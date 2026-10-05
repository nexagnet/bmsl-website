import { createHash, randomBytes } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { directoryTree, readArchiveIndex } from '../../scripts/backup/archive.mjs';
import {
  BUNDLE_FILES,
  createBackup,
  fingerprintDatabase,
  newRestoreDatabaseName,
  restoreBundle,
  verifyBundle,
  type Manifest,
} from '../../scripts/backup/bundle.mjs';
import { createOwnedDatabase, dropDisposableDatabase, runInGroup } from './support/db-lifecycle';
import { assertSafeAdminUrl, databaseUrlFor } from './support/disposable-db';

// W5C synthetic, disposable backup/restore proof. It runs inside the existing required `pnpm test:integration` step
// (real PostgreSQL service; pg_dump/pg_restore must exist and match: a missing tool FAILS this file, nothing skips).
//
// Resources this file creates and owns: one source database (bmsl_bkp_src_<hex>), one empty database for the
// "no migrations" refusal (bmsl_bkp_empty_<hex>), one decoy database (bmsl_restore_<hex>) for the pre-existing-target
// refusal, and a private temp root. Every restore database is created, recorded and removed by restoreBundle itself;
// this file only checks that afterwards they are gone. Nothing real is read or written; all data is synthetic.
//
// Worker lifecycle: the Payload fixture subprocesses (support/backup-fixture.ts) own their pools and exit; they run as
// invocation-owned process groups and, before any cleanup, PostgreSQL itself (pg_stat_activity) must report no session
// on the database they used. payload.destroy() is NOT assumed to close connections.

const ADMIN_URL = assertSafeAdminUrl(process.env.BMSL_IT_ADMIN_DATABASE_URL);
const ADMIN_PASSWORD = decodeURIComponent(ADMIN_URL.password);
const REPO_ROOT = path.resolve(import.meta.dirname, '../..');
const CLI = path.join(REPO_ROOT, 'scripts', 'backup', 'cli.mjs');
const PAYLOAD_SECRET = `synthetic-backup-${randomBytes(8).toString('hex')}`;
const LEAD_EMAIL = 'synthetic-backup-lead@example.invalid';

const hex12 = () => randomBytes(6).toString('hex');
const SRC_DB = `bmsl_bkp_src_${hex12()}`;
const EMPTY_DB = `bmsl_bkp_empty_${hex12()}`;
const sha = (b: Buffer | string) => createHash('sha256').update(b).digest('hex');

let admin: pg.Client;
let tmpRoot: string;
let srcMedia: string;
let head: string;
let bundle: string;
let manifest: Manifest;
let seeded: { leadId: number; mediaFiles: string[] };
const created: string[] = [];

const urlOf = (name: string) => databaseUrlFor(ADMIN_URL, name);
const databases = async (like: string) =>
  (await admin.query<{ datname: string }>('select datname from pg_database where datname like $1 order by datname', [like])).rows.map((r) => r.datname);
const sessions = async (name: string) =>
  (await admin.query('select pid from pg_stat_activity where datname = $1 and pid <> pg_backend_pid()', [name])).rowCount ?? 0;
const withClient = async <T>(name: string, fn: (c: pg.Client) => Promise<T>) => {
  const c = new pg.Client({ connectionString: urlOf(name) });
  await c.connect();
  try {
    return await fn(c);
  } finally {
    await c.end();
  }
};

async function fixture(cmd: string, dbName: string, mediaDir: string): Promise<Record<string, unknown>> {
  const out = await runInGroup('pnpm', ['exec', 'payload', 'run', 'tests/integration/support/backup-fixture.ts'], {
    cwd: REPO_ROOT,
    env: {
      ...process.env,
      DATABASE_URL: urlOf(dbName),
      PAYLOAD_SECRET,
      NODE_ENV: 'test',
      NEXT_TELEMETRY_DISABLED: '1',
      BMSL_MEDIA_DIR: mediaDir,
      BKP_FIXTURE_CMD: cmd,
    },
    timeoutMs: 240_000,
  });
  const line = out.split('\n').find((l) => l.startsWith('FIXTURE_RESULT:'));
  if (!line) throw new Error(`fixture ${cmd} produced no result\n${out.slice(-3000)}`);
  const result = JSON.parse(line.slice('FIXTURE_RESULT:'.length)) as Record<string, unknown>;
  expect(await sessions(dbName), `fixture ${cmd} left a PostgreSQL session open on ${dbName}`).toBe(0);
  return result;
}

async function cli(args: string[], env: Record<string, string>): Promise<Record<string, unknown>> {
  const out = await runInGroup(process.execPath, [CLI, ...args], { cwd: REPO_ROOT, env: { ...process.env, ...env }, timeoutMs: 300_000 });
  expect(out).not.toContain(ADMIN_PASSWORD);
  const line = out.trim().split('\n').pop() ?? '';
  return JSON.parse(line) as Record<string, unknown>;
}

/** Private copy of a bundle that a test may damage; the original stays intact. */
function copyBundle(name: string): string {
  const dest = path.join(tmpRoot, name);
  fs.mkdirSync(dest, { mode: 0o700 });
  for (const f of fs.readdirSync(bundle)) {
    fs.copyFileSync(path.join(bundle, f), path.join(dest, f));
    fs.chmodSync(path.join(dest, f), 0o600);
  }
  return dest;
}

const restoreArgs = (over: Partial<Parameters<typeof restoreBundle>[0]> = {}) => ({
  bundleDir: bundle,
  targetDir: path.join(tmpRoot, `restore-${hex12()}`),
  databaseName: newRestoreDatabaseName(),
  adminDatabaseUrl: ADMIN_URL.toString(),
  ...over,
});

const restoreDatabases = async () => (await databases('bmsl\\_restore\\_%')).sort();

beforeAll(async () => {
  admin = new pg.Client({ connectionString: ADMIN_URL.toString() });
  await admin.connect();
  tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'bmsl-w5c-'));
  fs.chmodSync(tmpRoot, 0o700);
  srcMedia = path.join(tmpRoot, 'media-src');
  fs.mkdirSync(srcMedia);
  head = (await runInGroup('git', ['rev-parse', 'HEAD'], { cwd: REPO_ROOT, env: process.env, timeoutMs: 15_000 })).trim();
  expect(head).toMatch(/^[0-9a-f]{40}$/);
  await createOwnedDatabase(admin, SRC_DB);
  created.push(SRC_DB);
  await createOwnedDatabase(admin, EMPTY_DB);
  created.push(EMPTY_DB);
  seeded = (await fixture('seed', SRC_DB, srcMedia)) as typeof seeded;
}, 300_000);

afterAll(async () => {
  try {
    for (const name of created.reverse()) await dropDisposableDatabase(admin, name, 60_000);
  } finally {
    await admin?.end();
    if (tmpRoot) fs.rmSync(tmpRoot, { recursive: true, force: true });
  }
}, 120_000);

describe('backup of source + PostgreSQL + synthetic media (via the real CLI)', () => {
  it('creates one consistent, private bundle outside Git without leaking the credential', async () => {
    const out = path.join(tmpRoot, 'bundle');
    const report = await cli(
      ['backup', '--out', out, '--source-commit', head, '--media-dir', srcMedia, '--database-url-env', 'BMSL_BACKUP_DATABASE_URL', '--confirm-writes-paused'],
      { BMSL_BACKUP_DATABASE_URL: urlOf(SRC_DB) },
    );
    expect(report).toMatchObject({ ok: true, bundle: out, source: head });
    bundle = out;
    manifest = verifyBundle(bundle);

    expect(fs.readdirSync(bundle).sort()).toEqual(Object.values(BUNDLE_FILES).sort());
    expect(fs.statSync(bundle).mode & 0o777).toBe(0o700);
    for (const f of fs.readdirSync(bundle)) expect(fs.statSync(path.join(bundle, f)).mode & 0o777, f).toBe(0o600);
    expect(path.relative(REPO_ROOT, bundle).startsWith('..')).toBe(true);

    expect(manifest.source.commit).toBe(head);
    expect(manifest.capture).toEqual({ writesPausedAttested: true, mediaTreeStable: true, databaseFingerprintStable: true });
    const committed = fs
      .readdirSync(path.join(REPO_ROOT, 'src', 'migrations'))
      .filter((f) => /^\d{8}_\d{6}_.+\.ts$/.test(f))
      .map((f) => f.replace(/\.ts$/, ''))
      .sort();
    expect(manifest.database.migrations.map((m) => m.name).sort()).toEqual(committed);
    // 3 uploads + 1 generated nested file (at least); and exactly what is on disk.
    expect(manifest.media.fileCount).toBe(directoryTree(srcMedia).fileCount);
    expect(manifest.media.fileCount).toBeGreaterThanOrEqual(4);
    expect(manifest.database.tables['contact_leads']?.rows).toBe(1);

    const sourcePaths = readArchiveIndex(path.join(bundle, BUNDLE_FILES.source)).entries.map((e) => e.path);
    expect(sourcePaths).toContain('package.json');
    expect(sourcePaths.filter((p) => /(^|\/)\.env/.test(p) && !p.endsWith('.env.example'))).toEqual([]);
    const text = fs.readFileSync(path.join(bundle, BUNDLE_FILES.manifest), 'utf8');
    for (const secret of [ADMIN_PASSWORD, PAYLOAD_SECRET, LEAD_EMAIL, '0900000099']) expect(text).not.toContain(secret);
  }, 300_000);

  it('refuses unsafe backup invocations and leaves no output behind', async () => {
    const base = { sourceCommit: head, mediaDir: srcMedia, databaseUrl: urlOf(SRC_DB), confirmWritesPaused: true, repoRoot: REPO_ROOT };
    const before = fs.readdirSync(tmpRoot).sort();
    await expect(createBackup({ ...base, outDir: path.join(tmpRoot, 'x1'), confirmWritesPaused: false })).rejects.toThrow(/confirm-writes-paused/);
    await expect(createBackup({ ...base, outDir: path.join(REPO_ROOT, 'inside-repo-backup') })).rejects.toThrow(/outside the repository/);
    await expect(createBackup({ ...base, outDir: path.join(tmpRoot, 'bundle') })).rejects.toThrow(/already exists/);
    await expect(createBackup({ ...base, outDir: path.join(tmpRoot, 'x2'), sourceCommit: 'HEAD' })).rejects.toThrow(/40-hex/);
    await expect(createBackup({ ...base, outDir: path.join(tmpRoot, 'x3'), mediaDir: 'relative/media' })).rejects.toThrow(/absolute/);
    await expect(createBackup({ ...base, outDir: path.join(tmpRoot, 'x4'), databaseUrl: `${urlOf(SRC_DB)}?host=elsewhere` })).rejects.toThrow(/query parameters/);
    await expect(createBackup({ ...base, outDir: path.join(tmpRoot, 'x5'), databaseUrl: urlOf(EMPTY_DB) })).rejects.toThrow(/no applied Payload migrations/);
    expect(fs.readdirSync(tmpRoot).sort()).toEqual(before);
    expect(fs.existsSync(path.join(REPO_ROOT, 'inside-repo-backup'))).toBe(false);
  }, 120_000);
});

describe('restore into a distinct isolated disposable database', () => {
  it('restores, compares schema/content/sequences/migrations/media hashes and keeps the lead and media relationships usable', async () => {
    const beforeNames = await restoreDatabases();
    const srcBefore = await withClient(SRC_DB, fingerprintDatabase);
    const mediaBefore = directoryTree(srcMedia).treeHash;
    const bundleBefore = fs.readdirSync(bundle).map((f) => sha(fs.readFileSync(path.join(bundle, f))));

    const args = restoreArgs();
    const restored = await restoreBundle(args);
    try {
      expect(restored.databaseName).not.toBe(SRC_DB);
      expect(restored.resources).toEqual({ database: args.databaseName, directory: args.targetDir });
      expect(await restoreDatabases()).toEqual([...beforeNames, args.databaseName].sort());

      // independent comparison (fresh connections, not the tool's own verification)
      const restoredFp = await withClient(args.databaseName, fingerprintDatabase);
      expect(restoredFp.schemaHash).toBe(srcBefore.schemaHash);
      expect(restoredFp.contentHash).toBe(srcBefore.contentHash);
      expect(restoredFp.sequencesHash).toBe(srcBefore.sequencesHash);
      expect(restoredFp.migrationsHash).toBe(srcBefore.migrationsHash);
      expect(restoredFp.tables).toEqual(srcBefore.tables);
      expect(directoryTree(restored.mediaDir).treeHash).toBe(mediaBefore);
      for (const entry of directoryTree(srcMedia).entries) {
        expect(sha(fs.readFileSync(path.join(restored.mediaDir, ...entry.path.split('/'))))).toBe(entry.sha256);
      }
      expect(fs.existsSync(path.join(restored.sourceDir, 'package.json'))).toBe(true);
      expect(fs.statSync(restored.targetDir).mode & 0o077).toBe(0);

      // usable by the real application stack: lead + relationships + sequence continuity, then pools must be closed
      const used = await fixture('use-restored', args.databaseName, restored.mediaDir);
      expect(used.leadId).toBe(seeded.leadId);
      expect(used.leadName).toBe('Synthetic Backup Lead');
      expect((used.projectMedia as string[]).slice().sort()).toEqual(seeded.mediaFiles.filter((f) => f.endsWith('.png')).sort());
      for (const filename of [...(used.projectMedia as string[]), used.documentFile as string]) {
        const original = fs.readFileSync(path.join(srcMedia, filename));
        expect(sha(fs.readFileSync(path.join(restored.mediaDir, filename))), `${filename} resolves to the original bytes`).toBe(sha(original));
      }
      expect(Number(used.newLeadId)).toBeGreaterThan(Number(used.leadId));
      expect(await sessions(args.databaseName)).toBe(0);
    } finally {
      await restored.cleanup();
    }

    // cleanup scope: exactly what this invocation created is gone, everything else is untouched
    expect(await restoreDatabases()).toEqual(beforeNames);
    expect(fs.existsSync(args.targetDir)).toBe(false);
    expect(await withClient(SRC_DB, fingerprintDatabase)).toEqual(srcBefore);
    expect(directoryTree(srcMedia).treeHash).toBe(mediaBefore);
    expect(fs.readdirSync(bundle).map((f) => sha(fs.readFileSync(path.join(bundle, f))))).toEqual(bundleBefore);
    expect(fs.existsSync(bundle)).toBe(true);

    console.log(
      `W5C_BACKUP_REPORT ${JSON.stringify({
        sourceCommit: manifest.source.commit,
        sourceFiles: manifest.source.fileCount,
        mediaFiles: manifest.media.fileCount,
        migrations: manifest.database.migrations.length,
        tables: manifest.database.tableCount,
        pgDump: manifest.database.pgDump,
        schemaHash: manifest.database.schemaHash,
        contentHash: manifest.database.contentHash,
        mediaTreeHash: manifest.media.treeHash,
        restoredDatabaseDistinct: true,
        syntheticLeadPersisted: true,
        postRestoreLeadCreated: true,
        sessionsAfterWorkers: 0,
        createdThenRemoved: { database: 1, directory: 1 },
      })}`,
    );
  }, 600_000);

  it('the restore CLI runs end to end and removes what it created with --cleanup', async () => {
    const before = await restoreDatabases();
    const name = newRestoreDatabaseName();
    const target = path.join(tmpRoot, `cli-restore-${hex12()}`);
    const report = await cli(
      ['restore', '--bundle', bundle, '--target-dir', target, '--database-name', name, '--admin-database-url-env', 'BMSL_RESTORE_ADMIN_DATABASE_URL', '--cleanup'],
      { BMSL_RESTORE_ADMIN_DATABASE_URL: ADMIN_URL.toString() },
    );
    expect(report).toMatchObject({ ok: true, created: { database: name, directory: target }, cleanedUp: true });
    expect(await restoreDatabases()).toEqual(before);
    expect(fs.existsSync(target)).toBe(false);
  }, 300_000);

  it('rejects a pre-existing database and never touches it', async () => {
    const decoy = newRestoreDatabaseName();
    await admin.query(`create database "${decoy}"`);
    try {
      await withClient(decoy, async (c) => {
        await c.query('create table keep_me (v text)');
        await c.query("insert into keep_me values ('precious')");
      });
      const args = restoreArgs({ databaseName: decoy });
      await expect(restoreBundle(args)).rejects.toThrow(/already exists/);
      expect(fs.existsSync(args.targetDir)).toBe(false);
      expect((await withClient(decoy, (c) => c.query('select v from keep_me'))).rows).toEqual([{ v: 'precious' }]);
    } finally {
      expect(await sessions(decoy)).toBe(0);
      await admin.query(`drop database if exists "${decoy}"`);
    }
  }, 120_000);

  it('rejects the source database, the administrative database and non-restore names before touching anything', async () => {
    const before = await restoreDatabases();
    for (const databaseName of [SRC_DB, 'bmsl', 'postgres', 'bmsl_restore_x']) {
      await expect(restoreBundle(restoreArgs({ databaseName }))).rejects.toThrow(/bmsl_restore_/);
    }
    await expect(restoreBundle(restoreArgs({ adminDatabaseUrl: 'postgresql://u:p@db.example.com:5432/postgres' }))).rejects.toThrow(/non-local/);
    expect(await restoreDatabases()).toEqual(before);
  }, 120_000);

  it('rejects a pre-existing target directory and leaves its contents, the bundle and every database alone', async () => {
    const before = await restoreDatabases();
    const target = path.join(tmpRoot, 'existing-target');
    fs.mkdirSync(target);
    fs.writeFileSync(path.join(target, 'keep.txt'), 'precious');
    await expect(restoreBundle(restoreArgs({ targetDir: target }))).rejects.toThrow(/already exists/);
    expect(fs.readFileSync(path.join(target, 'keep.txt'), 'utf8')).toBe('precious');
    expect(fs.readdirSync(target)).toEqual(['keep.txt']);
    expect(await restoreDatabases()).toEqual(before);
  }, 120_000);
});

describe('incomplete, corrupt or inconsistent bundles', () => {
  const rejects = async (dir: string, pattern: RegExp) => {
    const before = await restoreDatabases();
    const args = restoreArgs({ bundleDir: dir });
    await expect(restoreBundle(args)).rejects.toThrow(pattern);
    expect(await restoreDatabases(), 'no database may be created for a bad bundle').toEqual(before);
    expect(fs.existsSync(args.targetDir)).toBe(false);
  };
  const flipLastByte = (file: string) => {
    const b = fs.readFileSync(file);
    b[b.length - 1] = b[b.length - 1]! ^ 0xff;
    fs.writeFileSync(file, b);
  };

  it.each(Object.values(BUNDLE_FILES))('rejects a bundle missing %s', async (component) => {
    const copy = copyBundle(`missing-${component}`);
    fs.rmSync(path.join(copy, component));
    await rejects(copy, /incomplete/);
  }, 120_000);

  it.each([BUNDLE_FILES.database, BUNDLE_FILES.media, BUNDLE_FILES.source])('rejects a corrupted %s', async (component) => {
    const copy = copyBundle(`corrupt-${component}`);
    flipLastByte(path.join(copy, component));
    await rejects(copy, /corrupt|does not match/);
  }, 120_000);

  it('rejects a truncated database dump and an unexpected extra file', async () => {
    const truncated = copyBundle('truncated-dump');
    const f = path.join(truncated, BUNDLE_FILES.database);
    fs.writeFileSync(f, fs.readFileSync(f).subarray(0, 100));
    await rejects(truncated, /size does not match/);
    const extra = copyBundle('extra-file');
    fs.writeFileSync(path.join(extra, 'notes.txt'), 'x', { mode: 0o600 });
    await rejects(extra, /unexpected entries/);
  }, 120_000);

  it('rejects a bundle whose permissions are not private', async () => {
    const copy = copyBundle('open-permissions');
    fs.chmodSync(path.join(copy, BUNDLE_FILES.database), 0o644);
    await rejects(copy, /group\/other/);
  }, 120_000);

  it('cleans up exactly what it created when the manifest disagrees with the restored data', async () => {
    const copy = copyBundle('lying-manifest');
    const file = path.join(copy, BUNDLE_FILES.manifest);
    const lie = JSON.parse(fs.readFileSync(file, 'utf8')) as Manifest;
    lie.database.contentHash = '0'.repeat(64); // components still intact, so only the post-restore comparison can catch it
    fs.writeFileSync(file, JSON.stringify(lie));
    const before = await restoreDatabases();
    const args = restoreArgs({ bundleDir: copy });
    await expect(restoreBundle(args)).rejects.toThrow(/fingerprint mismatch: contentHash/);
    expect(await restoreDatabases()).toEqual(before); // the database it created is gone
    expect(fs.existsSync(args.targetDir)).toBe(false); // and so is the directory it created
    expect(fs.existsSync(copy)).toBe(true);
  }, 300_000);
});

describe('worker failure and bounded cleanup', () => {
  const sibling = () => {
    const f = path.join(tmpRoot, `sibling-${hex12()}.txt`);
    fs.writeFileSync(f, 'keep');
    return f;
  };

  it('removes the database and directory it created when pg_restore exceeds its time bound', async () => {
    const keep = sibling();
    const before = await restoreDatabases();
    const args = restoreArgs({ timeoutMs: 1 });
    await expect(restoreBundle(args)).rejects.toThrow(/timed out/);
    expect(await restoreDatabases()).toEqual(before);
    expect(fs.existsSync(args.targetDir)).toBe(false);
    expect(fs.readFileSync(keep, 'utf8')).toBe('keep');
  }, 300_000);

  it('removes only its own resources when a media write fails part-way, preserving original inputs', async () => {
    const keep = sibling();
    const before = await restoreDatabases();
    const mediaBefore = directoryTree(srcMedia).treeHash;
    const args = restoreArgs();
    let writes = 0;
    await expect(
      restoreBundle({
        ...args,
        hooks: {
          extract: {
            beforeWrite: (entry) => {
              // Only entries of the media archive (the source archive has none of these names).
              if (entry.path.startsWith('synthetic-backup-')) {
                writes += 1;
                if (writes === 2) throw new Error('simulated partial media write failure');
              }
            },
          },
        },
      }),
    ).rejects.toThrow(/simulated partial media write failure/);
    expect(writes).toBe(2);
    expect(await restoreDatabases()).toEqual(before);
    expect(fs.existsSync(args.targetDir)).toBe(false);
    expect(fs.readFileSync(keep, 'utf8')).toBe('keep');
    expect(directoryTree(srcMedia).treeHash).toBe(mediaBefore);
    expect(fs.existsSync(bundle)).toBe(true);
    expect(fs.existsSync(path.dirname(args.targetDir))).toBe(true);
  }, 300_000);

  it('cleans up when something fails right after the database was created', async () => {
    const before = await restoreDatabases();
    const args = restoreArgs();
    await expect(
      restoreBundle({
        ...args,
        hooks: {
          afterDatabaseCreated: () => {
            throw new Error('simulated worker failure after CREATE DATABASE');
          },
        },
      }),
    ).rejects.toThrow(/simulated worker failure/);
    expect(await restoreDatabases()).toEqual(before);
    expect(fs.existsSync(args.targetDir)).toBe(false);
  }, 300_000);
});
