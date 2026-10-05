import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { isSecretEnvPath, readCommitFiles, runTool, verifyBundle, restoreBundle } from '../../../scripts/backup/bundle.mjs';
import {
  assertPrivate,
  assertPrivateOutputSupported,
  childEnv,
  connectionStringFor,
  createPrivateDirectory,
  parseDatabaseUrl,
  redact,
  RESTORE_DB_NAME,
} from '../../../scripts/backup/safety.mjs';

// Pure rules (no database): connection handling, private output, Git-sourced source files, bounded child tools and the
// restore preconditions that must fail before any resource exists.

let tmp: string;
beforeEach(() => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'bmsl-backup-safety-'));
});
afterEach(() => {
  fs.rmSync(tmp, { recursive: true, force: true });
});

const gitEnv = { ...process.env, GIT_AUTHOR_NAME: 't', GIT_AUTHOR_EMAIL: 't@example.invalid', GIT_COMMITTER_NAME: 't', GIT_COMMITTER_EMAIL: 't@example.invalid' };
const git = (cwd: string, ...args: string[]) => execFileSync('git', args, { cwd, env: gitEnv, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();

describe('database URL handling', () => {
  it('parses the parts and keeps the password out of the connection summary', () => {
    const c = parseDatabaseUrl('postgresql://u%40x:p%2Fw@localhost:5433/db1?sslmode=disable');
    expect(c).toEqual({ host: 'localhost', port: '5433', user: 'u@x', password: 'p/w', database: 'db1', sslmode: 'disable' });
    expect(connectionStringFor(c, 'other')).toContain('/other');
  });

  it.each([
    ['empty', ''],
    ['not a url', 'nope'],
    ['wrong scheme', 'mysql://u:p@localhost/db'],
    ['no database', 'postgresql://u:p@localhost:5432/'],
    ['host override', 'postgresql://u:p@localhost/db?host=prod.example'],
    ['options injection', 'postgresql://u:p@localhost/db?options=-c%20search_path%3Dx'],
    ['dbname override', 'postgresql://u:p@localhost/db?dbname=prod'],
    ['bad sslmode', 'postgresql://u:p@localhost/db?sslmode=banana'],
  ])('refuses %s', (_name, raw) => {
    expect(() => parseDatabaseUrl(raw)).toThrow();
  });

  it('restore administrative URLs must be local', () => {
    expect(() => parseDatabaseUrl('postgresql://u:p@db.internal.example:5432/postgres', { requireLocal: true })).toThrow(/non-local/);
    expect(() => parseDatabaseUrl('postgresql://u:p@localhost:5432/postgres', { requireLocal: true })).not.toThrow();
    expect(() => parseDatabaseUrl('postgresql://u:p@127.0.0.1:5432/postgres', { requireLocal: true })).not.toThrow();
  });

  it('restore database names are bmsl_restore_<hex> only', () => {
    expect(RESTORE_DB_NAME.test('bmsl_restore_0123456789abcdef')).toBe(true);
    for (const bad of ['bmsl', 'postgres', 'bmsl_restore_', 'bmsl_restore_XYZ', 'bmsl_it_0123456789abcdef', 'bmsl_restore_0123456789abcdef; drop database x', '"bmsl_restore_0123456789abcdef"']) {
      expect(RESTORE_DB_NAME.test(bad), bad).toBe(false);
    }
  });
});

describe('child process environment', () => {
  it('carries the credential in PG* variables only and inherits nothing else', () => {
    const conn = parseDatabaseUrl('postgresql://bmsl:s3cret@localhost:5432/src');
    const env = childEnv(conn, 'target', { PATH: '/usr/bin', PAYLOAD_SECRET: 'live-secret', DATABASE_URL: 'postgresql://prod', PGSERVICE: 'prod', PGOPTIONS: '-c x' });
    expect(env).toMatchObject({ PGHOST: 'localhost', PGPORT: '5432', PGUSER: 'bmsl', PGPASSWORD: 's3cret', PGDATABASE: 'target', PATH: '/usr/bin' });
    expect(Object.keys(env)).not.toEqual(expect.arrayContaining(['PAYLOAD_SECRET', 'DATABASE_URL', 'PGSERVICE', 'PGOPTIONS']));
  });

  it('redacts secrets from diagnostics', () => {
    expect(redact('connection to s3cret failed: s3cret', ['s3cret'])).toBe('connection to [redacted] failed: [redacted]');
  });
});

describe('runTool', () => {
  const env = { PATH: process.env.PATH ?? '' };
  it('kills a tool that exceeds its timeout', async () => {
    const started = Date.now();
    await expect(runTool(process.execPath, ['-e', 'setTimeout(() => {}, 60000)'], { env, timeoutMs: 400 })).rejects.toThrow(/timed out/);
    expect(Date.now() - started).toBeLessThan(15_000);
  });

  it('reports a failing tool with its stderr redacted and never the environment', async () => {
    const error = await runTool(process.execPath, ['-e', 'console.error("password s3cret rejected"); process.exit(3)'], { env: { ...env, PGPASSWORD: 's3cret' }, secrets: ['s3cret'] }).catch((e: Error) => e);
    expect((error as Error).message).toContain('exit 3');
    expect((error as Error).message).toContain('[redacted]');
    expect((error as Error).message).not.toContain('s3cret');
  });

  it('fails clearly when the tool is missing instead of skipping', async () => {
    await expect(runTool('bmsl-no-such-tool-xyz', [], { env })).rejects.toThrow(/could not start/);
  });
});

describe('private output', () => {
  const repoRoot = path.resolve(import.meta.dirname, '../../..');

  it('creates a 0700 directory outside Git and refuses everything else', () => {
    const dir = path.join(tmp, 'bundle');
    expect(createPrivateDirectory(dir, { repoRoot })).toBe(dir);
    expect(fs.statSync(dir).mode & 0o777).toBe(0o700);
    expect(() => createPrivateDirectory(dir, { repoRoot })).toThrow(/already exists/);
    expect(() => createPrivateDirectory('relative/dir', { repoRoot })).toThrow(/absolute/);
    expect(() => createPrivateDirectory(path.join(tmp, 'no-parent', 'x'), { repoRoot })).toThrow(/parent/);
    expect(() => createPrivateDirectory(path.join(repoRoot, 'private-backup'), { repoRoot })).toThrow(/outside the repository/);
    expect(fs.existsSync(path.join(repoRoot, 'private-backup'))).toBe(false);
  });

  it('refuses a directory inside any Git work tree', () => {
    git(tmp, 'init', '-q');
    expect(() => createPrivateDirectory(path.join(tmp, 'inside'), { repoRoot })).toThrow(/Git work tree/);
    expect(fs.existsSync(path.join(tmp, 'inside'))).toBe(false);
  });

  it('assertPrivate rejects group/other access and symlinks', () => {
    const f = path.join(tmp, 'dump');
    fs.writeFileSync(f, 'x', { mode: 0o644 });
    fs.chmodSync(f, 0o644);
    expect(() => assertPrivate(f)).toThrow(/group\/other/);
    fs.chmodSync(f, 0o600);
    expect(() => assertPrivate(f)).not.toThrow();
    const link = path.join(tmp, 'link');
    fs.symlinkSync(f, link);
    expect(() => assertPrivate(link)).toThrow(/symbolic link/);
  });

  it('fails closed on Windows instead of pretending chmod protects the output', () => {
    expect(() => assertPrivateOutputSupported('win32')).toThrow(/unsupported on Windows/);
    expect(() => assertPrivateOutputSupported('linux')).not.toThrow();
  });
});

describe('source files come from one Git commit', () => {
  const makeRepo = () => {
    const repo = path.join(tmp, 'repo');
    fs.mkdirSync(repo);
    git(repo, 'init', '-q');
    fs.writeFileSync(path.join(repo, 'a.txt'), 'committed');
    fs.mkdirSync(path.join(repo, 'src'));
    fs.writeFileSync(path.join(repo, 'src', 'run.sh'), '#!/bin/sh\n', { mode: 0o755 });
    fs.writeFileSync(path.join(repo, '.env.example'), 'DATABASE_URL=placeholder');
    fs.writeFileSync(path.join(repo, '.env.production'), 'SECRET=oops-committed');
    git(repo, 'add', '-A');
    git(repo, 'commit', '-q', '-m', 'one');
    return repo;
  };

  it('archives committed content only: not untracked files, not later edits, not .env* secrets', () => {
    const repo = makeRepo();
    const commit = git(repo, 'rev-parse', 'HEAD');
    fs.writeFileSync(path.join(repo, 'a.txt'), 'EDITED AFTER COMMIT');
    fs.writeFileSync(path.join(repo, 'private-export.csv'), 'untracked PII');
    const { files, excluded, treeSha } = readCommitFiles(repo, commit);
    expect(files.map((f) => f.path)).toEqual(['.env.example', 'a.txt', 'src/run.sh']);
    expect(files.find((f) => f.path === 'a.txt')?.data.toString()).toBe('committed');
    expect(files.find((f) => f.path === 'src/run.sh')?.exec).toBe(true);
    expect(excluded).toEqual(['.env.production']);
    expect(treeSha).toMatch(/^[0-9a-f]{40}$/);
  });

  it('requires a full commit SHA that exists', () => {
    const repo = makeRepo();
    expect(() => readCommitFiles(repo, 'HEAD')).toThrow(/40-hex/);
    expect(() => readCommitFiles(repo, git(repo, 'rev-parse', '--short', 'HEAD'))).toThrow(/40-hex/);
    expect(() => readCommitFiles(repo, '0'.repeat(40))).toThrow();
  });

  it('refuses a commit that contains a symbolic link', () => {
    const repo = makeRepo();
    fs.symlinkSync('/etc/passwd', path.join(repo, 'evil-link'));
    git(repo, 'add', '-A');
    git(repo, 'commit', '-q', '-m', 'two');
    expect(() => readCommitFiles(repo, git(repo, 'rev-parse', 'HEAD'))).toThrow(/symbolic link/);
  });

  it('classifies secret environment files', () => {
    for (const p of ['.env', '.env.local', '.env.production', 'apps/web/.env.staging']) expect(isSecretEnvPath(p), p).toBe(true);
    for (const p of ['.env.example', 'docs/env.md', 'src/environment.ts']) expect(isSecretEnvPath(p), p).toBe(false);
  });
});

describe('restore preconditions fail before any resource is created', () => {
  it('rejects an unsafe database name, a non-local administrative host and a missing bundle', async () => {
    const base = { bundleDir: path.join(tmp, 'nope'), targetDir: path.join(tmp, 'target'), databaseName: 'bmsl_restore_0123456789abcdef', adminDatabaseUrl: 'postgresql://u:p@localhost:5432/postgres' };
    await expect(restoreBundle({ ...base, databaseName: 'production' })).rejects.toThrow(/bmsl_restore_/);
    await expect(restoreBundle({ ...base, databaseName: 'postgres' })).rejects.toThrow(/bmsl_restore_/);
    await expect(restoreBundle({ ...base, adminDatabaseUrl: 'postgresql://u:p@prod.example.com:5432/postgres' })).rejects.toThrow(/non-local/);
    await expect(restoreBundle({ ...base })).rejects.toThrow();
    expect(fs.existsSync(base.targetDir)).toBe(false);
  });

  it('rejects an empty, partial or foreign bundle directory without touching it', () => {
    const bundle = path.join(tmp, 'bundle');
    fs.mkdirSync(bundle, { mode: 0o700 });
    expect(() => verifyBundle(bundle)).toThrow(/incomplete/);
    fs.writeFileSync(path.join(bundle, 'manifest.json'), '{}', { mode: 0o600 });
    expect(() => verifyBundle(bundle)).toThrow(/incomplete, missing/);
    fs.writeFileSync(path.join(bundle, 'surprise.txt'), 'x', { mode: 0o600 });
    for (const n of ['source.bmslarc', 'media.bmslarc', 'database.dump']) fs.writeFileSync(path.join(bundle, n), 'x', { mode: 0o600 });
    expect(() => verifyBundle(bundle)).toThrow(/unexpected entries/);
    expect(fs.readFileSync(path.join(bundle, 'manifest.json'), 'utf8')).toBe('{}');
  });

  it('rejects a bundle readable by group/other', () => {
    const bundle = path.join(tmp, 'open-bundle');
    fs.mkdirSync(bundle);
    fs.chmodSync(bundle, 0o755);
    expect(() => verifyBundle(bundle)).toThrow(/group\/other/);
  });
});
