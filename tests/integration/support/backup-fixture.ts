import fs from 'node:fs';
import path from 'node:path';
import { getPayload } from 'payload';
import config from '../../../src/payload.config';
import { createContactLead } from '../../../src/lib/contact-lead';

// Fixture runtime for tests/integration/backup-restore.test.ts, executed as a short-lived subprocess:
//   pnpm exec payload run tests/integration/support/backup-fixture.ts   (BKP_FIXTURE_CMD=seed|use-restored)
// It owns its Payload instance and PostgreSQL pool and ends with process.exit, so the operating system closes every
// connection it opened (@payloadcms/db-postgres destroy() resets Payload state but never calls pool.end()). The caller
// runs it as an invocation-owned process group and then asks PostgreSQL itself whether any session is left.
// It refuses any database that is not one of the backup test's disposable databases. Synthetic data only.

const url = new URL(process.env.DATABASE_URL ?? 'postgresql://invalid');
const name = decodeURIComponent(url.pathname.replace(/^\//, ''));
if (!['localhost', '127.0.0.1', '::1', '[::1]'].includes(url.hostname) || !/^bmsl_(bkp_src|restore)_[0-9a-f]{12,16}$/.test(name)) {
  throw new Error('backup fixture refuses to run against anything but a disposable backup-test database');
}
const mediaDir = process.env.BMSL_MEDIA_DIR;
if (!mediaDir || !path.isAbsolute(mediaDir)) throw new Error('BMSL_MEDIA_DIR (absolute) is required');

// Same constants as tests/integration/backup-restore.test.ts (a payload-run script cannot be imported).
const LEAD_EMAIL = 'synthetic-backup-lead@example.invalid';
const PROJECT_SLUG = 'synthetic-backup-project';
const DOCUMENT_TITLE = 'Synthetic Backup Document';

const png = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
  'base64',
);
const pdf = Buffer.from(
  '%PDF-1.4\n1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n2 0 obj\n<< /Type /Pages /Kids [] /Count 0 >>\nendobj\n' +
    'xref\n0 3\n0000000000 65535 f \n0000000009 00000 n \n0000000058 00000 n \ntrailer\n<< /Size 3 /Root 1 0 R >>\nstartxref\n110\n%%EOF\n',
  'latin1',
);

let exitCode = 0;
const payload = await getPayload({ config });
try {
  const cmd = process.env.BKP_FIXTURE_CMD;
  let result: unknown;
  if (cmd === 'seed') {
    await payload.db.migrate();
    const upload = (file: string, data: Buffer, mimetype: string, rights: 'APPROVED' | 'UNCONFIRMED') =>
      payload.create({
        collection: 'media-assets',
        data: { alt: `synthetic ${file}`, rightsStatus: rights, source: 'synthetic backup fixture' },
        file: { data, mimetype, name: file, size: data.length },
      });
    const cover = await upload('synthetic-backup-cover.png', png, 'image/png', 'APPROVED');
    const gallery = await upload('synthetic-backup-gallery.png', png, 'image/png', 'APPROVED');
    const file = await upload('synthetic-backup-file.pdf', pdf, 'application/pdf', 'APPROVED');
    const project = await payload.create({
      collection: 'projects',
      data: {
        name: 'Synthetic Backup Project',
        slug: PROJECT_SLUG,
        summary: 'Synthetic summary for the backup proof.',
        sourceStatus: 'CONFIRMED',
        images: [cover.id, gallery.id],
        _status: 'published',
      },
    });
    const document = await payload.create({
      collection: 'documents',
      data: { title: DOCUMENT_TITLE, file: file.id, _status: 'published' },
    });
    const lead = await createContactLead(payload, {
      name: 'Synthetic Backup Lead',
      phone: '0900000099',
      email: LEAD_EMAIL,
      requestType: 'khao-sat',
      message: 'Synthetic lead that must survive backup and restore.',
      consent: true,
      sourcePage: '/lien-he',
      utm: { utm_source: 'synthetic' },
    });
    // A generated/derived file the media directory may contain next to the originals (nested path on purpose).
    fs.mkdirSync(path.join(mediaDir, 'generated'), { recursive: true });
    fs.writeFileSync(path.join(mediaDir, 'generated', 'synthetic-derived.bin'), Buffer.from('synthetic derived media bytes'));
    result = {
      leadId: lead.id,
      projectId: project.id,
      documentId: document.id,
      mediaFiles: [cover.filename, gallery.filename, file.filename],
    };
  } else if (cmd === 'use-restored') {
    // The restored database must be usable by the real application stack: the lead is there, the project still resolves
    // its media relationships (depth 1), the document resolves its file, and the id sequences still allocate new ids.
    const leads = await payload.find({ collection: 'contact-leads', where: { email: { equals: LEAD_EMAIL } }, overrideAccess: true, depth: 0 });
    const projects = await payload.find({ collection: 'projects', where: { slug: { equals: PROJECT_SLUG } }, overrideAccess: true, depth: 1 });
    const documents = await payload.find({ collection: 'documents', where: { title: { equals: DOCUMENT_TITLE } }, overrideAccess: true, depth: 1 });
    const lead = leads.docs[0];
    const project = projects.docs[0] as unknown as { id: number; images: { id: number; filename: string }[] } | undefined;
    const document = documents.docs[0] as unknown as { id: number; file: { id: number; filename: string } } | undefined;
    if (leads.totalDocs !== 1 || !lead || !project || !document) throw new Error('restored database is missing the synthetic lead, project or document');
    const next = await createContactLead(payload, {
      name: 'Synthetic Post-Restore Lead',
      phone: '0900000098',
      requestType: 'khac',
      message: 'Created after restore to prove the sequences and persistence still work.',
      consent: true,
      sourcePage: '/lien-he',
    });
    result = {
      leadId: lead.id,
      leadName: lead.name,
      projectId: project.id,
      projectMedia: project.images.map((m) => m.filename),
      documentId: document.id,
      documentFile: document.file.filename,
      newLeadId: next.id,
    };
  } else {
    throw new Error(`unknown BKP_FIXTURE_CMD ${String(cmd)}`);
  }
  console.log(`\nFIXTURE_RESULT:${JSON.stringify(result)}`); // leading newline: never glued to an unterminated log fragment
} catch (error) {
  console.error(error instanceof Error ? (error.stack ?? error.message) : error);
  exitCode = 1;
} finally {
  await payload.destroy();
}
process.exit(exitCode);
