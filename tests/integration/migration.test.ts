import pg from 'pg';
import type { Payload } from 'payload';
import { getPayload } from 'payload';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { getDatabaseUrl } from '../../src/lib/database';
import { toArticle, toProject } from '../../src/lib/public-content';
import manifest from '../../src/migration/legacy-manifest.json';
import { runLegacyImport } from '../../src/migration/importer';

// Synthetic data only; the disposable local database is reset by this file.
process.env.PAYLOAD_SECRET ??= 'synthetic-integration-secret';
const databaseUrl = getDatabaseUrl();
const host = new URL(databaseUrl).hostname;
if (!['localhost', '127.0.0.1', '::1', '[::1]'].includes(host)) {
  throw new Error(`Refusing to reset a non-local database (${host})`);
}

const PUBLIC = { overrideAccess: false, depth: 2, draft: false } as const;
const approved = { contentApproved: true, approvedBy: 'synthetic approver', approvedAt: '2026-01-01' };
const articleUrl = '/xu-huong-phat-trien-nganh-dich-vu-bao-ve-co-hoi-va-thach-thuc/';

let payload: Payload;
const pool = new pg.Pool({ connectionString: databaseUrl });

beforeAll(async () => {
  await pool.query('drop schema if exists public cascade; create schema public;');
  const { default: config } = await import('../../src/payload.config');
  payload = await getPayload({ config });
  await payload.db.migrate();
});

afterAll(async () => {
  await payload?.destroy();
  await pool.end();
});

beforeEach(async () => {
  for (const collection of ['projects', 'articles', 'article-categories', 'media-assets'] as const) {
    await payload.delete({ collection, where: { id: { exists: true } } });
  }
});

const count = async (collection: 'projects' | 'articles' | 'media-assets') =>
  (await payload.find({ collection, draft: true, limit: 1, depth: 0 })).totalDocs;

describe('legacy importer: projects', () => {
  it('dry-run is the default and writes nothing', async () => {
    const report = await runLegacyImport(payload, {});
    expect(report.mode).toBe('dry-run');
    expect(report.created).toHaveLength(17);
    expect(await count('projects')).toBe(0);
    expect(await count('articles')).toBe(0);
  });

  it('write mode creates 17 draft profiles preserving all 18 legacy sources', async () => {
    const report = await runLegacyImport(payload, { write: true });
    expect(report.mode).toBe('write');
    expect(report.created).toHaveLength(17);
    expect(report.conflicts).toEqual([]);

    const all = await payload.find({ collection: 'projects', draft: true, limit: 100, depth: 0 });
    expect(all.totalDocs).toBe(17);
    const urls = all.docs.flatMap((d) => (d.legacyUrls ?? []).map((u: { url: string }) => u.url));
    const projectSources = manifest.entries.filter((e) => e.kind === 'project').map((e) => e.legacyPath);
    expect(urls.sort()).toEqual([...projectSources].sort());
    expect(urls).toHaveLength(18);

    const hv = all.docs.find((d) => d.slug === 'hoc-vien-quoc-phong');
    expect(hv?.legacyUrls?.map((u: { url: string }) => u.url).sort()).toEqual([
      '/chung-cu-hoc-vien-quoc-phong-dang-van-hanh-2/',
      '/chung-cu-hoc-vien-quoc-phong-dang-van-hanh/',
    ]);
    expect(all.docs.some((d) => d.slug.includes('354'))).toBe(false);

    for (const d of all.docs) {
      expect(d._status).toBe('draft');
      expect(d.sourceStatus).toBe('LEGACY-SOURCE');
      expect(d.address ?? null).toBeNull();
      expect(d.scale ?? null).toBeNull();
      expect(d.operatingSince ?? null).toBeNull();
      expect(d.services ?? []).toHaveLength(0);
      expect(d.images ?? []).toHaveLength(0);
    }
    expect(report.pendingApprovals.length).toBeGreaterThanOrEqual(17);
  });

  it('imported drafts never reach the public read path', async () => {
    await runLegacyImport(payload, { write: true });
    const list = await payload.find({ collection: 'projects', limit: 50, ...PUBLIC });
    expect(list.totalDocs).toBe(0);
    expect(list.docs.map(toProject).filter(Boolean)).toEqual([]);
  });

  it('rerun is idempotent: nothing created twice, everything skipped', async () => {
    await runLegacyImport(payload, { write: true });
    const again = await runLegacyImport(payload, { write: true });
    expect(again.created).toEqual([]);
    expect(again.skipped).toHaveLength(17);
    expect(again.conflicts).toEqual([]);
    expect(await count('projects')).toBe(17);
  });

  it('preserves manual edits and published state on rerun', async () => {
    await runLegacyImport(payload, { write: true });
    const found = await payload.find({ collection: 'projects', where: { slug: { equals: 'jsc34' } }, draft: true, limit: 1 });
    await payload.update({
      collection: 'projects',
      id: found.docs[0].id,
      // Publishing needs sourceStatus CONFIRMED (a legacy profile cannot be published as it is: see cms.test.ts).
      data: { name: 'Edited by editor', summary: 'Edited summary', sourceStatus: 'CONFIRMED', _status: 'published' },
    });

    const again = await runLegacyImport(payload, { write: true });
    expect(again.created).toEqual([]);
    const after = await payload.find({ collection: 'projects', where: { slug: { equals: 'jsc34' } }, limit: 1, ...PUBLIC });
    expect(after.docs[0].name).toBe('Edited by editor');
    expect(after.docs[0].summary).toBe('Edited summary');
    expect(after.docs[0]._status).toBe('published');
    expect(await count('projects')).toBe(17);
  });

  it('reports a conflict (and changes nothing) when a slug is taken by an unrelated record', async () => {
    await payload.create({
      collection: 'projects',
      data: { name: 'Manually created', slug: 'ecolife-tay-ho', legacyUrls: [{ url: '/something-else/' }] },
      draft: true,
    });
    const report = await runLegacyImport(payload, { write: true });
    expect(report.conflicts.map((c) => c.slug)).toEqual(['ecolife-tay-ho']);
    expect(report.created).toHaveLength(16);
    const doc = await payload.find({ collection: 'projects', where: { slug: { equals: 'ecolife-tay-ho' } }, draft: true, limit: 1 });
    expect(doc.docs[0].name).toBe('Manually created');
  });
});

describe('legacy importer: approved external articles', () => {
  const input = { articles: [{ legacyUrl: articleUrl, title: 'Synthetic article', paragraphs: ['Synthetic paragraph.'], approval: approved }] };

  it('imports approved external articles as draft without forcing a category', async () => {
    const report = await runLegacyImport(payload, { write: true, externalInput: input });
    expect(report.created.filter((c) => c.collection === 'articles')).toHaveLength(1);
    const found = await payload.find({ collection: 'articles', draft: true, limit: 5, depth: 0 });
    expect(found.totalDocs).toBe(1);
    expect(found.docs[0]._status).toBe('draft');
    expect(found.docs[0].legacyUrl).toBe(articleUrl);
    expect(found.docs[0].category ?? null).toBeNull();
    expect(found.docs[0].cover ?? null).toBeNull();
    expect(await count('media-assets')).toBe(0);
    expect(await count('articles')).toBe(1);
    expect((await payload.find({ collection: 'article-categories', draft: true, limit: 1 })).totalDocs).toBe(0);
    const pub = await payload.find({ collection: 'articles', limit: 5, ...PUBLIC });
    expect(pub.docs.map(toArticle).filter(Boolean)).toEqual([]);
  });

  it('dry-run writes no articles, rerun is idempotent and preserves manual edits', async () => {
    const dry = await runLegacyImport(payload, { externalInput: input });
    expect(dry.created.some((c) => c.collection === 'articles')).toBe(true);
    expect(await count('articles')).toBe(0);

    await runLegacyImport(payload, { write: true, externalInput: input });
    const found = await payload.find({ collection: 'articles', draft: true, limit: 1 });
    await payload.update({ collection: 'articles', id: found.docs[0].id, data: { title: 'Edited title' } , draft: true });
    const again = await runLegacyImport(payload, { write: true, externalInput: input });
    expect(again.created.filter((c) => c.collection === 'articles')).toEqual([]);
    expect(again.skipped.some((s) => s.collection === 'articles')).toBe(true);
    const after = await payload.find({ collection: 'articles', draft: true, limit: 5 });
    expect(after.totalDocs).toBe(1);
    expect(after.docs[0].title).toBe('Edited title');
  });

  it('does not import unapproved input; it appears in pending approvals', async () => {
    const report = await runLegacyImport(payload, {
      write: true,
      externalInput: { articles: [{ legacyUrl: articleUrl, title: 'Unapproved' }] },
    });
    expect(await count('articles')).toBe(0);
    expect(report.pendingApprovals.some((p) => p.legacyUrl === articleUrl)).toBe(true);
  });

  it('reports a conflict instead of overwriting an unrelated article with the same slug', async () => {
    await payload.create({ collection: 'articles', data: { title: 'Mine', slug: 'xu-huong-phat-trien-nganh-dich-vu-bao-ve-co-hoi-va-thach-thuc' }, draft: true });
    const report = await runLegacyImport(payload, { write: true, externalInput: input });
    expect(report.conflicts.some((c) => c.collection === 'articles')).toBe(true);
    const found = await payload.find({ collection: 'articles', draft: true, limit: 5 });
    expect(found.totalDocs).toBe(1);
    expect(found.docs[0].title).toBe('Mine');
  });

  it('never invents a category: an unknown categorySlug is reported, not created or forced', async () => {
    const report = await runLegacyImport(payload, {
      write: true,
      externalInput: { articles: [{ ...input.articles[0], categorySlug: 'tin-cong-ty' }] },
    });
    expect(report.created.some((c) => c.collection === 'articles')).toBe(true);
    expect((await payload.find({ collection: 'article-categories', draft: true, limit: 1 })).totalDocs).toBe(0);
    const found = await payload.find({ collection: 'articles', draft: true, limit: 1, depth: 0 });
    expect(found.docs[0].category ?? null).toBeNull();
    expect(report.pendingApprovals.some((p) => p.needs.includes('category'))).toBe(true);
  });
});

describe('legacy importer: batch validation, slug reservation and optional candidates', () => {
  const articleSources = manifest.entries.filter((e) => e.kind === 'article');
  const itemFor = (legacyUrl: string, extra: Record<string, unknown> = {}) => ({
    legacyUrl,
    title: `Synthetic ${legacyUrl}`,
    paragraphs: ['Synthetic paragraph.'],
    approval: approved,
    ...extra,
  });
  const withoutMode = <T extends { mode: string }>(r: T) => ({ ...r, mode: undefined });

  it('invalid root creates neither projects nor articles, in write mode', async () => {
    for (const bad of [{ articles: 'bad' }, { articles: [], unexpected: true }, null, []]) {
      await expect(runLegacyImport(payload, { write: true, externalInput: bad })).rejects.toThrow();
      expect(await count('projects')).toBe(0);
      expect(await count('articles')).toBe(0);
    }
  });

  it('two sources with the same slug: one created, one reported conflict, dry-run and write agree, no DB error', async () => {
    const [a, b] = articleSources;
    const externalInput = { articles: [itemFor(a.legacyPath, { slug: 'synthetic-same-slug' }), itemFor(b.legacyPath, { slug: 'synthetic-same-slug' })] };
    const dry = await runLegacyImport(payload, { externalInput });
    expect(await count('articles')).toBe(0);
    const written = await runLegacyImport(payload, { write: true, externalInput });

    expect(withoutMode(written)).toEqual(withoutMode(dry));
    expect(written.created.filter((c) => c.collection === 'articles').map((c) => c.legacyUrls)).toEqual([[a.legacyPath]]);
    expect(written.conflicts.filter((c) => c.collection === 'articles')).toHaveLength(1);
    expect(written.conflicts.find((c) => c.collection === 'articles')?.slug).toBe('synthetic-same-slug');
    expect(await count('articles')).toBe(1);
    const found = await payload.find({ collection: 'articles', draft: true, limit: 5, depth: 0 });
    expect(found.docs[0].legacyUrl).toBe(a.legacyPath);

    // Rerun: nothing new, first record preserved including a manual edit, conflict still reported.
    await payload.update({ collection: 'articles', id: found.docs[0].id, data: { title: 'Edited by editor' }, draft: true });
    const again = await runLegacyImport(payload, { write: true, externalInput });
    expect(again.created.filter((c) => c.collection === 'articles')).toEqual([]);
    expect(again.skipped.filter((s) => s.collection === 'articles')).toHaveLength(1);
    expect(again.conflicts.filter((c) => c.collection === 'articles')).toHaveLength(1);
    const after = await payload.find({ collection: 'articles', draft: true, limit: 5, depth: 0 });
    expect(after.totalDocs).toBe(1);
    expect(after.docs[0].title).toBe('Edited by editor');
  });

  it('a batch slug that equals an existing manual article is a conflict and the manual record is preserved', async () => {
    await payload.create({ collection: 'articles', data: { title: 'Manual', slug: 'synthetic-manual' }, draft: true });
    const [a, b] = articleSources;
    const externalInput = { articles: [itemFor(a.legacyPath, { slug: 'synthetic-manual' }), itemFor(b.legacyPath)] };
    const dry = await runLegacyImport(payload, { externalInput });
    const written = await runLegacyImport(payload, { write: true, externalInput });
    expect(withoutMode(written)).toEqual(withoutMode(dry));
    expect(written.conflicts.map((c) => c.slug)).toEqual(['synthetic-manual']);
    expect(await count('articles')).toBe(2);
    const manual = await payload.find({ collection: 'articles', where: { slug: { equals: 'synthetic-manual' } }, draft: true, limit: 1 });
    expect(manual.docs[0].title).toBe('Manual');
  });

  it('imports the listed candidates #4 (service) and #31 (About) as drafts; the redirect map is not changed', async () => {
    const byId = (id: number) => manifest.entries.find((e) => e.id === id)!;
    const externalInput = { articles: [itemFor(byId(4).legacyPath), itemFor(byId(31).legacyPath)] };
    const report = await runLegacyImport(payload, { write: true, externalInput });
    expect(report.rejected).toEqual([]);
    expect(report.created.filter((c) => c.collection === 'articles')).toHaveLength(2);
    const found = await payload.find({ collection: 'articles', draft: true, limit: 5, depth: 0 });
    expect(found.docs.map((d) => d._status)).toEqual(['draft', 'draft']);
    const pub = await payload.find({ collection: 'articles', limit: 5, ...PUBLIC });
    expect(pub.docs.map(toArticle).filter(Boolean)).toEqual([]);
    expect(byId(4)).toMatchObject({ disposition: 'redirect', activeTarget: '/dich-vu' });
    expect(byId(31)).toMatchObject({ disposition: 'redirect', activeTarget: '/gioi-thieu' });
    // A non-listed kind is still rejected.
    const rejected = await runLegacyImport(payload, { externalInput: { articles: [itemFor('/chung-cu-ecolife-tay-ho-dang-van-hanh/')] } });
    expect(rejected.rejected).toHaveLength(1);
  });

  it('reports the article batch against the <=10 handover acceptance without capping the import', async () => {
    const items = articleSources.slice(0, 11).map((e) => itemFor(e.legacyPath, { slug: `synthetic-${e.id}` }));
    expect(items).toHaveLength(11);
    const report = await runLegacyImport(payload, { write: true, externalInput: { articles: items } });
    expect(report.created.filter((c) => c.collection === 'articles')).toHaveLength(11);
    expect(report.articleSelection).toMatchObject({ initialHandoverMax: 10, approvedInBatch: 11, withinInitialHandover: false, selectionApproved: false });
    expect(await count('articles')).toBe(11);
    const none = await runLegacyImport(payload, {});
    expect(none.articleSelection).toMatchObject({ approvedInBatch: 0, withinInitialHandover: true, selectionApproved: false });
  });
});
