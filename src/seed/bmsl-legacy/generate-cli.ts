import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { buildPack, type ContentReviewFile, type ImageFetcher, type ReviewFile } from './generator';
import { MAX_ASSET_BYTES, PACK_FILES, packProblems } from './pack';
import { get, loadSnapshot } from './source-fetch';

// EXPLICIT, network-using step: re-reads the public legacy site and rewrites the committed seed pack.
//   pnpm seed:bmsl-legacy:generate --observed-at 2026-10-06
// Normal seeding NEVER runs this: the loader reads the committed pack offline. Only https://binhminhsonglo.vn is
// contacted (public WordPress REST + /wp-content/uploads images); other hosts are never fetched. Nothing here
// writes to a database. Image rights come only from review/image-review.json (unlisted images stay pending).

const REPO_ROOT = path.resolve(import.meta.dirname, '../../..');
const PACK_DIR = path.join(REPO_ROOT, 'src/seed/bmsl-legacy');
const REPORT = path.join(REPO_ROOT, 'docs/migration/w75-legacy-seed-report.md');

function parseArgs(argv: readonly string[]): { observedAt: string } {
  let observedAt: string | undefined;
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--observed-at') observedAt = argv[(i += 1)];
    else throw new Error(`Unknown argument: ${argv[i]}`);
  }
  if (!observedAt || !/^\d{4}-\d{2}-\d{2}$/.test(observedAt)) throw new Error('--observed-at YYYY-MM-DD is required (keeps the output deterministic)');
  return { observedAt };
}

const imageFailures: string[] = [];

async function fetchImageOnce(url: string): Promise<Buffer> {
  const res = await get(url, 'image');
  const type = (res.headers.get('content-type') ?? '').split(';')[0]!.trim().toLowerCase();
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  if (!['image/jpeg', 'image/png'].includes(type)) throw new Error(`unexpected content-type ${type}`);
  if (Number(res.headers.get('content-length') ?? '0') > MAX_ASSET_BYTES) throw new Error('larger than the 10 MB limit');
  const chunks: Buffer[] = [];
  let total = 0;
  for await (const chunk of res.body as unknown as AsyncIterable<Uint8Array>) {
    total += chunk.length;
    if (total > MAX_ASSET_BYTES) throw new Error('larger than the 10 MB limit');
    chunks.push(Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}

/**
 * Optional operator-side cache (BMSL_SEED_IMAGE_CACHE=<absolute dir>, outside the repository): a file already downloaded
 * from the same URL path is reused instead of fetched again. The bytes still go through the same type/size checks and
 * are hashed as usual; the cache only saves time on repeated runs.
 */
const cacheFile = (url: string): string | undefined => {
  const dir = process.env.BMSL_SEED_IMAGE_CACHE;
  if (!dir || !path.isAbsolute(dir)) return undefined;
  return path.join(dir, new URL(url).pathname.replace('/wp-content/uploads/', '').replace(/\//g, '__'));
};

/** Up to 4 attempts with backoff; a final failure is recorded and printed, never silently ignored. */
const fetchImage: ImageFetcher = async (url) => {
  const cached = cacheFile(url);
  if (cached && existsSync(cached)) return readFileSync(cached);
  let reason = 'unknown';
  for (let attempt = 1; attempt <= 4; attempt += 1) {
    try {
      const bytes = await fetchImageOnce(url);
      if (cached) {
        mkdirSync(path.dirname(cached), { recursive: true });
        writeFileSync(cached, bytes);
      }
      return bytes;
    } catch (error) {
      reason = (error as Error).message;
      if (/10 MB|content-type|HTTP 404/.test(reason)) break;
      await new Promise((resolve) => setTimeout(resolve, attempt * 1500));
    }
  }
  imageFailures.push(`${url} (${reason})`);
  return undefined;
};

const json = (value: unknown) => `${JSON.stringify(value, null, 2)}\n`;

try {
  const { observedAt } = parseArgs(process.argv.slice(2));
  const review = JSON.parse(readFileSync(path.join(PACK_DIR, 'review/image-review.json'), 'utf8')) as ReviewFile;
  const contentReview = JSON.parse(readFileSync(path.join(PACK_DIR, 'review/content-review.json'), 'utf8')) as ContentReviewFile;
  console.log('Reading the public legacy site (read-only)...');
  const snapshot = await loadSnapshot();
  console.log(`  ${snapshot.posts.length} posts, ${snapshot.pages.length} pages, ${snapshot.categories.length} categories, ${snapshot.sitemapUrls.length} sitemap URLs`);
  const { pack, assets, report } = await buildPack({ snapshot, fetchImage, review, contentReview, observedAt });
  if (imageFailures.length) {
    console.error(`${imageFailures.length} image(s) could not be fetched and stay pending:`);
    for (const f of imageFailures) console.error(`  - ${f}`);
    // A committed-class image that failed would silently change the pack: stop instead of writing a partial pack.
    const lost = pack.manifest.pendingMedia.filter((p) => ['BRAND', 'GRAPHIC', 'OBJECT', 'PROJECT_PHOTO'].includes(p.class));
    if (lost.length) throw new Error(`${lost.length} image(s) approved for the pack could not be fetched; re-run when the legacy site answers`);
  }

  // Fail closed: a pack that does not validate is never written.
  const problems = packProblems(pack, (file) => assets.get(file));
  if (problems.length) throw new Error(`Generated pack is invalid:\n- ${problems.join('\n- ')}`);

  mkdirSync(path.join(PACK_DIR, 'records'), { recursive: true });
  mkdirSync(path.join(PACK_DIR, 'assets'), { recursive: true });
  writeFileSync(path.join(PACK_DIR, PACK_FILES.manifest), json(pack.manifest));
  writeFileSync(path.join(PACK_DIR, PACK_FILES.serviceAreas), json({ records: pack.serviceAreas }));
  writeFileSync(path.join(PACK_DIR, PACK_FILES.projects), json({ records: pack.projects }));
  writeFileSync(path.join(PACK_DIR, PACK_FILES.articles), json({ records: pack.articles }));
  writeFileSync(path.join(PACK_DIR, PACK_FILES.globals), json({ records: pack.globals }));
  for (const [file, bytes] of assets) writeFileSync(path.join(PACK_DIR, file), bytes);
  // Remove only files this generator owns (assets/ of this pack) that are no longer part of the pack.
  for (const name of readdirSync(path.join(PACK_DIR, 'assets'))) if (!assets.has(`assets/${name}`)) rmSync(path.join(PACK_DIR, 'assets', name));
  mkdirSync(path.dirname(REPORT), { recursive: true });
  writeFileSync(REPORT, report);

  const c = pack.manifest.counts;
  console.log(`Pack written: ${c.projects} projects, ${c.articles} articles, ${c.serviceAreas} service areas, ${c.globals} globals`);
  console.log(
    `Images: ${c.imagesCommitted} committed (${((c.committedBytes ?? 0) / 1e6).toFixed(1)} MB), ${c.imagesPendingTotal} pending (${c.imagesPendingPerson} person, ${c.imagesPendingThirdParty} third-party, ${c.imagesPendingDocument} document, ${c.imagesPendingUnreviewed} unreviewed)`,
  );
  console.log(`Report: ${path.relative(REPO_ROOT, REPORT)}`);
  process.exit(0);
} catch (error) {
  const cause = (error as { cause?: { code?: string; message?: string } }).cause;
  console.error(`Generate aborted: ${(error as Error).message}${cause ? ` (${cause.code ?? cause.message})` : ''}`);
  process.exit(1);
}
