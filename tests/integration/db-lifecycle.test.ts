import { randomBytes } from 'node:crypto';
import pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  createOwnedDatabase,
  dropDisposableDatabase,
  runInGroup,
  spawnGroup,
  stopProcessGroup,
  waitForNoSessions,
} from './support/db-lifecycle';
import { assertSafeAdminUrl, INVOCATION_DB_ENV } from './support/disposable-db';

// Regression guard for the HTTP fixture's teardown (see support/db-lifecycle.ts): a database must only be dropped
// after the processes that own its connections are gone, and the helpers must prove that against PostgreSQL itself.

// Administrative connection provided by the integration entrypoint (global-setup.ts), validated again here.
const ADMIN_URL = assertSafeAdminUrl(process.env.BMSL_IT_ADMIN_DATABASE_URL).toString();

const DB = `bmsl_lifecycle_${randomBytes(6).toString('hex')}`;
let admin: pg.Client;

const urlFor = (db: string) => {
  const u = new URL(ADMIN_URL);
  u.pathname = `/${db}`;
  return u.toString();
};

const sessionCount = async (db: string) =>
  Number((await admin.query('select count(*)::int as n from pg_stat_activity where datname = $1 and pid <> pg_backend_pid()', [db])).rows[0].n);

const until = async (predicate: () => Promise<boolean>, ms: number, what: string) => {
  const deadline = Date.now() + ms;
  while (Date.now() < deadline) {
    if (await predicate()) return;
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error(`timed out waiting for ${what}`);
};

beforeAll(async () => {
  admin = new pg.Client({ connectionString: ADMIN_URL });
  await admin.connect();
  await createOwnedDatabase(admin, DB);
});

afterAll(async () => {
  try {
    await dropDisposableDatabase(admin, DB);
  } finally {
    await admin.end();
  }
});

describe('disposable database teardown', () => {
  it('reports a still-connected owner instead of dropping or forcing', async () => {
    const owner = new pg.Client({ connectionString: urlFor(DB) });
    await owner.connect();
    try {
      await expect(waitForNoSessions(admin, DB, 600)).rejects.toThrow(/still connected/);
      // A plain DROP must also refuse while the owner is connected: nothing forces it away.
      await expect(admin.query(`drop database "${DB}"`)).rejects.toThrow(/being accessed by other users/);
    } finally {
      await owner.end();
    }
    await waitForNoSessions(admin, DB, 10_000);
  });

  it('refuses to inspect or drop a database that is not disposable', async () => {
    await expect(waitForNoSessions(admin, 'postgres')).rejects.toThrow(/non-disposable/);
    await expect(dropDisposableDatabase(admin, 'bmsl')).rejects.toThrow(/non-disposable/);
  });

  it('never drops a database it did not create, even with a valid disposable-looking name (real PostgreSQL)', async () => {
    // Created out-of-band (as another run or a person might), so this module never owned it.
    const foreign = `bmsl_lifecycle_${randomBytes(6).toString('hex')}`;
    await admin.query(`create database "${foreign}"`);
    try {
      await expect(dropDisposableDatabase(admin, foreign)).rejects.toThrow(/not created by this run/);
      const still = await admin.query('select 1 from pg_database where datname = $1', [foreign]);
      expect(still.rowCount).toBe(1);
      // An already-existing name cannot be claimed either: CREATE fails and ownership is not recorded.
      await expect(createOwnedDatabase(admin, foreign)).rejects.toThrow(/already exists/);
      await expect(dropDisposableDatabase(admin, foreign)).rejects.toThrow(/not created by this run/);
    } finally {
      await admin.query(`drop database if exists "${foreign}"`); // test-created above, so this test cleans it itself
    }
  });

  it('a subprocess that holds a connection releases it when its group is stopped', async () => {
    const script = `
      const pg = require('pg');
      const c = new pg.Client({ connectionString: process.env.OWNED_URL });
      c.connect().then(() => console.log('connected'));
      setInterval(() => {}, 1000);
    `;
    const group = spawnGroup('node', ['-e', script], {
      cwd: process.cwd(),
      env: { ...process.env, OWNED_URL: urlFor(DB) },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    try {
      await new Promise<void>((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error('subprocess did not connect')), 20_000);
        group.child.once('exit', () => reject(new Error('subprocess exited before connecting')));
        group.child.stdout?.on('data', (d) => {
          if (String(d).includes('connected')) {
            clearTimeout(timer);
            resolve();
          }
        });
      });
      await expect(waitForNoSessions(admin, DB, 400)).rejects.toThrow(/still connected/);
    } finally {
      // Runs on readiness or assertion failure too, so a failed run never leaves a process holding a session.
      await stopProcessGroup(group);
    }
    await waitForNoSessions(admin, DB, 10_000);
    expect(() => process.kill(-(group.child.pid as number), 0)).toThrow(/ESRCH|kill/);
  });
});

describe('invocation-owned command groups (the pnpm -> payload/next -> node shape of http-smoke)', () => {
  // The parent holds no session itself; a DESCENDANT does, exactly like `pnpm exec` spawning `node`. Killing only the
  // parent (the old behaviour) would leave that descendant, its session and its pipes behind.
  const descendantHoldingSession = (parentTail: string) => `
    const { spawn } = require('node:child_process');
    spawn(process.execPath, ['-e', ${JSON.stringify(`
      const pg = require('pg');
      const c = new pg.Client({ connectionString: process.env.OWNED_URL });
      c.connect().then(() => { setInterval(() => {}, 1000); });
    `)}], { stdio: 'inherit' });
    ${parentTail}
  `;
  const run = (parentTail: string, timeoutMs: number) =>
    runInGroup('node', ['-e', descendantHoldingSession(parentTail)], {
      cwd: process.cwd(),
      env: { ...process.env, OWNED_URL: urlFor(DB) },
      timeoutMs,
      graceMs: 3_000,
    });
  const unrelatedDatabaseStillExists = async () => {
    const name = process.env[INVOCATION_DB_ENV];
    expect(name).toBeTruthy();
    const rows = await admin.query('select 1 from pg_database where datname = $1', [name]);
    expect(rows.rowCount).toBe(1);
  };

  it('on timeout the whole group is killed: the descendant, its session and the pipes are gone before DROP', async () => {
    const running = run('setInterval(() => {}, 1000);', 8_000);
    const outcome = running.then(() => undefined, (error: Error) => error);
    await until(async () => (await sessionCount(DB)) > 0, 7_000, 'the descendant to hold a session'); // not vacuous
    const error = await outcome;
    expect(error?.message).toMatch(/timed out/);
    // runInGroup has already awaited the group's pipes: PostgreSQL must show no session without any extra waiting.
    expect(await sessionCount(DB)).toBe(0);
    await waitForNoSessions(admin, DB, 2_000);
    await unrelatedDatabaseStillExists();
  }, 40_000);

  it('on failure of the leader the surviving descendant is killed too', async () => {
    const running = run(`setTimeout(() => process.exit(3), 7000);`, 30_000);
    const outcome = running.then(() => undefined, (error: Error) => error);
    await until(async () => (await sessionCount(DB)) > 0, 6_500, 'the descendant to hold a session');
    const error = await outcome;
    expect(error?.message).toMatch(/failed \(code 3/);
    expect(await sessionCount(DB)).toBe(0);
    await unrelatedDatabaseStillExists();
  }, 40_000);

  it('a clean exit also leaves no descendant behind', async () => {
    await run(`setTimeout(() => process.exit(0), 3000);`, 30_000);
    expect(await sessionCount(DB)).toBe(0);
  }, 40_000);
});
