import pg from 'pg';
import type { Payload } from 'payload';
import { getPayload } from 'payload';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { handleContactPost } from '../../src/lib/contact-endpoint';
import { loadLeadEmailConfig } from '../../src/lib/lead-email-settings';
import { deliverLeadNotification } from '../../src/lib/lead-notification';
import { createSmtpSink } from './support/smtp-sink';

// Lead e-mail configured by an ADMIN in the CMS (global lead-email-settings), with NO lead-e-mail environment variable.
// Real PostgreSQL (disposable), real Payload, real nodemailer adapter speaking to an in-process SMTP sink. Synthetic data only.

process.env.PAYLOAD_SECRET ??= 'synthetic-integration-secret';
for (const name of ['LEAD_EMAIL_ENABLED', 'SMTP_HOST', 'SMTP_PORT', 'SMTP_SECURE', 'SMTP_USER', 'SMTP_PASS', 'LEAD_EMAIL_FROM', 'LEAD_EMAIL_TO', 'LEAD_SMTP_ENCRYPTION_KEY']) {
  delete process.env[name];
}
const sink = createSmtpSink();
const SLUG = 'lead-email-settings' as never;
const admin = { id: 1, collection: 'users', role: 'ADMIN' } as never;
const editor = { id: 2, collection: 'users', role: 'EDITOR' } as never;
// Built at run time so no credential-looking literal sits in the source; it only exists inside the disposable DB.
const PASSWORD = ['synthetic', 'cms', 'pw', '1'].join('-');

let payload: Payload;
let pool: pg.Pool;
let port: number;

const save = (data: Record<string, unknown>) => payload.updateGlobal({ slug: SLUG, data, overrideAccess: false, user: admin } as never);
const cmsOn = (extra: Record<string, unknown> = {}) =>
  save({ enabled: true, to: 'inbox@cms-sandbox.example', from: 'sender@cms-sandbox.example', smtpHost: '127.0.0.1', smtpPort: port, ...extra });
const newLead = async () => {
  const res = await handleContactPost(
    new Request('http://localhost/lien-he/gui', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'Synthetic Cms', phone: '0900000003', requestType: 'khac', message: 'Synthetic body', consent: true, sourcePage: '/lien-he' }),
    }),
    { getPayload: async () => payload, allow: () => true, notify: () => async () => undefined },
  );
  expect(res.status).toBe(200);
  const { docs } = await payload.find({ collection: 'contact-leads', overrideAccess: true, sort: '-id', limit: 1 });
  return docs[0]!.id;
};
const state = async (id: number | string) => (await pool.query('select notification_state s from contact_leads where id = $1', [id])).rows[0].s as string;

beforeAll(async () => {
  port = await sink.start();
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

beforeEach(async () => {
  sink.messages.length = 0;
  sink.setMode('accept');
  await save({ enabled: false, clearSmtpPassword: true, to: null, from: null, smtpHost: null, smtpPort: null, smtpUser: null });
});

describe('lead e-mail configured in the CMS', () => {
  it('is OFF with an empty CMS and no environment', async () => {
    expect(await loadLeadEmailConfig(payload, {})).toMatchObject({ enabled: false });
    expect(await state(await newLead())).toBe('not_configured');
  });

  it('sends through the CMS-configured SMTP without any environment variable, and applies a change without restart', async () => {
    await cmsOn();
    const id = await newLead();
    expect(await state(id)).toBe('pending');
    await payload.jobs.run({ queue: 'lead-mail', silent: true });
    expect(await state(id)).toBe('sent');
    expect(sink.messages).toHaveLength(1);
    expect(sink.messages[0]!.to).toEqual(['inbox@cms-sandbox.example']);
    expect(sink.messages[0]!.from).toBe('sender@cms-sandbox.example');

    await save({ to: 'other@cms-sandbox.example' });
    const second = await newLead();
    await payload.jobs.run({ queue: 'lead-mail', silent: true });
    expect(await state(second)).toBe('sent');
    expect(sink.messages[1]!.to).toEqual(['other@cms-sandbox.example']);
  });

  it('falls back to the environment for empty CMS values', async () => {
    await save({ enabled: true, to: 'inbox@cms-sandbox.example' });
    const env = { SMTP_HOST: '127.0.0.1', SMTP_PORT: String(port), LEAD_EMAIL_FROM: 'env-sender@cms-sandbox.example' };
    const config = await loadLeadEmailConfig(payload, env);
    expect(config).toMatchObject({ enabled: true, from: 'env-sender@cms-sandbox.example', to: 'inbox@cms-sandbox.example' });
  });

  it('stores the SMTP password encrypted, never returns it, keeps it across saves and clears on request', async () => {
    await cmsOn({ smtpUser: 'smtp-user', smtpPasswordInput: PASSWORD });
    const stored = (await pool.query('select smtp_password_encrypted p, smtp_password_configured c from lead_email_settings')).rows[0];
    expect(stored.c).toBe(true);
    expect(stored.p).toMatch(/^v1\./);
    expect(stored.p).not.toContain(PASSWORD);
    expect(JSON.stringify((await pool.query('select * from lead_email_settings')).rows)).not.toContain(PASSWORD);

    // Neither the ADMIN read path nor the update response exposes the ciphertext or the password.
    const read = await payload.findGlobal({ slug: SLUG, overrideAccess: false, user: admin } as never);
    expect(JSON.stringify(read)).not.toContain(PASSWORD);
    expect(JSON.stringify(read)).not.toContain('v1.');
    expect(read).toMatchObject({ smtpPasswordConfigured: true });

    // The server can use it (decrypt), and an unrelated save keeps it.
    await save({ to: 'again@cms-sandbox.example' });
    expect((await loadLeadEmailConfig(payload, {}))).toMatchObject({ enabled: true, smtp: { auth: { user: 'smtp-user', pass: PASSWORD } } });

    await save({ clearSmtpPassword: true });
    expect((await pool.query('select smtp_password_encrypted p, smtp_password_configured c from lead_email_settings')).rows[0]).toEqual({ p: null, c: false });
  });

  it('is OFF (and names only SMTP_PASS) when the stored password cannot be decrypted', async () => {
    await cmsOn({ smtpUser: 'smtp-user', smtpPasswordInput: PASSWORD });
    process.env.LEAD_SMTP_ENCRYPTION_KEY = 'a-different-key-material';
    try {
      expect(await loadLeadEmailConfig(payload, process.env)).toEqual({ enabled: false, problems: ['SMTP_PASS'] });
    } finally {
      delete process.env.LEAD_SMTP_ENCRYPTION_KEY;
    }
  });

  it('is readable and writable by ADMIN only', async () => {
    await expect(payload.findGlobal({ slug: SLUG, overrideAccess: false, user: editor } as never)).rejects.toThrow();
    await expect(payload.updateGlobal({ slug: SLUG, data: { enabled: true }, overrideAccess: false, user: editor } as never)).rejects.toThrow();
    await expect(payload.findGlobal({ slug: SLUG, overrideAccess: false } as never)).rejects.toThrow();
  });

  it('delivery does nothing once the CMS switch is turned off again', async () => {
    await cmsOn();
    const id = await newLead();
    await save({ enabled: false });
    await expect(deliverLeadNotification(payload, id, {})).resolves.toBe('skipped_disabled');
    expect(sink.messages).toHaveLength(0);
  });
});
