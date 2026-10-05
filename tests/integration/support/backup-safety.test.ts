import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { isSecretEnvPath, readCommitFiles, runTool, verifyBundle, restoreBundle } from '../../../scripts/backup/bundle.mjs';
import { secretsFromArgs } from '../../../scripts/backup/cli.mjs';
import {
  assertPrivate,
  assertPrivateOutputSupported,
  childEnv,
  connectionStringFor,
  createPrivateDirectory,
  insideGitWorkTree,
  parseDatabaseUrl,
  redact,
  RESTORE_DB_NAME,
  ToolError,
  toPublicError,
  validatePrivateDestination,
} from '../../../scripts/backup/safety.mjs';

// Pure rules (no database): connection handling, private output, Git-sourced source files, bounded child tools and the
// restore preconditions that must fail before any resource exists.

let tmp: string;
beforeEach(() => {
  tmp = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'bmsl-backup-safety-')));
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

  it('reports a failing tool as tool name + exit code only: stderr with a password and lead PII never reaches the error', async () => {
    const script =
      'console.error("FATAL: password s3cret rejected for user bmsl"); ' +
      'console.error("ERROR: duplicate key value violates unique constraint \\"contact_leads_email\\" DETAIL: Key (email)=(pii-lead@example.invalid) already exists. CONTEXT: COPY contact_leads, line 1: 0900000099 Nguyen Van A"); ' +
      'process.exit(3)';
    const error = (await runTool(process.execPath, ['-e', script], { env: { ...env, PGPASSWORD: 's3cret' } }).catch((e: Error) => e)) as Error;
    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe('ToolError');
    expect(error.message).toContain('exit 3');
    for (const leak of ['s3cret', 'pii-lead@example.invalid', '0900000099', 'Nguyen', 'contact_leads', 'duplicate key', 'rejected for user']) {
      expect(error.message, leak).not.toContain(leak);
      expect(toPublicError(error, ['s3cret']), leak).not.toContain(leak);
    }
  });

  it('reports a signal and does not capture stderr for a tool that succeeds', async () => {
    const killed = (await runTool(process.execPath, ['-e', 'console.error("pii-lead@example.invalid"); process.kill(process.pid, "SIGTERM")'], { env }).catch((e: Error) => e)) as Error;
    expect(killed.message).toContain('SIGTERM');
    expect(killed.message).not.toContain('pii-lead');
    const ok = await runTool(process.execPath, ['-e', 'console.error("noise"); console.log("pg_dump (PostgreSQL) 16.0")'], { env });
    expect(ok.stdout).toContain('16.0');
  });

  it('fails clearly when the tool is missing instead of skipping', async () => {
    await expect(runTool('bmsl-no-such-tool-xyz', [], { env })).rejects.toThrow(/could not start/);
  });
});

describe('public failure text (what the CLI prints)', () => {
  const pgError = (message: string, code: string) => Object.assign(new Error(message), { severity: 'ERROR', code, detail: 'Key (email)=(pii-lead@example.invalid) already exists.' });

  it('reduces PostgreSQL client errors to SQLSTATE: no row values, role names or connection details', () => {
    for (const error of [
      pgError('duplicate key value violates unique constraint "contact_leads_email_idx"', '23505'),
      pgError('invalid input syntax for type integer: "0900000099 Nguyen Van A"', '22P02'),
      pgError('password authentication failed for user "bmsl"', '28P01'),
    ]) {
      const text = toPublicError(error, ['s3cret']);
      expect(text).toMatch(/SQLSTATE [0-9A-Z]{5}/);
      for (const leak of ['pii-lead', '0900000099', 'Nguyen', 'bmsl', 'duplicate key', 'contact_leads']) expect(text, leak).not.toContain(leak);
    }
  });

  it('reduces system errors to their code, which drops hosts, ports and file names', () => {
    const connect = Object.assign(new Error('connect ECONNREFUSED 10.1.2.3:5432'), { code: 'ECONNREFUSED' });
    const fsError = Object.assign(new Error("EACCES: permission denied, open '/private/leads-export.csv'"), { code: 'EACCES' });
    expect(toPublicError(connect)).toBe('system error (ECONNREFUSED); details are withheld');
    expect(toPublicError(fsError)).not.toContain('leads-export');
  });

  it('keeps this tool\'s own fixed messages, redacts known secrets from them, and never prints unknown values', () => {
    expect(toPublicError(new ToolError('pg_restore failed (exit 1)'))).toBe('pg_restore failed (exit 1)');
    expect(toPublicError(new Error('--bundle is required'))).toBe('--bundle is required');
    expect(toPublicError(new Error('oops s3cret'), ['s3cret'])).toBe('oops [redacted]');
    expect(toPublicError({ message: 'pii-lead@example.invalid' })).toBe('unexpected failure');
    expect(toPublicError(new RangeError('pii-lead@example.invalid'))).toBe('unexpected failure (RangeError)');
  });

  it('collects the passwords named by the CLI flags so they can be scrubbed', () => {
    const env = { A: 'postgresql://u:pw-one@localhost/db', B: 'postgresql://u:pw%2Ftwo@localhost/postgres', C: 'not a url' };
    expect(secretsFromArgs(['backup', '--database-url-env', 'A'], env)).toEqual(['pw-one']);
    expect(secretsFromArgs(['restore', '--admin-database-url-env', 'B', '--database-url-env', 'C'], env)).toEqual(['pw/two']);
    expect(secretsFromArgs(['verify', '--bundle', 'x'], env)).toEqual([]);
  });
});

describe('insideGitWorkTree fails closed when Git cannot answer', () => {
  const repoRoot = path.resolve(import.meta.dirname, '../../..');
  let savedPath: string | undefined;
  beforeEach(() => {
    savedPath = process.env.PATH;
  });
  afterEach(() => {
    process.env.PATH = savedPath;
  });

  /** A directory holding only a fake `git` shell script, put alone on PATH. */
  const withFakeGit = (script: string) => {
    const bin = path.join(tmp, 'fake-bin');
    fs.mkdirSync(bin, { recursive: true });
    fs.writeFileSync(path.join(bin, 'git'), `#!/bin/sh\n${script}\n`, { mode: 0o755 });
    process.env.PATH = bin;
  };

  it('answers true inside a work tree and false only for a genuine "not a git repository"', () => {
    const plain = path.join(tmp, 'plain');
    fs.mkdirSync(plain);
    expect(insideGitWorkTree(plain)).toBe(false);
    expect(insideGitWorkTree(path.join(plain, 'not-yet', 'there'))).toBe(false);
    const repo = path.join(tmp, 'repo');
    fs.mkdirSync(repo);
    git(repo, 'init', '-q');
    expect(insideGitWorkTree(repo)).toBe(true);
    expect(insideGitWorkTree(path.join(repo, 'sub', 'dir'))).toBe(true);
    expect(insideGitWorkTree(path.join(repo, '.git'))).toBe(true); // Git-controlled territory counts as inside
  });

  it('throws when the git executable is missing', () => {
    process.env.PATH = path.join(tmp, 'empty-bin');
    expect(() => insideGitWorkTree(tmp)).toThrow(/cannot verify the destination is outside Git/);
  });

  it.each([
    ['exits 1', 'exit 1'],
    ['exits 128 with another fatal message (dubious ownership)', 'echo "fatal: detected dubious ownership in repository" >&2; exit 128'],
    ['exits 128 silently', 'exit 128'],
    ['is killed by a signal', 'kill -TERM $$'],
    ['succeeds with unexpected output', 'echo maybe'],
    ['succeeds with no output', 'exit 0'],
  ])('throws when git %s', (_name, script) => {
    withFakeGit(script);
    expect(() => insideGitWorkTree(tmp)).toThrow(/cannot verify the destination is outside Git/);
  });

  it('accepts a fake git that reports "not a git repository" the way Git does', () => {
    withFakeGit('echo "fatal: not a git repository (or any of the parent directories): .git" >&2; exit 128');
    expect(insideGitWorkTree(tmp)).toBe(false);
  });

  it('makes validatePrivateDestination refuse (not accept) a private parent when git is unusable, and creates nothing', () => {
    const dest = path.join(tmp, 'restore');
    withFakeGit('exit 1');
    expect(() => validatePrivateDestination(dest, { repoRoot, label: '--target-dir' })).toThrow(/cannot verify/);
    expect(() => createPrivateDirectory(dest, { repoRoot })).toThrow(/cannot verify/);
    expect(fs.existsSync(dest)).toBe(false);
  });

  it('does not put the child\'s stderr or the directory into the error text', () => {
    withFakeGit('echo "fatal: secret-detail pii-lead@example.invalid" >&2; exit 2');
    const error = (() => {
      try {
        insideGitWorkTree(tmp);
      } catch (e) {
        return e as Error;
      }
      return undefined;
    })();
    expect(error?.message).toMatch(/exited with status 2/);
    expect(error?.message).not.toContain('pii-lead');
    expect(error?.message).not.toContain('secret-detail');
    expect(error?.message).not.toContain(tmp);
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

  describe('validatePrivateDestination (the check restore runs before it creates anything)', () => {
    it('accepts a fresh canonical path outside Git and creates nothing', () => {
      const dest = path.join(tmp, 'fresh');
      expect(validatePrivateDestination(dest, { repoRoot, label: '--target-dir' })).toBe(dest);
      expect(fs.existsSync(dest)).toBe(false);
    });

    it('refuses another Git work tree (not only this repository) and creates nothing in it', () => {
      const other = path.join(tmp, 'other-repo');
      fs.mkdirSync(other);
      git(other, 'init', '-q');
      const before = fs.readdirSync(other).sort();
      expect(() => validatePrivateDestination(path.join(other, 'restore'), { repoRoot })).toThrow(/Git work tree/);
      expect(() => validatePrivateDestination(path.join(other, 'a', 'b'), { repoRoot })).toThrow(/parent/);
      expect(fs.readdirSync(other).sort()).toEqual(before);
    });

    it('refuses the repository itself and anything inside it', () => {
      expect(() => validatePrivateDestination(path.join(repoRoot, 'restored'), { repoRoot })).toThrow(/outside the repository/);
      expect(() => validatePrivateDestination(path.join(repoRoot, 'media'), { repoRoot })).toThrow(/outside the repository/);
      expect(fs.existsSync(path.join(repoRoot, 'restored'))).toBe(false);
    });

    it('refuses a symbolic link anywhere in the ancestors, even one that points outside Git', () => {
      const real = path.join(tmp, 'real-parent');
      fs.mkdirSync(real);
      const link = path.join(tmp, 'link-parent');
      fs.symlinkSync(real, link);
      expect(() => validatePrivateDestination(path.join(link, 'restore'), { repoRoot })).toThrow(/symbolic link/);
      expect(fs.readdirSync(real)).toEqual([]);
    });

    it('refuses a symbolic link whose target is inside a Git work tree or this repository', () => {
      const other = path.join(tmp, 'other-repo');
      fs.mkdirSync(other);
      git(other, 'init', '-q');
      const toOther = path.join(tmp, 'to-other');
      fs.symlinkSync(other, toOther);
      const toRepo = path.join(tmp, 'to-repo');
      fs.symlinkSync(repoRoot, toRepo);
      for (const link of [toOther, toRepo]) expect(() => validatePrivateDestination(path.join(link, 'restore'), { repoRoot }), link).toThrow(/symbolic link/);
      expect(fs.readdirSync(other)).toEqual(['.git']);
      expect(fs.existsSync(path.join(repoRoot, 'restore'))).toBe(false);
    });

    it('refuses a destination that already exists, including a dangling symbolic link', () => {
      const existing = path.join(tmp, 'existing');
      fs.mkdirSync(existing);
      fs.writeFileSync(path.join(existing, 'keep.txt'), 'precious');
      const dangling = path.join(tmp, 'dangling');
      fs.symlinkSync(path.join(tmp, 'nowhere'), dangling);
      expect(() => validatePrivateDestination(existing, { repoRoot })).toThrow(/already exists/);
      expect(() => validatePrivateDestination(dangling, { repoRoot })).toThrow(/already exists/);
      expect(fs.readFileSync(path.join(existing, 'keep.txt'), 'utf8')).toBe('precious');
      expect(fs.existsSync(path.join(tmp, 'nowhere'))).toBe(false);
    });

    it('refuses a parent that other users can rename entries in', () => {
      const open = path.join(tmp, 'open-parent');
      fs.mkdirSync(open);
      fs.chmodSync(open, 0o777);
      expect(() => validatePrivateDestination(path.join(open, 'restore'), { repoRoot })).toThrow(/writable by group\/other/);
      fs.chmodSync(open, 0o1777); // sticky (like /tmp): entries cannot be renamed by others
      expect(() => validatePrivateDestination(path.join(open, 'restore'), { repoRoot })).not.toThrow();
    });
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
