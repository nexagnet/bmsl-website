// Pure-ish safety rules for the backup/restore tooling: connection parsing, private output, child environments.
// Nothing here prints or returns a credential except `childEnv`, which hands one to a child through its environment
// (never through its argument list, never into a log).
/* global process, URL */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

export const LOCAL_HOSTS = ['localhost', '127.0.0.1', '::1', '[::1]'];
/** Restore targets are created by this tool and nothing else: bmsl_restore_ + 12..16 hex digits. */
export const RESTORE_DB_NAME = /^bmsl_restore_[0-9a-f]{12,16}$/;

// Query parameters that could redirect a connection or inject server options; anything not listed is refused too.
const ALLOWED_PARAMS = ['sslmode'];
const SSL_MODES = ['disable', 'allow', 'prefer', 'require', 'verify-ca', 'verify-full'];

/** A failed child tool (pg_dump / pg_restore). Its message is fixed text plus tool name and exit/signal/timeout only. */
export class ToolError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ToolError';
  }
}

export function assertPrivateOutputSupported(platform = process.platform) {
  if (platform === 'win32') {
    throw new Error(
      'backup/restore output is unsupported on Windows: POSIX modes (0700/0600) are what keep dumps private and no ACL ' +
        'handling is implemented, so the tool fails closed. Run it on Linux/macOS (see docs/runbooks/backup-restore.md).',
    );
  }
}

/** Parses a PostgreSQL URL into connection parts. Refuses anything that could select a different target or options. */
export function parseDatabaseUrl(raw, { requireLocal = false } = {}) {
  if (!raw?.trim()) throw new Error('database URL is empty');
  let url;
  try {
    url = new URL(raw);
  } catch {
    throw new Error('database URL is not a valid URL');
  }
  if (url.protocol !== 'postgres:' && url.protocol !== 'postgresql:') throw new Error('database URL must be postgres:// or postgresql://');
  if (requireLocal && !LOCAL_HOSTS.includes(url.hostname)) {
    throw new Error(`refusing a non-local PostgreSQL host (${url.hostname}); restore targets are local and disposable only`);
  }
  const extra = [...url.searchParams.keys()].filter((k) => !ALLOWED_PARAMS.includes(k));
  if (extra.length > 0) throw new Error(`database URL must not carry query parameters other than sslmode (found ${extra.join(', ')})`);
  const sslmode = url.searchParams.get('sslmode') ?? undefined;
  if (sslmode && !SSL_MODES.includes(sslmode)) throw new Error('database URL has an invalid sslmode');
  const database = decodeURIComponent(url.pathname.replace(/^\//, ''));
  if (!database) throw new Error('database URL must name a database');
  return {
    host: url.hostname.replace(/^\[|\]$/g, ''),
    port: url.port || '5432',
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    database,
    sslmode,
  };
}

/** Rebuilds a connection string for a different database name on the same server (for pg.Client). */
export function connectionStringFor(conn, database) {
  const url = new URL('postgresql://localhost');
  url.hostname = conn.host.includes(':') ? `[${conn.host}]` : conn.host;
  url.port = conn.port;
  url.username = conn.user;
  url.password = conn.password;
  url.pathname = `/${encodeURIComponent(database)}`;
  if (conn.sslmode) url.searchParams.set('sslmode', conn.sslmode);
  return url.toString();
}

/**
 * Minimal environment for pg_dump/pg_restore: credentials via PG* variables only. The parent environment is NOT
 * inherited, so unrelated secrets (PAYLOAD_SECRET, DATABASE_URL, tokens) never reach a child, and PGSERVICE/PGOPTIONS/
 * PGPASSFILE style redirections cannot leak in.
 */
export function childEnv(conn, database, parent = process.env) {
  const env = {
    PATH: parent.PATH ?? '',
    LANG: 'C',
    PGHOST: conn.host,
    PGPORT: String(conn.port),
    PGUSER: conn.user,
    PGDATABASE: database,
    PGCONNECT_TIMEOUT: '15',
  };
  if (conn.password) env.PGPASSWORD = conn.password;
  if (conn.sslmode) env.PGSSLMODE = conn.sslmode;
  if (parent.TMPDIR) env.TMPDIR = parent.TMPDIR;
  return env;
}

export function redact(text, secrets) {
  let out = String(text);
  for (const s of secrets) if (s) out = out.split(s).join('[redacted]');
  return out;
}

/**
 * The only text a failure may show on the CLI or in logs. PostgreSQL client errors and Node system errors can carry
 * row values (constraint details, invalid-input values), role names, hosts and paths, so they are reduced to a fixed
 * description plus their SQLSTATE / system code. Errors raised by this tool itself (validation failures, ToolError
 * with tool name and exit/signal/timeout) already have fixed, value-free messages and pass through. Anything else is
 * reported as unexpected. Known secrets are redacted from whatever is returned.
 */
export function toPublicError(error, secrets = []) {
  let text;
  if (!(error instanceof Error)) text = 'unexpected failure';
  else if (typeof error.severity === 'string') text = `database error (SQLSTATE ${typeof error.code === 'string' ? error.code : 'unknown'}); details are withheld because they can contain row values`;
  else if (typeof error.code === 'string') text = `system error (${error.code}); details are withheld`;
  else if (error.name === 'Error' || error.name === 'ToolError' || error.name === 'ArchiveError') text = error.message;
  else text = `unexpected failure (${error.name})`;
  return redact(text, secrets);
}

const isInside = (parent, child) => {
  const rel = path.relative(parent, child);
  return rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel));
};

const GIT_TIMEOUT_MS = 15_000;

/**
 * True when `dir` (or its nearest existing ancestor) is inside a Git work tree, false ONLY when Git itself reports
 * "not a git repository". Anything else (git missing, not executable, timed out, killed by a signal, refusing the
 * directory, any other exit status or unexpected output) means the check could not be completed, and it throws:
 * the destination is private data and an unverifiable "outside Git" is not accepted. A result of `false` from
 * rev-parse (inside a .git directory or a bare repository) is Git-controlled territory and counts as inside.
 * Git's stderr is read only to classify the result; it is never returned or printed.
 */
export function insideGitWorkTree(dir) {
  let probe = path.resolve(dir);
  while (!fs.existsSync(probe)) probe = path.dirname(probe);
  const result = spawnSync('git', ['-C', probe, 'rev-parse', '--is-inside-work-tree'], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    timeout: GIT_TIMEOUT_MS,
    env: { PATH: process.env.PATH ?? '', HOME: process.env.HOME ?? '', LC_ALL: 'C', LANG: 'C' },
  });
  const unverifiable = (why) => new Error(`cannot verify the destination is outside Git (git ${why}); refusing, git is required for this check`);
  if (result.error) throw unverifiable(typeof result.error.code === 'string' ? `could not run: ${result.error.code}` : 'could not run');
  if (result.signal) throw unverifiable(`was terminated by signal ${result.signal}`);
  if (result.status === 0) {
    const out = result.stdout.trim();
    if (out === 'true' || out === 'false') return true;
    throw unverifiable('returned unexpected output');
  }
  if (result.status === 128 && /^fatal: not a git repository/m.test(result.stderr)) return false;
  throw unverifiable(`exited with status ${result.status}`);
}

/**
 * Validates a private destination WITHOUT creating anything: absolute, canonical (no symbolic link in any ancestor, so
 * what is checked is where the data really goes), outside the repository and outside every Git work tree, existing
 * parent that others cannot rename entries in, and the destination itself not existing. Returns the resolved path.
 * Backup output and restore targets both go through this, before any other resource is created.
 */
export function validatePrivateDestination(dir, { repoRoot, label = 'output' } = {}) {
  assertPrivateOutputSupported();
  if (!dir || !path.isAbsolute(dir)) throw new Error(`${label} directory must be an absolute path`);
  const resolved = path.resolve(dir);
  const parent = path.dirname(resolved);
  if (!fs.existsSync(parent) || !fs.statSync(parent).isDirectory()) throw new Error(`parent of the ${label} directory must already exist`);
  if (fs.realpathSync(parent) !== parent) throw new Error(`${label} directory must not be reached through a symbolic link (canonical parent differs)`);
  if (repoRoot && (isInside(path.resolve(repoRoot), resolved) || isInside(fs.realpathSync(repoRoot), resolved))) {
    throw new Error(`${label} directory must be outside the repository`);
  }
  if (insideGitWorkTree(resolved)) throw new Error(`${label} directory must be outside any Git work tree (private data never goes into Git)`);
  const parentMode = fs.statSync(parent).mode;
  if ((parentMode & 0o022) !== 0 && (parentMode & 0o1000) === 0) {
    throw new Error(`parent of the ${label} directory is writable by group/other without the sticky bit`);
  }
  try {
    fs.lstatSync(resolved);
    throw new Error(`${label} directory already exists; refusing to reuse it`);
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
  return resolved;
}

/** Private output destination: validated by `validatePrivateDestination`, then created 0700 and verified. */
export function createPrivateDirectory(dir, { repoRoot, label = 'output' } = {}) {
  const resolved = validatePrivateDestination(dir, { repoRoot, label });
  fs.mkdirSync(resolved, { mode: 0o700 });
  fs.chmodSync(resolved, 0o700);
  assertPrivate(resolved);
  return resolved;
}

/** Throws unless the path is owned by this user with no group/other permission bits. */
export function assertPrivate(p) {
  assertPrivateOutputSupported();
  const st = fs.lstatSync(p);
  if (st.isSymbolicLink()) throw new Error('private output must not be a symbolic link');
  if ((st.mode & 0o077) !== 0) throw new Error(`${st.isDirectory() ? 'directory' : 'file'} is accessible by group/other (mode ${(st.mode & 0o777).toString(8)})`);
  if (typeof process.getuid === 'function' && st.uid !== process.getuid()) throw new Error('private output is not owned by the current user');
}
