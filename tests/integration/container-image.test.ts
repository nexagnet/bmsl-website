import { execFile } from 'node:child_process';
import { createHash, randomBytes } from 'node:crypto';
import { chmodSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import net from 'node:net';
import { tmpdir } from 'node:os';
import path from 'node:path';
import pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createOwnedDatabase, dropDisposableDatabase, waitForNoSessions } from './support/db-lifecycle';
import { assertSafeAdminUrl } from './support/disposable-db';
import { observeNeverReady } from './support/never-ready';

// Packaged production runtime proof (CD2): builds the EXACT checked-out Dockerfile (frozen lockfile) and runs the
// resulting NON-ROOT image on the Linux Docker host network against a NEW invocation-owned PostgreSQL database and a
// NEW private persistent media volume. It proves, with real HTTP: fresh DB + committed migrations -> GET /healthz 200;
// fail-closed missing runtime configuration; a missing database never reports ready; synthetic media uploaded through
// the real CMS survives removing and re-creating the container on the same volume, with rights still enforced; and the
// CD gate CLI shipped in the image is runnable without any application secret. Synthetic data only.
//
// Nothing is skipped: if Docker (or its daemon) is unavailable this suite FAILS. Cleanup removes only the container,
// volume, image and database IDs created here; the database is dropped without FORCE after PostgreSQL reports no
// session. Secrets reach the container only through a private env file outside Git (mode 0600, deleted afterwards)
// and every error text is scrubbed of them.

const ADMIN_URL = assertSafeAdminUrl(process.env.BMSL_IT_ADMIN_DATABASE_URL);
const REPO_ROOT = path.resolve(import.meta.dirname, '../..');
const ID = randomBytes(6).toString('hex');
const IMAGE = `bmsl-it-image:${ID}`;
const VOLUME = `bmsl-it-media-${ID}`;
const DB_NAME = `bmsl_container_${ID}`;
const MISSING_DB_NAME = `bmsl_container_${randomBytes(6).toString('hex')}`;
const SECRET = `synthetic-container-${randomBytes(16).toString('hex')}`;
const BOOTSTRAP_TOKEN = `synthetic-bootstrap-${randomBytes(16).toString('hex')}`;
const ADMIN_PASSWORD = `Pw-${randomBytes(12).toString('hex')}`;
const ADMIN_EMAIL = 'container-admin@example.invalid';
const SHA = 'b3db97cbe1aad2f05fcb5f17b4cefe7db20d70f0';
const MEDIA_DIR = '/data/media';

const pngBytes = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
  'base64',
);

const secrets = [SECRET, BOOTSTRAP_TOKEN, ADMIN_PASSWORD, ADMIN_URL.password].filter(Boolean);
const scrub = (text: string) => secrets.reduce((t, s) => t.split(s).join('[redacted]'), text);

type Result = { code: number; stdout: string; stderr: string };
const docker = (args: string[], timeoutMs: number): Promise<Result> =>
  new Promise((resolve) => {
    execFile('docker', args, { cwd: REPO_ROOT, timeout: timeoutMs, maxBuffer: 32 * 1024 * 1024, encoding: 'utf8' }, (error, stdout, stderr) => {
      const code = error ? (typeof error.code === 'number' ? error.code : 1) : 0;
      resolve({ code, stdout: scrub(stdout), stderr: scrub(stderr) });
    });
  });
const must = async (args: string[], timeoutMs: number, what: string): Promise<string> => {
  const r = await docker(args, timeoutMs);
  if (r.code !== 0) throw new Error(`${what} failed (exit ${r.code})\n${(r.stdout + r.stderr).slice(-3000)}`);
  return r.stdout.trim();
};

const tmp = mkdtempSync(path.join(tmpdir(), 'bmsl-ctr-'));
const containers = new Set<string>();
let imageBuilt = false;
let volumeCreated = false;
let admin: pg.Client;
let createdDatabase = false;
let base = '';
let envFile = '';

const urlFor = (db: string) => {
  const u = new URL(ADMIN_URL.toString());
  u.pathname = `/${db}`;
  return u.toString();
};
const freePort = () =>
  new Promise<number>((resolve, reject) => {
    const s = net.createServer();
    s.once('error', reject);
    s.listen(0, '127.0.0.1', () => {
      const { port: p } = s.address() as net.AddressInfo;
      s.close(() => resolve(p));
    });
  });
const writeEnvFile = (name: string, vars: Record<string, string>) => {
  const file = path.join(tmp, name);
  writeFileSync(file, Object.entries(vars).map(([k, v]) => `${k}=${v}`).join('\n') + '\n', { mode: 0o600 });
  chmodSync(file, 0o600);
  return file;
};
const appEnv = (db: string, p: number): Record<string, string> => ({
  DATABASE_URL: urlFor(db),
  PAYLOAD_SECRET: SECRET,
  BMSL_MEDIA_DIR: MEDIA_DIR,
  PORT: String(p),
  SITE_URL: `http://127.0.0.1:${p}`,
  INITIAL_ADMIN_BOOTSTRAP_TOKEN: BOOTSTRAP_TOKEN,
});

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const running = async (name: string) => (await docker(['inspect', '-f', '{{.State.Running}}', name], 20_000)).stdout.trim() === 'true';
const logs = async (name: string) => {
  const r = await docker(['logs', '--tail', '60', name], 20_000);
  return (r.stdout + r.stderr).slice(-3000);
};

/** `docker run -d` on the host network with the private env file; the container is recorded for cleanup. */
async function start(name: string, file: string, extra: string[] = []): Promise<void> {
  containers.add(name);
  await must(['run', '-d', '--name', name, '--network', 'host', '--env-file', file, ...extra, IMAGE], 120_000, `start ${name}`);
}
/** True only when Docker positively reports the object does not exist (a daemon failure is NOT absence). */
const isAbsent = async (kind: 'container' | 'volume' | 'image', ref: string): Promise<boolean> => {
  const r = await docker([kind, 'inspect', ref], 30_000);
  return r.code !== 0 && /no such/i.test(r.stderr);
};
/** Stops and removes an owned container; ownership is kept until its absence is confirmed, otherwise this throws. */
async function removeContainer(name: string): Promise<void> {
  if (!containers.has(name)) return;
  await docker(['stop', '-t', '15', name], 60_000);
  await docker(['rm', '-f', name], 60_000);
  if (!(await isAbsent('container', name))) throw new Error(`owned container ${name} could not be confirmed removed`);
  containers.delete(name);
}
/** Foreground `docker run --rm`: named and tracked, so a client timeout cannot leave an untracked survivor. */
async function runOnce(name: string, args: string[], timeoutMs: number): Promise<Result> {
  containers.add(name);
  try {
    return await docker(['run', '--rm', '--name', name, ...args], timeoutMs);
  } finally {
    await removeContainer(name);
  }
}
let oneShot = 0;
const oneShotName = (label: string) => `bmsl-it-${label}-${ID}-${++oneShot}`;
async function healthz(): Promise<number | undefined> {
  try {
    return (await fetch(`${base}/healthz`, { signal: AbortSignal.timeout(5000), redirect: 'manual' })).status;
  } catch {
    return undefined;
  }
}
async function waitHealthy(name: string, timeoutMs = 240_000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (!(await running(name))) throw new Error(`container ${name} exited early\n${await logs(name)}`);
    if ((await healthz()) === 200) return;
    await sleep(1500);
  }
  throw new Error(`container ${name} never reported /healthz 200\n${await logs(name)}`);
}

beforeAll(async () => {
  const probe = await docker(['version', '--format', '{{.Server.Version}}'], 30_000);
  if (probe.code !== 0) {
    throw new Error('Docker daemon is unavailable: the packaged-container proof is REQUIRED and is never skipped');
  }
  admin = new pg.Client({ connectionString: ADMIN_URL.toString(), connectionTimeoutMillis: 15_000 });
  await admin.connect();
  // The application is configured with disableCreateDatabase: the database must be pre-provisioned (and owned) here.
  await createOwnedDatabase(admin, DB_NAME);
  createdDatabase = true;
  const port = await freePort();
  base = `http://127.0.0.1:${port}`;
  envFile = writeEnvFile('app.env', appEnv(DB_NAME, port));
  await must(['build', '-t', IMAGE, '.'], 600_000, 'docker build');
  imageBuilt = true;
  await must(['volume', 'create', VOLUME], 30_000, 'volume create');
  volumeCreated = true;
}, 720_000);

afterAll(async () => {
  // Every owned cleanup is attempted; any failure is aggregated and fails the suite (required CI never passes silently).
  const failures: string[] = [];
  const attempt = async (what: string, fn: () => Promise<unknown>) => {
    try {
      await fn();
    } catch (error) {
      failures.push(`${what}: ${scrub(error instanceof Error ? error.message : String(error))}`);
    }
  };
  for (const name of [...containers]) await attempt(`container ${name}`, () => removeContainer(name));
  if (volumeCreated) {
    await attempt('volume', async () => {
      await docker(['volume', 'rm', VOLUME], 60_000);
      if (!(await isAbsent('volume', VOLUME))) throw new Error(`owned volume ${VOLUME} could not be confirmed removed`);
    });
  }
  if (imageBuilt) {
    await attempt('image', async () => {
      await docker(['image', 'rm', IMAGE], 60_000);
      if (!(await isAbsent('image', IMAGE))) throw new Error(`owned image ${IMAGE} could not be confirmed removed`);
    });
  }
  await attempt('private env files', async () => rmSync(tmp, { recursive: true, force: true }));
  if (createdDatabase) await attempt('database', () => dropDisposableDatabase(admin, DB_NAME, 60_000));
  await attempt('admin connection', async () => admin?.end());
  if (failures.length > 0) throw new Error(`cleanup failed:\n${failures.join('\n')}`);
}, 360_000);

describe('container image: identity and fail-closed configuration', () => {
  it('runs as non-root user:group node:node and keeps application files read-only', async () => {
    expect(await must(['image', 'inspect', '-f', '{{.Config.User}}', IMAGE], 30_000, 'inspect')).toBe('node:node');
    const r = await runOnce(
      oneShotName('id'),
      ['--network', 'none', '--entrypoint', 'sh', IMAGE, '-c', 'echo "$(id -u):$(id -g)"; test ! -w /app/package.json && test ! -w /app/src && echo ro; test -w /data/media && echo media-w'],
      60_000,
    );
    expect(r.code).toBe(0);
    expect(r.stdout.split('\n').map((l) => l.trim())).toEqual(['1000:1000', 'ro', 'media-w', '']);
  });

  it('exits non-zero with a fixed message and no value when runtime configuration is missing', async () => {
    const noSecret = writeEnvFile('partial.env', { DATABASE_URL: urlFor(DB_NAME), BMSL_MEDIA_DIR: MEDIA_DIR });
    const r = await runOnce(oneShotName('nosecret'), ['--network', 'none', '--env-file', noSecret, IMAGE], 60_000);
    expect(r.code).toBe(1);
    expect(r.stderr).toContain('PAYLOAD_SECRET is required');
    expect(r.stderr).not.toContain(SECRET);
    const none = await runOnce(oneShotName('noenv'), ['--network', 'none', IMAGE], 60_000);
    expect(none.code).toBe(1);
    expect(none.stderr).toContain('DATABASE_URL is required');
  });

  it('a database that does not exist is never reported ready and is not auto-created', async () => {
    const name = `bmsl-it-nodb-${ID}`;
    const missingPort = await freePort();
    const file = writeEnvFile('missing-db.env', appEnv(MISSING_DB_NAME, missingPort));
    // Private tmpfs for media: this container must not touch the proof volume.
    await start(name, file, ['--mount', 'type=tmpfs,destination=/data/media,tmpfs-mode=1777']);
    // Only connection failures are tolerated; any observed 200 fails at once (see support/never-ready.test.ts).
    const verdict = await observeNeverReady({
      isRunning: () => running(name),
      probe: async () => (await fetch(`http://127.0.0.1:${missingPort}/healthz`, { signal: AbortSignal.timeout(5000) })).status,
      sleep: async (ms) => void (await sleep(ms)),
      timeoutMs: 90_000,
    });
    expect(['exited', 'unavailable']).toContain(verdict);
    await removeContainer(name);
    const exists = await admin.query('select 1 from pg_database where datname = $1', [MISSING_DB_NAME]);
    expect(exists.rowCount).toBe(0);
  }, 150_000);
});

describe('container image: fresh database, migrations, media volume, rights', () => {
  const name = `bmsl-it-app-${ID}`;
  const volumeMount = ['-v', `${VOLUME}:${MEDIA_DIR}`];
  let mediaId = 0;
  let mediaFilename = '';
  const sha256 = createHash('sha256').update(pngBytes).digest('hex');

  const json = { 'content-type': 'application/json' };
  const login = async () => {
    const res = await fetch(`${base}/api/users/login`, { method: 'POST', headers: json, body: JSON.stringify({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD }) });
    expect(res.status, 'login').toBe(200);
    return ((await res.json()) as { token: string }).token;
  };

  it('applies the committed migrations to the fresh database and reports GET /healthz 200 (read-only, no-store)', async () => {
    await start(name, envFile, volumeMount);
    await waitHealthy(name);
    const res = await fetch(`${base}/healthz`);
    expect(res.status).toBe(200);
    expect(res.headers.get('cache-control')).toContain('no-store');
    expect(await res.json()).toEqual({ status: 'ok' });
    const db = new pg.Client({ connectionString: urlFor(DB_NAME) });
    await db.connect();
    try {
      expect(Number((await db.query('select count(*)::int as n from payload_migrations')).rows[0].n)).toBeGreaterThan(0);
    } finally {
      await db.end();
    }
  }, 300_000);

  it('serves the public home page from the packaged runtime', async () => {
    expect((await fetch(`${base}/`, { redirect: 'manual' })).status).toBe(200);
  });

  it('the process inside the container is the non-root node user and can write the mounted media volume', async () => {
    const r = await must(['exec', name, 'sh', '-c', `id -u; touch ${MEDIA_DIR}/.write-probe && rm ${MEDIA_DIR}/.write-probe && echo writable`], 30_000, 'exec');
    expect(r.split('\n').map((l) => l.trim())).toEqual(['1000', 'writable']);
  });

  it('uploads synthetic media through the real CMS as the bootstrapped ADMIN; it is stored on the volume and UNCONFIRMED', async () => {
    const first = await fetch(`${base}/api/users/first-register`, {
      method: 'POST',
      headers: { ...json, 'x-bootstrap-token': BOOTSTRAP_TOKEN },
      body: JSON.stringify({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD, role: 'ADMIN' }),
    });
    expect(first.status).toBe(200);
    const token = await login();
    const form = new FormData();
    form.set('_payload', JSON.stringify({ alt: 'synthetic container media', rightsStatus: 'UNCONFIRMED' }));
    form.set('file', new Blob([new Uint8Array(pngBytes)], { type: 'image/png' }), 'container-proof.png');
    const res = await fetch(`${base}/api/media-assets`, { method: 'POST', headers: { authorization: `JWT ${token}` }, body: form });
    expect(res.status).toBe(201);
    const doc = ((await res.json()) as { doc: { id: number; filename: string; rightsStatus: string } }).doc;
    expect(doc.rightsStatus).toBe('UNCONFIRMED');
    mediaId = doc.id;
    mediaFilename = doc.filename;
    const hash = await must(['exec', name, 'sha256sum', `${MEDIA_DIR}/${mediaFilename}`], 30_000, 'sha256sum');
    expect(hash.split(/\s+/)[0]).toBe(sha256);
    const owner = await must(['exec', name, 'stat', '-c', '%u:%g', `${MEDIA_DIR}/${mediaFilename}`], 30_000, 'stat');
    expect(owner).toBe('1000:1000');
  }, 120_000);

  it('rights are enforced: the UNCONFIRMED original is not served anonymously', async () => {
    const res = await fetch(`${base}/api/media-assets/file/${encodeURIComponent(mediaFilename)}`, { redirect: 'manual' });
    expect(res.status).not.toBe(200);
    expect(res.status).not.toBe(304);
    expect(Buffer.from(await res.arrayBuffer()).subarray(1, 4).toString('latin1')).not.toBe('PNG');
  });

  it('media survives removing and re-creating the container on the same volume, with the rights still enforced', async () => {
    await removeContainer(name);
    await start(name, envFile, volumeMount);
    await waitHealthy(name);
    const hash = await must(['exec', name, 'sha256sum', `${MEDIA_DIR}/${mediaFilename}`], 30_000, 'sha256sum');
    expect(hash.split(/\s+/)[0]).toBe(sha256);
    const token = await login();
    const doc = await fetch(`${base}/api/media-assets/${mediaId}`, { headers: { authorization: `JWT ${token}` } });
    expect(doc.status).toBe(200);
    expect(((await doc.json()) as { rightsStatus: string }).rightsStatus).toBe('UNCONFIRMED');
    const anonymous = await fetch(`${base}/api/media-assets/file/${encodeURIComponent(mediaFilename)}`, { redirect: 'manual' });
    expect(anonymous.status).not.toBe(200);
    expect([401, 403, 404]).toContain((await fetch(`${base}/api/media-assets/${mediaId}`)).status);
  }, 300_000);

  it('stops cleanly and leaves PostgreSQL with no session on the owned database', async () => {
    await removeContainer(name);
    await waitForNoSessions(admin, DB_NAME, 60_000);
  }, 120_000);
});

describe('container image: CD gate CLI is included and runnable without application secrets', () => {
  const run = (envVars: string[], extra: string[] = [], cmd: string[] = ['node', 'scripts/cd/gate-main-ci.mjs']) =>
    runOnce(oneShotName('gate'), ['--network', 'none', ...envVars.flatMap((e) => ['-e', e]), ...extra, IMAGE, ...cmd], 120_000);

  it('an invalid SHA exits 2 without any DATABASE_URL, PAYLOAD_SECRET or media volume', async () => {
    const r = await run(['BMSL_TARGET_SHA=not-a-sha']);
    expect(r.code).toBe(2);
    expect(r.stdout).toBe('');
  });

  it('a valid SHA with no reachable GitHub fails closed (exit 5), proving no credential or network is assumed', async () => {
    const r = await run([`BMSL_TARGET_SHA=${SHA}`, 'BMSL_GATE_TIMEOUT_SECONDS=30']);
    expect(r.code).toBe(5);
    expect(r.stdout).toBe('');
    expect(r.stderr).toContain('"status":"fail"');
  }, 120_000);

  it('a synthetic API fixture preloaded into the real image entrypoint exits 0 and prints only safe metadata', async () => {
    const dir = path.join(tmp, 'gate');
    const preload = path.join(dir, 'preload.mjs');
    mkdirSync(dir, { recursive: true, mode: 0o755 });
    const runObj = `{ id: 900, run_number: 10, run_attempt: 1, workflow_id: 375023465, path: '.github/workflows/ci.yml', event: 'push', head_branch: 'main', head_sha: SHA, status: 'completed', conclusion: 'success', head_repository: { full_name: 'nexagnet/bmsl-website' }, repository: { full_name: 'nexagnet/bmsl-website' } }`;
    writeFileSync(
      preload,
      `const SHA = ${JSON.stringify(SHA)};
const ok = (b) => new Response(JSON.stringify(b), { status: 200 });
const job = (name, step) => ({ id: 1, run_id: 900, run_attempt: 1, head_sha: SHA, name, status: 'completed', conclusion: 'success', steps: [{ name: step, status: 'completed', conclusion: 'success' }] });
globalThis.fetch = async (url) => {
  const p = new URL(String(url)).pathname;
  if (p.endsWith('/branches/main')) return ok({ commit: { sha: SHA } });
  if (p.endsWith('/runs')) return ok({ total_count: 1, workflow_runs: [${runObj}] });
  if (p.endsWith('/jobs')) return ok({ total_count: 2, jobs: [job('verify', 'Application verify scripts'), job('integration', 'Required application integration suite')] });
  if (p.endsWith('/runs/900')) return ok(${runObj});
  return new Response('{}', { status: 404 });
};
`,
      { mode: 0o644 },
    );
    chmodSync(preload, 0o644);
    const r = await run([`BMSL_TARGET_SHA=${SHA}`], ['-v', `${dir}:/gate-fixture:ro`], ['node', '--import', '/gate-fixture/preload.mjs', 'scripts/cd/gate-main-ci.mjs']);
    expect(r.code).toBe(0);
    expect(JSON.parse(r.stdout)).toEqual({ gate: 'bmsl-main-ci', status: 'pass', reason: 'exact-main ci verified', sha: SHA, runId: 900, attempt: 1 });
  }, 120_000);
});
