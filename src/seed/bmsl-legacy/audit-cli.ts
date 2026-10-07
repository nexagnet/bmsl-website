import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { auditSource, renderAuditReport, renderLedgerCsv } from './audit';
import type { Manifest, ProjectRecord } from './pack';
import { loadSnapshot, reportedTotal } from './source-fetch';

// EXPLICIT, network-using, READ-ONLY step (Issue #80): re-reads the public legacy site and compares it with the committed
// seed pack, then rewrites the two audit documents. It never changes the pack, never touches a database or a volume.
//   pnpm seed:bmsl-legacy:audit            (--check = verify only, write nothing; exit 1 on any discrepancy)
// Only https://binhminhsonglo.vn is contacted, through the same bounded/backoff reader as the generator.

const REPO_ROOT = path.resolve(import.meta.dirname, '../../..');
const PACK_DIR = path.join(REPO_ROOT, 'src/seed/bmsl-legacy');
const DOCS = path.join(REPO_ROOT, 'docs/migration');

try {
  const check = process.argv.slice(2).includes('--check');
  const manifest = JSON.parse(readFileSync(path.join(PACK_DIR, 'manifest.json'), 'utf8')) as Manifest;
  const { records: projects } = JSON.parse(readFileSync(path.join(PACK_DIR, 'records/projects.json'), 'utf8')) as { records: ProjectRecord[] };

  console.log('Reading the public legacy site (read-only)...');
  const snapshot = await loadSnapshot();
  const mediaReported = await reportedTotal('media');
  console.log(`  ${snapshot.posts.length} posts, ${snapshot.pages.length} pages, ${snapshot.media.length}/${mediaReported ?? '?'} media, ${snapshot.sitemapUrls.length} sitemap URLs`);

  const result = auditSource({
    snapshot,
    manifest,
    projects,
    mediaReported,
    readAsset: (file) => {
      try {
        return readFileSync(path.join(PACK_DIR, file));
      } catch {
        return undefined;
      }
    },
  });

  if (!check) {
    mkdirSync(DOCS, { recursive: true });
    writeFileSync(path.join(DOCS, 'w80-source-fidelity-audit.md'), renderAuditReport(result));
    writeFileSync(path.join(DOCS, 'w80-image-ledger.csv'), renderLedgerCsv(result));
    console.log('Wrote docs/migration/w80-source-fidelity-audit.md and docs/migration/w80-image-ledger.csv');
  }
  const c = result.counts;
  console.log(`Images: ${c.imageUrlsFound} URLs = ${c.committedUrls} committed (${c.committedFiles} files) + ${c.pendingRights} pending + ${c.externalHost} third-party host + ${c.unfetchable} unfetchable + ${c.unaccounted} unaccounted; ${c.libraryOnly} library-only`);
  if (result.problems.length) {
    console.error(`${result.problems.length} discrepancy(ies) between the legacy site and the seed pack:`);
    for (const p of result.problems) console.error(`  - ${p}`);
    process.exit(1);
  }
  console.log('No discrepancy between the legacy site and the seed pack.');
  process.exit(0);
} catch (error) {
  const cause = (error as { cause?: { code?: string; message?: string } }).cause;
  console.error(`Audit aborted: ${(error as Error).message}${cause ? ` (${cause.code ?? cause.message})` : ''}`);
  process.exit(2);
}
