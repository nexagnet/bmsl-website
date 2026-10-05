import { type ChildProcess, spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import net from 'node:net';
import path from 'node:path';
import pg from 'pg';
import type { Payload } from 'payload';
import { getPayload } from 'payload';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import manifest from '../../src/migration/legacy-manifest.json';

// Real HTTP proof (W4): a production Next build + `next start` against a DISPOSABLE PostgreSQL database that
// this file creates and drops itself (never the shared database, never any other database). Synthetic data only.
// It runs under the existing `pnpm test:integration` CI step; nothing is skipped: any provisioning, type
// generation, build or startup failure fails every test here.

const ADMIN_URL = process.env.DATABASE_URL;
if (!ADMIN_URL) throw new Error('DATABASE_URL is required');
const adminHost = new URL(ADMIN_URL).hostname;
if (!['localhost', '127.0.0.1', '::1', '[::1]'].includes(adminHost)) {
  throw new Error(`Refusing to provision a database on a non-local host (${adminHost})`);
}

const REPO_ROOT = path.resolve(import.meta.dirname, '../..');
const DB_NAME = `bmsl_http_smoke_${randomBytes(6).toString('hex')}`;
if (!/^bmsl_http_smoke_[0-9a-f]{12}$/.test(DB_NAME)) throw new Error('unexpected disposable database name');
const SECRET = `synthetic-smoke-${randomBytes(8).toString('hex')}`;
const smokeUrl = (() => {
  const u = new URL(ADMIN_URL);
  u.pathname = `/${DB_NAME}`;
  return u.toString();
})();

const IA_ROUTES = ['/', '/gioi-thieu', '/dich-vu', '/du-an', '/kien-thuc', '/quy-trinh-minh-bach', '/lien-he', '/tuyen-dung'];
const approved = { contentApproved: true, approvedBy: 'synthetic approver', approvedAt: '2026-01-01' };
const DRAFT_ARTICLE_TITLE = 'Synthetic smoke draft article';
const PUBLISHED_PROJECT = { name: 'Synthetic Smoke Published Project', slug: 'synthetic-smoke-published' };

const redirectEntries = manifest.entries.filter((e) => e.disposition === 'redirect');
const activeTargets = [...new Set(redirectEntries.map((e) => e.activeTarget))].sort();

let admin: pg.Client;
let payload: Payload | undefined;
let server: ChildProcess | undefined;
let base = '';
let serverLog = '';
let media: { approved: { id: number | string; path: string }; unconfirmed: { id: number | string; path: string } };
let documentId = '';
const PNG_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';
const previousEnv = { DATABASE_URL: process.env.DATABASE_URL, PAYLOAD_SECRET: process.env.PAYLOAD_SECRET };

const tail = (text: string) => text.slice(-4000);

function run(args: string[], timeoutMs: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn('pnpm', ['exec', ...args], {
      cwd: REPO_ROOT,
      env: { ...process.env, DATABASE_URL: smokeUrl, PAYLOAD_SECRET: SECRET, NODE_ENV: 'production', NEXT_TELEMETRY_DISABLED: '1' },
    });
    let out = '';
    child.stdout.on('data', (d) => (out += d));
    child.stderr.on('data', (d) => (out += d));
    const timer = setTimeout(() => child.kill('SIGKILL'), timeoutMs);
    child.on('error', reject);
    child.on('close', (code, signal) => {
      clearTimeout(timer);
      if (code === 0) resolve();
      else reject(new Error(`pnpm exec ${args.join(' ')} failed (code ${code}, signal ${signal})\n${tail(out)}`));
    });
  });
}

const freePort = () =>
  new Promise<number>((resolve, reject) => {
    const s = net.createServer();
    s.once('error', reject);
    s.listen(0, '127.0.0.1', () => {
      const { port } = s.address() as net.AddressInfo;
      s.close(() => resolve(port));
    });
  });

const get = (route: string) => fetch(`${base}${route}`, { redirect: 'manual' });

async function waitUntilServing() {
  const deadline = Date.now() + 120_000;
  while (Date.now() < deadline) {
    if (server?.exitCode !== null) throw new Error(`next start exited early\n${tail(serverLog)}`);
    try {
      if ((await get('/')).status === 200) return;
    } catch {
      // not listening yet
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new Error(`next start did not serve "/" in time\n${tail(serverLog)}`);
}

beforeAll(async () => {
  admin = new pg.Client({ connectionString: ADMIN_URL });
  await admin.connect();
  await admin.query(`create database "${DB_NAME}"`);

  // Schema through the committed migrations, in-process, against the disposable database only.
  process.env.DATABASE_URL = smokeUrl;
  process.env.PAYLOAD_SECRET = SECRET;
  const { default: config } = await import('../../src/payload.config');
  payload = await getPayload({ config });
  await payload.db.migrate();

  // Synthetic data: 17 imported project drafts + approved draft articles (incl. candidate #4), and one published
  // project as a positive control proving that public pages really read this database.
  const { runLegacyImport } = await import('../../src/migration/importer');
  const byId = (id: number) => manifest.entries.find((e) => e.id === id)!.legacyPath;
  const report = await runLegacyImport(payload, {
    write: true,
    externalInput: {
      articles: [
        { legacyUrl: byId(3), title: DRAFT_ARTICLE_TITLE, paragraphs: ['Synthetic paragraph.'], approval: approved },
        { legacyUrl: byId(4), title: 'Synthetic smoke draft service article', approval: approved },
      ],
    },
  });
  if (report.created.length !== 19 || report.rejected.length > 0) throw new Error('synthetic import did not create the expected drafts');
  // W5A fixtures: APPROVED and UNCONFIRMED media, a published project using both, an approved download,
  // and a published noindex singleton.
  const png = Buffer.from(PNG_BASE64, 'base64');
  const upload = (name: string, rightsStatus: 'APPROVED' | 'UNCONFIRMED') =>
    payload!.create({
      collection: 'media-assets',
      data: { alt: `synthetic ${name}`, rightsStatus },
      file: { data: png, mimetype: 'image/png', name: `${name}.png`, size: png.length },
    });
  const [approvedMedia, unconfirmedMedia, docMedia] = [
    await upload('w5a-approved', 'APPROVED'),
    await upload('w5a-unconfirmed', 'UNCONFIRMED'),
    await upload('w5a-document', 'APPROVED'),
  ];
  media = {
    approved: { id: approvedMedia.id, path: `/api/media-assets/file/${approvedMedia.filename}` },
    unconfirmed: { id: unconfirmedMedia.id, path: `/api/media-assets/file/${unconfirmedMedia.filename}` },
  };
  await payload.create({
    collection: 'projects',
    data: {
      ...PUBLISHED_PROJECT,
      sourceStatus: 'LEGACY-SOURCE',
      images: [approvedMedia.id, unconfirmedMedia.id],
      _status: 'published',
    },
  });
  const doc = await payload.create({
    collection: 'documents',
    data: { title: 'Synthetic smoke document', file: docMedia.id, _status: 'published' },
  });
  documentId = String(doc.id);
  await payload.updateGlobal({ slug: 'about-page', data: { title: 'Synthetic about', seo: { noindex: true }, _status: 'published' } });

  // Reproducible type check: regenerate the Payload types first so `next build` type-checks the app and the
  // test fixtures against the strict generated types, exactly as it does after any local Payload start.
  await run(['payload', 'generate:types'], 120_000);
  await run(['next', 'build'], 480_000);

  const port = await freePort();
  base = `http://127.0.0.1:${port}`;
  server = spawn('pnpm', ['exec', 'next', 'start', '-p', String(port), '-H', '127.0.0.1'], {
    cwd: REPO_ROOT,
    // Own process group: pnpm spawns next as a child, and both must be gone before the database is dropped.
    detached: true,
    env: { ...process.env, DATABASE_URL: smokeUrl, PAYLOAD_SECRET: SECRET, NODE_ENV: 'production', NEXT_TELEMETRY_DISABLED: '1' },
  });
  server.stdout?.on('data', (d) => (serverLog += d));
  server.stderr?.on('data', (d) => (serverLog += d));
  await waitUntilServing();
}, 840_000);

/** Stops the whole server process group (pnpm + next) and resolves only once it has really exited. */
async function stopServer() {
  const child = server;
  if (!child || child.pid === undefined || child.exitCode !== null || child.signalCode !== null) return;
  const signal = (sig: NodeJS.Signals) => {
    try {
      process.kill(-child.pid!, sig);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ESRCH') throw error;
    }
  };
  const closed = new Promise<void>((resolve) => child.once('close', () => resolve()));
  signal('SIGTERM');
  const escalate = setTimeout(() => signal('SIGKILL'), 15_000);
  await closed;
  clearTimeout(escalate);
  signal('SIGKILL'); // reap any straggler left in the group
}

/** The disposable database may be dropped only when no other session is connected to it. */
async function waitForNoConnections() {
  const deadline = Date.now() + 20_000;
  for (;;) {
    const { rows } = await admin.query<{ pid: number; state: string | null; application_name: string }>(
      'select pid, state, application_name from pg_stat_activity where datname = $1 and pid <> pg_backend_pid()',
      [DB_NAME],
    );
    if (rows.length === 0) return;
    if (Date.now() > deadline) throw new Error(`sessions still connected to ${DB_NAME}: ${JSON.stringify(rows)}`);
    await new Promise((r) => setTimeout(r, 250));
  }
}

afterAll(async () => {
  // Order matters: server first, then the in-process Payload pool, then verify, then drop (no WITH FORCE, so a
  // lingering connection fails the run loudly instead of being terminated into an unhandled 57P01 error).
  await stopServer();
  await payload?.destroy();
  try {
    // Only the database created by this file is ever dropped.
    if (admin) {
      await waitForNoConnections();
      await admin.query(`drop database if exists "${DB_NAME}"`);
    }
  } finally {
    await admin?.end();
    for (const [key, value] of Object.entries(previousEnv)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
}, 90_000);

describe('HTTP smoke: legacy redirects (real Next server, disposable PostgreSQL)', () => {
  it('covers all 46 redirect sources and the identity root', () => {
    expect(manifest.entries).toHaveLength(47);
    expect(redirectEntries).toHaveLength(46);
    expect(manifest.entries.filter((e) => e.disposition === 'identity').map((e) => e.legacyPath)).toEqual(['/']);
  });

  const cases = redirectEntries.flatMap((e) => {
    const bare = e.legacyPath.replace(/\/$/, '');
    return [
      { id: e.id, requestPath: bare, target: e.activeTarget },
      { id: e.id, requestPath: `${bare}/`, target: e.activeTarget },
    ];
  });

  it.each(cases)('#$id $requestPath -> one direct 301 to $target', async ({ requestPath, target }) => {
    const res = await get(requestPath);
    expect(res.status).toBe(301);
    const location = res.headers.get('location');
    expect(location).not.toBeNull();
    const url = new URL(location!, base);
    expect(url.origin).toBe(base);
    expect(`${url.pathname}${url.search}${url.hash}`).toBe(target);
  });

  it('every active target and the root return 200 directly (no chain)', async () => {
    const results: Record<string, number> = {};
    for (const route of ['/', ...activeTargets]) results[route] = (await get(route)).status;
    expect(Object.fromEntries(Object.keys(results).map((r) => [r, 200]))).toEqual(results);
  });
});

describe('HTTP smoke: public IA routes and draft non-leak', () => {
  it.each(IA_ROUTES)('%s returns 200 with the configured database and secret', async (route) => {
    const res = await get(route);
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('text/html');
  });

  it('public pages really read the database: the published control project is listed and served', async () => {
    const list = await (await get('/du-an')).text();
    expect(list).toContain(PUBLISHED_PROJECT.name);
    const detail = await get(`/du-an/${PUBLISHED_PROJECT.slug}`);
    expect(detail.status).toBe(200);
    expect(await detail.text()).toContain(PUBLISHED_PROJECT.name);
  });

  it('imported project drafts never leak: not listed, detail pages return 404, not in the sitemap', async () => {
    const list = await (await get('/du-an')).text();
    const sitemap = await (await get('/sitemap.xml')).text();
    expect(sitemap).toContain(PUBLISHED_PROJECT.slug);
    for (const project of manifest.projects) {
      expect(list).not.toContain(project.name);
      expect((await get(`/du-an/${project.slug}`)).status).toBe(404);
      expect(sitemap).not.toContain(`/du-an/${project.slug}`);
    }
  });

  it('imported article drafts (incl. candidate #4) never leak into public pages', async () => {
    for (const route of ['/kien-thuc', '/dich-vu', '/', '/sitemap.xml']) {
      const body = await (await get(route)).text();
      expect(body).not.toContain('Synthetic smoke draft');
    }
  });
});

// W5A over real HTTP. Order matters: the last test revokes the approval of the approved media file.
describe('HTTP smoke: W5A SEO, analytics default-off and media rights boundary', () => {
  const jsonLd = (html: string): Record<string, unknown>[] =>
    [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map(
      (m) => JSON.parse(m[1]!) as Record<string, unknown>,
    );
  const optimizerUrls = (mediaPath: string) => [
    `/_next/image?url=${encodeURIComponent(mediaPath)}&w=64&q=75`,
    `/_next/image?url=${encodeURIComponent(mediaPath)}&w=640&q=75`,
    `/_next/image?url=${encodeURIComponent(`${base}${mediaPath}`)}&w=64&q=75`,
  ];
  const expectNoOptimizedBytes = async (mediaPath: string) => {
    for (const url of optimizerUrls(mediaPath)) {
      for (const method of ['GET', 'HEAD']) {
        const res = await fetch(`${base}${url}`, { method, redirect: 'manual' });
        expect(res.status, `${method} ${url}`).toBe(404);
        expect(res.headers.get('content-type') ?? '', `${method} ${url}`).not.toMatch(/^image\//);
        expect(res.headers.get('cache-control') ?? '').not.toMatch(/immutable|max-age=[1-9]/);
      }
    }
  };
  const expectOriginalDenied = async (mediaPath: string) => {
    for (const method of ['GET', 'HEAD']) {
      const res = await fetch(`${base}${mediaPath}`, { method, redirect: 'manual' });
      expect([401, 403, 404], `${method} ${mediaPath}`).toContain(res.status);
      expect(res.headers.get('content-type') ?? '').not.toMatch(/^image\//);
    }
  };

  it('home page: canonical, Organization JSON-LD, and no analytics script by default', async () => {
    const html = await (await get('/')).text();
    expect(html).toContain('rel="canonical"');
    expect(jsonLd(html).map((d) => d['@type'])).toContain('Organization');
    expect(html).not.toMatch(/googletagmanager|google-analytics|gtag\(|dataLayer/);
    expect(html).not.toContain('google-site-verification');
  });

  it('sitemap excludes the published noindex singleton but keeps indexable routes; robots hides admin/api', async () => {
    const sitemap = await (await get('/sitemap.xml')).text();
    expect(sitemap).not.toContain('/gioi-thieu');
    for (const route of ['/lien-he', '/dich-vu', '/du-an', `/du-an/${PUBLISHED_PROJECT.slug}`]) {
      expect(sitemap).toContain(`${route}</loc>`);
    }
    const about = await (await get('/gioi-thieu')).text();
    expect(about).toMatch(/<meta name="robots" content="noindex/);
    const robots = await (await get('/robots.txt')).text();
    expect(robots).toMatch(/Disallow: \/admin/);
    expect(robots).toMatch(/Disallow: \/api/);
  });

  it('project page: BreadcrumbList JSON-LD, only the APPROVED image as a plain same-site <img>', async () => {
    const html = await (await get(`/du-an/${PUBLISHED_PROJECT.slug}`)).text();
    const crumbs = jsonLd(html).find((d) => d['@type'] === 'BreadcrumbList');
    expect(JSON.stringify(crumbs)).toContain(`/du-an/${PUBLISHED_PROJECT.slug}`);
    expect(html).toContain(`src="${media.approved.path}"`);
    expect(html).toContain('decoding="async"');
    expect(html).not.toContain(media.unconfirmed.path);
    expect(html).not.toContain('/_next/image');
  });

  it('process page: download links carry only the numeric document id; no analytics runs by default', async () => {
    const html = await (await get('/quy-trinh-minh-bach')).text();
    expect(html).toContain('data-analytics-event="document_download"');
    expect(html).toContain(`data-analytics-document-id="${documentId}"`);
    expect(html).not.toMatch(/googletagmanager|gtag\(/);
    // No hotline/Zalo is published, so no phone/Zalo links exist (nothing invented).
    expect(html).not.toContain('data-analytics-event="phone_click"');
    expect(html).not.toContain('data-analytics-event="zalo_click"');
  });

  it('APPROVED original is served; UNCONFIRMED original is denied (GET and HEAD)', async () => {
    const ok = await fetch(`${base}${media.approved.path}`);
    expect(ok.status).toBe(200);
    expect(ok.headers.get('content-type')).toMatch(/^image\/png/);
    expect((await ok.arrayBuffer()).byteLength).toBeGreaterThan(0);
    await expectOriginalDenied(media.unconfirmed.path);
  });

  it('crafted /_next/image requests never return bytes for APPROVED or UNCONFIRMED media (optimizer is off)', async () => {
    await expectNoOptimizedBytes(media.approved.path);
    await expectNoOptimizedBytes(media.unconfirmed.path);
  });

  it('after approval is revoked: original and optimizer URLs return no bytes (no stale derived cache)', async () => {
    // Warm every URL while APPROVED, then revoke through the real CMS write path.
    for (const url of optimizerUrls(media.approved.path)) await fetch(`${base}${url}`);
    await payload!.update({ collection: 'media-assets', id: media.approved.id, data: { rightsStatus: 'UNCONFIRMED' } });
    await expectOriginalDenied(media.approved.path);
    await expectNoOptimizedBytes(media.approved.path);
    const html = await (await get(`/du-an/${PUBLISHED_PROJECT.slug}`)).text();
    expect(html).not.toContain(media.approved.path);
  });
});
