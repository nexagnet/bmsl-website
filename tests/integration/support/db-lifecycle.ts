import { type ChildProcess, spawn, type SpawnOptions } from 'node:child_process';
import type pg from 'pg';

// Lifecycle helpers for the disposable-database HTTP fixture. Every connection to the disposable database is
// owned by a process this test spawned (the Next server group and short-lived fixture subprocesses). Cleanup
// ends those processes, waits until PostgreSQL itself reports no session left, and only then drops the
// database, without WITH (FORCE) and without terminating anyone else's sessions.

const DISPOSABLE_NAME = /^bmsl_[a-z_]+_[0-9a-f]{12,16}$/;

// Ownership is not a naming convention: a name that merely looks disposable (right prefix, local host) may belong
// to someone else's run. Only databases whose CREATE DATABASE this module instance actually executed successfully
// are recorded here, and only recorded databases can be inspected-for-drop or dropped.
const owned = new Set<string>();

export const ownsDatabase = (dbName: string): boolean => owned.has(dbName);

/** Creates a database and records ownership only after PostgreSQL confirmed the creation (a failed or "already exists" CREATE is never owned). */
export async function createOwnedDatabase(admin: pg.Client, dbName: string): Promise<void> {
  if (!DISPOSABLE_NAME.test(dbName)) throw new Error(`refusing to create non-disposable database ${dbName}`);
  await admin.query(`create database "${dbName}"`);
  owned.add(dbName);
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export type Group = { child: ChildProcess; closed: Promise<void> };

/** Spawns a child in its own process group and records when its stdio has fully closed. */
export function spawnGroup(command: string, args: string[], options: SpawnOptions): Group {
  const child = spawn(command, args, { ...options, detached: true });
  const closed = new Promise<void>((resolve) => child.once('close', () => resolve()));
  return { child, closed };
}

const within = (p: Promise<void>, ms: number): Promise<boolean> =>
  new Promise((resolve) => {
    const timer = setTimeout(() => resolve(false), ms);
    void p.then(() => {
      clearTimeout(timer);
      resolve(true);
    });
  });

/**
 * Stops a group started by spawnGroup together with every descendant (`pnpm exec next start` -> node):
 * SIGTERM first, SIGKILL for the same group if it does not close in time. Resolves only after the group's stdio
 * has closed, i.e. after every process in it has released its pipes. Safe to call more than once.
 */
export async function stopProcessGroup({ child, closed }: Group, graceMs = 10_000): Promise<void> {
  const pid = child.pid;
  if (pid === undefined) return;
  const signalGroup = (signal: NodeJS.Signals) => {
    try {
      process.kill(-pid, signal);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ESRCH') throw error;
    }
  };
  signalGroup('SIGTERM');
  if (await within(closed, graceMs)) {
    signalGroup('SIGKILL'); // leader is gone; make sure no straggler of the group outlives it
    return;
  }
  signalGroup('SIGKILL');
  if (!(await within(closed, 10_000))) throw new Error(`process group ${pid} did not close after SIGKILL`);
}

export type RunOptions = { cwd: string; env: NodeJS.ProcessEnv; timeoutMs: number; graceMs?: number };

/**
 * Runs a command as an invocation-owned process group and resolves with its combined output. On timeout, failure or
 * success the WHOLE group (for example `pnpm exec payload run` -> node, which hold the PostgreSQL sessions) is
 * stopped and its pipes are awaited before this returns, so a caller can safely DROP the database afterwards.
 */
export async function runInGroup(command: string, args: string[], { cwd, env, timeoutMs, graceMs }: RunOptions): Promise<string> {
  const group = spawnGroup(command, args, { cwd, env });
  let out = '';
  group.child.stdout?.on('data', (d) => (out += d));
  group.child.stderr?.on('data', (d) => (out += d));
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    void stopProcessGroup(group, graceMs).catch(() => undefined);
  }, timeoutMs);
  let spawnError: Error | undefined;
  group.child.once('error', (error) => {
    spawnError = error;
  });
  const result = await new Promise<{ code: number | null; signal: NodeJS.Signals | null }>((resolve) => {
    group.child.once('exit', (code, signal) => resolve({ code, signal }));
    group.child.once('error', () => resolve({ code: null, signal: null }));
  });
  clearTimeout(timer);
  let stopError: unknown;
  try {
    await stopProcessGroup(group, graceMs); // descendants of a finished leader must not outlive the run
  } catch (error) {
    stopError = error;
  }
  const tail = out.slice(-4000);
  if (spawnError) throw spawnError;
  if (timedOut) throw new Error(`${command} ${args.join(' ')} timed out after ${timeoutMs} ms\n${tail}`);
  if (result.code !== 0) {
    throw new Error(`${command} ${args.join(' ')} failed (code ${result.code}, signal ${result.signal})\n${tail}`);
  }
  if (stopError) throw stopError;
  return out;
}

const sessionsOf = async (admin: pg.Client, dbName: string) =>
  (
    await admin.query<{ pid: number; state: string | null; application_name: string }>(
      'select pid, state, application_name from pg_stat_activity where datname = $1 and pid <> pg_backend_pid()',
      [dbName],
    )
  ).rows;

/** Polls PostgreSQL until the database has no session. Fails loudly (with the leftovers) instead of forcing. */
export async function waitForNoSessions(admin: pg.Client, dbName: string, timeoutMs = 30_000): Promise<void> {
  if (!DISPOSABLE_NAME.test(dbName)) throw new Error(`refusing to inspect non-disposable database ${dbName}`);
  const deadline = Date.now() + timeoutMs;
  let rows = await sessionsOf(admin, dbName);
  while (rows.length > 0 && Date.now() < deadline) {
    await sleep(200);
    rows = await sessionsOf(admin, dbName);
  }
  if (rows.length > 0) {
    throw new Error(`${rows.length} session(s) still connected to ${dbName}: ${JSON.stringify(rows)}`);
  }
}

/** Drops only a database this test created, and only once nothing is connected to it. */
export async function dropDisposableDatabase(admin: pg.Client, dbName: string, timeoutMs = 30_000): Promise<void> {
  if (!DISPOSABLE_NAME.test(dbName)) throw new Error(`refusing to drop non-disposable database ${dbName}`);
  if (!owned.has(dbName)) throw new Error(`refusing to drop ${dbName}: it was not created by this run`);
  await waitForNoSessions(admin, dbName, timeoutMs);
  await admin.query(`drop database if exists "${dbName}"`);
  owned.delete(dbName);
}
