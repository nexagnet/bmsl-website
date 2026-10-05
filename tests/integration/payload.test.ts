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

describe('W5B3 job posting confirmed facts (migration 20261005_150000_job_confirmed_facts)', () => {
  // Explicit LEGACY-SOURCE for unconfirmed fixtures (sourceStatus is required in the generated types).
  const job = (slug: string, extra: Record<string, unknown> = {}) =>
    ({
      title: `Synthetic ${slug}`,
      slug,
      applyInstruction: 'synthetic',
      sourceStatus: 'LEGACY-SOURCE',
      ...extra,
    }) as never;
  const confirmedFacts = {
    sourceStatus: 'CONFIRMED' as const,
    datePosted: '2026-03-04T00:00:00.000Z',
    jobLocation: { addressLocality: 'Synthetic City', addressCountry: 'ZZ' },
  };
  const columns = async (table: string) =>
    (await pool.query('select column_name from information_schema.columns where table_name = $1', [table])).rows.map(
      (r: { column_name: string }) => r.column_name,
    );

  it('migration up added the optional columns to the live and version tables and is recorded', async () => {
    const mig = await pool.query("select 1 from payload_migrations where name = '20261005_150000_job_confirmed_facts'");
    expect(mig.rowCount).toBe(1);
    const live = await columns('job_postings');
    for (const c of ['date_posted', 'job_location_street_address', 'job_location_address_locality', 'job_location_address_region', 'job_location_postal_code', 'job_location_address_country', 'source_status']) {
      expect(live, c).toContain(c);
    }
    const versions = await columns('_job_postings_v');
    for (const c of ['version_date_posted', 'version_job_location_street_address', 'version_job_location_address_locality', 'version_job_location_address_region', 'version_job_location_postal_code', 'version_job_location_address_country', 'version_source_status']) {
      expect(versions, c).toContain(c);
    }
  });

  it('migration down then up restores the columns without touching other tables', async () => {
    const { migrations } = await import('../../src/migrations');
    const m = migrations.find((x) => x.name === '20261005_150000_job_confirmed_facts')!;
    const before = await pool.query('select count(*)::int as n from users');
    const args = { db: payload.db.drizzle, payload, req: {} as never };
    await m.down(args as never);
    expect(await columns('job_postings')).not.toContain('source_status');
    expect(await columns('_job_postings_v')).not.toContain('version_source_status');
    expect(await columns('job_postings')).toContain('slug');
    expect((await pool.query('select count(*)::int as n from users')).rows[0].n).toBe(before.rows[0].n);
    await m.up(args as never);
    expect(await columns('job_postings')).toContain('source_status');
    expect(await columns('_job_postings_v')).toContain('version_source_status');
  });

  it('facts are optional, default to unconfirmed and are never derived from createdAt', async () => {
    const created = await payload.create({ collection: 'job-postings', data: { title: 'Synthetic default', slug: 'synthetic-job-facts-default', applyInstruction: 'synthetic' } as never });
    expect(created.sourceStatus).toBe('LEGACY-SOURCE');
    expect(created.datePosted ?? null).toBeNull();
    expect(created.jobLocation?.addressCountry ?? null).toBeNull();
    expect(created.createdAt).toBeTruthy();
  });

  it('stores operator-entered facts and rejects a malformed country code', async () => {
    const created = await payload.create({ collection: 'job-postings', data: job('synthetic-job-facts-stored', confirmedFacts) });
    expect(created.sourceStatus).toBe('CONFIRMED');
    expect(created.datePosted).toBe('2026-03-04T00:00:00.000Z');
    expect(created.jobLocation?.addressLocality).toBe('Synthetic City');
    await denied(
      payload.create({
        collection: 'job-postings',
        data: job('synthetic-job-facts-bad-country', { jobLocation: { addressLocality: 'Synthetic City', addressCountry: 'Zzz' } }),
      }),
    );
  });

  it('publication needs CONFIRMED; the anonymous reader sees only published CONFIRMED jobs', async () => {
    await denied(payload.create({ collection: 'job-postings', data: job('synthetic-job-pub-legacy', { _status: 'published' }) }));
    await payload.create({ collection: 'job-postings', data: job('synthetic-job-pub-confirmed', { ...confirmedFacts, _status: 'published' }) });
    await payload.create({ collection: 'job-postings', data: job('synthetic-job-draft-confirmed', { ...confirmedFacts, _status: 'draft' }) });
    await payload.create({ collection: 'job-postings', data: job('synthetic-job-draft-legacy', { _status: 'draft' }) });
    const slugs = async () =>
      (await payload.find({ collection: 'job-postings', limit: 100, ...anonymous })).docs.map((d) => d.slug);
    expect(await slugs()).toEqual(['synthetic-job-pub-confirmed']);

    // A stored published row that is not CONFIRMED (pre-existing data) is invisible to the anonymous reader.
    await pool.query("update job_postings set source_status = 'LEGACY-SOURCE' where slug = 'synthetic-job-pub-confirmed'");
    expect(await slugs()).toEqual([]);
    const staff = await payload.find({ collection: 'job-postings', where: { slug: { equals: 'synthetic-job-pub-confirmed' } }, ...asUser(editor) });
    expect(staff.totalDocs).toBe(1);
  });
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
      data: { title: 'Synthetic job', slug: 'synthetic-job-rbac', applyInstruction: 'synthetic', sourceStatus: 'LEGACY-SOURCE' },
      draft: true,
      ...asUser(editor),
    });
    const png = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
      'base64',
    );
    const media = await payload.create({
      collection: 'media-assets',
      data: { alt: 'synthetic image', rightsStatus: 'UNCONFIRMED' },
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
        data: { name: 'x', phone: '1', requestType: 'khac', message: 'm', sourcePage: '/', status: 'new', consent: { given: true, at: new Date().toISOString() } },
        ...anonymous,
      }),
    );
    expect((await payload.find({ collection: 'contact-leads', ...asUser(admin) })).totalDocs).toBe(1);
    await denied(payload.delete({ collection: 'contact-leads', id: lead.id, ...asUser(admin) }));
  });

  it('submitContact: persists first, rejects invalid, discards honeypot, notifies only after persistence', async () => {
    const { submitContact } = await import('../../src/lib/contact-submission');
    const count = async () =>
      Number((await pool.query('select count(*)::int as n from contact_leads')).rows[0].n);
    const before = await count();
    const valid = {
      name: 'Synthetic Submit',
      phone: '0900000001',
      requestType: 'khac',
      message: 'synthetic submit message',
      consent: true,
      sourcePage: '/lien-he',
    };

    const seenAtNotify: number[] = [];
    const ok = await submitContact(payload, valid, async () => {
      seenAtNotify.push(await count());
    });
    expect(ok).toEqual({ status: 200, body: { ok: true, persisted: true } });
    expect(seenAtNotify).toEqual([before + 1]);
    expect(await count()).toBe(before + 1);

    const failingNotifier = await submitContact(payload, { ...valid, name: 'Synthetic Notify Fail' }, async () => {
      throw new Error('notifier down');
    });
    expect(failingNotifier.status).toBe(200);
    expect(await count()).toBe(before + 2);

    const cases = [
      { ...valid, name: '' },
      { ...valid, phone: 'abc' },
      { ...valid, requestType: 'other' },
      { ...valid, consent: false },
    ];
    for (const bad of cases) {
      let notified = false;
      const res = await submitContact(payload, bad, async () => {
        notified = true;
      });
      expect(res.status).toBe(400);
      expect(notified).toBe(false);
    }
    expect(await count()).toBe(before + 2);

    let botNotified = false;
    const bot = await submitContact(payload, { ...valid, website: 'http://spam.example' }, async () => {
      botNotified = true;
    });
    expect(bot).toEqual({ status: 200, body: { ok: true } });
    expect(botNotified).toBe(false);
    expect(await count()).toBe(before + 2);

    const stored = await pool.query(
      'select consent_given, consent_at, status, source_page from contact_leads where name = $1',
      ['Synthetic Submit'],
    );
    expect(stored.rows[0]).toMatchObject({ consent_given: true, status: 'new', source_page: '/lien-he' });
    expect(stored.rows[0].consent_at).toBeInstanceOf(Date);
  });

  it('submitContact: returns failure, not success, when persistence fails', async () => {
    const { submitContact } = await import('../../src/lib/contact-submission');
    const broken = { create: async () => { throw new Error('db down'); } } as unknown as Payload;
    let notified = false;
    const res = await submitContact(
      broken,
      { name: 'a', phone: '0900000002', requestType: 'khac', message: 'm', consent: true, sourcePage: '/lien-he' },
      async () => {
        notified = true;
      },
    );
    expect(res).toEqual({ status: 500, body: { ok: false, error: 'persist_failed' } });
    expect(notified).toBe(false);
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
