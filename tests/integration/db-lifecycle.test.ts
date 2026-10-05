import { randomBytes } from 'node:crypto';
import pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { dropDisposableDatabase, spawnGroup, stopProcessGroup, waitForNoSessions } from './support/db-lifecycle';

// Regression guard for the HTTP fixture's teardown (see support/db-lifecycle.ts): a database must only be dropped
// after the processes that own its connections are gone, and the helpers must prove that against PostgreSQL itself.

const ADMIN_URL = process.env.DATABASE_URL;
if (!ADMIN_URL) throw new Error('DATABASE_URL is required');
if (!['localhost', '127.0.0.1', '::1', '[::1]'].includes(new URL(ADMIN_URL).hostname)) {
  throw new Error('Refusing to provision a database on a non-local host');
}

const DB = `bmsl_lifecycle_${randomBytes(6).toString('hex')}`;
let admin: pg.Client;

const urlFor = (db: string) => {
  const u = new URL(ADMIN_URL);
  u.pathname = `/${db}`;
  return u.toString();
};

beforeAll(async () => {
  admin = new pg.Client({ connectionString: ADMIN_URL });
  await admin.connect();
  await admin.query(`create database "${DB}"`);
});

afterAll(async () => {
  await dropDisposableDatabase(admin, DB);
  await admin.end();
});

describe('disposable database teardown', () => {
  it('reports a still-connected owner instead of dropping or forcing', async () => {
    const owner = new pg.Client({ connectionString: urlFor(DB) });
    await owner.connect();
    await expect(waitForNoSessions(admin, DB, 600)).rejects.toThrow(/still connected/);
    // A plain DROP must also refuse while the owner is connected: nothing forces it away.
    await expect(admin.query(`drop database "${DB}"`)).rejects.toThrow(/being accessed by other users/);
    await owner.end();
    await waitForNoSessions(admin, DB, 10_000);
  });

  it('refuses to inspect or drop a database that is not disposable', async () => {
    await expect(waitForNoSessions(admin, 'postgres')).rejects.toThrow(/non-disposable/);
    await expect(dropDisposableDatabase(admin, 'bmsl')).rejects.toThrow(/non-disposable/);
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
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('subprocess did not connect')), 20_000);
      group.child.stdout?.on('data', (d) => {
        if (String(d).includes('connected')) {
          clearTimeout(timer);
          resolve();
        }
      });
    });
    await expect(waitForNoSessions(admin, DB, 400)).rejects.toThrow(/still connected/);

    await stopProcessGroup(group);
    await waitForNoSessions(admin, DB, 10_000);
    expect(() => process.kill(-(group.child.pid as number), 0)).toThrow(/ESRCH|kill/);
  });
});
