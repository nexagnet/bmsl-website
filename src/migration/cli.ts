import path from 'node:path';

export type CliArgs = { write: boolean; input?: string };

/** Dry-run unless `--write` is passed explicitly. */
export function parseArgs(argv: readonly string[]): CliArgs {
  const args: CliArgs = { write: false };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--write') args.write = true;
    else if (arg === '--input') {
      const value = argv[(i += 1)];
      if (!value || value.startsWith('--')) throw new Error('--input requires a file path');
      args.input = value;
    } else throw new Error(`Unknown argument: ${arg}`);
  }
  return args;
}

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '::1', '[::1]']);
const DEFAULT_PORT = '5432';
const SAFE_QUERY_PARAMS = new Set(['sslmode', 'ssl', 'sslrootcert', 'sslcert', 'sslkey', 'application_name', 'connect_timeout', 'uselibpqcompat']);

export type DatabaseTarget = { host: string; port: string; database: string };

/** Canonical acknowledgement: `<host>/<database>`, or `<host>:<port>/<database>` for a non-default port. */
export function formatTargetAck(target: DatabaseTarget): string {
  return `${target.host}${target.port === DEFAULT_PORT ? '' : `:${target.port}`}/${target.database}`;
}

/**
 * Effective connection identity (host, port, database) of a postgres/postgresql URL. Credentials and query values are
 * never kept. Anything that makes the identity ambiguous (other protocol, multi-host, empty host/database, encoded
 * host, query parameters that could override the authority, malformed encoding) throws a generic error that never
 * echoes the URL.
 */
export function parseDatabaseTarget(databaseUrl: string): DatabaseTarget {
  const fail = (): never => {
    throw new Error('Database URL has no unambiguous postgres host/port/database; refusing');
  };
  let url: URL;
  try {
    url = new URL(databaseUrl);
  } catch {
    return fail();
  }
  if (url.protocol !== 'postgres:' && url.protocol !== 'postgresql:') return fail();
  const host = url.hostname.toLowerCase();
  if (!host || /[,%\s]/.test(host)) return fail();
  // Multi-host lists (`a:1,b:2`) must not slip through the URL parser.
  const authority = databaseUrl.slice(databaseUrl.indexOf('//') + 2).split(/[/?#]/)[0] ?? '';
  if (authority.includes(',')) return fail();
  if (url.port !== '' && !/^\d{1,5}$/.test(url.port)) return fail();
  const port = url.port === '' ? DEFAULT_PORT : String(Number(url.port));
  if (Number(port) < 1 || Number(port) > 65535) return fail();
  let database = '';
  try {
    database = decodeURIComponent(url.pathname.replace(/^\/+/, ''));
  } catch {
    return fail();
  }
  if (!database || database.includes('/')) return fail();
  for (const key of url.searchParams.keys()) {
    if (!SAFE_QUERY_PARAMS.has(key.toLowerCase())) return fail();
  }
  if (url.hash) return fail();
  return { host, port, database };
}

const DECLARED_NON_PRODUCTION = new Set(['dev', 'staging']);

/**
 * Operator attestation (not proof) that the target is DEV/STAGING:
 *   BMSL_IMPORT_TARGET_ENV=dev|staging   and   BMSL_IMPORT_TARGET_ACK=<host>[:<port, if not 5432>]/<database> (exact match).
 * Anything else (absent, production, unknown, mismatched) is denied.
 */
function assertDeclaredNonProductionTarget(env: Record<string, string | undefined>, target: DatabaseTarget): void {
  const declared = (env.BMSL_IMPORT_TARGET_ENV ?? '').trim();
  if (!DECLARED_NON_PRODUCTION.has(declared)) {
    throw new Error('Refusing: BMSL_IMPORT_TARGET_ENV must be exactly "dev" or "staging" for this target');
  }
  const expected = formatTargetAck(target);
  if ((env.BMSL_IMPORT_TARGET_ACK ?? '').trim() !== expected) {
    throw new Error(`Refusing: BMSL_IMPORT_TARGET_ACK must equal "<host>[:<port if not 5432>]/<database>" of the configured target (${expected})`);
  }
}

/**
 * Throws unless the run is safe. Call BEFORE getPayload: dry-run and write both start migration-capable Payload.
 * - input files inside this repo are always refused;
 * - a local target outside NODE_ENV=production (disposable local development) needs no declaration;
 * - every other invocation (non-local target, or NODE_ENV=production even on a local DB), write or dry-run, needs
 *   BMSL_IMPORT_ALLOW_STAGING=true + BMSL_IMPORT_TARGET_ENV=dev|staging + exact BMSL_IMPORT_TARGET_ACK.
 * The target URL must be unambiguous in every mode.
 */
export function assertImportAllowed(options: {
  write: boolean;
  env: Record<string, string | undefined>;
  databaseUrl: string;
  repoRoot: string;
  inputPath?: string;
}): void {
  const { env, databaseUrl, repoRoot, inputPath } = options;
  if (inputPath) {
    const rel = path.relative(repoRoot, path.resolve(inputPath));
    if (rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel))) {
      throw new Error('Refusing input stored inside this public repository; keep raw legacy data outside the repo');
    }
  }
  const target = parseDatabaseTarget(databaseUrl);
  const production = env.NODE_ENV === 'production';
  if (LOCAL_HOSTS.has(target.host) && !production) return;
  if (env.BMSL_IMPORT_ALLOW_STAGING !== 'true') {
    throw new Error(
      production
        ? 'Refusing to start import in production mode without BMSL_IMPORT_ALLOW_STAGING=true plus a dev/staging target declaration'
        : `Refusing to start import against a non-local database (${target.host}); set BMSL_IMPORT_ALLOW_STAGING=true plus a dev/staging target declaration`,
    );
  }
  assertDeclaredNonProductionTarget(env, target);
}

/** Runs the guard again immediately before `init` (e.g. getPayload); `init` is never called when the guard throws. */
export async function initAfterGuard<T>(options: Parameters<typeof assertImportAllowed>[0], init: () => Promise<T>): Promise<T> {
  assertImportAllowed(options);
  return init();
}

/** Honest label for dry-run: Payload still starts (schema push / migrations are possible); this is NOT read-only. */
export function describeMode(write: boolean): string {
  return write
    ? 'MODE: WRITE (migration-capable Payload startup; non-clobber import)'
    : 'MODE: DRY-RUN (migration-capable Payload startup, no records written; NOT read-only inventory)';
}
