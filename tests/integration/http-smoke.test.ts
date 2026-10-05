import { type ChildProcess, spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { getDatabaseUrl } from '../../src/lib/database';
import manifest from '../../src/migration/legacy-manifest.json';
import { STATIC_PUBLIC_PATHS } from '../../src/lib/site';

// Actual Next HTTP proof against a disposable PostgreSQL database (synthetic data only).
// Everything this file creates is private to it: one uniquely named database (created and dropped here),
// one private Next dist directory and one temp directory. The shared CI database is never reset.
const repoRoot = path.resolve(__dirname, '../..');
const baseUrl = getDatabaseUrl();
if (!['localhost', '127.0.0.1', '::1', '[::1]'].includes(new URL(baseUrl).hostname)) {
  throw new Error('Refusing to create a disposable database on a non-local server');
}

const dbName = `bmsl_http_smoke_${randomBytes(6).toString('hex')}`;
const smokeUrl = (() => {
  const u = new URL(baseUrl);
  u.pathname = `/${dbName}`;
  return u.toString();
})();
const distDir = `.next-smoke-${randomBytes(4).toString('hex')}`;
const tmpDir = mkdtempSync(path.join(os.tmpdir(), 'bmsl-http-smoke-'));
const secret = `synthetic-${randomBytes(8).toString('hex')}`;
const nextBin = path.join(repoRoot, 'node_modules/next/dist/bin/next');
const payloadBin = path.join(repoRoot, 'node_modules/payload/bin.js');

const childEnv = (extra: Record<string, string | undefined> = {}) => {
  const env: Record<string, string | undefined> = { ...process.env, DATABASE_URL: smokeUrl, PAYLOAD_SECRET: secret, NEXT_DIST_DIR: distDir, NEXT_TELEMETRY_DISABLED: '1', ...extra };
  return env as NodeJS.ProcessEnv;
};

function run(args: string[], env: NodeJS.ProcessEnv, label: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, args, { cwd: repoRoot, env, stdio: ['ignore', 'pipe', 'pipe'] });
    let tail = '';
    const keep = (b: Buffer) => (tail = (tail + b.toString()).slice(-4000));
    child.stdout.on('data', keep);
    child.stderr.on('data', keep);
    child.on('error', reject);
    child.on('exit', (code) => (code === 0 ? resolve() : reject(new Error(`${label} failed (exit ${code}):\n${tail}`))));
  });
}

const freePort = () =>
  new Promise<number>((resolve, reject) => {
    const srv = net.createServer();
    srv.once('error', reject);
    srv.listen(0, '127.0.0.1', () => {
      const { port } = srv.address() as net.AddressInfo;
      srv.close(() => resolve(port));
    });
  });

let server: ChildProcess | undefined;
let origin = '';
const admin = new pg.Pool({ connectionString: baseUrl, max: 1 });
let created = false;

const get = (p: string) => fetch(origin + p, { redirect: 'manual' });

beforeAll(async () => {
  await admin.query(`create database ${dbName}`);
  created = true;
  // Committed migrations (push is disabled), then a production build and server on an unused port.
  await run([payloadBin, 'migrate'], childEnv({ NODE_ENV: 'development' }), 'payload migrate');
  await run([nextBin, 'build'], childEnv({ NODE_ENV: 'production' }), 'next build');

  // Synthetic drafts through the real importer CLI, to prove drafts never leak. Input lives outside the repo.
  const inputFile = path.join(tmpDir, 'articles.json');
  writeFileSync(
    inputFile,
    JSON.stringify({
      articles: [
        {
          legacyUrl: '/xu-huong-phat-trien-nganh-dich-vu-bao-ve-co-hoi-va-thach-thuc/',
          title: 'Synthetic draft article title',
          paragraphs: ['Synthetic paragraph.'],
          approval: { contentApproved: true, approvedBy: 'synthetic approver', approvedAt: '2026-01-01' },
        },
      ],
    }),
  );
  await run(
    [payloadBin, 'run', 'src/migration/run-import.ts', '--', '--write', '--input', inputFile],
    childEnv({ NODE_ENV: 'development' }),
    'migrate:legacy --write',
  );

  const port = await freePort();
  origin = `http://127.0.0.1:${port}`;
  server = spawn(process.execPath, [nextBin, 'start', '-p', String(port), '-H', '127.0.0.1'], {
    cwd: repoRoot,
    env: childEnv({ NODE_ENV: 'production' }),
    stdio: 'ignore',
  });
  const deadline = Date.now() + 60_000;
  for (;;) {
    try {
      if ((await fetch(origin + '/gioi-thieu', { redirect: 'manual' })).status === 200) break;
    } catch {
      /* not listening yet */
    }
    if (Date.now() > deadline || server.exitCode !== null) throw new Error('next start did not become ready');
    await new Promise((r) => setTimeout(r, 500));
  }
}, 600_000);

afterAll(async () => {
  server?.kill('SIGTERM');
  rmSync(tmpDir, { recursive: true, force: true });
  rmSync(path.join(repoRoot, distDir), { recursive: true, force: true });
  if (created) {
    // Only the database created by this file is ever dropped.
    await admin.query(`drop database if exists ${dbName} with (force)`);
  }
  await admin.end();
}, 60_000);

const redirects = manifest.entries.filter((e) => e.disposition === 'redirect');
const activeTargets = [...new Set(redirects.map((e) => e.activeTarget))];

describe('HTTP smoke against disposable PostgreSQL', () => {
  it('has 46 redirect sources and one identity root', () => {
    expect(redirects).toHaveLength(46);
    expect(manifest.entries.filter((e) => e.disposition === 'identity').map((e) => e.legacyPath)).toEqual(['/']);
  });

  it('every legacy source, with and without trailing slash, yields one direct 301 to its active target', async () => {
    const problems: string[] = [];
    let requests = 0;
    for (const e of redirects) {
      const noSlash = e.legacyPath.replace(/\/$/, '');
      for (const variant of [e.legacyPath, noSlash]) {
        requests += 1;
        const res = await get(variant);
        const location = res.headers.get('location');
        const target = location ? new URL(location, origin).pathname : null;
        if (res.status !== 301 || target !== e.activeTarget) problems.push(`#${e.id} ${variant} -> ${res.status} ${location}`);
      }
    }
    expect(requests).toBe(92);
    expect(problems).toEqual([]);
  });

  it('each active target and the root return 200 directly (no chain)', async () => {
    for (const target of ['/', ...activeTargets]) {
      const res = await get(target);
      expect(res.status, target).toBe(200);
      expect(res.headers.get('location'), target).toBeNull();
    }
  });

  it('the eight public IA routes return 200', async () => {
    expect(STATIC_PUBLIC_PATHS).toHaveLength(8);
    for (const p of STATIC_PUBLIC_PATHS) expect((await get(p)).status, p).toBe(200);
  });

  it('imported drafts do not leak: proposed detail targets are 404 and listings omit them', async () => {
    const detailTargets = redirects.map((e) => e.proposedTarget).filter((t) => !activeTargets.includes(t) && !STATIC_PUBLIC_PATHS.includes(t));
    expect(detailTargets.length).toBeGreaterThan(0);
    for (const t of [...new Set(detailTargets)]) expect((await get(t)).status, t).toBe(404);
    for (const listing of ['/du-an', '/kien-thuc']) {
      const html = await (await get(listing)).text();
      for (const project of manifest.projects) expect(html, listing).not.toContain(project.name);
      expect(html, listing).not.toContain('Synthetic draft article title');
    }
  });
});
