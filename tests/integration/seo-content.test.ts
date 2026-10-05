import pg from 'pg';
import type { Payload } from 'payload';
import { getPayload } from 'payload';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { getDatabaseUrl } from '../../src/lib/database';
import { buildSitemapEntries } from '../../src/lib/public-content';
import { STATIC_PUBLIC_PATHS } from '../../src/lib/site';

// W5A against real PostgreSQL, through the real public read path (src/lib/cms.ts). Synthetic data only.
process.env.PAYLOAD_SECRET ??= 'synthetic-integration-secret';
const databaseUrl = getDatabaseUrl();
const host = new URL(databaseUrl).hostname;
if (!['localhost', '127.0.0.1', '::1', '[::1]'].includes(host)) {
  throw new Error(`Refusing to reset a non-local database (${host})`);
}

const PROJECTS = 505; // above the old silent 500 limit and above two 200-item pages
let payload: Payload;
const pool = new pg.Pool({ connectionString: databaseUrl });
const cms = () => import('../../src/lib/cms');

const settings = (data: Record<string, unknown>, draft: boolean) =>
  payload.updateGlobal({
    slug: 'site-settings',
    // Cast: the generated Payload types (produced in CI) are strict about the shape of partial global data.
    data: { ...data, ...(draft ? {} : { _status: 'published' }) } as never,
    draft,
  });

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

describe('published SiteSettings and analytics isolation', () => {
  it('a never-published (draft-only) settings document yields an empty public view, even when it enables analytics', async () => {
    await settings({ ga4Id: 'G-DRAFT00001', analyticsEnabled: true, searchConsoleVerification: 'd'.repeat(30) }, true);
    const { getSiteSettings } = await cms();
    expect(await getSiteSettings()).toEqual({});
    // The draft really exists for staff: the isolation is the public read, not a missing write.
    const asDraft = await payload.findGlobal({ slug: 'site-settings', draft: true });
    expect(asDraft.analyticsEnabled).toBe(true);
  });

  it('ID-only published settings (analyticsEnabled explicitly false) keep analytics off', async () => {
    // Payload keeps previously saved draft fields on update, so the fixture states the flag explicitly.
    await settings({ ga4Id: 'G-ABC123DEF4', analyticsEnabled: false }, false);
    const { getSiteSettings } = await cms();
    expect((await getSiteSettings()).analytics).toBeUndefined();
  });

  it('a later private draft cannot activate public analytics; only publishing does', async () => {
    const { getSiteSettings } = await cms();
    await settings({ ga4Id: 'G-ABC123DEF4', analyticsEnabled: true }, true);
    expect((await getSiteSettings()).analytics).toBeUndefined();

    await settings({ ga4Id: 'G-ABC123DEF4', analyticsEnabled: true }, false);
    expect((await getSiteSettings()).analytics).toEqual({ measurementId: 'G-ABC123DEF4' });
  });

  it('published but invalid ID, or switch off, disables analytics again', async () => {
    const { getSiteSettings } = await cms();
    await settings({ ga4Id: 'not-a-ga4-id', analyticsEnabled: true }, false);
    expect((await getSiteSettings()).analytics).toBeUndefined();
    await settings({ ga4Id: 'G-ABC123DEF4', analyticsEnabled: false }, false);
    expect((await getSiteSettings()).analytics).toBeUndefined();
  });

  it('exposes only valid published contact facts and verification token', async () => {
    const { getSiteSettings } = await cms();
    await settings(
      {
        ga4Id: 'G-ABC123DEF4',
        analyticsEnabled: false,
        searchConsoleVerification: 'abcDEF123_-abcDEF123_-abc',
        contact: { hotline: '0900 000 000', zalo: 'https://evil.example' },
      },
      false,
    );
    const view = await getSiteSettings();
    expect(view.hotline?.href).toBe('tel:0900000000');
    expect(view.zalo).toBeUndefined();
    expect(view.searchConsoleVerification).toBe('abcDEF123_-abcDEF123_-abc');
  });
});

describe('sitemap over real content', () => {
  it(`lists all ${PROJECTS} published projects (no 500 cap) and excludes drafts and noindex`, async () => {
    for (let i = 0; i < PROJECTS; i += 1) {
      await payload.create({
        collection: 'projects',
        data: { name: `Synthetic ${i}`, slug: `synthetic-sitemap-${i}`, sourceStatus: 'LEGACY-SOURCE', _status: 'published' },
      });
    }
    await payload.create({
      collection: 'projects',
      data: { name: 'Synthetic draft', slug: 'synthetic-sitemap-draft', sourceStatus: 'LEGACY-SOURCE' },
      draft: true,
    });
    await payload.create({
      collection: 'projects',
      data: {
        name: 'Synthetic noindex',
        slug: 'synthetic-sitemap-noindex',
        sourceStatus: 'LEGACY-SOURCE',
        seo: { noindex: true },
        _status: 'published',
      },
    });

    const { getContentPaths } = await cms();
    const projectPaths = (await getContentPaths()).filter((p) => p.startsWith('/du-an/'));
    expect(projectPaths).toHaveLength(PROJECTS);
    expect(new Set(projectPaths).size).toBe(PROJECTS);
    expect(projectPaths).not.toContain('/du-an/synthetic-sitemap-draft');
    expect(projectPaths).not.toContain('/du-an/synthetic-sitemap-noindex');
  }, 120_000);

  it('excludes published noindex singletons but not indexable or draft-only ones', async () => {
    await payload.updateGlobal({
      slug: 'contact-page',
      data: { title: 'Liên hệ', seo: { noindex: true }, _status: 'published' },
    });
    await payload.updateGlobal({
      slug: 'about-page',
      data: { title: 'Giới thiệu', seo: { noindex: false }, _status: 'published' },
    });
    // Draft-only noindex on a published page must not change the public sitemap.
    await payload.updateGlobal({ slug: 'about-page', data: { seo: { noindex: true } }, draft: true });

    const { getNoindexStaticPaths, getContentPaths } = await cms();
    const noindex = await getNoindexStaticPaths();
    expect(noindex).toEqual(['/lien-he']);

    const urls = buildSitemapEntries(
      'https://example.test',
      STATIC_PUBLIC_PATHS.filter((p) => !noindex.includes(p)),
      await getContentPaths(),
    ).map((e) => e.url);
    expect(urls).not.toContain('https://example.test/lien-he');
    expect(urls).toContain('https://example.test/gioi-thieu');
    expect(urls).toContain('https://example.test');
    expect(urls.length).toBeGreaterThan(PROJECTS);
  });

  it('fails instead of returning a partial list when the database is unavailable', async () => {
    const { getContentPaths } = await cms();
    await pool.query('alter table projects rename to projects_tmp');
    try {
      await expect(getContentPaths()).rejects.toThrow();
    } finally {
      await pool.query('alter table projects_tmp rename to projects');
    }
  });
});
