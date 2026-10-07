import pg from 'pg';
import type { Payload } from 'payload';
import { getPayload } from 'payload';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { deliverLeadNotification, reconcileLeadNotifications } from '../../src/lib/lead-notification';
import { migrations } from '../../src/migrations';

// Issue #82 — the outbox migration is ADDITIVE and safe on a database that already holds leads (disposable DB only).
// Steps: build the schema WITHOUT the new migration, insert synthetic legacy leads, apply the new migration,
// prove nothing was lost or sent, roll it back, and apply it again.

process.env.PAYLOAD_SECRET ??= 'synthetic-integration-secret';
const NEW = '20261007_075550_lead_email_outbox';
const ENABLED = { LEAD_EMAIL_ENABLED: 'true', SMTP_HOST: '127.0.0.1', SMTP_PORT: '1', LEAD_EMAIL_FROM: 'a@bmsl-sandbox.example', LEAD_EMAIL_TO: 'b@bmsl-sandbox.example' };

let payload: Payload;
let pool: pg.Pool;
const columns = async (table: string) =>
  (await pool.query('select column_name from information_schema.columns where table_name = $1', [table])).rows.map((r: { column_name: string }) => r.column_name);
const tableExists = async (name: string) => (await pool.query('select to_regclass($1) as t', [`public.${name}`])).rows[0].t !== null;

beforeAll(async () => {
  pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
  await pool.query('drop schema if exists public cascade; create schema public;');
  const { default: config } = await import('../../src/payload.config');
  payload = await getPayload({ config });
  expect(migrations.at(-1)?.name).toBe(NEW);
  await payload.db.migrate({ migrations: migrations.slice(0, -1) as never });
});

afterAll(async () => {
  await payload?.destroy();
  await pool?.end();
});

describe('lead e-mail outbox migration', () => {
  it('starts from a schema that has leads but no outbox', async () => {
    expect(await columns('contact_leads')).not.toContain('notification_state');
    expect(await tableExists('payload_jobs')).toBe(false);
    for (const n of [1, 2, 3]) {
      await pool.query(
        `insert into contact_leads (name, phone, request_type, message, consent_given, consent_at, source_page, status)
         values ($1, $2, 'khac', 'Synthetic legacy body', true, now(), '/lien-he', 'new')`,
        [`Synthetic Legacy ${n}`, `090000010${n}`],
      );
    }
  });

  it('applies additively: every existing lead is untouched and none is ever notified retroactively', async () => {
    await payload.db.migrate();
    expect((await pool.query('select 1 from payload_migrations where name = $1', [NEW])).rowCount).toBe(1);
    expect(await columns('contact_leads')).toEqual(
      expect.arrayContaining(['notification_state', 'notification_attempts', 'notification_last_attempt_at', 'notification_lease_until', 'notification_sent_at', 'notification_last_error']),
    );
    expect(await tableExists('payload_jobs')).toBe(true);
    expect(await tableExists('payload_jobs_log')).toBe(true);

    const rows = (await pool.query('select name, phone, notification_state s from contact_leads order by id')).rows;
    expect(rows.map((r: { name: string }) => r.name)).toEqual(['Synthetic Legacy 1', 'Synthetic Legacy 2', 'Synthetic Legacy 3']);
    expect(rows.every((r: { s: string | null }) => r.s === null)).toBe(true);

    const { docs } = await payload.find({ collection: 'contact-leads', overrideAccess: true, limit: 1 });
    await expect(deliverLeadNotification(payload, docs[0]!.id, ENABLED)).resolves.toBe('skipped_not_claimable');
    expect(await reconcileLeadNotifications(payload)).toBe(0);
    expect(Number((await pool.query('select count(*)::int c from payload_jobs')).rows[0].c)).toBe(0);
  });

  it('rolls back cleanly (leads kept) and can be applied again', async () => {
    await payload.db.migrateDown();
    expect(await columns('contact_leads')).not.toContain('notification_state');
    expect(await tableExists('payload_jobs')).toBe(false);
    expect(Number((await pool.query('select count(*)::int c from contact_leads')).rows[0].c)).toBe(3);

    await payload.db.migrate();
    expect(await columns('contact_leads')).toContain('notification_state');
    expect(Number((await pool.query('select count(*)::int c from contact_leads')).rows[0].c)).toBe(3);
  });
});
