import { mkdtempSync, readdirSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import pg from 'pg';
import type { Payload } from 'payload';
import { getPayload } from 'payload';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { RichText } from '../../src/components/RichText';
import { getDatabaseUrl } from '../../src/lib/database';
import { toArticle, toPage, toProject } from '../../src/lib/public-content';
import { assertImportAllowed } from '../../src/migration/cli';
import { loadPack, runSeed, type LoadedPack, type SeedReport } from '../../src/seed/bmsl-legacy/loader';
import { uploadKeysOf } from '../../src/seed/bmsl-legacy/pack';

// Seed-in-code proof (Issue #75): a fresh, EMPTY, disposable PostgreSQL + an empty media directory are seeded from the
// COMMITTED pack only (no network). Real pack content is used for the seed; every other record here is synthetic.
process.env.PAYLOAD_SECRET ??= 'synthetic-integration-secret';
const databaseUrl = getDatabaseUrl();
const host = new URL(databaseUrl).hostname;
if (!['localhost', '127.0.0.1', '::1', '[::1]'].includes(host)) {
  throw new Error(`Refusing to reset a non-local database (${host})`);
}
// Must be set BEFORE the Payload config is imported: media-assets resolves its directory when the config loads.
const mediaDir = mkdtempSync(path.join(tmpdir(), 'bmsl-seed-media-'));
process.env.BMSL_MEDIA_DIR = mediaDir;

const PUBLIC = { overrideAccess: false, depth: 2, draft: false } as const;
const anonymous = { overrideAccess: false as const };
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGP4z8DwHwAFAAH/q842iQAAAABJRU5ErkJggg==', 'base64');

let payload: Payload;
let loaded: LoadedPack;
const pool = new pg.Pool({ connectionString: databaseUrl });
const filesInMedia = () => readdirSync(mediaDir).filter((f) => statSync(path.join(mediaDir, f)).isFile());
const count = async (collection: 'projects' | 'articles' | 'service-areas' | 'media-assets' | 'article-categories') =>
  (await payload.find({ collection, draft: true, limit: 1, depth: 0, overrideAccess: true })).totalDocs;
const counts = async () => ({
  areas: await count('service-areas'),
  media: await count('media-assets'),
  projects: await count('projects'),
  articles: await count('articles'),
});

beforeAll(async () => {
  await pool.query('drop schema if exists public cascade; create schema public;');
  const { default: config } = await import('../../src/payload.config');
  payload = await getPayload({ config });
  await payload.db.migrate();
  loaded = loadPack();
});

afterAll(async () => {
  await payload?.destroy();
  await pool.end();
  rmSync(mediaDir, { recursive: true, force: true });
});

describe('seed pack on a fresh empty database', () => {
  let conflictProjectId: number | string;
  let preexistingArticleId: number | string;
  const preexistingArticleTitle = 'Synthetic human edited title';
  let dry: SeedReport;
  let first: SeedReport;

  it('starts empty, then holds pre-existing synthetic content (one slug conflict, one already-seeded article)', async () => {
    for (const c of ['projects', 'articles', 'service-areas', 'media-assets', 'article-categories'] as const) expect(await count(c), c).toBe(0);
    const ecolife = loaded.pack.projects.find((p) => p.slug === 'ecolife-tay-ho')!;
    // A published, CONFIRMED sample project that owns a pack slug but has another legacy source: a conflict, never touched.
    const project = await payload.create({
      collection: 'projects',
      data: { name: 'Synthetic sample project', slug: ecolife.slug, sourceStatus: 'CONFIRMED', _status: 'published' },
    });
    conflictProjectId = project.id;
    // An article that already carries the pack's legacy URL (e.g. imported before): skipped, never modified.
    const existing = await payload.create({
      collection: 'articles',
      data: { title: preexistingArticleTitle, slug: 'synthetic-existing', legacyUrl: loaded.pack.articles[0]!.legacyUrl, _status: 'draft' },
      draft: true,
    });
    preexistingArticleId = existing.id;
  });

  it('--dry-run reads the committed pack offline and writes ZERO rows and ZERO files', async () => {
    const before = await counts();
    dry = await runSeed(payload, loaded, { write: false });
    expect(dry.mode).toBe('dry-run');
    expect(dry.conflicts.map((c) => `${c.collection}/${c.slug}`)).toEqual(['projects/ecolife-tay-ho']);
    expect(dry.skipped.map((s) => s.key)).toContain(loaded.pack.articles[0]!.key);
    expect(dry.created.length).toBeGreaterThan(30);
    expect(filesInMedia()).toHaveLength(0);
    expect(await counts()).toEqual(before);
    expect(((await payload.findGlobal({ slug: 'about-page', draft: true, depth: 0 })) as { title?: string }).title ?? '').toBe('');
  });

  it('--write seeds draft records and the image files from the pack; conflicts and existing records stay untouched', async () => {
    first = await runSeed(payload, loaded, { write: true });
    expect(first.mode).toBe('write');
    expect(first.created.map((c) => c.key)).toEqual(dry.created.map((c) => c.key));

    expect(await count('service-areas')).toBe(loaded.pack.serviceAreas.length);
    expect(await count('projects')).toBe(loaded.pack.projects.length); // seeded - 1 conflict + the pre-existing one
    expect(await count('articles')).toBe(loaded.pack.articles.length); // seeded - 1 skipped + the pre-existing one
    expect(await count('article-categories')).toBe(0); // taxonomy is an unresolved owner decision
    expect(first.media.created).toBeGreaterThan(30);
    expect(await count('media-assets')).toBe(first.media.created);
    expect(filesInMedia()).toHaveLength(first.media.created);
    for (const f of filesInMedia()) expect(statSync(path.join(mediaDir, f)).size).toBeGreaterThan(1000);

    // Pre-existing records are untouched.
    const conflict = await payload.findByID({ collection: 'projects', id: conflictProjectId, depth: 0 });
    expect(conflict).toMatchObject({ name: 'Synthetic sample project', sourceStatus: 'CONFIRMED', _status: 'published' });
    const existing = await payload.findByID({ collection: 'articles', id: preexistingArticleId, depth: 0, draft: true });
    expect(existing.title).toBe(preexistingArticleTitle);
  });

  it('everything created is a draft; projects are LEGACY-SOURCE; image rights are UNCONFIRMED; globals are unpublished', async () => {
    for (const collection of ['service-areas', 'projects', 'articles'] as const) {
      const published = await payload.find({ collection, draft: true, where: { _status: { equals: 'published' } }, limit: 5, depth: 0, overrideAccess: true });
      // Only the synthetic pre-existing published project may be published.
      expect(published.docs.map((d) => d.id), collection).toEqual(collection === 'projects' ? [conflictProjectId] : []);
    }
    const legacy = await payload.find({ collection: 'projects', draft: true, where: { sourceStatus: { equals: 'LEGACY-SOURCE' } }, limit: 100, depth: 0, overrideAccess: true });
    expect(legacy.totalDocs).toBe(loaded.pack.projects.length - 1);
    const rights = await payload.find({ collection: 'media-assets', where: { rightsStatus: { not_equals: 'UNCONFIRMED' } }, limit: 1, depth: 0, overrideAccess: true });
    expect(rights.totalDocs).toBe(0);
    for (const slug of ['about-page', 'contact-page'] as const) {
      const g = (await payload.findGlobal({ slug, draft: true, depth: 0 })) as { title?: string; _status?: string; body?: unknown };
      expect(g.title, slug).toBeTruthy();
      expect(g._status, slug).toBe('draft');
      expect(JSON.stringify(g.body), slug).toContain('"type":"paragraph"');
    }
    const settings = (await payload.findGlobal({ slug: 'site-settings', draft: true, depth: 0 })) as { contact?: Record<string, unknown>; analyticsEnabled?: boolean };
    expect(Object.values(settings.contact ?? {}).filter(Boolean)).toEqual([]);
    expect(settings.analyticsEnabled).not.toBe(true);
  });

  it('materializes editable CMS records with the source values, relations and in-body images in their positions', async () => {
    const bvId = (await payload.find({ collection: 'service-areas', where: { slug: { equals: 'bao-ve' } }, draft: true, depth: 0, overrideAccess: true })).docs[0]!.id;

    const bkhcn = (await payload.find({ collection: 'projects', where: { slug: { equals: 'bo-khoa-hoc-cong-nghe' } }, draft: true, depth: 1, overrideAccess: true })).docs[0]!;
    expect(bkhcn.address).toContain('Quan Hoa');
    expect(bkhcn.scale).toContain('90 căn hộ');
    expect((bkhcn.services as unknown as { id: number }[]).map((s) => s.id)).toContain(bvId);
    expect(bkhcn.legacyUrls?.[0]?.url).toBe('/chung-cu-bo-khoa-hoc-cong-nghe-dang-van-hanh/');
    expect(((bkhcn.images ?? []) as unknown[]).length).toBeGreaterThan(0);

    // An article with committed images: every upload node now points at a real media-assets document, in order.
    const source = loaded.pack.articles.find((a) => a.slug !== loaded.pack.articles[0]!.slug && uploadKeysOf(a.body).length >= 2)!;
    const article = (await payload.find({ collection: 'articles', where: { slug: { equals: source.slug } }, draft: true, depth: 1, overrideAccess: true })).docs[0]!;
    const stored = (article.body as unknown as { root: { children: { type: string; value?: { alt?: string; id?: number; rightsStatus?: string } }[] } }).root.children;
    expect(stored.map((n) => n.type)).toEqual(source.body.root.children.map((n) => n.type));
    const uploads = stored.filter((n) => n.type === 'upload');
    expect(uploads).toHaveLength(uploadKeysOf(source.body).length);
    for (const u of uploads) {
      expect(typeof u.value?.id).toBe('number');
      expect(u.value?.rightsStatus).toBe('UNCONFIRMED');
      expect(u.value?.alt).toBeTruthy();
    }
    expect(new Date(article.publishedAt as string).toISOString()).toBe(source.publishedAt);
    expect(article.legacyUrl).toBe(source.legacyUrl);
  });

  it('a second --write is idempotent: nothing created, no duplicates, no new files, existing content untouched', async () => {
    const before = { ...(await counts()), files: filesInMedia().length };
    const again = await runSeed(payload, loaded, { write: true });
    expect(again.created).toEqual([]);
    expect(again.media.created).toBe(0);
    expect(again.conflicts.map((c) => c.slug)).toEqual(['ecolife-tay-ho']);
    expect({ ...(await counts()), files: filesInMedia().length }).toEqual(before);
  });

  it('never overwrites a later human edit of a seeded article, service area or global', async () => {
    const seeded = loaded.pack.articles.find((a) => a.slug !== loaded.pack.articles[0]!.slug)!;
    const doc = (await payload.find({ collection: 'articles', where: { slug: { equals: seeded.slug } }, draft: true, depth: 0, overrideAccess: true })).docs[0]!;
    await payload.update({ collection: 'articles', id: doc.id, data: { title: 'Synthetic: edited by BMSL staff' }, draft: true });
    const area = (await payload.find({ collection: 'service-areas', where: { slug: { equals: 'pccc' } }, draft: true, depth: 0, overrideAccess: true })).docs[0]!;
    await payload.update({ collection: 'service-areas', id: area.id, data: { summary: 'Synthetic: confirmed copy' }, draft: true });
    await payload.updateGlobal({ slug: 'about-page', data: { title: 'Synthetic: edited about' }, draft: true });

    const report = await runSeed(payload, loaded, { write: true });
    expect(report.created).toEqual([]);
    expect((await payload.findByID({ collection: 'articles', id: doc.id, depth: 0, draft: true })).title).toBe('Synthetic: edited by BMSL staff');
    expect((await payload.findByID({ collection: 'service-areas', id: area.id, depth: 0, draft: true })).summary).toBe('Synthetic: confirmed copy');
    expect(((await payload.findGlobal({ slug: 'about-page', draft: true, depth: 0 })) as { title?: string }).title).toBe('Synthetic: edited about');
  });

  it('anonymous visitors cannot read any seeded draft, global, media record or image byte', async () => {
    for (const collection of ['projects', 'articles', 'service-areas', 'media-assets'] as const) {
      const r = await payload.find({ collection, ...anonymous, depth: 2 });
      // Only the synthetic published+CONFIRMED sample project is public.
      expect(r.totalDocs, collection).toBe(collection === 'projects' ? 1 : 0);
    }
    const publicProjects = await payload.find({ collection: 'projects', ...PUBLIC });
    expect(publicProjects.docs.map((d) => toProject(d)?.name)).toEqual(['Synthetic sample project']);
    for (const slug of ['about-page', 'contact-page'] as const) {
      expect(toPage(await payload.findGlobal({ slug, ...PUBLIC }))).toBeNull();
    }
    const media = await payload.find({ collection: 'media-assets', depth: 0, overrideAccess: true, limit: 1 });
    await expect(payload.findByID({ collection: 'media-assets', id: media.docs[0]!.id, ...anonymous })).rejects.toThrow();
  });
});

describe('approved images in rich text (synthetic records, same public read path)', () => {
  const upload = (id: number | string) => ({ type: 'upload', version: 3, format: '', id: 'a'.repeat(24), relationTo: 'media-assets', value: id, fields: null });
  const textBlock = { type: 'paragraph', format: '', indent: 0, version: 1, direction: 'ltr', textFormat: 0, children: [{ type: 'text', text: 'Trước', format: 0, detail: 0, mode: 'normal', style: '', version: 1 }] };
  const doc = (...children: unknown[]) => ({ root: { type: 'root', format: '', indent: 0, version: 1, direction: 'ltr', children: [textBlock, ...children] } });
  const media = (name: string, rights: 'APPROVED' | 'UNCONFIRMED') =>
    payload.create({
      collection: 'media-assets',
      data: { alt: `synthetic ${name}`, rightsStatus: rights },
      file: { data: PNG, mimetype: 'image/png', name: `${name}.png`, size: PNG.length },
    });

  it('renders an APPROVED inline image where it sits and renders nothing for an UNCONFIRMED one', async () => {
    const approved = await media('rich-approved', 'APPROVED');
    const unconfirmed = await media('rich-unconfirmed', 'UNCONFIRMED');
    const category = await payload.create({ collection: 'article-categories', data: { name: 'Synthetic category', slug: 'synthetic-category', order: 1, _status: 'published' } });
    await payload.create({
      collection: 'articles',
      data: {
        title: 'Synthetic rich article',
        slug: 'synthetic-rich-article',
        category: category.id,
        body: doc(upload(approved.id), upload(unconfirmed.id)) as never,
        _status: 'published',
      },
    });
    const found = await payload.find({ collection: 'articles', where: { slug: { equals: 'synthetic-rich-article' } }, ...PUBLIC });
    const article = toArticle(found.docs[0])!;
    expect(article).toBeDefined();
    const html = renderToStaticMarkup(createElement(RichText, { data: article.body }));
    expect(html).toContain('Trước');
    expect(html.match(/<img /g)).toHaveLength(1);
    expect(html).toContain('alt="synthetic rich-approved"');
    expect(html).toContain(`src="${(approved as unknown as { url: string }).url}"`);
    expect(html).not.toContain('rich-unconfirmed');
    // Same position: the paragraph comes first, then the image figure.
    expect(html.indexOf('Trước')).toBeLessThan(html.indexOf('<figure'));
  });

  it('after the approval is revoked the image disappears from the rendered article', async () => {
    const m = (await payload.find({ collection: 'media-assets', where: { alt: { equals: 'synthetic rich-approved' } }, depth: 0, overrideAccess: true })).docs[0]!;
    await payload.update({ collection: 'media-assets', id: m.id, data: { rightsStatus: 'UNCONFIRMED' } });
    const found = await payload.find({ collection: 'articles', where: { slug: { equals: 'synthetic-rich-article' } }, ...PUBLIC });
    const html = renderToStaticMarkup(createElement(RichText, { data: toArticle(found.docs[0])!.body }));
    expect(html).not.toContain('<img');
  });
});

describe('seed guards', () => {
  const base = { env: {} as Record<string, string | undefined>, databaseUrl: 'postgresql://u:p@localhost:5432/db', repoRoot: path.resolve(import.meta.dirname, '../..') };

  it('requires a complete DEV/STAGING target acknowledgement before any non-local Payload startup', () => {
    const remote = 'postgresql://u:p@db.internal.example:5432/x';
    const declaredDev = {
      BMSL_IMPORT_ALLOW_STAGING: 'true',
      BMSL_IMPORT_TARGET_ENV: 'dev',
      BMSL_IMPORT_TARGET_ACK: 'db.internal.example/x',
    };
    expect(() => assertImportAllowed({ ...base, write: true, env: { NODE_ENV: 'production' } })).toThrow(/production/);
    expect(() => assertImportAllowed({ ...base, write: true, databaseUrl: remote })).toThrow(/non-local/);
    expect(() => assertImportAllowed({ ...base, write: true, databaseUrl: remote, env: { BMSL_IMPORT_ALLOW_STAGING: 'true' } })).toThrow(/BMSL_IMPORT_TARGET_ENV/);
    expect(() => assertImportAllowed({ ...base, write: false, databaseUrl: remote, env: { BMSL_IMPORT_ALLOW_STAGING: 'true' } })).toThrow(/BMSL_IMPORT_TARGET_ENV/);
    expect(() => assertImportAllowed({ ...base, write: false, env: { NODE_ENV: 'production' } })).toThrow(/production/);
    expect(() => assertImportAllowed({ ...base, write: true, databaseUrl: remote, env: declaredDev })).not.toThrow();
    expect(() => assertImportAllowed({ ...base, write: false, databaseUrl: remote, env: declaredDev })).not.toThrow();
  });
});
