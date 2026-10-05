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
      data: { name: 'Edited by editor', summary: 'Edited summary', _status: 'published' },
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
