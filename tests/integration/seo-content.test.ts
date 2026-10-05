import pg from 'pg';
import type { Payload } from 'payload';
import { getPayload } from 'payload';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { getDatabaseUrl } from '../../src/lib/database';
import { buildSitemapEntries, toProject } from '../../src/lib/public-content';
import { isApprovedMediaPath } from '../../src/lib/seo';
import { STATIC_PUBLIC_PATHS } from '../../src/lib/site';

// W5A against real PostgreSQL (synthetic data only): sitemap pagination beyond 500 documents, noindex
// singleton exclusion, published-only SiteSettings (analytics + contact links) and real media URL shape.
// Uses the real public read path (src/lib/cms.ts) through the @payload-config alias.
process.env.PAYLOAD_SECRET ??= 'synthetic-integration-secret';
const databaseUrl = getDatabaseUrl();
const host = new URL(databaseUrl).hostname;
if (!['localhost', '127.0.0.1', '::1', '[::1]'].includes(host)) {
  throw new Error(`Refusing to reset a non-local database (${host})`);
}

const png = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
  'base64',
);
const PROJECT_COUNT = 505;

let payload: Payload;
let cms: typeof import('../../src/lib/cms');
const pool = new pg.Pool({ connectionString: databaseUrl });

beforeAll(async () => {
  await pool.query('drop schema if exists public cascade; create schema public;');
  const { default: config } = await import('../../src/payload.config');
  payload = await getPayload({ config });
  await payload.db.migrate();
  cms = await import('../../src/lib/cms');
});

afterAll(async () => {
  await payload?.destroy();
  await pool.end();
});

const media = async (name: string, rights: 'APPROVED' | 'UNCONFIRMED') =>
  payload.create({
    collection: 'media-assets',
    data: { alt: `synthetic ${name}`, rightsStatus: rights },
    file: { data: png, mimetype: 'image/png', name: `${name}.png`, size: png.length },
  });

describe('sitemap pagination and noindex isolation (real PostgreSQL)', () => {
  it(`lists all ${PROJECT_COUNT} published projects (no 500 cap) and excludes noindex and draft ones`, async () => {
    for (let start = 0; start < PROJECT_COUNT; start += 25) {
      await Promise.all(
        Array.from({ length: Math.min(25, PROJECT_COUNT - start) }, (_, k) => {
          const i = start + k;
          return payload.create({
            collection: 'projects',
            data: { name: `Synthetic ${i}`, slug: `synthetic-${i}`, sourceStatus: 'LEGACY-SOURCE', _status: 'published' },
          });
        }),
      );
    }
    await payload.create({
      collection: 'projects',
      data: { name: 'Hidden', slug: 'synthetic-noindex', sourceStatus: 'LEGACY-SOURCE', seo: { noindex: true }, _status: 'published' },
    });
    await payload.create({
      collection: 'projects',
      data: { name: 'Draft', slug: 'synthetic-draft', sourceStatus: 'LEGACY-SOURCE', _status: 'draft' },
      draft: true,
    });

    const { contentPaths } = await cms.getSitemapData();
    const projectPaths = contentPaths.filter((p) => p.startsWith('/du-an/'));
    expect(projectPaths).toHaveLength(PROJECT_COUNT);
    expect(new Set(projectPaths).size).toBe(PROJECT_COUNT);
    expect(contentPaths).not.toContain('/du-an/synthetic-noindex');
    expect(contentPaths).not.toContain('/du-an/synthetic-draft');

    const entries = buildSitemapEntries('https://example.test', STATIC_PUBLIC_PATHS, contentPaths);
    expect(entries.length).toBeGreaterThan(500);
  }, 240_000);

  it('excludes only PUBLISHED noindex singletons; unpublished drafts never change the sitemap', async () => {
    // Draft-only noindex on the home page: not published, so it must not exclude "/".
    await payload.updateGlobal({ slug: 'home-page', data: { seo: { noindex: true } }, draft: true });
    expect((await cms.getSitemapData()).excludedPaths).toEqual([]);

    await payload.updateGlobal({ slug: 'about-page', data: { title: 'About', seo: { noindex: true }, _status: 'published' } });
    await payload.updateGlobal({ slug: 'contact-page', data: { title: 'Contact', seo: { noindex: false }, _status: 'published' } });
    expect((await cms.getSitemapData()).excludedPaths).toEqual(['/gioi-thieu']);
  });
});

describe('SiteSettings: published-only analytics and contact links (real PostgreSQL)', () => {
  const publish = (data: Record<string, unknown>) =>
    payload.updateGlobal({ slug: 'site-settings', data: { ...data, _status: 'published' } as never });

  it('is empty before anything is published', async () => {
    expect(await cms.getSiteSettings()).toEqual({});
  });

  it('ID-only published settings (analyticsEnabled explicitly false) keep analytics OFF', async () => {
    await publish({ ga4Id: 'G-ABCD1234', analyticsEnabled: false });
    expect(await cms.getSiteSettings()).toEqual({});
  });

  it('a private DRAFT cannot activate public analytics, contact links or verification', async () => {
    await payload.updateGlobal({
      slug: 'site-settings',
      draft: true,
      data: {
        ga4Id: 'G-DRAFT9999',
        analyticsEnabled: true,
        searchConsoleVerification: 'abcDEF123_-abcDEF123_-abcDEF123',
        contact: { hotline: '0900000000', zalo: '0900000001' },
      } as never,
    });
    expect(await cms.getSiteSettings()).toEqual({});
    // Staff can see the draft, so the public result above is the access/draft filter, not an empty table.
    const draft = await payload.findGlobal({ slug: 'site-settings', draft: true });
    expect((draft as unknown as { ga4Id?: string }).ga4Id).toBe('G-DRAFT9999');
  });

  it('publishing enables analytics only with the switch on AND a valid id', async () => {
    await publish({ ga4Id: 'G-ABCD1234', analyticsEnabled: true });
    expect((await cms.getSiteSettings()).ga4Id).toBe('G-ABCD1234');

    await publish({ ga4Id: 'G-ABCD1234', analyticsEnabled: false });
    expect((await cms.getSiteSettings()).ga4Id).toBeUndefined();

    await publish({ ga4Id: 'UA-1"><script>', analyticsEnabled: true });
    expect((await cms.getSiteSettings()).ga4Id).toBeUndefined();
  });

  it('exposes published hotline/Zalo and a valid verification token only after publish', async () => {
    await publish({
      ga4Id: 'G-ABCD1234',
      analyticsEnabled: false,
      searchConsoleVerification: 'abcDEF123_-abcDEF123_-abcDEF123',
      contact: { hotline: '0900 000 000', zalo: '0900000001' },
    });
    const s = await cms.getSiteSettings();
    expect(s.hotline?.href).toBe('tel:0900000000');
    expect(s.zalo?.href).toBe('https://zalo.me/0900000001');
    expect(s.searchConsoleVerification).toBe('abcDEF123_-abcDEF123_-abcDEF123');
    expect(s.ga4Id).toBeUndefined();
  });
});

describe('approved media URLs (real Payload upload)', () => {
  it('real Payload file URLs pass the approved-path check; unapproved and revoked media never map', async () => {
    const ok = await media('w5a-ok', 'APPROVED');
    const blocked = await media('w5a-blocked', 'UNCONFIRMED');
    expect(isApprovedMediaPath(ok.url)).toBe(true);

    const project = await payload.create({
      collection: 'projects',
      data: {
        name: 'Media project',
        slug: 'media-project',
        sourceStatus: 'LEGACY-SOURCE',
        images: [ok.id, blocked.id],
        _status: 'published',
      },
    });
    const read = async () =>
      toProject(await payload.findByID({ collection: 'projects', id: project.id, overrideAccess: false, depth: 2, draft: false }));
    expect((await read())?.images.map((i) => i.id)).toEqual([String(ok.id)]);

    await payload.update({ collection: 'media-assets', id: ok.id, data: { rightsStatus: 'UNCONFIRMED' } });
    expect((await read())?.images).toEqual([]);
  });
});
