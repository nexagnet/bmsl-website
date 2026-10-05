// Pure-ish safety rules for the backup/restore tooling: connection parsing, private output, child environments.
// Nothing here prints or returns a credential except `childEnv`, which hands one to a child through its environment
// (never through its argument list, never into a log).
/* global process, URL */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

export const LOCAL_HOSTS = ['localhost', '127.0.0.1', '::1', '[::1]'];
/** Restore targets are created by this tool and nothing else: bmsl_restore_ + 12..16 hex digits. */
export const RESTORE_DB_NAME = /^bmsl_restore_[0-9a-f]{12,16}$/;

// Query parameters that could redirect a connection or inject server options; anything not listed is refused too.
const ALLOWED_PARAMS = ['sslmode'];
const SSL_MODES = ['disable', 'allow', 'prefer', 'require', 'verify-ca', 'verify-full'];

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

const isInside = (parent, child) => {
  const rel = path.relative(parent, child);
  return rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel));
};

/** True when `dir` (or its nearest existing ancestor) is inside a Git work tree. */
export function insideGitWorkTree(dir) {
  let probe = path.resolve(dir);
  while (!fs.existsSync(probe)) probe = path.dirname(probe);
  try {
    return execFileSync('git', ['-C', probe, 'rev-parse', '--is-inside-work-tree'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim() === 'true';
  } catch {
    return false; // not a work tree (or git missing)
  }
}

/**
 * Private output destination: absolute, outside the repository and outside any Git work tree, with an existing parent,
 * and not existing itself. Created 0700 and verified. Returns the resolved path.
 */
export function createPrivateDirectory(dir, { repoRoot, label = 'output' } = {}) {
  assertPrivateOutputSupported();
  if (!dir || !path.isAbsolute(dir)) throw new Error(`${label} directory must be an absolute path`);
  const resolved = path.resolve(dir);
  const parent = path.dirname(resolved);
  if (repoRoot && isInside(path.resolve(repoRoot), resolved)) throw new Error(`${label} directory must be outside the repository`);
  if (!fs.existsSync(parent) || !fs.statSync(parent).isDirectory()) throw new Error(`parent of the ${label} directory must already exist`);
  if (insideGitWorkTree(resolved)) throw new Error(`${label} directory must be outside any Git work tree (private data never goes into Git)`);
  try {
    fs.lstatSync(resolved);
    throw new Error(`${label} directory already exists; refusing to reuse it`);
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
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
