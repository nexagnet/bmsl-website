import { getPayload } from 'payload';
import config from '../../../src/payload.config';
import manifest from '../../../src/migration/legacy-manifest.json';
import { runLegacyImport } from '../../../src/migration/importer';
import { JOBS, MARKERS, STORED_LEGACY_SLUG } from './markers';

// Fixture runtime for tests/integration/http-smoke.test.ts, executed as a short-lived subprocess:
//   pnpm exec payload run tests/integration/support/smoke-fixture.ts   (SMOKE_FIXTURE_CMD=seed|revoke)
// It owns its Payload instance and PostgreSQL pool and ends with process.exit, so the operating system closes every
// connection it opened. (@payloadcms/db-postgres' destroy() resets Payload state but never calls pool.end(), and the
// adapter keeps one reserved client for its lifetime, so an in-process fixture could not release its own pool.)
// It refuses to touch any database that is not the smoke test's disposable one. Synthetic data only.

const url = new URL(process.env.DATABASE_URL ?? 'postgresql://invalid');
if (!['localhost', '127.0.0.1', '::1', '[::1]'].includes(url.hostname) || !/^\/bmsl_http_smoke_[0-9a-f]{12}$/.test(url.pathname)) {
  throw new Error('smoke fixture refuses to run against anything but the disposable smoke database');
}

const png = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
  'base64',
);
// A minimal but structurally valid PDF (header, xref table, %%EOF) as accepted by Payload's PDF integrity check.
const pdf = Buffer.from(
  '%PDF-1.4\n1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n2 0 obj\n<< /Type /Pages /Kids [] /Count 0 >>\nendobj\n' +
    'xref\n0 3\n0000000000 65535 f \n0000000009 00000 n \n0000000058 00000 n \ntrailer\n<< /Size 3 /Root 1 0 R >>\nstartxref\n110\n%%EOF\n',
  'latin1',
);
const approved = { contentApproved: true, approvedBy: 'synthetic approver', approvedAt: '2026-01-01' };

let exitCode = 0;
const payload = await getPayload({ config });
try {
  const cmd = process.env.SMOKE_FIXTURE_CMD;
  let result: unknown;

  if (cmd === 'seed') {
    await payload.db.migrate();
    const byId = (id: number) => manifest.entries.find((e) => e.id === id)!.legacyPath;
    const report = await runLegacyImport(payload, {
      write: true,
      externalInput: {
        articles: [
          { legacyUrl: byId(3), title: 'Synthetic smoke draft article', paragraphs: ['Synthetic paragraph.'], approval: approved },
          { legacyUrl: byId(4), title: 'Synthetic smoke draft service article', approval: approved },
        ],
      },
    });
    if (report.created.length !== 19 || report.rejected.length > 0) {
      throw new Error('synthetic import did not create the expected drafts');
    }

    const upload = (name: string, rights: 'APPROVED' | 'UNCONFIRMED') =>
      payload.create({
        collection: 'media-assets',
        data: { alt: `synthetic ${name}`, rightsStatus: rights, source: MARKERS.mediaSource },
        file: { data: png, mimetype: 'image/png', name: `${name}.png`, size: png.length },
      });
    const ok = await upload('smoke-approved', 'APPROVED');
    const blocked = await upload('smoke-unconfirmed', 'UNCONFIRMED');
    const uploadPdf = (name: string, rights: 'APPROVED' | 'UNCONFIRMED') =>
      payload.create({
        collection: 'media-assets',
        data: { alt: `synthetic ${name}`, rightsStatus: rights, source: MARKERS.mediaSource },
        file: { data: pdf, mimetype: 'application/pdf', name: `${name}.pdf`, size: pdf.length },
      });
    const okPdf = await uploadPdf('smoke-approved-doc', 'APPROVED');
    const blockedPdf = await uploadPdf('smoke-unconfirmed-doc', 'UNCONFIRMED');

    // Positive control: a CONFIRMED, published project that really renders from this database, with both media.
    // (Only CONFIRMED projects can be published; the imported legacy profiles stay drafts.)
    const project = await payload.create({
      collection: 'projects',
      data: {
        name: 'Synthetic Smoke Published Project',
        slug: 'synthetic-smoke-published',
        summary: MARKERS.publicSummary,
        sourceStatus: 'CONFIRMED',
        legacyUrls: [{ url: MARKERS.legacyUrl }],
        images: [ok.id, blocked.id],
        _status: 'published',
      },
    });
    // A newer PRIVATE draft of the published record: the published version must stay what the public sees.
    await payload.update({
      collection: 'projects',
      id: project.id,
      data: { summary: MARKERS.draftSummary },
      draft: true,
    });
    // Approved positive control for customer facts: CONFIRMED source, approved BQT feedback.
    await payload.create({
      collection: 'projects',
      data: {
        name: 'Synthetic Smoke Confirmed Project',
        slug: 'synthetic-smoke-confirmed',
        sourceStatus: 'CONFIRMED',
        address: MARKERS.confirmedAddress,
        bqtFeedback: { text: MARKERS.confirmedFeedback, approvedBySource: true },
        _status: 'published',
      },
    });
    // Created CONFIRMED + published (the only way the CMS allows); the test then downgrades its stored sourceStatus
    // with SQL to simulate data that predates the publication gate. REST and pages must hide it.
    await payload.create({
      collection: 'projects',
      data: {
        name: 'Synthetic Smoke Stored Legacy Project',
        slug: STORED_LEGACY_SLUG,
        summary: MARKERS.storedLegacySummary,
        sourceStatus: 'CONFIRMED',
        _status: 'published',
      },
    });
    // Recruitment (W5B3): only the CONFIRMED job with an operator-entered date and location may emit JobPosting.
    const body = (t: string) => ({
      root: {
        type: 'root',
        format: '',
        indent: 0,
        version: 1,
        direction: 'ltr' as const,
        children: [
          {
            type: 'paragraph',
            format: '',
            indent: 0,
            version: 1,
            direction: 'ltr' as const,
            children: [{ type: 'text', text: t, version: 1, detail: 0, format: 0, mode: 'normal', style: '' }],
          },
        ],
      },
    });
    const location = { addressLocality: JOBS.locality, addressCountry: JOBS.country };
    const job = (slug: string, extra: Record<string, unknown>) =>
      payload.create({
        collection: 'job-postings',
        data: {
          title: `Synthetic ${slug}`,
          slug,
          description: body(`Synthetic description ${slug}`),
          applyInstruction: 'Synthetic apply instruction',
          _status: 'published',
          ...extra,
        } as never,
      });
    await job(JOBS.confirmed, { sourceStatus: 'CONFIRMED', datePosted: JOBS.datePosted, jobLocation: location });
    await job(JOBS.unconfirmed, { sourceStatus: 'LEGACY-SOURCE', datePosted: JOBS.datePosted, jobLocation: location });
    await job(JOBS.noLocation, { sourceStatus: 'CONFIRMED', datePosted: JOBS.datePosted });
    await job(JOBS.noDate, { sourceStatus: 'CONFIRMED', jobLocation: location });
    await job(JOBS.draft, { sourceStatus: 'CONFIRMED', datePosted: JOBS.datePosted, jobLocation: location, _status: 'draft' });
    // Documents: approved file is the positive control, UNCONFIRMED file must stay hidden.
    await payload.create({
      collection: 'documents',
      data: { title: 'Synthetic Smoke Approved Document', file: okPdf.id, _status: 'published' },
    });
    await payload.create({
      collection: 'documents',
      data: { title: 'Synthetic Smoke Hidden Document', file: blockedPdf.id, _status: 'published' },
    });
    // Published singleton with a newer private draft.
    await payload.updateGlobal({ slug: 'about-page', data: { title: MARKERS.publicAbout, _status: 'published' } });
    await payload.updateGlobal({ slug: 'about-page', data: { title: MARKERS.draftAbout }, draft: true });

    // Published settings: ID-only, analytics explicitly off (default), valid hotline.
    await payload.updateGlobal({
      slug: 'site-settings',
      data: { ga4Id: 'G-ABC123DEF4', analyticsEnabled: false, contact: { hotline: '0900 000 000' }, _status: 'published' },
    });
    await payload.updateGlobal({
      slug: 'site-settings',
      data: { contact: { hotline: MARKERS.draftHotline } },
      draft: true,
    });
    // A published noindex singleton must be left out of the sitemap.
    await payload.updateGlobal({
      slug: 'contact-page',
      data: { title: 'Liên hệ', seo: { noindex: true }, _status: 'published' },
    });

    result = {
      approved: { id: ok.id, filename: ok.filename, url: ok.url },
      unconfirmed: { id: blocked.id, filename: blocked.filename, url: blocked.url },
      approvedPdf: { id: okPdf.id, filename: okPdf.filename, url: okPdf.url },
      unconfirmedPdf: { id: blockedPdf.id, filename: blockedPdf.filename, url: blockedPdf.url },
      projectId: project.id,
    };
  } else if (cmd === 'revoke') {
    const id = Number(process.env.SMOKE_FIXTURE_MEDIA_ID);
    if (!Number.isInteger(id)) throw new Error('SMOKE_FIXTURE_MEDIA_ID is required');
    const revoked = await payload.update({ collection: 'media-assets', id, data: { rightsStatus: 'UNCONFIRMED' } });
    result = { id: revoked.id, rightsStatus: revoked.rightsStatus };
  } else {
    throw new Error(`unknown SMOKE_FIXTURE_CMD ${String(cmd)}`);
  }

  console.log(`FIXTURE_RESULT:${JSON.stringify(result)}`);
} catch (error) {
  console.error(error instanceof Error ? (error.stack ?? error.message) : error);
  exitCode = 1;
} finally {
  await payload.destroy();
}
process.exit(exitCode);
