import { getPayload } from 'payload';
import config from '../../../src/payload.config';
import manifest from '../../../src/migration/legacy-manifest.json';
import { runLegacyImport } from '../../../src/migration/importer';

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
        data: { alt: `synthetic ${name}`, rightsStatus: rights },
        file: { data: png, mimetype: 'image/png', name: `${name}.png`, size: png.length },
      });
    const ok = await upload('smoke-approved', 'APPROVED');
    const blocked = await upload('smoke-unconfirmed', 'UNCONFIRMED');

    // Positive control: a published project that really renders from this database, with both media.
    await payload.create({
      collection: 'projects',
      data: {
        name: 'Synthetic Smoke Published Project',
        slug: 'synthetic-smoke-published',
        sourceStatus: 'LEGACY-SOURCE',
        images: [ok.id, blocked.id],
        _status: 'published',
      },
    });

    // Published settings: ID-only, analytics explicitly off (default), valid hotline.
    await payload.updateGlobal({
      slug: 'site-settings',
      data: { ga4Id: 'G-ABC123DEF4', analyticsEnabled: false, contact: { hotline: '0900 000 000' }, _status: 'published' },
    });
    // A published noindex singleton must be left out of the sitemap.
    await payload.updateGlobal({
      slug: 'contact-page',
      data: { title: 'Liên hệ', seo: { noindex: true }, _status: 'published' },
    });

    result = {
      approved: { id: ok.id, filename: ok.filename, url: ok.url },
      unconfirmed: { id: blocked.id, filename: blocked.filename, url: blocked.url },
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
