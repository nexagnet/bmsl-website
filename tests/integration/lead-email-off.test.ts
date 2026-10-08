import pg from 'pg';
import type { Payload } from 'payload';
import { getPayload } from 'payload';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { handleContactPost } from '../../src/lib/contact-endpoint';
import { deliverLeadNotification, reconcileLeadNotifications } from '../../src/lib/lead-notification';
import { createSmtpSink } from './support/smtp-sink';

// Issue #82 — with NO sender/recipient/SMTP configuration the feature is OFF: leads are stored exactly as before,
// nothing is queued, nothing is sent (a listening SMTP sink proves nothing even tries), and the state says why.

process.env.PAYLOAD_SECRET ??= 'synthetic-integration-secret';
for (const name of ['LEAD_EMAIL_ENABLED', 'SMTP_HOST', 'SMTP_PORT', 'SMTP_SECURE', 'SMTP_USER', 'SMTP_PASS', 'LEAD_EMAIL_FROM', 'LEAD_EMAIL_TO']) {
  delete process.env[name];
}
const sink = createSmtpSink();
let payload: Payload;
let pool: pg.Pool;

const submit = () =>
  handleContactPost(
    new Request('http://localhost/lien-he/gui', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'Synthetic Off', phone: '0900000002', requestType: 'khac', message: 'Synthetic body', consent: true, sourcePage: '/lien-he' }),
    }),
    { getPayload: async () => payload, allow: () => true },
  );

beforeAll(async () => {
  await sink.start();
  pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
  await pool.query('drop schema if exists public cascade; create schema public;');
  const { default: config } = await import('../../src/payload.config');
  payload = await getPayload({ config });
  await payload.db.migrate();
});

afterAll(async () => {
  await sink.stop();
  await payload?.destroy();
  await pool?.end();
});

describe('feature OFF (no explicit configuration)', () => {
  it('stores the lead, answers persisted:true, queues nothing and sends nothing', async () => {
    const res = await submit();
    expect(await res.json()).toEqual({ ok: true, persisted: true });

    const row = (await pool.query('select notification_state s, notification_attempts a from contact_leads')).rows;
    expect(row).toHaveLength(1);
    expect(row[0].s).toBe('not_configured');
    expect(row[0].a).toBeNull();
    expect(Number((await pool.query('select count(*)::int c from payload_jobs')).rows[0].c)).toBe(0);
    expect(sink.messages).toHaveLength(0);
  });

  it('delivery and reconcile do nothing while OFF, and a lead stored while OFF is never sent retroactively', async () => {
    const { docs } = await payload.find({ collection: 'contact-leads', overrideAccess: true, limit: 1 });
    await expect(deliverLeadNotification(payload, docs[0]!.id)).resolves.toBe('skipped_disabled');
    expect(await reconcileLeadNotifications(payload)).toBe(0);
    // Even if the feature is switched on later, a not_configured lead is not claimable.
    const enabled = {
      LEAD_EMAIL_ENABLED: 'true',
      SMTP_HOST: '127.0.0.1',
      SMTP_PORT: String(sink.port),
      LEAD_EMAIL_FROM: 'a@bmsl-sandbox.example',
      LEAD_EMAIL_TO: 'b@bmsl-sandbox.example',
    };
    await expect(deliverLeadNotification(payload, docs[0]!.id, enabled)).resolves.toBe('skipped_not_claimable');
    expect(sink.messages).toHaveLength(0);
  });
});
