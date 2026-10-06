import config from '@payload-config';
import { sql } from '@payloadcms/db-postgres/drizzle';
import { getPayload } from 'payload';
import { READINESS_DB_TIMEOUT_MS, checkReadiness, readinessResponse, singleflight } from '../../lib/readiness';
import { migrations } from '../../migrations';

// Read-only readiness probe for the platform (GET only; no write path). It reuses the Payload singleton and its
// adapter pool and reports a fixed minimal body, so nothing about the database or secrets can leak.
export const dynamic = 'force-dynamic';

// At most one probe query is outstanding at a time. Inside it, a short transaction sets LOCAL lock/statement timeouts
// so a table lock on payload_migrations ends the query on the server (releasing the pooled connection) instead of
// waiting forever; acquiring a pooled connection is bounded by the adapter pool's connectionTimeoutMillis.
const readApplied = singleflight(async () => {
  const payload = await getPayload({ config });
  return payload.db.drizzle.transaction(async (tx) => {
    await tx.execute(sql.raw(`set local lock_timeout = ${READINESS_DB_TIMEOUT_MS}`));
    await tx.execute(sql.raw(`set local statement_timeout = ${READINESS_DB_TIMEOUT_MS}`));
    const result = (await tx.execute(sql`select name from payload_migrations`)) as { rows: { name: unknown }[] };
    return result.rows.map((r) => String(r.name));
  });
});

export const GET = async (): Promise<Response> =>
  readinessResponse(await checkReadiness({ expectedMigrations: migrations.map((m) => m.name), appliedMigrations: readApplied }));
