import pg from 'pg';
import type { Payload } from 'payload';
import { getPayload } from 'payload';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { getDatabaseUrl } from '../../src/lib/database';
import { buildSitemapEntries, toProject } from '../../src/lib/public-content';
import { collectAllPages } from '../../src/lib/seo';
import { toSiteSettings } from '../../src/lib/site-settings';

// Synthetic data only; mirrors the public read options and the paging of src/lib/cms.ts (getContentPaths).
process.env.PAYLOAD_SECRET ??= 'synthetic-integration-secret';
const databaseUrl = getDatabaseUrl();
const host = new URL(databaseUrl).hostname;
if (!['localhost', '127.0.0.1', '::1', '[::1]'].includes(host)) {
  throw new Error(`Refusing to reset a non-local database (${host})`);
}

const PUBLIC = { overrideAccess: false, depth: 2, draft: false } as const;
const COUNT = 505; // above the former silent 500 cap
const png = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
  'base64',
);

let payload: Payload;
const pool = new pg.Pool({ connectionString: databaseUrl });

beforeAll(async () => {
  await pool.query('drop schema if exists public cascade; create schema public;');
  const { default: config } = await import('../../src/payload.config');
  payload = await getPayload({ config });
  await payload.db.migrate();
}, 120_000);

afterAll(async () => {
  await payload?.destroy();
  await pool.end();
});

describe('sitemap content beyond 500 items', () => {
  it('pages through every published, indexable project and skips drafts and noindex', async () => {
    for (let i = 0; i < COUNT; i++) {
      await payload.create({
        collection: 'projects',
        data: {
          name: `Synthetic ${i}`,
          slug: `synthetic-${i}`,
          sourceStatus: 'LEGACY-SOURCE',
          seo: { noindex: i === 0 },
          _status: 'published',
        },
      });
    }
    await payload.create({
      collection: 'projects',
      data: { name: 'Draft', slug: 'draft-synthetic', _status: 'draft' },
      draft: true,
    });

    const projects = await collectAllPages(async (page) => {
      const r = await payload.find({ collection: 'projects', sort: 'createdAt', page, limit: 200, ...PUBLIC });
      return { docs: r.docs.map(toProject).filter((p) => !!p), totalPages: r.totalPages };
    });
    expect(projects).toHaveLength(COUNT);

    const indexable = projects.filter((p) => !p?.seo.noindex).map((p) => p!.href);
    expect(indexable).toHaveLength(COUNT - 1);
    const entries = buildSitemapEntries('https://bmsl.example', ['/'], indexable);
    expect(entries).toHaveLength(COUNT);
    expect(entries.some((e) => e.url.endsWith('/du-an/draft-synthetic'))).toBe(false);
    expect(entries.some((e) => e.url.endsWith('/du-an/synthetic-0'))).toBe(false);
  }, 280_000);
});

describe('published SiteSettings only', () => {
  it('draft or absent settings keep analytics off; publishing with an explicit switch and valid id enables it', async () => {
    const read = async () => toSiteSettings(await payload.findGlobal({ slug: 'site-settings', ...PUBLIC }));
    expect((await read()).analyticsEnabled).toBe(false);

    await payload.updateGlobal({
      slug: 'site-settings',
      data: { ga4Id: 'G-ABCDEF1234', analyticsEnabled: true, _status: 'draft' },
      draft: true,
    });
    expect((await read()).analyticsEnabled).toBe(false);

    await payload.updateGlobal({ slug: 'site-settings', data: { ga4Id: 'G-ABCDEF1234', _status: 'published' } });
    expect((await read()).analyticsEnabled).toBe(false); // id alone is not enough

    await payload.updateGlobal({ slug: 'site-settings', data: { analyticsEnabled: true, _status: 'published' } });
    expect(await read()).toMatchObject({ analyticsEnabled: true, ga4Id: 'G-ABCDEF1234' });

    await payload.updateGlobal({ slug: 'site-settings', data: { ga4Id: 'not-an-id', _status: 'published' } });
    expect((await read()).analyticsEnabled).toBe(false);
  });
});

describe('media rights at the access layer', () => {
  it('UNCONFIRMED media and media whose approval was revoked are invisible to the public', async () => {
    const make = async (name: string, rightsStatus: 'APPROVED' | 'UNCONFIRMED') =>
      payload.create({
        collection: 'media-assets',
        data: { alt: `synthetic ${name}`, rightsStatus },
        file: { data: png, mimetype: 'image/png', name: `${name}.png`, size: png.length },
      });
    const approved = await make('seo-ok', 'APPROVED');
    const blocked = await make('seo-blocked', 'UNCONFIRMED');
    const visible = async (id: number | string) =>
      (await payload.find({ collection: 'media-assets', where: { id: { equals: id } }, overrideAccess: false })).docs.length;

    expect(await visible(approved.id)).toBe(1);
    expect(await visible(blocked.id)).toBe(0);
    await payload.update({ collection: 'media-assets', id: approved.id, data: { rightsStatus: 'UNCONFIRMED' } });
    expect(await visible(approved.id)).toBe(0);
  });
});
