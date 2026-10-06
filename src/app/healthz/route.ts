import config from '@payload-config';
import { sql } from '@payloadcms/db-postgres/drizzle';
import { getPayload } from 'payload';
import { checkReadiness, readinessResponse } from '../../lib/readiness';
import { migrations } from '../../migrations';

// Read-only readiness probe for the platform (GET only; no write path). It reuses the Payload singleton and its
// adapter pool and reports a fixed minimal body, so nothing about the database or secrets can leak.
export const dynamic = 'force-dynamic';

export const GET = async (): Promise<Response> =>
  readinessResponse(
    await checkReadiness({
      expectedMigrations: migrations.map((m) => m.name),
      appliedMigrations: async () => {
        const payload = await getPayload({ config });
        const result = (await payload.db.drizzle.execute(sql`select name from payload_migrations`)) as {
          rows: { name: unknown }[];
        };
        return result.rows.map((r) => String(r.name));
      },
    }),
  );
