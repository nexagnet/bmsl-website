import { spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import net from 'node:net';
import path from 'node:path';
import pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import manifest from '../../src/migration/legacy-manifest.json';
import { dropDisposableDatabase, type Group, spawnGroup, stopProcessGroup } from './support/db-lifecycle';

// Real HTTP proof (W4/W5A): a production Next build + `next start` against a DISPOSABLE PostgreSQL database that
// this file creates and drops itself (never the shared database, never any other database). Synthetic data only.
// It runs under the existing `pnpm test:integration` CI step; nothing is skipped: any provisioning, type
// generation, build or startup failure fails every test here.
//
// Lifecycle: every connection to the disposable database belongs to a process this file spawned: short-lived
// `payload run` fixture subprocesses (support/smoke-fixture.ts, which exit and so close their own pool) and the Next
// server's process group. Teardown stops that group, waits until pg_stat_activity shows no session, then drops the
// database (no WITH FORCE). A leftover session fails the run loudly. No Payload instance lives in this process.

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
const PUBLISHED_PROJECT = { name: 'Synthetic Smoke Published Project', slug: 'synthetic-smoke-published' };

const redirectEntries = manifest.entries.filter((e) => e.disposition === 'redirect');
const activeTargets = [...new Set(redirectEntries.map((e) => e.activeTarget))].sort();

type Media = { id: number; filename: string; url: string };

let admin: pg.Client;
let server: Group | undefined;
let fixture: { approved: Media; unconfirmed: Media } | undefined;
let base = '';
let serverLog = '';
let createdDatabase = false;

const tail = (text: string) => text.slice(-4000);

/** Runs `pnpm exec <args>` against the disposable database and resolves with its output. */
function run(args: string[], timeoutMs: number, env: Record<string, string> = { NODE_ENV: 'production' }): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn('pnpm', ['exec', ...args], {
      cwd: REPO_ROOT,
      env: { ...process.env, DATABASE_URL: smokeUrl, PAYLOAD_SECRET: SECRET, NEXT_TELEMETRY_DISABLED: '1', ...env },
    });
    let out = '';
    child.stdout.on('data', (d) => (out += d));
    child.stderr.on('data', (d) => (out += d));
    const timer = setTimeout(() => child.kill('SIGKILL'), timeoutMs);
    child.on('error', reject);
    child.on('close', (code, signal) => {
      clearTimeout(timer);
      if (code === 0) resolve(out);
      else reject(new Error(`pnpm exec ${args.join(' ')} failed (code ${code}, signal ${signal})\n${tail(out)}`));
    });
  });
}

/** Fixture commands run in a subprocess that exits afterwards, closing every connection it owned. */
async function runFixture(cmd: string, extra: Record<string, string> = {}): Promise<Record<string, unknown>> {
  const out = await run(['payload', 'run', 'tests/integration/support/smoke-fixture.ts'], 240_000, {
    NODE_ENV: 'test',
    SMOKE_FIXTURE_CMD: cmd,
    ...extra,
  });
  const line = out.split('\n').find((l) => l.startsWith('FIXTURE_RESULT:'));
  if (!line) throw new Error(`fixture ${cmd} produced no result\n${tail(out)}`);
  return JSON.parse(line.slice('FIXTURE_RESULT:'.length)) as Record<string, unknown>;
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

const get = (route: string, init: RequestInit = {}) => fetch(`${base}${route}`, { redirect: 'manual', ...init });

async function waitUntilServing() {
  const deadline = Date.now() + 120_000;
  while (Date.now() < deadline) {
    if (server?.child.exitCode !== null) throw new Error(`next start exited early\n${tail(serverLog)}`);
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
  createdDatabase = true;

  // Schema (committed migrations), 17 imported project drafts + approved draft articles (incl. candidate #4), a
  // published project with one APPROVED and one UNCONFIRMED media file as positive control, published ID-only
  // SiteSettings (analytics off) and a published noindex singleton: all through the real CMS, in a fixture subprocess.
  const seeded = await runFixture('seed');
  fixture = seeded as unknown as { approved: Media; unconfirmed: Media };

  // Reproducible type check: regenerate the Payload types first so `next build` type-checks the app and the
  // test fixtures against the strict generated types, exactly as it does after any local Payload start.
  await run(['payload', 'generate:types'], 120_000);
  await run(['next', 'build'], 480_000);

  const port = await freePort();
  base = `http://127.0.0.1:${port}`;
  server = spawnGroup('pnpm', ['exec', 'next', 'start', '-p', String(port), '-H', '127.0.0.1'], {
    cwd: REPO_ROOT,
    env: { ...process.env, DATABASE_URL: smokeUrl, PAYLOAD_SECRET: SECRET, NODE_ENV: 'production', NEXT_TELEMETRY_DISABLED: '1' },
  });
  server.child.stdout?.on('data', (d) => (serverLog += d));
  server.child.stderr?.on('data', (d) => (serverLog += d));
  await waitUntilServing();
}, 840_000);

afterAll(async () => {
  try {
    if (server) await stopProcessGroup(server);
  } finally {
    // Only the database created by this file is ever dropped, and only once PostgreSQL reports no session on it.
    try {
      if (createdDatabase) await dropDisposableDatabase(admin, DB_NAME);
    } finally {
      await admin?.end();
    }
  }
}, 120_000);

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

describe('HTTP smoke: W5A SEO and analytics output', () => {
  it('home HTML carries the safe Organization JSON-LD and no analytics script by default', async () => {
    const html = await (await get('/')).text();
    expect(html).toContain('application/ld+json');
    expect(html).toContain('"@type":"Organization"');
    expect(html).not.toMatch(/LocalBusiness/);
    // ID-only published settings (analyticsEnabled=false): no external script, no analytics bootstrap.
    expect(html).not.toContain('googletagmanager.com');
    expect(html).not.toContain('G-ABC123DEF4');
  });

  it('project detail has a canonical, a BreadcrumbList and only the approved image', async () => {
    const html = await (await get(`/du-an/${PUBLISHED_PROJECT.slug}`)).text();
    expect(html).toContain(`/du-an/${PUBLISHED_PROJECT.slug}"`);
    expect(html).toContain('"@type":"BreadcrumbList"');
    expect(html).toContain(fixture!.approved.url);
    expect(html).not.toContain(fixture!.unconfirmed.filename);
  });

  it('the published hotline is rendered with its analytics hook; no Zalo is invented', async () => {
    const html = await (await get('/')).text();
    expect(html).toContain('href="tel:0900000000"');
    expect(html).toContain('data-analytics-event="phone_click"');
    expect(html).not.toContain('zalo.me');
  });

  it('sitemap excludes the published noindex singleton and private routes, includes indexable pages', async () => {
    const sitemap = await (await get('/sitemap.xml')).text();
    expect(sitemap).not.toContain('/lien-he');
    expect(sitemap).not.toMatch(/\/(admin|api)(\/|<)/);
    expect(sitemap).toContain('/gioi-thieu');
  });

  it('robots.txt disallows /admin and /api', async () => {
    const robots = await (await get('/robots.txt')).text();
    expect(robots).toMatch(/Disallow: \/admin/);
    expect(robots).toMatch(/Disallow: \/api/);
  });
});

describe('HTTP smoke: media rights at original and optimizer URLs (before and after revocation)', () => {
  const fileUrl = (m: Media) => `/api/media-assets/file/${encodeURIComponent(m.filename)}`;
  const optimizerUrls = (m: Media) => [
    `/_next/image?url=${encodeURIComponent(fileUrl(m))}&w=64&q=75`,
    `/_next/image?url=${encodeURIComponent(`${base}${fileUrl(m)}`)}&w=64&q=75`,
    `/_next/image?url=${encodeURIComponent(fileUrl(m))}&w=640&q=50`,
  ];
  const expectNoImageBytes = async (res: Response) => {
    expect(res.status).not.toBe(200);
    expect(res.headers.get('content-type') ?? '').not.toMatch(/^image\//);
    // Whatever the body is, it must not start with the PNG signature of the synthetic fixture image.
    expect(Buffer.from(await res.arrayBuffer()).subarray(0, 4).toString('hex')).not.toBe('89504e47');
  };
  const methods = ['GET', 'HEAD'] as const;

  it('the real file URL shape is the approved-media path accepted by the site', () => {
    expect(fixture!.approved.url).toBe(fileUrl(fixture!.approved));
  });

  it('APPROVED original serves real image bytes on GET; UNCONFIRMED original never serves on GET or HEAD', async () => {
    const ok = await get(fileUrl(fixture!.approved));
    expect(ok.status).toBe(200);
    expect(ok.headers.get('content-type')).toMatch(/^image\/png/);
    const bytes = Buffer.from(await ok.arrayBuffer());
    expect(bytes.subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a'); // PNG signature
    for (const method of methods) await expectNoImageBytes(await get(fileUrl(fixture!.unconfirmed), { method }));
  });

  it('HEAD on the original is not a supported capability of the Payload REST route: safe 404, no image body', async () => {
    // Payload's REST route exports GET/POST/DELETE/PATCH/PUT/OPTIONS only. Even for APPROVED media the answer is a
    // safe 404 with no image content: unsupported, not a rights bypass.
    const res = await get(fileUrl(fixture!.approved), { method: 'HEAD' });
    expect(res.status).toBe(404);
    await expectNoImageBytes(res);
  });

  it('Next image optimizer endpoint is disabled: crafted GET/HEAD never yield bytes, for APPROVED or UNCONFIRMED media', async () => {
    for (const media of [fixture!.approved, fixture!.unconfirmed]) {
      for (const url of optimizerUrls(media)) {
        for (const method of methods) {
          const res = await get(url, { method });
          expect(res.status, `${method} ${url}`).toBe(404);
          await expectNoImageBytes(res);
        }
      }
    }
  });

  it('after approval is revoked, neither the original nor any (previously warmed) optimizer URL exposes bytes', async () => {
    // Warm attempt while still APPROVED: all optimizer URLs are requested before revocation.
    for (const url of optimizerUrls(fixture!.approved)) expect((await get(url)).status).toBe(404);

    const revoked = await runFixture('revoke', { SMOKE_FIXTURE_MEDIA_ID: String(fixture!.approved.id) });
    expect(revoked).toEqual({ id: fixture!.approved.id, rightsStatus: 'UNCONFIRMED' });

    for (const method of methods) {
      await expectNoImageBytes(await get(fileUrl(fixture!.approved), { method }));
      for (const url of optimizerUrls(fixture!.approved)) {
        const res = await get(url, { method });
        expect(res.status, `${method} ${url}`).toBe(404);
        await expectNoImageBytes(res);
      }
    }
    // The public page no longer references the revoked image either.
    const html = await (await get(`/du-an/${PUBLISHED_PROJECT.slug}`)).text();
    expect(html).not.toContain(fixture!.approved.filename);
  });
});
