import pg from 'pg';
import type { Payload } from 'payload';
import { getPayload } from 'payload';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { getDatabaseUrl } from '../../src/lib/database';
import { toPage } from '../../src/lib/public-content';

// Issue #102 — role matrix (ADMIN / EDITOR / anonymous) and the HomePage hero lifecycle driven only through the CMS.
// Synthetic data only, disposable local PostgreSQL.
process.env.PAYLOAD_SECRET ??= 'synthetic-integration-secret';
const databaseUrl = getDatabaseUrl();
if (!['localhost', '127.0.0.1', '::1', '[::1]'].includes(new URL(databaseUrl).hostname)) {
  throw new Error('Refusing to reset a non-local database');
}

type StaffUser = { id: number | string; collection: 'users'; role: string };

let payload: Payload;
let admin: StaffUser;
let editor: StaffUser;
const pool = new pg.Pool({ connectionString: databaseUrl });

const asUser = (u: StaffUser) => ({ user: u, overrideAccess: false as const });
const anonymous = { overrideAccess: false as const };
const denied = (p: Promise<unknown>) => expect(p).rejects.toThrow();
const png = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
  'base64',
);

const upload = (name: string, rightsStatus: 'APPROVED' | 'UNCONFIRMED', actor: StaffUser = editor) =>
  payload.create({
    collection: 'media-assets',
    data: { alt: `synthetic ${name}`, rightsStatus },
    file: { data: png, mimetype: 'image/png', name: `${name}.png`, size: png.length },
    ...asUser(actor),
  });

// Exactly what the public site does (src/lib/cms.ts getPage): no user, overrideAccess:false, published only.
const publicHome = async () =>
  toPage(await payload.findGlobal({ slug: 'home-page', overrideAccess: false, depth: 2, draft: false }));

beforeAll(async () => {
  await pool.query('drop schema if exists public cascade; create schema public;');
  const { default: config } = await import('../../src/payload.config');
  payload = await getPayload({ config });
  await payload.db.migrate();
  // The first user is always ADMIN; later users stay EDITOR unless an ADMIN promotes them.
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

describe('role matrix', () => {
  it('has one ADMIN and one EDITOR', () => {
    expect(admin.role).toBe('ADMIN');
    expect(editor.role).toBe('EDITOR');
  });

  it('globals: ADMIN writes every singleton, EDITOR and anonymous write none', async () => {
    for (const slug of ['home-page', 'about-page', 'process-page', 'contact-page'] as const) {
      await payload.updateGlobal({ slug, data: { title: `Synthetic ${slug}`, _status: 'draft' }, draft: true, ...asUser(admin) });
      await denied(payload.updateGlobal({ slug, data: { title: 'editor' }, draft: true, ...asUser(editor) }));
      await denied(payload.updateGlobal({ slug, data: { title: 'anon' }, draft: true, ...anonymous }));
    }
    await payload.updateGlobal({ slug: 'site-settings', data: { ga4Id: 'G-SYNTHETIC' }, ...asUser(admin) });
    await denied(payload.updateGlobal({ slug: 'site-settings', data: { ga4Id: 'G-E' }, ...asUser(editor) }));
    await denied(payload.updateGlobal({ slug: 'site-settings', data: { ga4Id: 'G-A' }, ...anonymous }));
  });

  it('globals: a draft singleton is invisible to the public but visible to staff', async () => {
    expect(await publicHome()).toBeNull();
    const asEditor = await payload.findGlobal({ slug: 'home-page', draft: true, ...asUser(editor) });
    expect(asEditor.title).toBe('Synthetic home-page');
  });

  it('admin-only collections: EDITOR cannot create, update or delete; ADMIN can', async () => {
    const area = await payload.create({
      collection: 'service-areas',
      data: { name: 'Synthetic area', slug: 'synthetic-area', summary: 'x', order: 90 },
      draft: true,
      ...asUser(admin),
    });
    await denied(payload.update({ collection: 'service-areas', id: area.id, data: { summary: 'y' }, ...asUser(editor) }));
    await denied(payload.delete({ collection: 'service-areas', id: area.id, ...asUser(editor) }));
    await payload.update({ collection: 'service-areas', id: area.id, data: { summary: 'z' }, ...asUser(admin) });
    await payload.delete({ collection: 'service-areas', id: area.id, ...asUser(admin) });

    await denied(
      payload.create({ collection: 'article-categories', data: { name: 'c', slug: 'c' }, draft: true, ...asUser(editor) }),
    );
    await denied(payload.find({ collection: 'redirects', ...asUser(editor) }));
    await expect(payload.find({ collection: 'redirects', ...asUser(admin) })).resolves.toBeDefined();
    await denied(payload.find({ collection: 'contact-leads', ...asUser(editor) }));
  });

  it('users: EDITOR cannot create users or read other users; ADMIN can', async () => {
    await denied(
      payload.create({
        collection: 'users',
        data: { email: 'third@example.test', password: 'synthetic-Third-1', role: 'EDITOR' },
        ...asUser(editor),
      }),
    );
    const seenByEditor = await payload.find({ collection: 'users', ...asUser(editor) });
    expect(seenByEditor.docs.map((u) => u.id)).toEqual([editor.id]);
    expect((await payload.find({ collection: 'users', ...asUser(admin) })).totalDocs).toBe(2);
    await denied(
      payload.update({ collection: 'users', id: editor.id, data: { role: 'ADMIN' }, ...asUser(editor) }),
    );
  });
});

describe('homepage hero driven only by the CMS (issue #102)', () => {
  let approved: Awaited<ReturnType<typeof upload>>;
  let unapproved: Awaited<ReturnType<typeof upload>>;

  it('EDITOR cannot edit the hero; ADMIN saves a draft hero that stays private', async () => {
    approved = await upload('hero-approved', 'APPROVED');
    unapproved = await upload('hero-unapproved', 'UNCONFIRMED');
    await denied(
      payload.updateGlobal({
        slug: 'home-page',
        data: { hero: { headline: 'editor headline' } },
        draft: true,
        ...asUser(editor),
      }),
    );
    await payload.updateGlobal({
      slug: 'home-page',
      draft: true,
      data: { title: 'Synthetic home', hero: { headline: 'Synthetic headline A', desktopImage: approved.id } },
      ...asUser(admin),
    });
    expect(await publicHome()).toBeNull();
  });

  it('publish shows the new headline and the APPROVED image with no code change', async () => {
    await payload.updateGlobal({ slug: 'home-page', data: { _status: 'published' }, ...asUser(admin) });
    const home = await publicHome();
    expect(home?.hero?.headline).toBe('Synthetic headline A');
    expect(home?.hero?.desktopImage?.url).toContain('hero-approved');
    expect(home?.hero?.mobileImage).toBeUndefined();
  });

  it('replacing the image and text through the CMS changes the public output', async () => {
    const second = await upload('hero-second', 'APPROVED', admin);
    await payload.updateGlobal({
      slug: 'home-page',
      data: {
        hero: {
          headline: 'Synthetic headline B',
          desktopImage: second.id,
          mobileImage: approved.id,
          focalPoint: 'top',
          overlayPreset: 'strong',
          layoutPreset: 'split',
        },
        _status: 'published',
      },
      ...asUser(admin),
    });
    const hero = (await publicHome())?.hero;
    expect(hero?.headline).toBe('Synthetic headline B');
    expect(hero?.desktopImage?.url).toContain('hero-second');
    expect(hero?.mobileImage?.url).toContain('hero-approved');
    expect([hero?.focalPoint, hero?.overlayPreset, hero?.layoutPreset]).toEqual(['top', 'strong', 'split']);
  });

  it('an edit left as draft does not leak; the published hero is unchanged', async () => {
    await payload.updateGlobal({
      slug: 'home-page',
      draft: true,
      data: { hero: { headline: 'Synthetic unpublished C' } },
      ...asUser(admin),
    });
    expect((await publicHome())?.hero?.headline).toBe('Synthetic headline B');
    // restore the published state for the following cases
    await payload.updateGlobal({ slug: 'home-page', data: { hero: { headline: 'Synthetic headline B' }, _status: 'published' }, ...asUser(admin) });
  });

  it('an unapproved image is never served, and revoking an approved image removes it', async () => {
    await payload.updateGlobal({
      slug: 'home-page',
      data: { hero: { desktopImage: unapproved.id, mobileImage: null }, _status: 'published' },
      ...asUser(admin),
    });
    expect((await publicHome())?.hero?.desktopImage).toBeUndefined();

    await payload.updateGlobal({
      slug: 'home-page',
      data: { hero: { desktopImage: approved.id }, _status: 'published' },
      ...asUser(admin),
    });
    expect((await publicHome())?.hero?.desktopImage?.url).toContain('hero-approved');

    await payload.update({ collection: 'media-assets', id: approved.id, data: { rightsStatus: 'UNCONFIRMED' }, ...asUser(admin) });
    expect((await publicHome())?.hero?.desktopImage).toBeUndefined();
  });

  it('removing the image and disabling the hero is honoured; hero text survives', async () => {
    await payload.updateGlobal({
      slug: 'home-page',
      data: { hero: { desktopImage: null, mobileImage: null }, _status: 'published' },
      ...asUser(admin),
    });
    const hero = (await publicHome())?.hero;
    expect(hero?.desktopImage).toBeUndefined();
    expect(hero?.headline).toBe('Synthetic headline B');

    await payload.updateGlobal({ slug: 'home-page', data: { hero: { enabled: false }, _status: 'published' }, ...asUser(admin) });
    expect((await publicHome())?.hero?.enabled).toBe(false);
  });

  it('an external CTA link is dropped to the safe default', async () => {
    await payload.updateGlobal({
      slug: 'home-page',
      data: { hero: { enabled: true, primaryCtaLink: 'https://evil.example/x' }, _status: 'published' },
      ...asUser(admin),
    });
    expect((await publicHome())?.hero?.primaryCta.href.startsWith('/')).toBe(true);
  });
});
