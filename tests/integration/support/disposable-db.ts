import { randomBytes } from 'node:crypto';

// Pure rules for the integration entrypoint (global-setup.ts): which administrative DATABASE_URL is acceptable and
// what an invocation-owned database is called. Ownership itself (what this run actually created) is tracked by
// db-lifecycle.ts; a name or host that merely looks right is never ownership.

export const ADMIN_URL_ENV = 'BMSL_IT_ADMIN_DATABASE_URL';
export const INVOCATION_DB_ENV = 'BMSL_IT_DATABASE_NAME';

export const LOCAL_HOSTS = ['localhost', '127.0.0.1', '::1', '[::1]'];

/** Per-invocation database used by every legacy suite: bmsl_it_ + 16 random hex digits. */
export const INVOCATION_DB = /^bmsl_it_[0-9a-f]{16}$/;

export const newInvocationDatabaseName = (): string => `bmsl_it_${randomBytes(8).toString('hex')}`;

const FORBIDDEN_PARAMS = ['host', 'hostaddr', 'port', 'service', 'dbname', 'options'];

/**
 * Validates the administrative connection used only to CREATE/DROP the invocation databases. It must be an explicit
 * local PostgreSQL URL naming a database, and must not smuggle a different target through libpq-style query
 * parameters or point at an invocation database itself.
 */
export function assertSafeAdminUrl(raw: string | undefined): URL {
  if (!raw?.trim()) throw new Error('DATABASE_URL is required');
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error('DATABASE_URL is not a valid URL');
  }
  if (url.protocol !== 'postgres:' && url.protocol !== 'postgresql:') {
    throw new Error('DATABASE_URL must be a postgres:// or postgresql:// URL');
  }
  if (!LOCAL_HOSTS.includes(url.hostname)) {
    throw new Error(`Refusing to provision databases on a non-local host (${url.hostname})`);
  }
  const bad = FORBIDDEN_PARAMS.filter((p) => url.searchParams.has(p));
  if (bad.length > 0) throw new Error(`DATABASE_URL must not override its target via ${bad.join(', ')}`);
  const name = decodeURIComponent(url.pathname.replace(/^\//, ''));
  if (!name) throw new Error('DATABASE_URL must name a database');
  if (INVOCATION_DB.test(name)) throw new Error('DATABASE_URL already points at an invocation database; refusing to nest');
  return url;
}

export function databaseUrlFor(admin: URL, dbName: string): string {
  const url = new URL(admin.toString());
  url.pathname = `/${dbName}`;
  return url.toString();
}

/** What every test worker must be connected to: the invocation database, never the shared admin database. */
export function assertWorkerTarget(databaseUrl: string | undefined, expectedName: string | undefined): void {
  if (!databaseUrl || !expectedName) throw new Error('integration entrypoint did not provide a disposable database');
  const url = new URL(databaseUrl);
  if (!LOCAL_HOSTS.includes(url.hostname)) throw new Error(`worker DATABASE_URL host ${url.hostname} is not local`);
  const name = decodeURIComponent(url.pathname.replace(/^\//, ''));
  if (!INVOCATION_DB.test(name) || name !== expectedName) {
    throw new Error(`worker DATABASE_URL targets ${name || '(none)'}, not the invocation database ${expectedName}`);
  }
}
