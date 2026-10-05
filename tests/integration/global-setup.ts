import pg from 'pg';
import { createOwnedDatabase, dropDisposableDatabase, ownsDatabase } from './support/db-lifecycle';
import {
  ADMIN_URL_ENV,
  assertSafeAdminUrl,
  databaseUrlFor,
  INVOCATION_DB_ENV,
  newInvocationDatabaseName,
} from './support/disposable-db';

// Entrypoint of `pnpm test:integration` (vitest globalSetup, runs once in the main process BEFORE any suite).
// It creates ONE random, invocation-owned PostgreSQL database and points DATABASE_URL at it for every worker, so no
// legacy suite can ever reset the schema of the shared database named by the original DATABASE_URL. That original
// URL is kept only as an administrative connection (BMSL_IT_ADMIN_DATABASE_URL) for CREATE/DROP of databases this
// run owns; suites that need their own databases (http-smoke, db-lifecycle) derive them from it.
//
// Teardown drops only what setup created, and only once PostgreSQL reports no remaining session: test
// workers are separate processes that have exited by then (a Payload instance's reserved client is released by
// process exit, not by destroy()), and nothing is ever terminated or dropped WITH (FORCE).

let admin: pg.Client | undefined;
let invocationDb: string | undefined;

async function cleanup(): Promise<void> {
  try {
    if (admin && invocationDb && ownsDatabase(invocationDb)) await dropDisposableDatabase(admin, invocationDb, 60_000);
  } finally {
    const client = admin;
    admin = undefined;
    invocationDb = undefined;
    await client?.end();
  }
}

export async function setup(): Promise<void> {
  const adminUrl = assertSafeAdminUrl(process.env.DATABASE_URL);
  admin = new pg.Client({ connectionString: adminUrl.toString(), connectionTimeoutMillis: 15_000 });
  await admin.connect();
  const name = newInvocationDatabaseName();
  try {
    await createOwnedDatabase(admin, name);
    invocationDb = name;
  } catch (error) {
    await admin.end().catch(() => undefined);
    admin = undefined;
    throw error;
  }
  process.env[ADMIN_URL_ENV] = adminUrl.toString();
  process.env[INVOCATION_DB_ENV] = name;
  process.env.DATABASE_URL = databaseUrlFor(adminUrl, name);
}

export async function teardown(): Promise<void> {
  await cleanup();
}
