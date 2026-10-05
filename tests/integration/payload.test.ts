import pg from 'pg';
import type { Payload } from 'payload';
import { getPayload } from 'payload';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { getDatabaseUrl } from '../../src/lib/database';

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
  await payload.db.migrate(); // proves the committed migrations build the schema

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

describe('Payload configuration + Postgres adapter', () => {
  it('has applied migrations and exposes all W0 entities', async () => {
    const { rows } = await pool.query('select count(*)::int as n from payload_migrations');
    expect(rows[0].n).toBeGreaterThan(0);
    const slugs = payload.config.collections.map((c) => c.slug);
    for (const s of [
      'projects', 'articles', 'article-categories', 'job-postings', 'documents',
      'service-areas', 'media-assets', 'redirects', 'contact-leads', 'users',
    ]) {
      expect(slugs).toContain(s);
    }
    const globals = payload.config.globals.map((g) => g.slug);
    for (const s of ['home-page', 'about-page', 'process-page', 'contact-page', 'site-settings']) {
      expect(globals).toContain(s);
    }
  });

  it('makes the first account ADMIN and later accounts EDITOR', () => {
    expect(admin.role).toBe('ADMIN');
    expect(editor.role).toBe('EDITOR');
  });
});

describe('RBAC (ADMIN / EDITOR / anonymous)', () => {
  it('ADMIN-only: users, redirects, site settings', async () => {
    await denied(
      payload.create({
        collection: 'users',
        data: { email: 'x@example.test', password: 'synthetic-X-1', role: 'ADMIN' },
        ...asUser(editor),
      }),
    );
    await denied(
      payload.create({
        collection: 'redirects',
        data: { from: '/a', to: '/b', type: '301' },
        ...asUser(editor),
      }),
    );
    await denied(
      payload.updateGlobal({ slug: 'site-settings', data: { ga4Id: 'G-SYNTH' }, ...asUser(editor) }),
    );

    await payload.create({
      collection: 'redirects',
      data: { from: '/old', to: '/new', type: '301' },
      ...asUser(admin),
    });
    await payload.updateGlobal({
      slug: 'site-settings',
      data: { ga4Id: 'G-SYNTH' },
      ...asUser(admin),
    });
    const created = await payload.create({
      collection: 'users',
      data: { email: 'second-editor@example.test', password: 'synthetic-E2-1', role: 'EDITOR' },
      ...asUser(admin),
    });
    expect(created.role).toBe('EDITOR');
  });

  it('EDITOR can read only their own user record; anonymous cannot read users or redirects', async () => {
    const seen = await payload.find({ collection: 'users', ...asUser(editor) });
    expect(seen.docs.map((u) => u.id)).toEqual([editor.id]);
    expect((await payload.find({ collection: 'users', ...asUser(admin) })).totalDocs).toBeGreaterThan(1);
    await denied(payload.find({ collection: 'redirects', ...asUser(editor) }));
    await denied(payload.find({ collection: 'redirects', ...anonymous }));
    await denied(payload.updateGlobal({ slug: 'site-settings', data: {}, ...anonymous }));
  });

  it('EDITOR cannot escalate role', async () => {
    const updated = await payload.update({
      collection: 'users',
      id: editor.id,
      data: { role: 'ADMIN' },
      ...asUser(editor),
    }).catch(() => null);
    const row = await payload.findByID({ collection: 'users', id: editor.id });
    expect(row.role).toBe('EDITOR');
    expect(updated === null || updated.role === 'EDITOR').toBe(true);
  });

  it('EDITOR manages articles, projects, job postings, documents and media', async () => {
    const cat = await payload.create({
      collection: 'article-categories',
      data: { name: 'Synthetic', slug: 'synthetic-rbac', order: 1 },
      ...asUser(admin),
    });
    await denied(
      payload.create({
        collection: 'article-categories',
        data: { name: 'Nope', slug: 'nope', order: 2 },
        ...asUser(editor),
      }),
    );
    await payload.create({
      collection: 'articles',
      data: { title: 'Synthetic article', slug: 'synthetic-article-rbac', category: cat.id },
      draft: true,
      ...asUser(editor),
    });
    await payload.create({
      collection: 'projects',
      data: { name: 'Synthetic project', slug: 'synthetic-project-rbac' },
      draft: true,
      ...asUser(editor),
    });
    await payload.create({
      collection: 'job-postings',
      data: { title: 'Synthetic job', slug: 'synthetic-job-rbac', applyInstruction: 'synthetic' },
      draft: true,
      ...asUser(editor),
    });
    const png = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
      'base64',
    );
    const media = await payload.create({
      collection: 'media-assets',
      data: { alt: 'synthetic image' },
      file: { data: png, mimetype: 'image/png', name: 'synthetic-rbac.png', size: png.length },
      ...asUser(editor),
    });
    expect(media.rightsStatus).toBe('UNCONFIRMED');
    await payload.create({
      collection: 'documents',
      data: { title: 'Synthetic doc', file: media.id },
      draft: true,
      ...asUser(editor),
    });
  });
});

describe('draft / published lifecycle', () => {
  it('hides drafts from the public and exposes them once published', async () => {
    const draft = await payload.create({
      collection: 'articles',
      data: { title: 'Lifecycle', slug: 'synthetic-lifecycle' },
      draft: true,
      ...asUser(editor),
    });
    const where = { slug: { equals: 'synthetic-lifecycle' } };
    expect((await payload.find({ collection: 'articles', where, ...anonymous })).totalDocs).toBe(0);
    expect(
      (await payload.find({ collection: 'articles', where, ...asUser(editor) })).totalDocs,
    ).toBe(1);

    await payload.update({
      collection: 'articles',
      id: draft.id,
      data: { _status: 'published' },
      ...asUser(editor),
    });
    const pub = await payload.find({ collection: 'articles', where, ...anonymous });
    expect(pub.totalDocs).toBe(1);
    expect(pub.docs[0]?._status).toBe('published');
  });

  it('does not expose media with UNCONFIRMED rights publicly', async () => {
    const res = await payload.find({ collection: 'media-assets', ...anonymous });
    expect(res.totalDocs).toBe(0);
  });
});

describe('contracted taxonomies', () => {
  it('supports 5 article categories without a hard ceiling, and 4 service areas', async () => {
    for (let i = 1; i <= 6; i++) {
      await payload.create({
        collection: 'article-categories',
        data: { name: `Synthetic category ${i}`, slug: `synthetic-cat-${i}`, order: i },
        ...asUser(admin),
      });
    }
    const cats = await payload.find({ collection: 'article-categories', limit: 50, ...asUser(admin) });
    expect(cats.totalDocs).toBeGreaterThanOrEqual(6);

    for (const [i, slug] of ['van-hanh', 'bao-ve', 've-sinh', 'pccc'].entries()) {
      await payload.create({
        collection: 'service-areas',
        data: { name: `Synthetic ${slug}`, slug, summary: 'synthetic', order: i },
        ...asUser(admin),
      });
    }
    const areas = await payload.find({ collection: 'service-areas', ...asUser(admin) });
    expect(areas.totalDocs).toBe(4);
  });

  it('lets ADMIN edit the singleton pages as drafts', async () => {
    for (const slug of ['home-page', 'about-page', 'process-page', 'contact-page']) {
      const doc = await payload.updateGlobal({
        slug: slug as 'home-page',
        data: { title: 'synthetic' },
        draft: true,
        ...asUser(admin),
      });
      expect(doc.title).toBe('synthetic');
    }
  });
});

describe('ContactLead durable persistence', () => {
  it('stores a synthetic lead in PostgreSQL and enforces fail-closed access', async () => {
    const { createContactLead } = await import('../../src/lib/contact-lead');
    const lead = await createContactLead(payload, {
      name: 'Synthetic Person',
      phone: '0000000000',
      requestType: 'khao-sat',
      message: 'synthetic message',
      consent: true,
      sourcePage: '/lien-he',
      utm: { utm_source: 'synthetic' },
    });

    const { rows } = await pool.query(
      'select name, phone, request_type, consent_given, status from contact_leads where id = $1',
      [lead.id],
    );
    expect(rows).toEqual([
      {
        name: 'Synthetic Person',
        phone: '0000000000',
        request_type: 'khao-sat',
        consent_given: true,
        status: 'new',
      },
    ]);

    await denied(payload.find({ collection: 'contact-leads', ...asUser(editor) }));
    await denied(payload.find({ collection: 'contact-leads', ...anonymous }));
    await denied(
      payload.create({
        collection: 'contact-leads',
        data: { name: 'x', phone: '1', requestType: 'khac', message: 'm', sourcePage: '/', consent: { given: true, at: new Date().toISOString() } },
        ...anonymous,
      }),
    );
    expect((await payload.find({ collection: 'contact-leads', ...asUser(admin) })).totalDocs).toBe(1);
    await denied(payload.delete({ collection: 'contact-leads', id: lead.id, ...asUser(admin) }));
  });

  it('rejects leads without consent', async () => {
    const { createContactLead } = await import('../../src/lib/contact-lead');
    await expect(
      createContactLead(payload, {
        name: 'a',
        phone: '1',
        requestType: 'khac',
        message: 'm',
        consent: false,
        sourcePage: '/',
      }),
    ).rejects.toThrow('consent is required');
  });
});
