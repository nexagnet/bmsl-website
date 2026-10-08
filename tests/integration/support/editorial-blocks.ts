import { mkdirSync, statSync } from 'node:fs';
import path from 'node:path';
import pg from 'pg';
import { type APIRequestContext, type Browser, type BrowserType, chromium, firefox, request, webkit } from 'playwright';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { SURVEY_CTA } from '../../../src/lib/site';
import { ENGINES, type Engine, SIZES } from './browser-policy';
import type { BrowserUatContext } from './browser-blocks';
import { JOBS } from './markers';

// Issue #84 editorial acceptance, executed under the existing `pnpm test:integration` step against the SAME production
// build, server and disposable PostgreSQL database as http-smoke.test.ts. Synthetic content only.
//
// Proves (actual engines, phone + desktop viewports): the real ADMIN and EDITOR roles sign in over HTTP, create DRAFT
// content through the CMS REST API, the draft is visible to staff and absent from the anonymous site, publishing makes
// it render, and the survey CTA, document link and job apply block are present, visible, inside the viewport width and
// working. Revoking the approval of an article cover image removes it from the page and its URL; unpublishing removes the
// page. Screenshots are written under test-results/w5b4/editorial/.
//
// Does NOT prove: a draft *preview route* (the website has none; staff see drafts through the CMS API/admin only),
// customer-confirmed content, unconfirmed source gaps, the dev-content runtime, or anything on Northflank.

const TYPES: Record<Engine, BrowserType> = { chromium, firefox, webkit };
const SHOT_DIR = 'test-results/w5b4/editorial';
const VIEWS = SIZES.filter((s) => s.name !== 'tablet');
const SERVICE = { slug: 'synthetic-editorial-service', name: 'Dịch vụ thử nghiệm biên tập', summary: 'Tóm tắt dịch vụ thử nghiệm' };
const ARTICLE = { slug: 'synthetic-editorial-article', title: 'Bài viết thử nghiệm biên tập', excerpt: 'Tóm tắt bài viết thử nghiệm' };
const CATEGORY_SLUG = 'synthetic-editorial-category';
const UAT_DOCUMENT_TITLE = 'Synthetic UAT Approved Document';

const richText = (t: string) => ({
  root: {
    type: 'root',
    format: '',
    indent: 0,
    version: 1,
    direction: 'ltr',
    children: [
      {
        type: 'paragraph',
        format: '',
        indent: 0,
        version: 1,
        direction: 'ltr',
        children: [{ type: 'text', text: t, version: 1, detail: 0, format: 0, mode: 'normal', style: '' }],
      },
    ],
  },
});

export function registerEditorialBlocks(ctx: BrowserUatContext): void {
  const browsers = new Map<Engine, Browser>();
  const ids: { service?: number | string; article?: number | string; coverId?: number; coverFilename?: string; categoryId?: number } = {};
  const articlePath = `/kien-thuc/${CATEGORY_SLUG}/${ARTICLE.slug}`;
  const servicePath = `/dich-vu/${SERVICE.slug}`;

  const sql = async <T extends pg.QueryResultRow>(text: string, values: unknown[] = []): Promise<T[]> => {
    const client = new pg.Client({ connectionString: ctx.smokeUrl });
    await client.connect();
    try {
      return (await client.query<T>(text, values)).rows;
    } finally {
      await client.end();
    }
  };
  const signIn = async (email: string, password: string): Promise<APIRequestContext> => {
    const api = await request.newContext({ baseURL: ctx.base, extraHTTPHeaders: { origin: ctx.base } });
    const res = await api.post('/api/users/login', { data: { email, password } });
    expect(res.status(), `login ${email}`).toBe(200);
    return api;
  };
  const anonymousStatus = async (p: string) => (await fetch(`${ctx.base}${p}`, { redirect: 'manual' })).status;

  describe('Editorial acceptance #84: CMS roles, draft/publish/revoke, representative pages (real server, disposable PostgreSQL)', () => {
    beforeAll(async () => {
      Object.assign(ids, await ctx.runFixture('editorial'));
      for (const engine of ENGINES) browsers.set(engine, await TYPES[engine].launch({ headless: true, timeout: 120_000 }));
      mkdirSync(path.join(ctx.repoRoot, SHOT_DIR), { recursive: true });
    }, 600_000);
    afterAll(async () => {
      for (const browser of browsers.values()) await browser.close().catch(() => undefined);
    }, 120_000);

    it('ADMIN creates a service draft and EDITOR an article draft: staff see them, the public does not; publishing exposes them', async () => {
      const adminRows = await sql<{ email: string }>("select email from users where role = 'ADMIN'");
      expect(adminRows).toHaveLength(1);
      const admin = await signIn(adminRows[0]!.email, ctx.adminPassword);
      const editor = await signIn(ctx.editorEmail, ctx.editorPassword);
      try {
        // ADMIN-only collection: an EDITOR must be refused.
        const refused = await editor.post('/api/service-areas?draft=true', {
          data: { name: 'x', slug: 'synthetic-editorial-refused', summary: 'x', _status: 'draft' },
        });
        expect([401, 403]).toContain(refused.status());

        const service = await admin.post('/api/service-areas?draft=true', {
          data: { name: SERVICE.name, slug: SERVICE.slug, summary: SERVICE.summary, body: richText('Nội dung dịch vụ thử nghiệm'), order: 1, _status: 'draft' },
        });
        expect(service.status(), await service.text()).toBe(201);
        ids.service = (await service.json()).doc.id;

        const article = await editor.post('/api/articles?draft=true', {
          data: {
            title: ARTICLE.title,
            slug: ARTICLE.slug,
            excerpt: ARTICLE.excerpt,
            body: richText('Nội dung bài viết thử nghiệm'),
            category: ids.categoryId,
            cover: ids.coverId,
            publishedAt: '2026-01-02T00:00:00.000Z',
            _status: 'draft',
          },
        });
        expect(article.status(), await article.text()).toBe(201);
        ids.article = (await article.json()).doc.id;

        // Staff can read the drafts; the anonymous site and REST cannot.
        expect((await admin.get(`/api/service-areas/${ids.service}?draft=true`)).status()).toBe(200);
        expect((await editor.get(`/api/articles/${ids.article}?draft=true`)).status()).toBe(200);
        expect(await anonymousStatus(servicePath)).toBe(404);
        expect(await anonymousStatus(articlePath)).toBe(404);
        const anonList = await (await fetch(`${ctx.base}/api/articles?where[slug][equals]=${ARTICLE.slug}`)).json();
        expect(anonList.totalDocs).toBe(0);
        expect(await (await fetch(`${ctx.base}/sitemap.xml`)).text()).not.toContain(ARTICLE.slug);

        // A real page-visible edit of the draft, then publish.
        expect((await editor.patch(`/api/articles/${ids.article}?draft=true`, { data: { excerpt: `${ARTICLE.excerpt} (đã sửa)` } })).status()).toBe(200);
        expect((await admin.patch(`/api/service-areas/${ids.service}`, { data: { _status: 'published' } })).status()).toBe(200);
        expect((await editor.patch(`/api/articles/${ids.article}`, { data: { _status: 'published' } })).status()).toBe(200);

        expect(await anonymousStatus(servicePath)).toBe(200);
        expect(await anonymousStatus(articlePath)).toBe(200);
        const rows = await sql<{ _status: string }>('select _status from articles where slug = $1', [ARTICLE.slug]);
        expect(rows).toEqual([{ _status: 'published' }]);
      } finally {
        await admin.dispose();
        await editor.dispose();
      }
    }, 240_000);

    for (const engine of ENGINES) {
      for (const view of VIEWS) {
        describe(`[${engine} / ${view.name} ${view.width}x${view.height}] representative pages`, () => {
          const open = async (p: string, fn: (page: import('playwright').Page) => Promise<void>) => {
            const context = await browsers.get(engine)!.newContext({ viewport: { width: view.width, height: view.height }, locale: 'vi-VN', serviceWorkers: 'block' });
            try {
              const page = await context.newPage();
              const response = await page.goto(`${ctx.base}${p}`, { waitUntil: 'load', timeout: 60_000 });
              expect(response?.status(), p).toBe(200);
              // Layout: the document never scrolls sideways and the main heading is visible inside the viewport width.
              const h1 = page.locator('main h1').first();
              await h1.waitFor({ state: 'visible', timeout: 30_000 });
              const box = await h1.boundingBox();
              expect(box && box.x >= 0 && box.x + box.width <= view.width + 1, `${p} h1 inside viewport`).toBe(true);
              expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), `${p} has no horizontal overflow`).toBe(true);
              await fn(page);
              const file = path.join(ctx.repoRoot, SHOT_DIR, `${engine}-${view.name}-${p.replace(/[^a-z0-9]+/gi, '_')}.png`);
              await page.screenshot({ path: file, fullPage: true });
              expect(statSync(file).size, `${p} screenshot`).toBeGreaterThan(2_000);
            } finally {
              await context.close().catch(() => undefined);
            }
          };
          const surveyCta = async (page: import('playwright').Page) => {
            const cta = page.locator('.survey-cta-section a.button');
            await cta.scrollIntoViewIfNeeded();
            await cta.waitFor({ state: 'visible' });
            expect((await cta.innerText()).trim()).toBe(SURVEY_CTA.label);
            expect(await cta.getAttribute('href')).toBe(SURVEY_CTA.href);
            const box = await cta.boundingBox();
            expect(box && box.width > 0 && box.x >= 0 && box.x + box.width <= view.width + 1, 'CTA inside viewport').toBe(true);
            await cta.click();
            await page.waitForURL(/\/lien-he\?requestType=khao-sat/, { timeout: 30_000 });
            await page.locator('form.contact-form').waitFor({ state: 'visible', timeout: 30_000 });
            await expect.poll(() => page.locator('select[name="requestType"]').inputValue(), { timeout: 15_000 }).toBe('khao-sat');
          };

          it('service: published content, working survey CTA', () =>
            open(servicePath, async (page) => {
              expect(await page.locator('main h1').first().innerText()).toBe(SERVICE.name);
              expect(await page.locator('main').innerText()).toContain('Nội dung dịch vụ thử nghiệm');
              await surveyCta(page);
            }), 180_000);

          it('article: published content with APPROVED cover, working survey CTA', () =>
            open(articlePath, async (page) => {
              expect(await page.locator('main h1').first().innerText()).toBe(ARTICLE.title);
              const cover = page.locator('main article img').first();
              await expect.poll(() => cover.evaluate((el: HTMLImageElement) => el.complete && el.naturalWidth), { timeout: 15_000 }).toBeGreaterThan(0);
              await surveyCta(page);
            }), 180_000);

          it('project: published CONFIRMED project, working survey CTA', () => open(`/du-an/${ctx.publishedSlug}`, surveyCta), 180_000);

          it('document: the approved document link is visible and points at an approved file', () =>
            open('/quy-trinh-minh-bach', async (page) => {
              const link = page.getByRole('link', { name: UAT_DOCUMENT_TITLE });
              await link.scrollIntoViewIfNeeded();
              await link.waitFor({ state: 'visible' });
              expect(await link.getAttribute('href')).toMatch(/^\/api\/media-assets\/file\//);
              const res = await page.request.get(`${ctx.base}${await link.getAttribute('href')}`);
              expect(res.status()).toBe(200);
              expect(res.headers()['content-type']).toMatch(/pdf/);
            }), 180_000);

          it('job: published CONFIRMED posting shows the apply instruction', () =>
            open(`/tuyen-dung/${JOBS.confirmed}`, async (page) => {
              const apply = page.getByRole('heading', { name: 'Cách ứng tuyển' });
              await apply.scrollIntoViewIfNeeded();
              await apply.waitFor({ state: 'visible' });
              expect(await page.locator('main').innerText()).toContain('Synthetic apply instruction');
            }), 180_000);
        });
      }
    }

    it('EDITOR revokes the approved cover image: it leaves the article page and its URL; ADMIN unpublishes: pages disappear', async () => {
      const adminRows = await sql<{ email: string }>("select email from users where role = 'ADMIN'");
      const admin = await signIn(adminRows[0]!.email, ctx.adminPassword);
      const editor = await signIn(ctx.editorEmail, ctx.editorPassword);
      try {
        const coverUrl = `/api/media-assets/file/${ids.coverFilename}`;
        expect((await fetch(`${ctx.base}${coverUrl}`)).status).toBe(200);
        expect((await editor.patch(`/api/media-assets/${ids.coverId}`, { data: { rightsStatus: 'UNCONFIRMED' } })).status()).toBe(200);

        const html = await (await fetch(`${ctx.base}${articlePath}`)).text();
        expect(html).not.toContain(String(ids.coverFilename));
        const after = await fetch(`${ctx.base}${coverUrl}`);
        expect(after.status).not.toBe(200);
        expect(after.headers.get('content-type') ?? '').not.toMatch(/^image\//);

        expect((await admin.patch(`/api/service-areas/${ids.service}`, { data: { _status: 'draft' } })).status()).toBe(200);
        expect((await editor.patch(`/api/articles/${ids.article}`, { data: { _status: 'draft' } })).status()).toBe(200);
        expect(await anonymousStatus(servicePath)).toBe(404);
        expect(await anonymousStatus(articlePath)).toBe(404);
        expect(await (await fetch(`${ctx.base}/sitemap.xml`)).text()).not.toContain(ARTICLE.slug);
      } finally {
        await admin.dispose();
        await editor.dispose();
      }
    }, 240_000);
  });
}
