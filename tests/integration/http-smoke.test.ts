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
  await payload.create({
    collection: 'projects',
    data: { ...PUBLISHED_PROJECT, sourceStatus: 'LEGACY-SOURCE', _status: 'published' },
  });

  // Reproducible type check: regenerate the Payload types first so `next build` type-checks the app and the
  // test fixtures against the strict generated types, exactly as it does after any local Payload start.
  await run(['payload', 'generate:types'], 120_000);
  await run(['next', 'build'], 480_000);

  const port = await freePort();
  base = `http://127.0.0.1:${port}`;
  server = spawn('pnpm', ['exec', 'next', 'start', '-p', String(port), '-H', '127.0.0.1'], {
    cwd: REPO_ROOT,
    env: { ...process.env, DATABASE_URL: smokeUrl, PAYLOAD_SECRET: SECRET, NODE_ENV: 'production', NEXT_TELEMETRY_DISABLED: '1' },
  });
  server.stdout?.on('data', (d) => (serverLog += d));
  server.stderr?.on('data', (d) => (serverLog += d));
  await waitUntilServing();
}, 840_000);

afterAll(async () => {
  if (server && server.exitCode === null) {
    server.kill('SIGTERM');
    await new Promise((r) => setTimeout(r, 1000));
    if (server.exitCode === null) server.kill('SIGKILL');
  }
  await payload?.destroy();
  // Only the database created by this file is ever dropped.
  if (admin) {
    await admin.query(`drop database if exists "${DB_NAME}" with (force)`);
    await admin.end();
  }
  for (const [key, value] of Object.entries(previousEnv)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
}, 60_000);

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

describe('HTTP smoke: W5A SEO, analytics default and media boundary', () => {
  const png = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
    'base64',
  );
  const upload = async (name: string, rightsStatus: 'APPROVED' | 'UNCONFIRMED') => {
    const m = await payload!.create({
      collection: 'media-assets',
      data: { alt: `synthetic ${name}`, rightsStatus },
      file: { data: png, mimetype: 'image/png', name: `${name}.png`, size: png.length },
    });
    return m as unknown as { id: number; filename: string };
  };

  it('home page ships Organization JSON-LD and no analytics script by default', async () => {
    const html = await (await get('/')).text();
    expect(html).toContain('"@type":"Organization"');
    expect(html).not.toContain('googletagmanager.com');
    expect(html).not.toContain('google-site-verification');
  });

  it('enabled analytics still ships no external script from the server (consent is required client-side)', async () => {
    await payload!.updateGlobal({
      slug: 'site-settings',
      data: {
        ga4Id: 'G-ABCDEF1234',
        analyticsEnabled: true,
        searchConsoleVerification: 'abcDEF123_-abcDEF123_-xyz',
        _status: 'published',
      },
    });
    const html = await (await get('/')).text();
    expect(html).not.toContain('googletagmanager.com');
    expect(html).toContain('google-site-verification');
  });

  it('a draft SiteSettings changes nothing publicly', async () => {
    await payload!.updateGlobal({
      slug: 'site-settings',
      data: { searchConsoleVerification: 'zzzDEF123_-abcDEF123_-xyz', _status: 'draft' },
      draft: true,
    });
    const html = await (await get('/')).text();
    expect(html).not.toContain('zzzDEF123_-abcDEF123_-xyz');
  });

  it('a singleton marked noindex leaves the sitemap; admin and api never appear', async () => {
    expect(await (await get('/sitemap.xml')).text()).toContain('/gioi-thieu');
    await payload!.updateGlobal({
      slug: 'about-page',
      data: { title: 'Synthetic about', seo: { noindex: true }, _status: 'published' },
    });
    const sitemap = await (await get('/sitemap.xml')).text();
    expect(sitemap).not.toContain('/gioi-thieu');
    expect(sitemap).toContain('/lien-he');
    expect(sitemap).not.toMatch(/\/(admin|api)(\/|<)/);
    expect(await (await get('/robots.txt')).text()).toContain('Disallow: /admin');
  });

  it('media bytes follow the rights status at the real file URL (UNCONFIRMED, APPROVED, then revoked)', async () => {
    const ok = await upload('w5a-ok', 'APPROVED');
    const blocked = await upload('w5a-blocked', 'UNCONFIRMED');
    const status = async (m: { filename: string }) => (await get(`/api/media-assets/file/${m.filename}`)).status;

    expect(await status(blocked)).not.toBe(200);
    expect(await status(ok)).toBe(200);

    await payload!.update({ collection: 'media-assets', id: ok.id, data: { rightsStatus: 'UNCONFIRMED' } });
    expect(await status(ok)).not.toBe(200);
  });
});
