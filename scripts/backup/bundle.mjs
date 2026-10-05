// Backup bundle creation, verification and disposable restore.
//
// A bundle is a private directory with exactly four fixed-name files (names are NOT taken from the manifest):
//   manifest.json    source commit, migration state, component digests, DB fingerprints (no row data, no secrets)
//   source.bmslarc   regular files of ONE Git commit, read from Git objects (never the working tree)
//   media.bmslarc    the media directory (BMSL_MEDIA_DIR / media/)
//   database.dump    pg_dump custom format, no owners/ACLs/tablespaces
//
// Trust model: restore accepts only bundles made by a trusted operator with this tool. Digests prove integrity, not
// provenance, and a PostgreSQL dump is SQL that the server executes: never restore a bundle you did not create.
/* global process, Buffer, setTimeout, clearTimeout */
import { spawn, execFileSync } from 'node:child_process';
import { createHash, randomBytes } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import {
  ArchiveError,
  directoryTree,
  extractArchive,
  listRegularFiles,
  validateEntryPath,
  validateIndex,
  verifyArchive,
  writeArchive,
  treeHash,
} from './archive.mjs';
import {
  assertPrivate,
  assertPrivateOutputSupported,
  childEnv,
  connectionStringFor,
  createPrivateDirectory,
  parseDatabaseUrl,
  RESTORE_DB_NAME,
  ToolError,
  validatePrivateDestination,
} from './safety.mjs';

export const BUNDLE_FILES = { manifest: 'manifest.json', source: 'source.bmslarc', media: 'media.bmslarc', database: 'database.dump' };
export const FORMAT_VERSION = 1;
const DEFAULT_TIMEOUT_MS = 10 * 60 * 1000;
const TOOL_REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const sha256Of = (file) => {
  const hash = createHash('sha256');
  const fd = fs.openSync(file, 'r');
  try {
    const buf = Buffer.allocUnsafe(1024 * 1024);
    let n;
    while ((n = fs.readSync(fd, buf, 0, buf.length, null)) > 0) hash.update(buf.subarray(0, n));
  } finally {
    fs.closeSync(fd);
  }
  return hash.digest('hex');
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const quoteIdent = (name) => `"${String(name).replace(/"/g, '""')}"`;
const hashJson = (value) => createHash('sha256').update(JSON.stringify(value)).digest('hex');

// ---------------------------------------------------------------------------------------------------------------
// Child tools (pg_dump / pg_restore): no shell, credentials only in the environment, bounded run time, whole process
// group stopped on timeout. The tool's own output (stderr) is NEVER captured or reported: PostgreSQL tools echo row
// values (constraint violations), role names and connection details there, and the dump contains lead PII. A failure
// is reported as the tool name plus exit code / signal / timeout only.
// ---------------------------------------------------------------------------------------------------------------

/** @returns {Promise<{ stdout: string }>} */
export function runTool(command, args, { env, timeoutMs = DEFAULT_TIMEOUT_MS }) {
  return new Promise((resolve, reject) => {
    let child;
    try {
      child = spawn(command, args, { env, stdio: ['ignore', 'pipe', 'ignore'], detached: true, shell: false });
    } catch (error) {
      reject(new ToolError(`${command} could not start (${error.code ?? 'error'})`));
      return;
    }
    let stdout = '';
    let settled = false;
    let timedOut = false;
    child.stdout.on('data', (d) => (stdout = (stdout + d).slice(-64_000)));
    const killGroup = () => {
      try {
        process.kill(-child.pid, 'SIGKILL');
      } catch {
        /* already gone */
      }
    };
    const timer = setTimeout(() => {
      timedOut = true;
      killGroup();
    }, timeoutMs);
    const finish = (fn) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      killGroup(); // a finished leader must not leave descendants holding a database session
      fn();
    };
    child.once('error', (error) => finish(() => reject(new ToolError(`${command} could not start (${error.code ?? 'error'})`))));
    child.once('close', (code, signal) =>
      finish(() => {
        if (timedOut) reject(new ToolError(`${command} timed out after ${timeoutMs} ms and was killed`));
        else if (code !== 0) reject(new ToolError(`${command} failed (${signal ? `signal ${signal}` : `exit ${code}`}); its output is withheld because it can contain row values or credentials`));
        else resolve({ stdout });
      }),
    );
  });
}

export async function toolMajor(command, env) {
  const { stdout } = await runTool(command, ['--version'], { env, timeoutMs: 15_000 });
  const m = /(\d+)(?:\.\d+)?/.exec(stdout.replace(/^[^\d]*/, ''));
  if (!m) throw new Error(`could not read the version of ${command}`);
  return { major: Number(m[1]), text: stdout.trim() };
}

// ---------------------------------------------------------------------------------------------------------------
// Database fingerprints: schema, content, sequences, committed migration state. Hashes and counts only.
// ---------------------------------------------------------------------------------------------------------------

export async function fingerprintDatabase(client) {
  const one = async (sql) => (await client.query(sql)).rows;
  const tables = (await one("select tablename from pg_tables where schemaname = 'public' order by tablename")).map((r) => r.tablename);
  const columns = await one(
    `select table_name, column_name, data_type, udt_name, is_nullable, column_default, ordinal_position::text as pos
       from information_schema.columns where table_schema = 'public' order by table_name, ordinal_position`,
  );
  const indexes = await one("select tablename, indexname, indexdef from pg_indexes where schemaname = 'public' order by tablename, indexname");
  const constraints = await one(
    `select conrelid::regclass::text as rel, conname, pg_get_constraintdef(oid) as def
       from pg_constraint where connamespace = 'public'::regnamespace order by conrelid::regclass::text, conname`,
  );
  const enums = await one(
    `select t.typname, e.enumlabel from pg_enum e join pg_type t on t.oid = e.enumtypid
      where t.typnamespace = 'public'::regnamespace order by t.typname, e.enumsortorder`,
  );
  const schemaHash = hashJson({ tables, columns, indexes, constraints, enums });

  const content = {};
  for (const table of tables) {
    const [row] = await one(
      `select count(*)::text as rows, md5(coalesce(string_agg(t::text, E'\\n' order by t::text), '')) as md5 from public.${quoteIdent(table)} t`,
    );
    content[table] = { rows: Number(row.rows), md5: row.md5 };
  }
  const sequences = await one("select sequencename, last_value::text as last_value from pg_sequences where schemaname = 'public' order by sequencename");

  let migrations = [];
  if (tables.includes('payload_migrations')) {
    migrations = (await one('select name, batch::text as batch from public.payload_migrations order by name')).map((r) => ({ name: r.name, batch: r.batch }));
  }
  return { schemaHash, contentHash: hashJson(content), sequencesHash: hashJson(sequences), migrationsHash: hashJson(migrations), tables: content, migrations, tableCount: tables.length };
}

const FINGERPRINT_KEYS = ['schemaHash', 'contentHash', 'sequencesHash', 'migrationsHash'];

export function compareFingerprints(expected, actual) {
  const mismatches = FINGERPRINT_KEYS.filter((k) => expected[k] !== actual[k]);
  if (mismatches.length > 0) {
    const tableDiffs = Object.keys({ ...expected.tables, ...actual.tables }).filter(
      (t) => expected.tables?.[t]?.rows !== actual.tables?.[t]?.rows || expected.tables?.[t]?.md5 !== actual.tables?.[t]?.md5,
    );
    throw new Error(`database fingerprint mismatch: ${mismatches.join(', ')}${tableDiffs.length ? ` (tables: ${tableDiffs.join(', ')})` : ''}`);
  }
}

// ---------------------------------------------------------------------------------------------------------------
// Source from a Git commit
// ---------------------------------------------------------------------------------------------------------------

const git = (repoRoot, args, options = {}) =>
  execFileSync('git', ['-C', repoRoot, ...args], { stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 512 * 1024 * 1024, ...options });

/** `.env`, `.env.local`, `.env.production`... are never archived, even if someone committed one. `.env.example` is fine. */
export const isSecretEnvPath = (p) => /^\.env(\..*)?$/.test(path.posix.basename(p)) && path.posix.basename(p) !== '.env.example';

export function readCommitFiles(repoRoot, commit) {
  if (!/^[0-9a-f]{40}$/.test(commit ?? '')) throw new Error('--source-commit must be a full 40-hex commit SHA');
  const resolved = git(repoRoot, ['rev-parse', '--verify', `${commit}^{commit}`], { encoding: 'utf8' }).trim();
  if (resolved !== commit) throw new Error('source commit does not resolve to itself');
  const treeSha = git(repoRoot, ['rev-parse', `${commit}^{tree}`], { encoding: 'utf8' }).trim();
  const listing = git(repoRoot, ['ls-tree', '-r', '-z', '--full-tree', commit]).toString('latin1');
  const items = [];
  const excluded = [];
  for (const record of listing.split('\0').filter(Boolean)) {
    const tab = record.indexOf('\t');
    const [mode, type, oid] = record.slice(0, tab).split(' ');
    const rawPath = Buffer.from(record.slice(tab + 1), 'latin1').toString('utf8');
    if (type !== 'blob' || mode === '120000') throw new Error(`source commit contains a ${mode === '120000' ? 'symbolic link' : type}: ${JSON.stringify(rawPath)} (refused)`);
    validateEntryPath(rawPath);
    if (isSecretEnvPath(rawPath)) {
      excluded.push(rawPath);
      continue;
    }
    items.push({ path: rawPath, oid, exec: mode === '100755' });
  }
  items.sort((a, b) => (a.path < b.path ? -1 : 1));
  const files = items.map((i) => ({ ...i, data: git(repoRoot, ['cat-file', 'blob', i.oid]) }));
  return { treeSha, files, excluded };
}

function writeSourceArchive(archivePath, files) {
  const entries = files.map((f) => ({ type: 'file', path: f.path, size: f.data.length, sha256: createHash('sha256').update(f.data).digest('hex'), exec: f.exec || undefined }));
  validateIndex({ version: 1, entries });
  const json = Buffer.from(JSON.stringify({ version: 1, entries }), 'utf8');
  const header = Buffer.alloc(12);
  header.write('BMSLARC1', 0, 'latin1');
  header.writeUInt32BE(json.length, 8);
  const fd = fs.openSync(archivePath, 'wx', 0o600);
  try {
    fs.writeSync(fd, header);
    fs.writeSync(fd, json);
    for (const f of files) fs.writeSync(fd, f.data);
  } finally {
    fs.closeSync(fd);
  }
  return { entries, treeHash: treeHash(entries), fileCount: entries.length, bytes: fs.statSync(archivePath).size };
}

// ---------------------------------------------------------------------------------------------------------------
// Backup
// ---------------------------------------------------------------------------------------------------------------

/**
 * Creates a bundle. The caller ATTESTS (`confirmWritesPaused`) that the application is stopped or in maintenance, so
 * neither the database nor the media directory is written during capture; the tool cannot verify that. It then runs
 * two checks around the capture: the media tree is hashed while archiving and again after the dump, and the database
 * fingerprint is taken before and after pg_dump. A difference at those points fails the backup and removes the
 * incomplete bundle. Equal results do NOT independently prove that no concurrent write happened (for example a write
 * that was reverted, or one outside the fingerprinted data); the guarantee rests on the operator's attestation.
 */
export async function createBackup({ outDir, sourceCommit, mediaDir, databaseUrl, confirmWritesPaused, repoRoot, timeoutMs = DEFAULT_TIMEOUT_MS, now = () => new Date() }) {
  assertPrivateOutputSupported();
  if (confirmWritesPaused !== true) throw new Error('--confirm-writes-paused is required: pause application writes before capturing a consistent set');
  if (!mediaDir || !path.isAbsolute(mediaDir)) throw new Error('--media-dir must be an absolute path');
  if (!fs.existsSync(mediaDir) || !fs.statSync(mediaDir).isDirectory()) throw new Error('--media-dir does not exist or is not a directory');
  const conn = parseDatabaseUrl(databaseUrl);
  const resolvedMedia = fs.realpathSync(mediaDir);
  const source = readCommitFiles(repoRoot, sourceCommit); // validates the commit before any output exists
  const out = createPrivateDirectory(outDir, { repoRoot, label: 'backup output' });
  if (out === resolvedMedia || out.startsWith(resolvedMedia + path.sep) || resolvedMedia.startsWith(out + path.sep)) {
    fs.rmSync(out, { recursive: true, force: true });
    throw new Error('backup output and media directory must not overlap');
  }
  const file = (name) => path.join(out, name);
  try {
    const sourceInfo = writeSourceArchive(file(BUNDLE_FILES.source), source.files);

    const mediaInfo = writeArchive(file(BUNDLE_FILES.media), listRegularFiles(resolvedMedia));

    const client = new pg.Client({ connectionString: connectionStringFor(conn, conn.database), connectionTimeoutMillis: 15_000 });
    let before;
    let after;
    let serverMajor;
    try {
      await client.connect();
      serverMajor = Math.floor(Number((await client.query('show server_version_num')).rows[0].server_version_num) / 10_000);
      before = await fingerprintDatabase(client);
      if (before.migrations.length === 0) throw new Error('database has no applied Payload migrations; refusing to back up an unmigrated database');
      const env = childEnv(conn, conn.database);
      const dump = await toolMajor('pg_dump', env);
      if (dump.major < serverMajor) throw new Error(`pg_dump ${dump.major} is older than the server ${serverMajor}; install matching client tools`);
      fs.writeFileSync(file(BUNDLE_FILES.database), '', { mode: 0o600, flag: 'wx' });
      await runTool(
        'pg_dump',
        ['--format=custom', '--no-owner', '--no-privileges', '--no-tablespaces', '--no-comments', `--file=${file(BUNDLE_FILES.database)}`],
        { env, timeoutMs },
      );
      fs.chmodSync(file(BUNDLE_FILES.database), 0o600);
      after = await fingerprintDatabase(client);
      sourceInfo.pgDump = dump.text;
    } finally {
      await client.end().catch(() => undefined);
    }
    compareFingerprints(before, after); // throws if the database fingerprint differs between the two readings
    const mediaAfter = directoryTree(resolvedMedia);
    if (mediaAfter.treeHash !== mediaInfo.treeHash) throw new Error('media changed during capture; pause writes and retry');

    const manifest = {
      formatVersion: FORMAT_VERSION,
      createdAt: now().toISOString(),
      source: { commit: sourceCommit, tree: source.treeSha, sha256: sha256Of(file(BUNDLE_FILES.source)), bytes: sourceInfo.bytes, fileCount: sourceInfo.fileCount, treeHash: sourceInfo.treeHash, excludedSecretPaths: source.excluded.length },
      media: { sha256: sha256Of(file(BUNDLE_FILES.media)), bytes: mediaInfo.bytes, fileCount: mediaInfo.fileCount, treeHash: mediaInfo.treeHash },
      database: {
        sha256: sha256Of(file(BUNDLE_FILES.database)),
        bytes: fs.statSync(file(BUNDLE_FILES.database)).size,
        format: 'custom',
        pgDump: sourceInfo.pgDump,
        serverMajor,
        schemaHash: before.schemaHash,
        contentHash: before.contentHash,
        sequencesHash: before.sequencesHash,
        migrationsHash: before.migrationsHash,
        tableCount: before.tableCount,
        tables: before.tables,
        migrations: before.migrations,
      },
      // writesPausedAttested: the operator's attestation. mediaTreeStable / databaseFingerprintStable: the before/after
      // checks above found no difference (not a proof that nothing wrote in between).
      capture: { writesPausedAttested: true, mediaTreeStable: true, databaseFingerprintStable: true },
    };
    fs.writeFileSync(file(BUNDLE_FILES.manifest), `${JSON.stringify(manifest, null, 2)}\n`, { mode: 0o600, flag: 'wx' });
    verifyBundle(out);
    return { bundleDir: out, manifest };
  } catch (error) {
    fs.rmSync(out, { recursive: true, force: true }); // the incomplete bundle (possibly with PII) was created by this call
    throw error;
  }
}

// ---------------------------------------------------------------------------------------------------------------
// Verify
// ---------------------------------------------------------------------------------------------------------------

function readManifest(bundleDir) {
  const raw = fs.readFileSync(path.join(bundleDir, BUNDLE_FILES.manifest), 'utf8');
  let m;
  try {
    m = JSON.parse(raw);
  } catch {
    throw new Error('manifest.json is not valid JSON');
  }
  const bad = (what) => new Error(`manifest is invalid: ${what}`);
  if (m?.formatVersion !== FORMAT_VERSION) throw bad('unsupported formatVersion');
  if (!/^[0-9a-f]{40}$/.test(m.source?.commit ?? '')) throw bad('source.commit');
  for (const part of ['source', 'media', 'database']) {
    if (!/^[0-9a-f]{64}$/.test(m[part]?.sha256 ?? '') || !Number.isSafeInteger(m[part]?.bytes)) throw bad(`${part} digest`);
  }
  for (const k of FINGERPRINT_KEYS) if (typeof m.database[k] !== 'string') throw bad(`database.${k}`);
  if (!Array.isArray(m.database.migrations) || m.database.migrations.length === 0) throw bad('database.migrations');
  if (!Number.isInteger(m.database.serverMajor)) throw bad('database.serverMajor');
  return m;
}

/** Validates the whole bundle (names, permissions, digests, archives) without creating anything. Returns the manifest. */
export function verifyBundle(bundleDir) {
  assertPrivateOutputSupported();
  const dir = path.resolve(bundleDir);
  const st = fs.lstatSync(dir);
  if (st.isSymbolicLink() || !st.isDirectory()) throw new Error('bundle must be a real directory');
  assertPrivate(dir);
  const names = fs.readdirSync(dir).sort();
  const expected = Object.values(BUNDLE_FILES).sort();
  const missing = expected.filter((n) => !names.includes(n));
  if (missing.length > 0) throw new Error(`bundle is incomplete, missing: ${missing.join(', ')}`);
  const extra = names.filter((n) => !expected.includes(n));
  if (extra.length > 0) throw new Error(`bundle contains unexpected entries: ${extra.join(', ')}`);
  for (const n of expected) {
    const f = path.join(dir, n);
    const s = fs.lstatSync(f);
    if (!s.isFile() || s.isSymbolicLink()) throw new Error(`bundle component ${n} is not a regular file`);
    assertPrivate(f);
  }
  const manifest = readManifest(dir);
  for (const [part, name] of [['source', BUNDLE_FILES.source], ['media', BUNDLE_FILES.media], ['database', BUNDLE_FILES.database]]) {
    const f = path.join(dir, name);
    if (fs.statSync(f).size !== manifest[part].bytes) throw new Error(`${part} component size does not match the manifest`);
    if (sha256Of(f) !== manifest[part].sha256) throw new Error(`${part} component is corrupt or does not match the manifest (sha256)`);
  }
  for (const [part, name] of [['source', BUNDLE_FILES.source], ['media', BUNDLE_FILES.media]]) {
    let result;
    try {
      result = verifyArchive(path.join(dir, name));
    } catch (error) {
      throw error instanceof ArchiveError ? new Error(`${part} archive rejected: ${error.message}`) : error;
    }
    if (result.treeHash !== manifest[part].treeHash || result.fileCount !== manifest[part].fileCount) throw new Error(`${part} archive content does not match the manifest`);
  }
  return manifest;
}

// ---------------------------------------------------------------------------------------------------------------
// Restore (fresh, isolated, disposable)
// ---------------------------------------------------------------------------------------------------------------

async function sessionsOf(admin, dbName) {
  return (await admin.query('select pid from pg_stat_activity where datname = $1 and pid <> pg_backend_pid()', [dbName])).rows;
}

/** Drops a database this invocation created, only after PostgreSQL reports no session. No FORCE, nobody is terminated. */
async function dropOwnedDatabase(admin, dbName, timeoutMs = 60_000) {
  if (!RESTORE_DB_NAME.test(dbName)) throw new Error(`refusing to drop ${dbName}`);
  const deadline = Date.now() + timeoutMs;
  let rows = await sessionsOf(admin, dbName);
  while (rows.length > 0 && Date.now() < deadline) {
    await sleep(200);
    rows = await sessionsOf(admin, dbName);
  }
  if (rows.length > 0) throw new Error(`${rows.length} session(s) still connected to ${dbName}; database NOT dropped (left in place, never forced)`);
  await admin.query(`drop database if exists ${quoteIdent(dbName)}`);
}

export const newRestoreDatabaseName = () => `bmsl_restore_${randomBytes(8).toString('hex')}`;

/**
 * Restores a verified bundle into a brand new local database and a brand new directory. Everything is validated
 * before the first resource is created, including that the target directory is a fresh, canonical, private location
 * outside this repository and outside every Git work tree (`repoRoot` defaults to the repository this tool lives in).
 * The returned `resources` lists exactly what THIS call created; `cleanup()` (and the automatic cleanup on failure)
 * removes only those. The bundle, the media/source of the original system and any pre-existing database or directory
 * are never modified.
 */
export async function restoreBundle({ bundleDir, targetDir, databaseName, adminDatabaseUrl, repoRoot = TOOL_REPO_ROOT, timeoutMs = DEFAULT_TIMEOUT_MS, hooks = {} }) {
  assertPrivateOutputSupported();
  if (!RESTORE_DB_NAME.test(databaseName ?? '')) throw new Error('--database-name must match bmsl_restore_<12-16 hex digits>');
  const adminConn = parseDatabaseUrl(adminDatabaseUrl, { requireLocal: true });
  if (adminConn.database === databaseName) throw new Error('restore target must differ from the administrative database');

  // 1. Everything that can be checked without creating a resource.
  const manifest = verifyBundle(bundleDir);
  const bundle = fs.realpathSync(path.resolve(bundleDir)); // verifyBundle proved it is a real directory
  const target = validatePrivateDestination(targetDir, { repoRoot, label: '--target-dir' });
  if (target === bundle || target.startsWith(bundle + path.sep) || bundle.startsWith(target + path.sep)) throw new Error('--target-dir must not overlap the bundle');
  const toolEnv = childEnv(adminConn, databaseName);
  const restoreTool = await toolMajor('pg_restore', toolEnv);
  if (restoreTool.major < manifest.database.serverMajor) throw new Error(`pg_restore ${restoreTool.major} is older than the dump's server ${manifest.database.serverMajor}`);
  await runTool('pg_restore', ['--list', path.join(bundle, BUNDLE_FILES.database)], { env: toolEnv, timeoutMs: 60_000 }); // dump TOC must parse

  const admin = new pg.Client({ connectionString: connectionStringFor(adminConn, adminConn.database), connectionTimeoutMillis: 15_000 });
  await admin.connect();
  const resources = { database: undefined, directory: undefined };
  const cleanup = async () => {
    const errors = [];
    if (resources.directory) {
      try {
        fs.rmSync(resources.directory, { recursive: true, force: true });
        resources.directory = undefined;
      } catch (error) {
        errors.push(error);
      }
    }
    if (resources.database) {
      try {
        await dropOwnedDatabase(admin, resources.database);
        resources.database = undefined;
      } catch (error) {
        errors.push(error);
      }
    }
    if (errors.length > 0) throw new Error(`cleanup incomplete: ${errors.map((e) => e.message).join('; ')}`);
  };
  const closeAdmin = () => admin.end().catch(() => undefined);

  try {
    const serverMajor = Math.floor(Number((await admin.query('show server_version_num')).rows[0].server_version_num) / 10_000);
    if (restoreTool.major < serverMajor) throw new Error(`pg_restore ${restoreTool.major} is older than the target server ${serverMajor}`);
    // 2. Fresh distinct database: any existing one (even an empty bmsl_restore_*) is refused, never reused or dropped.
    const existing = await admin.query('select 1 from pg_database where datname = $1', [databaseName]);
    if (existing.rowCount > 0) throw new Error(`database ${databaseName} already exists; refusing to restore into or touch it`);
    await admin.query(`create database ${quoteIdent(databaseName)} template template0`);
    resources.database = databaseName; // ownership only after PostgreSQL confirmed this CREATE
    hooks.afterDatabaseCreated?.();

    // 3. Data: exact target, no archive-driven create/drop/connect options, no owners/ACLs/tablespaces.
    await runTool(
      'pg_restore',
      [
        '--no-owner', '--no-privileges', '--no-tablespaces', '--no-comments', '--no-security-labels', '--no-publications', '--no-subscriptions',
        '--exit-on-error', '--single-transaction', `--dbname=${databaseName}`, path.join(bundle, BUNDLE_FILES.database),
      ],
      { env: toolEnv, timeoutMs },
    );

    // 4. Files: a fresh directory created by this call, then fresh subdirectories via the safe extractor.
    fs.mkdirSync(target, { mode: 0o700 });
    resources.directory = target;
    fs.chmodSync(target, 0o700);
    assertPrivate(target);
    hooks.afterDirectoryCreated?.();
    const source = extractArchive(path.join(bundle, BUNDLE_FILES.source), path.join(target, 'source'), hooks.extract);
    const media = extractArchive(path.join(bundle, BUNDLE_FILES.media), path.join(target, 'media'), hooks.extract);

    // 5. Verification against the manifest.
    const restored = new pg.Client({ connectionString: connectionStringFor(adminConn, databaseName), connectionTimeoutMillis: 15_000 });
    let fingerprint;
    try {
      await restored.connect();
      fingerprint = await fingerprintDatabase(restored);
    } finally {
      await restored.end().catch(() => undefined);
    }
    compareFingerprints(manifest.database, fingerprint);
    if (source.treeHash !== manifest.source.treeHash) throw new Error('restored source does not match the manifest');
    if (directoryTree(path.join(target, 'media')).treeHash !== manifest.media.treeHash) throw new Error('restored media does not match the manifest');
    if (media.fileCount !== manifest.media.fileCount) throw new Error('restored media file count does not match the manifest');

    return {
      databaseName,
      databaseUrl: connectionStringFor(adminConn, databaseName), // returned to the in-process caller only; the CLI never prints it
      sourceDir: path.join(target, 'source'),
      mediaDir: path.join(target, 'media'),
      targetDir: target,
      resources: { database: databaseName, directory: target },
      verification: { schema: true, content: true, sequences: true, migrations: manifest.database.migrations.length, mediaFiles: media.fileCount, sourceFiles: source.fileCount },
      manifest,
      cleanup: async () => {
        try {
          await cleanup();
        } finally {
          await closeAdmin();
        }
      },
    };
  } catch (error) {
    try {
      await cleanup();
    } catch (cleanupError) {
      error.message = `${error.message}; ${cleanupError.message}`;
    } finally {
      await closeAdmin();
    }
    throw error;
  }
}
