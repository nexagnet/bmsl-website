import { appendFileSync, mkdirSync, writeFileSync } from 'node:fs';
import net from 'node:net';
import path from 'node:path';
import { performance } from 'node:perf_hooks';
import AxeBuilder from '@axe-core/playwright';
import pg from 'pg';
import { type Browser, type BrowserContext, type BrowserType, chromium, firefox, type Locator, type Page, webkit } from 'playwright';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { NAV_ITEMS } from '../../../src/lib/site';
import {
  AXE_TAGS,
  ENGINES,
  type Engine,
  eventProblems,
  eventsFromDataLayer,
  LIGHTHOUSE_BUDGET,
  lighthouseFailures,
  type LighthouseLike,
  type LighthouseMeasurement,
  measureLighthouse,
  SIZES,
  summarizeAxe,
} from './browser-policy';
import { runInGroup } from './db-lifecycle';
import { JOBS, MARKERS, PRIVATE_MARKERS } from './markers';

// W5B4: executed browser UAT. Registered from http-smoke.test.ts, so it runs under the existing `pnpm test:integration`
// CI step against the SAME production build, Next server and invocation-owned disposable PostgreSQL database as the
// HTTP proof (one `next build`, one server, synthetic data only). Nothing is skipped: browser provisioning, launch,
// every engine x size combination and every assertion either passes or fails the run.
//
// What this proves (actual engines): Chromium, Firefox and WebKit as shipped by Playwright, at phone/tablet/desktop
// viewport sizes. What it does NOT prove: branded Edge/Safari, physical Windows/macOS/iOS/Android devices, touch
// emulation, or any signed customer UAT. Analytics runs against an intercepted transport (the real gtag wiring writes
// to window.dataLayer, the Google hosts are answered by a local stub): it proves our wiring, not delivery to a real
// GA4 property or the property's Enhanced Measurement setting.

type Media = { id: number; filename: string; url: string };

export type BrowserUatContext = {
  readonly base: string;
  readonly smokeUrl: string;
  readonly repoRoot: string;
  readonly fixture: { approvedPdf: Media; unconfirmed: Media };
  readonly adminPassword: string;
  readonly editorEmail: string;
  readonly editorPassword: string;
  readonly publishedSlug: string;
  readonly legacySlugs: string[];
  runFixture: (cmd: string, extra?: Record<string, string>) => Promise<Record<string, unknown>>;
};

const TYPES: Record<Engine, BrowserType> = { chromium, firefox, webkit };
const MEASUREMENT_ID = 'G-ABC123DEF4'; // synthetic id seeded by the fixture, not a real GA4 property
const UAT_DOCUMENT_TITLE = 'Synthetic UAT Approved Document'; // created by the `uat-document` fixture, approved and published
const BROWSER_SUITE_BUDGET_MS = 12 * 60_000; // whole W5B4 browser work inside the 20 min CI job, next to build + HTTP smoke
// Destination-specific content of each primary-navigation route (from the page sources in src/app/(frontend)): a fixed
// heading where the route hard-codes it, a fixed in-page landmark where the heading comes from CMS content. /gioi-thieu
// renders the CMS about-page title as its h1 (the fixture publishes MARKERS.publicAbout); its document title comes from
// SEO metadata, so only the heading is awaited there.
const IA_DESTINATIONS: Record<string, { h1?: string; titleHasH1?: boolean; selector?: string }> = {
  '/': { selector: '#home-services' },
  '/gioi-thieu': { h1: MARKERS.publicAbout, titleHasH1: false },
  '/dich-vu': { h1: 'Dịch vụ' },
  '/du-an': { h1: 'Dự án đang vận hành' },
  '/quy-trinh-minh-bach': { selector: '#docs-title' },
  '/kien-thuc': { h1: 'Kiến thức & tin tức' },
  '/tuyen-dung': { h1: 'Tuyển dụng' },
  '/lien-he': { selector: 'form.contact-form' },
};
const REPORT_DIR = 'test-results/w5b4';

type W = Window & {
  bmslAnalytics?: { setConsent(granted: boolean): void };
  dataLayer?: ArrayLike<unknown>[];
  __csp?: string[];
} & Record<string, unknown>;

// Runs in every page before its scripts: records CSP violations, which a hydrating admin or frontend must not cause.
const recordCspViolations = () => {
  const w = window as unknown as W;
  w.__csp = [];
  document.addEventListener('securitypolicyviolation', (e) => w.__csp?.push(`${e.violatedDirective} ${e.blockedURI}`));
};
// Analytics links point at tel:/zalo/pdf targets; the test only observes the analytics hook, never follows them.
const keepOnPage = () => {
  window.addEventListener(
    'click',
    (e) => {
      const link = (e.target as Element | null)?.closest?.('a[data-analytics-event]');
      if (link) e.preventDefault();
    },
    true,
  );
};

const freePort = () =>
  new Promise<number>((resolve, reject) => {
    const s = net.createServer();
    s.once('error', reject);
    s.listen(0, '127.0.0.1', () => {
      const { port } = s.address() as net.AddressInfo;
      s.close(() => resolve(port));
    });
  });

const within = <T>(label: string, value: T | undefined): T => {
  if (value === undefined) throw new Error(`missing ${label}`);
  return value;
};

export function registerBrowserBlocks(ctx: BrowserUatContext): void {
  let startedAt = performance.now(); // reset when the browser work starts: the build and HTTP smoke are not part of this budget
  const browsers = new Map<Engine, Browser>();
  const report = {
    generatedAt: new Date().toISOString(),
    node: process.version,
    provisionMs: 0,
    engines: {} as Record<string, string>,
    sizes: SIZES.map((s) => `${s.name} ${s.width}x${s.height}`),
    matrix: [] as { engine: Engine; size: string; routesScanned: number; axe: Record<string, number>; axeBlocking: number }[],
    lighthouse: [] as { url: string; formFactor: string; measurement: LighthouseMeasurement; failures: string[] }[],
    lighthouseBudget: LIGHTHOUSE_BUDGET as unknown,
    checks: [] as string[],
    elapsedMs: 0,
  };
  const note = (line: string) => report.checks.push(line);

  const sql = async <T extends pg.QueryResultRow>(text: string, values: unknown[] = []): Promise<T[]> => {
    const client = new pg.Client({ connectionString: ctx.smokeUrl });
    await client.connect();
    try {
      return (await client.query<T>(text, values)).rows;
    } finally {
      await client.end();
    }
  };
  const leadCount = async (phone: string) =>
    Number((await sql<{ n: number }>('select count(*)::int as n from contact_leads where phone = $1', [phone]))[0]?.n);
  // The initial ADMIN is whichever concurrent first-register candidate won the bootstrap lock (the W5B2 block
  // races several on purpose), so its address is read from the owned disposable database, never assumed.
  const soleAdminEmail = async () => {
    const admins = await sql<{ email: string }>("select email from users where role = 'ADMIN'");
    expect(admins, 'exactly one ADMIN exists after the bootstrap').toHaveLength(1);
    return within('admin email', admins[0]?.email);
  };

  const hydrated = (page: Page, selector: string) =>
    page.waitForFunction(
      (sel) => {
        const el = document.querySelector(sel);
        return !!el && Object.keys(el).some((k) => k.startsWith('__reactProps$') || k.startsWith('__reactFiber$'));
      },
      selector,
      { timeout: 60_000 },
    );
  const cspViolations = (page: Page) => page.evaluate(() => (window as unknown as W).__csp ?? []);
  const text = async (locator: Locator) => (await locator.innerText()).replace(/\s+/g, ' ').trim();
  // Every document navigation is awaited here, to the DOMContentLoaded of the page it asked for. A page must never be
  // told to navigate while an earlier navigation of the same page is still in flight (each test below ends settled).
  const go = (page: Page, url: string) => page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60_000 });
  // Where a page is and what it shows: attached to a failure so a CI log explains it without a re-run.
  const where = async (page: Page) => {
    const body = await page.evaluate(() => document.body?.innerText ?? '').catch(() => '(page not readable)');
    return `${page.url()} :: ${body.replace(/\s+/g, ' ').trim().slice(0, 400)}`;
  };

  describe('W5B4 browser UAT (Chromium, Firefox, WebKit; phone/tablet/desktop; real server, disposable PostgreSQL)', () => {
    const uatMedia = new Map<Engine, { slug: string; mediaId: number; filename: string; url: string }>();

    beforeAll(async () => {
      // Browser binaries: the documented Playwright installer, system libraries included (the CI runner has sudo).
      // Skipped by Playwright itself when a revision is already present; a failure fails the whole suite.
      const t0 = performance.now();
      startedAt = t0;
      await runInGroup('pnpm', ['exec', 'playwright', 'install', '--with-deps', ...ENGINES], {
        cwd: ctx.repoRoot,
        env: { ...process.env, CI: '1' },
        timeoutMs: 600_000,
      });
      report.provisionMs = Math.round(performance.now() - t0);
      for (const engine of ENGINES) {
        const browser = await TYPES[engine].launch({ headless: true, timeout: 120_000 });
        browsers.set(engine, browser);
        report.engines[engine] = browser.version();
      }
      // Published SiteSettings: analytics enabled with the synthetic GA4 id, plus the approved synthetic hotline and Zalo.
      await ctx.runFixture('analytics-on');
      // This suite's own published document with an APPROVED file (the seeded one is revoked by an earlier block).
      await ctx.runFixture('uat-document');
      const slugs = ENGINES.map((e) => `synthetic-uat-media-${e}`);
      const made = (await ctx.runFixture('uat-media', { SMOKE_FIXTURE_SLUGS: slugs.join(',') })) as {
        projects: { slug: string; mediaId: number; filename: string; url: string }[];
      };
      ENGINES.forEach((engine, i) => uatMedia.set(engine, within('uat media', made.projects[i])));
    }, 900_000);

    afterAll(async () => {
      // Closing a Playwright browser also closes its contexts and pages and waits for the browser process to exit.
      for (const browser of browsers.values()) await browser.close().catch(() => undefined);
      report.elapsedMs = Math.round(performance.now() - startedAt);
      mkdirSync(path.join(ctx.repoRoot, REPORT_DIR), { recursive: true });
      writeFileSync(path.join(ctx.repoRoot, REPORT_DIR, 'browser-uat-report.json'), `${JSON.stringify(report, null, 2)}\n`);
      const md = [
        '### W5B4 browser UAT (actual engines; no branded Edge/Safari, no physical devices, no real GA4 property)',
        '',
        `Provisioning ${report.provisionMs} ms; browser suite ${report.elapsedMs} ms (budget ${BROWSER_SUITE_BUDGET_MS} ms). Engines: ${Object.entries(report.engines).map(([k, v]) => `${k} ${v}`).join(', ')}`,
        '',
        '| engine | size | routes axe-scanned | axe violations by impact | blocking (critical+serious) |',
        '| --- | --- | --- | --- | --- |',
        ...report.matrix.map((m) => `| ${m.engine} | ${m.size} | ${m.routesScanned} | ${JSON.stringify(m.axe)} | ${m.axeBlocking} |`),
        '',
        '| Lighthouse URL | form factor | perf | a11y | best-practices | SEO | LCP ms | CLS | TBT ms | bytes | budget failures |',
        '| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |',
        ...report.lighthouse.map((l) => {
          const m = l.measurement;
          return `| ${l.url} | ${l.formFactor} | ${m.performance} | ${m.accessibility} | ${m.bestPractices} | ${m.seo} | ${m.lcpMs} | ${m.cls} | ${m.tbtMs} | ${m.totalByteWeight} | ${l.failures.length === 0 ? 'none' : l.failures.join('; ')} |`;
        }),
        '',
      ].join('\n');
      console.log(`W5B4_REPORT ${JSON.stringify(report)}`);
      console.log(md);
      if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${md}\n`);
    }, 120_000);

    const AXE_ROUTES = [
      '/',
      '/gioi-thieu',
      '/dich-vu',
      '/du-an',
      `/du-an/${ctx.publishedSlug}`,
      '/kien-thuc',
      '/quy-trinh-minh-bach',
      '/lien-he',
      '/tuyen-dung',
      `/tuyen-dung/${JOBS.confirmed}`,
    ];
    const PUBLIC_PAGES = ['/', '/gioi-thieu', '/dich-vu', '/du-an', `/du-an/${ctx.publishedSlug}`, '/kien-thuc', '/quy-trinh-minh-bach', '/lien-he', '/tuyen-dung', `/tuyen-dung/${JOBS.confirmed}`];

    let comboIndex = 0;
    for (const engine of ENGINES) {
      for (const size of SIZES) {
        const combo = comboIndex++;
        const mobileMenu = size.name !== 'desktop';
        const phoneFor = (n: number) => `0900${String(10 + combo).padStart(2, '0')}${String(n).padStart(4, '0')}`;

        describe(`[${engine} / ${size.name} ${size.width}x${size.height}]`, () => {
          let context: BrowserContext;
          let page: Page;
          const browser = () => within('browser', browsers.get(engine));

          const fillAndSubmit = async (
            p: Page,
            v: { name?: string; phone: string; message?: string; consent?: boolean; honeypot?: string },
          ) => {
            await p.locator('input[name="name"]').fill(v.name ?? 'Synthetic UAT Person');
            await p.locator('input[name="phone"]').fill(v.phone);
            await p.locator('textarea[name="message"]').fill(v.message ?? `synthetic uat message ${engine} ${size.name}`);
            const consent = p.locator('input[name="consent"]');
            if (v.consent === false) await consent.uncheck();
            else await consent.check();
            if (v.honeypot) await p.locator('input[name="website"]').evaluate((el: HTMLInputElement, value) => (el.value = value), v.honeypot);
            await p.getByRole('button', { name: 'Gửi yêu cầu' }).click();
          };
          const status = (p: Page) => p.locator('form.contact-form [role="status"]');
          const openContact = async (p: Page, query = '') => {
            await go(p, `${ctx.base}/lien-he${query}`);
            await hydrated(p, 'form.contact-form');
          };

          beforeAll(async () => {
            context = await browser().newContext({ viewport: { width: size.width, height: size.height }, locale: 'vi-VN', serviceWorkers: 'block' });
            page = await context.newPage();
            await page.addInitScript(recordCspViolations);
          }, 120_000);
          afterAll(async () => {
            await context?.close().catch(() => undefined);
          }, 60_000);
          // Each test leaves its page on a blank document, so a client-side transition or request of one test can never
          // overlap the first navigation of the next one (no concurrent navigations of the same page).
          afterEach(async () => {
            await page.goto('about:blank', { waitUntil: 'load', timeout: 30_000 });
          }, 60_000);

          it('public IA: the 8 areas are reachable from the primary navigation', async () => {
            const navName = mobileMenu ? 'Điều hướng chính (di động)' : 'Điều hướng chính';
            const labels: string[] = [];
            for (const item of NAV_ITEMS) {
              // One fresh page per real link click, closed in `finally` before the next link: a click starts a client-side
              // navigation that can still be in flight when the assertions return (the '/' link targets the current URL,
              // so the home document satisfies generic assertions at once), and the next goto('/') on the same page would
              // race it (Firefox NS_BINDING_ABORTED, WebKit "'/' interrupted by another '/'"). Nothing is retried or ignored.
              const visitor = await context.newPage();
              try {
                await visitor.addInitScript(recordCspViolations);
                await go(visitor, `${ctx.base}/`);
                await hydrated(visitor, 'header.site-header a.wordmark');
                const homeHeading = await text(visitor.locator('main h1').first());
                if (mobileMenu) await visitor.locator('details.mobile-menu > summary').click();
                const nav = visitor.getByRole('navigation', { name: navName, exact: true });
                if (labels.length === 0) {
                  const all = await nav.getByRole('link').allInnerTexts();
                  expect(all.map((t) => t.trim())).toEqual(NAV_ITEMS.map((i) => i.label));
                }
                const link = nav.getByRole('link', { name: item.label, exact: true });
                expect(await link.getAttribute('href'), `${item.label} link target`).toBe(item.href);
                await link.click();
                await expect.poll(() => new URL(visitor.url()).pathname, { timeout: 30_000, message: `url after clicking ${item.label}` }).toBe(item.href);
                // The URL changes first and the document title, rendered content and heading follow when the router commits:
                // wait for the destination itself, not for any h1 (the still-visible home document has one too).
                await expect.poll(() => visitor.title(), { timeout: 30_000, message: `title of ${item.href}` }).not.toBe('');
                await expect.poll(() => visitor.locator('main').count(), { timeout: 30_000, message: `main of ${item.href}` }).toBe(1);
                await expect.poll(() => visitor.locator('main h1').count(), { timeout: 30_000, message: `heading of ${item.href}` }).toBeGreaterThan(0);
                const expected = IA_DESTINATIONS[item.href];
                if (expected?.h1) {
                  await expect.poll(() => text(visitor.locator('main h1').first()), { timeout: 30_000, message: `h1 of ${item.href}` }).toBe(expected.h1);
                  if (expected.titleHasH1 !== false) {
                    await expect.poll(() => visitor.title(), { timeout: 30_000, message: `title of ${item.href}` }).toContain(expected.h1);
                  }
                }
                if (expected?.selector) {
                  await expect.poll(() => visitor.locator(`main ${expected.selector}`).count(), { timeout: 30_000, message: `${expected.selector} of ${item.href}` }).toBeGreaterThan(0);
                }
                if (item.href !== '/') {
                  expect(await text(visitor.locator('main h1').first()), `${item.href} still shows the home heading`).not.toBe(homeHeading);
                }
                expect(await text(visitor.locator('main')), item.href).not.toMatch(/could not be found/i);
                labels.push(item.label);
              } finally {
                await visitor.close();
              }
            }
            expect(labels).toHaveLength(8);
          }, 240_000);

          it('keyboard: skip link, menu and navigation are operable without a pointer', async () => {
            await go(page, `${ctx.base}/`);
            await page.keyboard.press('Tab');
            await expect.poll(() => page.evaluate(() => document.activeElement?.className ?? ''), { timeout: 10_000 }).toContain('skip-link');
            expect(await page.locator('a.skip-link').isVisible()).toBe(true);
            await page.keyboard.press('Enter');
            await expect.poll(() => page.evaluate(() => location.hash), { timeout: 10_000 }).toBe('#main');
            await page.keyboard.press('Tab');
            // After the skip link, sequential focus continues after the header, not inside it.
            expect(await page.evaluate(() => !!document.activeElement?.closest('header'))).toBe(false);

            await go(page, `${ctx.base}/`);
            if (mobileMenu) {
              const summary = page.locator('details.mobile-menu > summary');
              const menu = page.locator('details.mobile-menu');
              await summary.focus();
              await page.keyboard.press('Enter');
              await expect.poll(() => menu.evaluate((el: HTMLDetailsElement) => el.open), { timeout: 10_000 }).toBe(true);
              await page.keyboard.press('Tab');
              await expect.poll(() => page.evaluate(() => document.activeElement?.textContent?.trim() ?? ''), { timeout: 10_000 }).toBe(NAV_ITEMS[0].label);
              await summary.focus();
              await page.keyboard.press('Space');
              await expect.poll(() => menu.evaluate((el: HTMLDetailsElement) => el.open), { timeout: 10_000 }).toBe(false);
            } else {
              const seen: string[] = [];
              for (let i = 0; i < 14; i++) {
                await page.keyboard.press('Tab');
                seen.push(await page.evaluate(() => document.activeElement?.textContent?.trim() ?? ''));
              }
              let next = 0;
              for (const label of seen) if (label === NAV_ITEMS[next]?.label) next++;
              expect(next, `Tab order ${JSON.stringify(seen)}`).toBe(NAV_ITEMS.length);
            }
          }, 120_000);

          it('contact: valid submission is durably stored, prefilled from the query, form resets and confirms', async () => {
            const phone = phoneFor(1);
            await openContact(page, '?requestType=bao-gia&utm_source=uat');
            const select = page.locator('select[name="requestType"]');
            await expect.poll(() => select.inputValue(), { timeout: 15_000 }).toBe('bao-gia');
            await fillAndSubmit(page, { phone, message: `synthetic valid ${engine} ${size.name}` });
            await expect.poll(() => text(status(page)), { timeout: 30_000 }).toContain('Đã nhận yêu cầu');
            expect(await page.locator('input[name="name"]').inputValue()).toBe('');
            const rows = await sql<{ request_type: string; consent_given: boolean; source_page: string; utm: Record<string, string> | null; message: string }>(
              'select request_type, consent_given, source_page, utm, message from contact_leads where phone = $1',
              [phone],
            );
            expect(rows).toHaveLength(1);
            expect(rows[0]).toMatchObject({ request_type: 'bao-gia', consent_given: true, source_page: '/lien-he' });
            expect(rows[0]?.utm).toEqual({ utm_source: 'uat' });
            expect(rows[0]?.message).toContain('synthetic valid');
          }, 120_000);

          it('contact: request type is prefilled only from a single known value', async () => {
            for (const [query, expected] of [
              ['?requestType=khac', 'khac'],
              ['?requestType=khao-sat', 'khao-sat'],
              ['?requestType=bao-gia', 'bao-gia'],
              ['?requestType=evil', 'khao-sat'],
              ['?requestType=khac&requestType=bao-gia', 'khao-sat'],
              ['', 'khao-sat'],
            ] as const) {
              await openContact(page, query);
              await expect
                .poll(() => page.locator('select[name="requestType"]').inputValue(), { timeout: 15_000, message: `requestType for "${query}"` })
                .toBe(expected);
            }
          }, 120_000);

          it('contact: invalid, no-consent, honeypot and server-error submissions write nothing', async () => {
            const [invalid, noConsent, bot, failing] = [phoneFor(2), phoneFor(3), phoneFor(4), phoneFor(5)];

            await openContact(page);
            await fillAndSubmit(page, { name: ' ', phone: invalid });
            await expect.poll(() => text(status(page)), { timeout: 30_000 }).toContain('Vui lòng kiểm tra');
            expect(await text(status(page))).toContain('Họ và tên');
            expect(await page.locator('input[name="name"]').getAttribute('aria-invalid')).toBe('true');

            await openContact(page);
            await fillAndSubmit(page, { phone: noConsent, consent: false });
            await expect.poll(() => text(status(page)), { timeout: 30_000 }).toContain('Đồng ý xử lý thông tin');

            await openContact(page);
            await fillAndSubmit(page, { phone: bot, honeypot: 'http://spam.invalid' });
            // A bot is told nothing: the page acknowledges, the database stays empty.
            await expect.poll(() => text(status(page)), { timeout: 30_000 }).toContain('Đã nhận yêu cầu');

            await openContact(page);
            await page.route('**/lien-he/gui', (route) => route.fulfill({ status: 500, contentType: 'application/json', body: '{"ok":false}' }));
            await fillAndSubmit(page, { phone: failing });
            await expect.poll(() => text(status(page)), { timeout: 30_000 }).toContain('Chưa gửi được yêu cầu');
            await page.unroute('**/lien-he/gui');

            for (const phone of [invalid, noConsent, bot, failing]) expect(await leadCount(phone), phone).toBe(0);
          }, 180_000);

          it('contact: a pending submit cannot be double-submitted (double-click and Enter)', async () => {
            const phone = phoneFor(6);
            let requests = 0;
            await openContact(page);
            await page.route('**/lien-he/gui', async (route) => {
              requests++;
              await new Promise((resolve) => setTimeout(resolve, 1500));
              await route.continue();
            });
            await page.locator('input[name="name"]').fill('Synthetic Double Click');
            await page.locator('input[name="phone"]').fill(phone);
            await page.locator('textarea[name="message"]').fill('synthetic double click');
            await page.locator('input[name="consent"]').check();
            await page.getByRole('button', { name: 'Gửi yêu cầu' }).dblclick();
            await expect.poll(() => page.getByRole('button', { name: 'Đang gửi…' }).isDisabled(), { timeout: 10_000 }).toBe(true);
            await page.locator('input[name="name"]').press('Enter');
            await expect.poll(() => text(status(page)), { timeout: 30_000 }).toContain('Đã nhận yêu cầu');
            await page.unroute('**/lien-he/gui');
            expect(requests).toBe(1);
            expect(await leadCount(phone)).toBe(1);
          }, 120_000);

          it('drafts, private fields and unconfirmed media never reach the rendered public pages', async () => {
            for (const route of PUBLIC_PAGES) {
              const response = await go(page, `${ctx.base}${route}`);
              expect(response?.status(), route).toBe(200);
              const html = await page.content();
              for (const marker of PRIVATE_MARKERS) expect(html, `${route} leaked ${marker}`).not.toContain(marker);
              for (const slug of [JOBS.unconfirmedDraft, JOBS.confirmedDraft, JOBS.storedLegacy]) expect(html, `${route} lists ${slug}`).not.toContain(slug);
              expect(html, route).not.toContain(ctx.fixture.unconfirmed.filename);
              expect(html, route).not.toContain('Synthetic Smoke Hidden Document');
            }
            for (const slug of [ctx.legacySlugs[0], ctx.legacySlugs[1], ctx.legacySlugs.at(-1)]) {
              expect((await go(page, `${ctx.base}/du-an/${slug}`))?.status(), `draft project ${slug}`).toBe(404);
            }
            for (const slug of [JOBS.unconfirmedDraft, JOBS.confirmedDraft, JOBS.storedLegacy]) {
              expect((await go(page, `${ctx.base}/tuyen-dung/${slug}`))?.status(), `job ${slug}`).toBe(404);
            }
            // An UNCONFIRMED image is not requestable from the browser either.
            await go(page, `${ctx.base}/`);
            const fetched = await page.evaluate(async (url) => {
              const r = await fetch(url);
              return { status: r.status, type: r.headers.get('content-type') ?? '' };
            }, ctx.fixture.unconfirmed.url);
            expect(fetched.status).not.toBe(200);
            expect(fetched.type).not.toMatch(/^image\//);
            // An APPROVED document is the positive control for the process page: it is published and its file is
            // APPROVED (the UAT's own fixture), while the seeded "Hidden" document (UNCONFIRMED file) is absent.
            await go(page, `${ctx.base}/quy-trinh-minh-bach`);
            const processPage = await text(page.locator('main'));
            expect(processPage).toContain(UAT_DOCUMENT_TITLE);
            expect(processPage).not.toContain('Synthetic Smoke Hidden Document');
          }, 240_000);

          it('axe: no critical or serious WCAG 2.0/2.1 A/AA violations on public pages (menu closed and open)', async () => {
            const failures: string[] = [];
            const impacts: Record<string, number> = {};
            let blockingTotal = 0;
            const scan = async (label: string) => {
              const results = await new AxeBuilder({ page }).withTags([...AXE_TAGS]).analyze();
              const summary = summarizeAxe(results.violations);
              for (const [impact, n] of Object.entries(summary.byImpact)) impacts[impact] = (impacts[impact] ?? 0) + n;
              blockingTotal += summary.blocking.length;
              for (const b of summary.blocking) {
                const sample = results.violations.find((v) => v.id === b.id)?.nodes[0]?.html.slice(0, 160) ?? '';
                failures.push(`${label}: ${b.id} (${b.impact}, ${b.nodes} node(s)) e.g. ${sample}`);
              }
            };
            for (const route of AXE_ROUTES) {
              await go(page, `${ctx.base}${route}`);
              await scan(route);
            }
            if (mobileMenu) {
              await go(page, `${ctx.base}/`);
              await page.locator('details.mobile-menu > summary').click();
              await scan('/ (menu open)');
            }
            report.matrix.push({ engine, size: `${size.name} ${size.width}x${size.height}`, routesScanned: AXE_ROUTES.length + (mobileMenu ? 1 : 0), axe: impacts, axeBlocking: blockingTotal });
            expect(failures).toEqual([]);
          }, 300_000);

          it('analytics: consent gates everything; exact events, minimal safe parameters, no success without a stored lead', async () => {
            const actx = await browser().newContext({ viewport: { width: size.width, height: size.height }, locale: 'vi-VN', serviceWorkers: 'block' });
            const googleHits: string[] = [];
            try {
              // Transport interception: the Google hosts are answered locally; nothing leaves the machine.
              await actx.route(/^https:\/\/([a-z0-9-]+\.)?(googletagmanager|google-analytics)\.com\//, (route) => {
                googleHits.push(route.request().url());
                return route.fulfill({ status: 200, contentType: 'application/javascript', body: '/* synthetic stub: not GA4 */' });
              });
              const ap = await actx.newPage();
              await ap.addInitScript(recordCspViolations);
              await ap.addInitScript(keepOnPage);
              const layer = () =>
                ap.evaluate(() => Array.from((window as unknown as W).dataLayer ?? [], (entry) => Array.from(entry as ArrayLike<unknown>)));
              const events = async () => eventsFromDataLayer(await layer());
              const setConsent = (granted: boolean) => ap.evaluate((g) => (window as unknown as W).bmslAnalytics?.setConsent(g), granted);
              const disabledFlag = () => ap.evaluate((id) => (window as unknown as W)[`ga-disable-${id}`], MEASUREMENT_ID);
              const click = (event: string) => ap.locator(`footer a[data-analytics-event="${event}"]`).click();
              const secrets = ['SECRETSRC', 'SECRETREF', 'leak@example.invalid', 'token=', phoneFor(7), phoneFor(8)];

              const response = await ap.goto(`${ctx.base}/lien-he?requestType=bao-gia&utm_source=SECRETSRC&email=leak%40example.invalid`, {
                referer: 'https://referrer.invalid/path?token=SECRETREF',
                waitUntil: 'domcontentloaded',
                timeout: 60_000,
              });
              expect(response?.status()).toBe(200);
              await hydrated(ap, 'form.contact-form');
              await ap.waitForFunction(() => typeof (window as unknown as W).bmslAnalytics === 'object', undefined, { timeout: 30_000 });
              await expect.poll(() => ap.locator('select[name="requestType"]').inputValue(), { timeout: 15_000 }).toBe('bao-gia');

              // 1. No consent: links clicked, nothing loaded, nothing sent.
              await click('phone_click');
              await click('zalo_click');
              expect(await layer()).toEqual([]);
              expect(googleHits).toEqual([]);

              // 2. Consent granted: the (intercepted) library is requested once and a safe page_view is queued.
              await setConsent(true);
              await expect.poll(async () => (await events()).map((e) => e.name), { timeout: 15_000 }).toContain('page_view');
              await expect.poll(() => googleHits.filter((u) => u.includes(`/gtag/js?id=${MEASUREMENT_ID}`)).length, { timeout: 15_000 }).toBe(1);
              const before = (await events()).length;

              // 3. A name outside the four allowed ones sends nothing; extra parameters are stripped from allowed ones.
              await ap.evaluate(() => {
                window.dispatchEvent(new CustomEvent('bmsl:analytics-event', { detail: { name: 'purchase', params: { link_location: 'footer' } } }));
                window.dispatchEvent(new CustomEvent('bmsl:analytics-event', { detail: { name: 'page_view', params: {} } }));
                window.dispatchEvent(new CustomEvent('bmsl:analytics-event', { detail: { name: 'phone_click', params: { link_location: 'footer', email: 'leak@example.invalid', phone: '0900000000' } } }));
              });
              await expect.poll(async () => (await events()).length, { timeout: 10_000 }).toBe(before + 1);
              const stripped = (await events()).at(-1);
              expect(stripped?.name).toBe('phone_click');
              expect(Object.keys(stripped?.params ?? {}).sort()).toEqual(['link_location', 'page_location', 'page_referrer']);

              // 4. Invalid, no-consent, honeypot and failed submissions: no form_submit, no row.
              const formSubmits = async () => (await events()).filter((e) => e.name === 'form_submit').length;
              await fillAndSubmit(ap, { name: ' ', phone: phoneFor(7) });
              await expect.poll(() => text(status(ap)), { timeout: 30_000 }).toContain('Vui lòng kiểm tra');
              await fillAndSubmit(ap, { phone: phoneFor(7), consent: false });
              await expect.poll(() => text(status(ap)), { timeout: 30_000 }).toContain('Đồng ý xử lý thông tin');
              await fillAndSubmit(ap, { phone: phoneFor(7), honeypot: 'http://spam.invalid' });
              await expect.poll(() => text(status(ap)), { timeout: 30_000 }).toContain('Đã nhận yêu cầu');
              await ap.route('**/lien-he/gui', (route) => route.fulfill({ status: 500, contentType: 'application/json', body: '{"ok":false}' }));
              await fillAndSubmit(ap, { phone: phoneFor(7) });
              await expect.poll(() => text(status(ap)), { timeout: 30_000 }).toContain('Chưa gửi được yêu cầu');
              await ap.unroute('**/lien-he/gui');
              expect(await formSubmits()).toBe(0);
              expect(await leadCount(phoneFor(7))).toBe(0);

              // 5. Success: one durable row first in PostgreSQL, then exactly one form_submit carrying only the request type.
              // The acknowledged honeypot above reset the form (as any acknowledgement does), so the request type is back at
              // its default: the visitor chooses "bao-gia" again, which is what the success event must then carry.
              await expect.poll(() => ap.locator('select[name="requestType"]').inputValue(), { timeout: 15_000 }).toBe('khao-sat');
              await ap.locator('select[name="requestType"]').selectOption('bao-gia');
              await fillAndSubmit(ap, { phone: phoneFor(8) });
              await expect.poll(() => text(status(ap)), { timeout: 30_000 }).toContain('Đã nhận yêu cầu');
              await expect.poll(formSubmits, { timeout: 15_000 }).toBe(1);
              expect(await leadCount(phoneFor(8))).toBe(1);
              const submit = (await events()).find((e) => e.name === 'form_submit');
              expect(submit?.params.request_type).toBe('bao-gia');

              // 6. The other business events.
              await click('phone_click');
              await click('zalo_click');
              await expect.poll(async () => new Set((await events()).map((e) => e.name)), { timeout: 15_000 }).toEqual(new Set(['page_view', 'phone_click', 'zalo_click', 'form_submit']));

              // 7. Withdraw: the library is switched off and no event of any kind is queued; regrant resumes.
              await setConsent(false);
              expect(await disabledFlag()).toBe(true);
              const atWithdrawal = (await layer()).length;
              await click('phone_click');
              await ap.evaluate(() => window.dispatchEvent(new CustomEvent('bmsl:analytics-event', { detail: { name: 'form_submit', params: { request_type: 'khac' } } })));
              expect((await layer()).length).toBe(atWithdrawal);
              await setConsent(true);
              expect(await disabledFlag()).toBe(false);
              await click('phone_click');
              await expect.poll(async () => (await layer()).length, { timeout: 15_000 }).toBeGreaterThan(atWithdrawal);
              expect((await events()).at(-1)?.name).toBe('phone_click');

              // 8. Every queued event is allowed, minimal and free of queries, referrers and form data.
              const all = await events();
              for (const event of all) expect(eventProblems(event, ctx.base), JSON.stringify(event)).toEqual([]);
              const serialised = JSON.stringify(await layer());
              for (const secret of secrets) expect(serialised, secret).not.toContain(secret);
              expect(googleHits.every((u) => u.includes('/gtag/js'))).toBe(true); // library only; the stub never collects
              expect(await cspViolations(ap)).toEqual([]);

              // 9. document_download is a separate page: consent starts over (it lives in memory only).
              await ap.goto(`${ctx.base}/quy-trinh-minh-bach`, { waitUntil: 'domcontentloaded', timeout: 60_000 });
              await ap.waitForFunction(() => typeof (window as unknown as W).bmslAnalytics === 'object', undefined, { timeout: 30_000 });
              const documentLink = ap.locator('main a[data-analytics-event="document_download"]').filter({ hasText: UAT_DOCUMENT_TITLE });
              await documentLink.click();
              expect(await layer()).toEqual([]);
              await setConsent(true);
              await documentLink.click();
              await expect.poll(async () => (await events()).map((e) => e.name), { timeout: 15_000 }).toContain('document_download');
              const download = (await events()).find((e) => e.name === 'document_download');
              expect(download?.params.link_location).toBe('documents');
              expect(String(download?.params.document_id)).toMatch(/^[A-Za-z0-9_-]{1,40}$/);
              for (const event of await events()) expect(eventProblems(event, ctx.base), JSON.stringify(event)).toEqual([]);
            } finally {
              await actx.close().catch(() => undefined);
            }
          }, 300_000);
        });
      }
    }

    for (const engine of ENGINES) {
      describe(`[${engine}] media revocation in the browser`, () => {
        it('an APPROVED image loads, then disappears from the page and from its URL once approval is revoked', async () => {
          const media = within('uat media', uatMedia.get(engine));
          const context = await within('browser', browsers.get(engine)).newContext({ viewport: { width: 1366, height: 900 }, serviceWorkers: 'block' });
          try {
            const page = await context.newPage();
            const image = page.locator(`main img[src*="${media.slug}"]`);
            const fetchUrl = () =>
              page.evaluate(async (url) => {
                const r = await fetch(url);
                const bytes = new Uint8Array(await r.arrayBuffer());
                return { status: r.status, type: r.headers.get('content-type') ?? '', png: bytes.length > 4 && bytes[0] === 0x89 && bytes[1] === 0x50 };
              }, media.url);

            await go(page, `${ctx.base}/du-an/${media.slug}`);
            expect(await image.count()).toBe(1);
            await expect.poll(() => image.evaluate((el: HTMLImageElement) => el.complete && el.naturalWidth), { timeout: 15_000 }).toBe(1);
            const before = await fetchUrl();
            expect(before.status).toBe(200);
            expect(before.type).toMatch(/^image\/png/);
            expect(before.png).toBe(true);

            await ctx.runFixture('revoke', { SMOKE_FIXTURE_MEDIA_ID: String(media.mediaId) });

            await page.reload({ waitUntil: 'domcontentloaded' });
            expect(await image.count()).toBe(0);
            expect(await page.content()).not.toContain(media.filename);
            const after = await fetchUrl();
            expect(after.status).not.toBe(200);
            expect(after.type).not.toMatch(/^image\//);
            expect(after.png).toBe(false);
            note(`${engine}: approved media loaded, then revoked media removed from page and URL`);
          } finally {
            await context.close().catch(() => undefined);
          }
        }, 300_000);
      });

      describe(`[${engine}] ADMIN and EDITOR flows, Payload admin hydration and CSP`, () => {
        const roleFlow = async (role: 'ADMIN' | 'EDITOR') => {
          const email = role === 'ADMIN' ? await soleAdminEmail() : ctx.editorEmail;
          const password = role === 'ADMIN' ? ctx.adminPassword : ctx.editorPassword;
          const context = await within('browser', browsers.get(engine)).newContext({ viewport: { width: 1366, height: 900 }, locale: 'en-US', serviceWorkers: 'block' });
          const pageErrors: string[] = [];
          const consoleProblems: string[] = [];
          const requestedUrls: string[] = [];
          let page: Page | undefined;
          // A failure names the step, the page it was on and what that page showed, so the CI log explains itself.
          const step = async <T>(name: string, run: () => Promise<T>): Promise<T> => {
            try {
              return await run();
            } catch (error) {
              const detail = page ? await where(page) : '(no page)';
              throw new Error(`${role}/${engine} step "${name}" failed at ${detail}\n${error instanceof Error ? error.message : String(error)}`);
            }
          };
          try {
            page = await context.newPage();
            const p = page;
            await p.addInitScript(recordCspViolations);
            p.on('pageerror', (e) => pageErrors.push(e.message));
            p.on('request', (r) => requestedUrls.push(r.url()));
            p.on('console', (m) => {
              if (m.type() === 'error' && /content security policy|refused to|hydrat/i.test(m.text())) consoleProblems.push(m.text());
            });

            // Login form hydration under the real CSP, then a real sign-in. The sign-in is a same-origin POST to the
            // Payload login endpoint: its answer is asserted first, then the browser must leave the login route.
            await step('open login', async () => {
              const login = await go(p, `${ctx.base}/admin/login`);
              expect(login?.headers()['content-security-policy']).toContain("frame-ancestors 'none'");
              await hydrated(p, '#field-email');
            });
            await step('sign in', async () => {
              await p.locator('#field-email').fill(email);
              await p.locator('#field-password').fill(password);
              const answered = p.waitForResponse((r) => new URL(r.url()).pathname === '/api/users/login' && r.request().method() === 'POST', { timeout: 60_000 });
              await p.locator('form button[type="submit"]').click();
              expect((await answered).status(), 'login response status').toBe(200);
              await expect.poll(() => new URL(p.url()).pathname, { timeout: 60_000, message: 'route after sign-in' }).not.toMatch(/^\/admin\/login/);
            });
            await step('dashboard', async () => {
              await p.locator('a[href="/admin/collections/articles"]').first().waitFor({ state: 'visible', timeout: 60_000 });
              // ADMIN sees the lead inbox; EDITOR does not (provisional ADMIN-only default for ContactLead).
              expect(await p.locator('a[href="/admin/collections/contact-leads"]').count() > 0).toBe(role === 'ADMIN');
            });

            // Rich-text editor (Lexical) compatibility: type and save a DRAFT article through the real admin UI.
            const slug = `w5b4-${role.toLowerCase()}-${engine}-draft`;
            const title = `W5B4 ${role} ${engine} draft`;
            await step('create draft article', async () => {
              await go(p, `${ctx.base}/admin/collections/articles/create`);
              await hydrated(p, '#field-title');
              await p.locator('#field-title').fill(title);
              await p.locator('#field-slug').fill(slug);
              // The editor is Lexical's contenteditable (role textbox) inside the body field.
              const editor = p.locator('#field-body [contenteditable="true"], .rich-text-lexical [contenteditable="true"]').first();
              await editor.waitFor({ state: 'visible', timeout: 60_000 });
              await editor.click();
              await p.keyboard.type('Synthetic editor text for the W5B4 UAT.');
              await expect.poll(() => text(editor), { timeout: 15_000 }).toContain('Synthetic editor text');
              await p.locator('#action-save-draft').click();
              await expect.poll(() => new URL(p.url()).pathname, { timeout: 60_000, message: 'route after saving the draft' }).toMatch(/^\/admin\/collections\/articles\/\d+$/);
            });
            const rows = await sql<{ _status: string; title: string }>('select _status, title from articles where slug = $1', [slug]);
            expect(rows).toEqual([{ _status: 'draft', title }]);

            // The draft is private: not in the public list and not in the sitemap.
            expect(await (await fetch(`${ctx.base}/kien-thuc`)).text()).not.toContain(title);

            // Role boundaries as the signed-in browser sees them (same-origin cookies).
            const api = (url: string, init?: { method: string; body: string }) =>
              p.evaluate(
                async ([u, i]) => {
                  const r = await fetch(u as string, i ? { method: i.method, headers: { 'content-type': 'application/json' }, body: i.body } : undefined);
                  return r.status;
                },
                [url, init] as const,
              );
            const leads = await api('/api/contact-leads?limit=1');
            if (role === 'ADMIN') {
              expect(leads).toBe(200);
            } else {
              // Only the EDITOR probes user creation: the request must be refused, nothing is created.
              const createUser = await api('/api/users', { method: 'POST', body: JSON.stringify({ email: `uat-${engine}@example.invalid`, password: 'Pw-synthetic-uat-1', role: 'ADMIN' }) });
              expect([401, 403]).toContain(leads);
              expect([401, 403]).toContain(createUser);
              expect(await sql('select 1 from users where email = $1', [`uat-${engine}@example.invalid`])).toHaveLength(0);
            }

            // Hydration and CSP: nothing blocked, no uncaught error, no hydration/CSP console error. The admin must
            // not look the signed-in user's hashed email up at Gravatar (admin.avatar is the local default icon):
            // the CSP stays narrow and no external avatar request is even attempted.
            expect(requestedUrls.filter((u) => /gravatar\.com/i.test(u))).toEqual([]);
            expect(await cspViolations(p)).toEqual([]);
            expect(pageErrors).toEqual([]);
            expect(consoleProblems).toEqual([]);
          } finally {
            await context.close().catch(() => undefined);
          }
        };

        it('ADMIN: signs in, edits a draft in the rich-text editor, sees the lead inbox; admin hydrates under CSP', () => roleFlow('ADMIN'), 360_000);
        it('EDITOR: signs in, edits a draft in the rich-text editor, cannot reach leads or user management', () => roleFlow('EDITOR'), 360_000);
      });
    }

    describe('Lighthouse (Chromium; measured, simulated throttling)', () => {
      it('measures the public pages and stays within the declared budgets', async () => {
        const lighthouse = (await import('lighthouse')).default as unknown as (
          url: string,
          flags: Record<string, unknown>,
        ) => Promise<{ lhr: LighthouseLike } | undefined>;
        const port = await freePort();
        const browser = await chromium.launch({ headless: true, args: [`--remote-debugging-port=${port}`], timeout: 120_000 });
        const failures: string[] = [];
        try {
          const page = await (await browser.newContext()).newPage();
          await page.goto('about:blank');
          const desktop = {
            formFactor: 'desktop',
            screenEmulation: { mobile: false, width: 1350, height: 940, deviceScaleFactor: 1, disabled: false },
            throttling: { rttMs: 40, throughputKbps: 10_240, cpuSlowdownMultiplier: 1, requestLatencyMs: 0, downloadThroughputKbps: 0, uploadThroughputKbps: 0 },
          };
          const runs = [
            { route: '/', formFactor: 'mobile', extra: {} },
            { route: '/lien-he', formFactor: 'mobile', extra: {} },
            { route: `/du-an/${ctx.publishedSlug}`, formFactor: 'mobile', extra: {} },
            { route: '/', formFactor: 'desktop', extra: desktop },
          ];
          for (const run of runs) {
            const url = `${ctx.base}${run.route}`;
            const result = await lighthouse(url, {
              port,
              logLevel: 'error',
              output: 'json',
              onlyCategories: ['performance', 'accessibility', 'best-practices', 'seo'],
              ...run.extra,
            });
            const lhr = within('lighthouse result', result?.lhr);
            const measurement = measureLighthouse(lhr);
            const problems = lighthouseFailures(measurement);
            report.lighthouse.push({ url: run.route, formFactor: run.formFactor, measurement, failures: problems });
            failures.push(...problems.map((p) => `${run.formFactor} ${run.route}: ${p}`));
          }
        } finally {
          await browser.close().catch(() => undefined);
        }
        expect(failures).toEqual([]);
      }, 600_000);
    });

    describe('execution budget', () => {
      it('the browser suite stays inside its share of the 20 minute CI job and every engine ran at every size', () => {
        expect(Object.keys(report.engines).sort()).toEqual([...ENGINES].sort());
        expect(report.matrix).toHaveLength(ENGINES.length * SIZES.length);
        expect(report.lighthouse.length).toBeGreaterThanOrEqual(4);
        expect(performance.now() - startedAt).toBeLessThan(BROWSER_SUITE_BUDGET_MS);
      });
    });
  });
}
