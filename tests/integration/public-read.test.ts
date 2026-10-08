import pg from 'pg';
import type { Payload } from 'payload';
import { getPayload } from 'payload';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { getDatabaseUrl } from '../../src/lib/database';
import { toArticle, toPage, toProject, toService } from '../../src/lib/public-content';

// Synthetic data only. Mirrors the public read options of src/lib/cms.ts (no user, overrideAccess:false, depth 2).
process.env.PAYLOAD_SECRET ??= 'synthetic-integration-secret';
const databaseUrl = getDatabaseUrl();
const host = new URL(databaseUrl).hostname;
if (!['localhost', '127.0.0.1', '::1', '[::1]'].includes(host)) {
  throw new Error(`Refusing to reset a non-local database (${host})`);
}

const PUBLIC = { overrideAccess: false, depth: 2, draft: false } as const;
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
});

afterAll(async () => {
  await payload?.destroy();
  await pool.end();
});

const media = async (name: string, rights: 'APPROVED' | 'UNCONFIRMED') => {
  const m = await payload.create({
    collection: 'media-assets',
    data: { alt: `synthetic ${name}`, rightsStatus: rights },
    file: { data: png, mimetype: 'image/png', name: `${name}.png`, size: png.length },
  });
  return m.id;
};

describe('public rendering data path', () => {
  it('maps only published content with approved media and approved BQT feedback', async () => {
    const [ok, blocked] = [await media('ok', 'APPROVED'), await media('blocked', 'UNCONFIRMED')];
    await payload.create({
      collection: 'projects',
      data: {
        name: 'Published project',
        slug: 'published-project',
        sourceStatus: 'CONFIRMED', // only CONFIRMED projects can be published; this isolates the approvedBySource gate
        images: [ok, blocked],
        bqtFeedback: { text: 'unapproved text', approvedBySource: false },
        _status: 'published',
      },
    });
    await payload.create({
      collection: 'projects',
      data: { name: 'Draft project', slug: 'draft-project', _status: 'draft' },
      draft: true,
    });

    const list = await payload.find({ collection: 'projects', limit: 50, ...PUBLIC });
    const projects = list.docs.map(toProject).filter(Boolean);
    expect(projects.map((p) => p?.slug)).toEqual(['published-project']);
    expect(projects[0]?.images).toHaveLength(1);
    expect(projects[0]?.images[0]?.alt).toBe('synthetic ok');
    expect(projects[0]?.bqtFeedback).toBeUndefined();
  });

  it('hides drafts but exposes published articles with or without a published category', async () => {
    await payload.create({
      collection: 'service-areas',
      data: { name: 'Published service', slug: 'published-service', summary: 's', order: 1, _status: 'published' },
    });
    await payload.create({
      collection: 'service-areas',
      data: { name: 'Draft service', slug: 'draft-service', summary: 's', order: 2, _status: 'draft' },
      draft: true,
    });
    const services = (await payload.find({ collection: 'service-areas', ...PUBLIC })).docs.map(toService);
    expect(services.filter(Boolean).map((s) => s?.slug)).toEqual(['published-service']);

    const publishedCat = await payload.create({
      collection: 'article-categories',
      data: { name: 'Cat', slug: 'cat', order: 1, _status: 'published' },
    });
    const draftCat = await payload.create({
      collection: 'article-categories',
      data: { name: 'Hidden cat', slug: 'hidden-cat', order: 2, _status: 'draft' },
      draft: true,
    });
    for (const [slug, category] of [
      ['visible-article', publishedCat.id],
      ['orphan-article', draftCat.id],
    ] as const) {
      await payload.create({
        collection: 'articles',
        data: { title: slug, slug, category, _status: 'published' },
      });
    }
    const articles = (await payload.find({ collection: 'articles', ...PUBLIC })).docs
      .map(toArticle)
      .filter(Boolean);
    expect(articles.map((a) => a?.href)).toEqual([
      '/kien-thuc/cat/visible-article',
      '/kien-thuc/bai-viet/orphan-article',
    ]);
  });

  it('returns the safe empty state for an unpublished singleton page', async () => {
    const page = await payload.findGlobal({ slug: 'about-page', ...PUBLIC });
    expect(toPage(page)).toBeNull();
  });
});
