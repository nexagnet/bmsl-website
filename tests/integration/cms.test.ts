import pg from 'pg';
import type { Payload } from 'payload';
import { getPayload } from 'payload';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { getDatabaseUrl } from '../../src/lib/database';
import { SERVICE_AREA_SEED, seedServiceAreas } from '../../src/seed/service-areas';

// Synthetic data only. Runs against a disposable PostgreSQL (CI service container or local throwaway DB).
process.env.PAYLOAD_SECRET ??= 'synthetic-integration-secret';
const databaseUrl = getDatabaseUrl();
const host = new URL(databaseUrl).hostname;
if (!['localhost', '127.0.0.1', '::1', '[::1]'].includes(host)) {
  throw new Error(`Refusing to reset a non-local database (${host})`);
}

type StaffUser = { id: number | string; collection: 'users'; role: string };

let payload: Payload;
let admin: StaffUser;
let editor: StaffUser;
const pool = new pg.Pool({ connectionString: databaseUrl });

const asUser = (u: StaffUser) => ({ user: u, overrideAccess: false as const });
const anonymous = { overrideAccess: false as const };
const denied = (p: Promise<unknown>) => expect(p).rejects.toThrow();

beforeAll(async () => {
  await pool.query('drop schema if exists public cascade; create schema public;');
  const { default: config } = await import('../../src/payload.config');
  payload = await getPayload({ config });
  await payload.db.migrate();
  const first = await payload.create({
    collection: 'users',
    data: { email: 'admin@example.test', password: 'synthetic-Admin-1', role: 'EDITOR' },
  });
  admin = { id: first.id, collection: 'users', role: first.role as string };
  const second = await payload.create({
    collection: 'users',
    data: { email: 'editor@example.test', password: 'synthetic-Editor-1', role: 'EDITOR' },
  });
  editor = { id: second.id, collection: 'users', role: second.role as string };
});

afterAll(async () => {
  await payload?.destroy();
  await pool.end();
});

describe('ServiceArea seed', () => {
  it('creates exactly the four confirmed records as drafts and is idempotent', async () => {
    const first = await seedServiceAreas(payload);
    expect(first).toHaveLength(4);
    expect(await seedServiceAreas(payload)).toEqual([]);

    const all = await payload.find({ collection: 'service-areas', draft: true, limit: 50 });
    expect(all.totalDocs).toBe(4);
    expect(all.docs.map((d) => d.name).sort()).toEqual(SERVICE_AREA_SEED.map((a) => a.name).sort());
    expect(all.docs.every((d) => d._status === 'draft')).toBe(true);
    // Draft seed content stays hidden from the public.
    expect((await payload.find({ collection: 'service-areas', ...anonymous })).totalDocs).toBe(0);
  });

  it('does not create any ArticleCategory', async () => {
    expect((await payload.find({ collection: 'article-categories', draft: true })).totalDocs).toBe(0);
  });
});

describe('Project BQT feedback gate', () => {
  it('hides feedback text from the public until approvedBySource=true', async () => {
    const project = await payload.create({
      collection: 'projects',
      data: {
        name: 'Synthetic BQT project',
        slug: 'synthetic-bqt',
        bqtFeedback: { text: 'synthetic feedback', approvedBySource: false },
      },
      ...asUser(editor),
    });
    await payload.update({
      collection: 'projects',
      id: project.id,
      data: { _status: 'published' },
      ...asUser(editor),
    });

    const hidden = await payload.findByID({ collection: 'projects', id: project.id, ...anonymous });
    expect(hidden.bqtFeedback?.text).toBeUndefined();
    const listed = await payload.find({ collection: 'projects', ...anonymous });
    expect(listed.docs[0]?.bqtFeedback?.text).toBeUndefined();
    const staff = await payload.findByID({ collection: 'projects', id: project.id, ...asUser(editor) });
    expect(staff.bqtFeedback?.text).toBe('synthetic feedback');

    await payload.update({
      collection: 'projects',
      id: project.id,
      data: { bqtFeedback: { approvedBySource: true } },
      ...asUser(editor),
    });
    const shown = await payload.findByID({ collection: 'projects', id: project.id, ...anonymous });
    expect(shown.bqtFeedback?.text).toBe('synthetic feedback');
  });
});

describe('MediaAsset rights gate', () => {
  it('serves media publicly only when rightsStatus=APPROVED', async () => {
    const png = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
      'base64',
    );
    const media = await payload.create({
      collection: 'media-assets',
      data: { alt: 'synthetic rights image' },
      file: { data: png, mimetype: 'image/png', name: 'synthetic-rights.png', size: png.length },
      ...asUser(editor),
    });
    expect(media.rightsStatus).toBe('UNCONFIRMED');
    expect((await payload.find({ collection: 'media-assets', ...anonymous })).totalDocs).toBe(0);
    await denied(payload.findByID({ collection: 'media-assets', id: media.id, ...anonymous }));

    await payload.update({
      collection: 'media-assets',
      id: media.id,
      data: { rightsStatus: 'APPROVED' },
      ...asUser(editor),
    });
    expect((await payload.find({ collection: 'media-assets', ...anonymous })).totalDocs).toBe(1);
  });
});

describe('Editorial CRUD and lifecycle', () => {
  it('ADMIN and EDITOR can create, update and delete allowed content; drafts become public when published', async () => {
    for (const actor of [admin, editor]) {
      const article = await payload.create({
        collection: 'articles',
        data: { title: `Synthetic ${actor.role}`, slug: `synthetic-crud-${actor.role.toLowerCase()}` },
        draft: true,
        ...asUser(actor),
      });
      const where = { slug: { equals: `synthetic-crud-${actor.role.toLowerCase()}` } };
      expect((await payload.find({ collection: 'articles', where, ...anonymous })).totalDocs).toBe(0);

      await payload.update({
        collection: 'articles',
        id: article.id,
        data: { excerpt: 'edited', _status: 'published' },
        ...asUser(actor),
      });
      const pub = await payload.find({ collection: 'articles', where, ...anonymous });
      expect(pub.docs[0]?.excerpt).toBe('edited');

      await payload.delete({ collection: 'articles', id: article.id, ...asUser(actor) });
      expect((await payload.find({ collection: 'articles', where, ...asUser(actor) })).totalDocs).toBe(0);
    }
  });

  it('keeps W1 RBAC: EDITOR cannot write service areas or site settings; anonymous cannot write content', async () => {
    await denied(
      payload.create({
        collection: 'service-areas',
        data: { name: 'x', slug: 'x', summary: 'x', order: 9 },
        ...asUser(editor),
      }),
    );
    await denied(payload.updateGlobal({ slug: 'site-settings', data: { ga4Id: 'G-X' }, ...asUser(editor) }));
    await denied(
      payload.create({
        collection: 'articles',
        data: { title: 'anon', slug: 'anon' },
        draft: true,
        ...anonymous,
      }),
    );
  });
});
