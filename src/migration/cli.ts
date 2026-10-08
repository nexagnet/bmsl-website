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

/** Host and database name only; credentials, port and query are never kept. Throws a generic error (no URL echo). */
export function parseDatabaseTarget(databaseUrl: string): { host: string; database: string } {
  let url: URL;
  try {
    url = new URL(databaseUrl);
  } catch {
    throw new Error('Database URL is not parseable; refusing');
  }
  const host = url.hostname.toLowerCase();
  let database = '';
  try {
    database = decodeURIComponent(url.pathname.replace(/^\/+/, ''));
  } catch {
    database = '';
  }
  if (!host || !database || database.includes('/')) throw new Error('Database URL has no unambiguous host/database; refusing');
  return { host, database };
}

const DECLARED_NON_PRODUCTION = new Set(['dev', 'staging']);

/**
 * Operator attestation (not proof) that the target is DEV/STAGING:
 *   BMSL_IMPORT_TARGET_ENV=dev|staging   and   BMSL_IMPORT_TARGET_ACK=<host>/<database> (exact match).
 * Anything else (absent, production, unknown, mismatched) is denied.
 */
function assertDeclaredNonProductionTarget(env: Record<string, string | undefined>, target: { host: string; database: string }): void {
  const declared = (env.BMSL_IMPORT_TARGET_ENV ?? '').trim();
  if (!DECLARED_NON_PRODUCTION.has(declared)) {
    throw new Error('Refusing: BMSL_IMPORT_TARGET_ENV must be exactly "dev" or "staging" for this target');
  }
  if ((env.BMSL_IMPORT_TARGET_ACK ?? '').trim() !== `${target.host}/${target.database}`) {
    throw new Error(`Refusing: BMSL_IMPORT_TARGET_ACK must equal "<host>/<database>" of the configured target (${target.host}/${target.database})`);
  }
}

/**
 * Throws unless the run is safe: never raw input inside this repo; writes only to local or declared dev/staging.
 * NODE_ENV=production is the optimized Node runtime mode, not a statement about the data. It is accepted for a write
 * only with an explicit dev/staging declaration + exact host/database acknowledgement + BMSL_IMPORT_ALLOW_STAGING=true.
 * A non-local dry-run under NODE_ENV=production needs the same declaration + acknowledgement, because it still
 * starts Payload (migration-capable) against that DB.
 */
export function assertImportAllowed(options: {
  write: boolean;
  env: Record<string, string | undefined>;
  databaseUrl: string;
  repoRoot: string;
  inputPath?: string;
}): void {
  const { write, env, databaseUrl, repoRoot, inputPath } = options;
  if (inputPath) {
    const rel = path.relative(repoRoot, path.resolve(inputPath));
    if (rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel))) {
      throw new Error('Refusing input stored inside this public repository; keep raw legacy data outside the repo');
    }
  }
  const production = env.NODE_ENV === 'production';
  if (!write && !production) return;
  const target = parseDatabaseTarget(databaseUrl);
  const local = LOCAL_HOSTS.has(target.host);
  if (!write) {
    if (!local) assertDeclaredNonProductionTarget(env, target);
    return;
  }
  if (production || !local) {
    if (env.BMSL_IMPORT_ALLOW_STAGING !== 'true') {
      throw new Error(
        production
          ? 'Refusing to write in production mode without BMSL_IMPORT_ALLOW_STAGING=true plus a dev/staging target declaration'
          : `Refusing to write to a non-local database (${target.host}); set BMSL_IMPORT_ALLOW_STAGING=true only for staging`,
      );
    }
    if (production || env.BMSL_IMPORT_TARGET_ENV !== undefined || env.BMSL_IMPORT_TARGET_ACK !== undefined) {
      assertDeclaredNonProductionTarget(env, target);
    }
  }
}

/** Honest label for dry-run: Payload still starts (schema push / migrations are possible); this is NOT read-only. */
export function describeMode(write: boolean): string {
  return write
    ? 'MODE: WRITE (migration-capable Payload startup; non-clobber import)'
    : 'MODE: DRY-RUN (migration-capable Payload startup, no records written; NOT read-only inventory)';
}
