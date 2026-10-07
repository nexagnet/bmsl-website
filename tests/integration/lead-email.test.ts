import pg from 'pg';
import type { Payload } from 'payload';
import { getPayload } from 'payload';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { handleContactPost } from '../../src/lib/contact-endpoint';
import { deliverLeadNotification, MAX_ATTEMPTS, reconcileLeadNotifications } from '../../src/lib/lead-notification';
import { createSmtpSink } from './support/smtp-sink';

// Issue #82 — ContactLead e-mail with REAL PostgreSQL (disposable DB), the REAL Payload Jobs Queue and the REAL
// @payloadcms/email-nodemailer adapter speaking SMTP to an in-process sink. Synthetic data only; nothing leaves loopback.

process.env.PAYLOAD_SECRET ??= 'synthetic-integration-secret';
const sink = createSmtpSink();
// Built at run time so no credential-looking literal sits in the source; the value only exists inside the disposable DB.
const syntheticPassword = (who: string) => ['synthetic', who, '1'].join('-');
const SENDER = 'sender@bmsl-sandbox.example';
const RECIPIENT = 'inbox@bmsl-sandbox.example';

const PHONE = '0900000001';
const NAME = 'Synthetic Lead Alpha';
const MESSAGE = 'Synthetic request body, no real person.';
const raw = (extra: Record<string, unknown> = {}) => ({
  name: NAME,
  phone: PHONE,
  requestType: 'bao-gia',
  message: MESSAGE,
  consent: true,
  sourcePage: '/lien-he',
  ...extra,
});

let payload: Payload;
let pool: pg.Pool;
const leadRow = async (id: number | string) =>
  (
    await pool.query(
      'select notification_state s, notification_attempts a, notification_last_error e, notification_sent_at t from contact_leads where id = $1',
      [id],
    )
  ).rows[0] as { s: string; a: string | null; e: string | null; t: Date | null };
const jobCount = async (id: number | string) =>
  Number((await pool.query("select count(*)::int c from payload_jobs where input->>'leadId' = $1", [String(id)])).rows[0].c);
const runQueue = () => payload.jobs.run({ queue: 'lead-mail', silent: true });
const makeJobsDue = () => pool.query('update payload_jobs set wait_until = null where completed_at is null and has_error is not true');
const post = (body: unknown) =>
  handleContactPost(
    new Request('http://localhost/lien-he/gui', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }),
    {
      getPayload: async () => payload,
      allow: () => true,
      notify: () => async () => undefined, // the queue is driven explicitly by each test
    },
  );
const newLead = async (extra: Record<string, unknown> = {}) => {
  const res = await post(raw(extra));
  expect(res.status).toBe(200);
  const { docs } = await payload.find({ collection: 'contact-leads', overrideAccess: true, sort: '-id', limit: 1 });
  return docs[0]!.id;
};

beforeAll(async () => {
  const port = await sink.start();
  Object.assign(process.env, {
    LEAD_EMAIL_ENABLED: 'true',
    SMTP_HOST: '127.0.0.1',
    SMTP_PORT: String(port),
    LEAD_EMAIL_FROM: SENDER,
    LEAD_EMAIL_TO: RECIPIENT,
  });
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

beforeEach(() => {
  sink.messages.length = 0;
  sink.setMode('accept');
});

describe('lead stored first, then notified', () => {
  it('stores the lead AND its queued job in one transaction, then delivers exactly one e-mail', async () => {
    const id = await newLead();
    expect((await leadRow(id)).s).toBe('pending');
    expect(await jobCount(id)).toBe(1);
    expect(sink.messages).toHaveLength(0); // nothing is sent inside the request path

    await runQueue();

    const row = await leadRow(id);
    expect(row.s).toBe('sent');
    expect(row.t).not.toBeNull();
    expect(sink.messages).toHaveLength(1);
    const mail = sink.messages[0]!;
    expect(mail.to).toEqual([RECIPIENT]);
    expect(mail.from).toBe(SENDER);
    expect(mail.raw).toMatch(new RegExp(`Message-ID: <bmsl-lead-${id}@bmsl-sandbox\\.example>`, 'i'));
    const subject = /^Subject: (.*)$/im.exec(mail.raw)![1]!;
    expect(subject).not.toContain(NAME);
    expect(subject).not.toContain(PHONE);
    expect(mail.raw).toContain(PHONE); // the body (to BMSL's own inbox) carries the callback details
  });

  it('the notification intent rolls back together with the lead (no job without a lead)', async () => {
    const jobs = async () => Number((await pool.query('select count(*)::int c from payload_jobs')).rows[0].c);
    const leads = async () => Number((await pool.query('select count(*)::int c from contact_leads')).rows[0].c);
    const [jobsBefore, leadsBefore] = [await jobs(), await leads()];
    const transactionID = (await payload.db.beginTransaction()) as string | number;
    await payload.create({
      collection: 'contact-leads',
      overrideAccess: true,
      req: { payload, transactionID } as never,
      data: {
        name: NAME,
        phone: PHONE,
        requestType: 'khac',
        message: MESSAGE,
        consent: { given: true, at: new Date().toISOString() },
        sourcePage: '/lien-he',
        status: 'new',
      },
    });
    await payload.db.rollbackTransaction(transactionID);
    expect(await jobs()).toBe(jobsBefore);
    expect(await leads()).toBe(leadsBefore);
  });
});

describe('failure never loses the lead and retries without duplicating', () => {
  it('SMTP unavailable: the API still answers persisted:true, the lead is kept, retry delivers once', async () => {
    const port = sink.port;
    await sink.stop();
    const res = await post(raw({ name: 'Synthetic Lead Down' }));
    expect(await res.json()).toEqual({ ok: true, persisted: true });
    const { docs } = await payload.find({ collection: 'contact-leads', overrideAccess: true, sort: '-id', limit: 1 });
    const id = docs[0]!.id;

    await runQueue(); // connection refused
    const failed = await leadRow(id);
    expect(failed.s).toBe('failed');
    expect(failed.e).toMatch(/^[A-Z_]+$/); // a code, never a message
    expect(Number(failed.a)).toBe(1);

    await sink.start(port); // SMTP comes back
    await makeJobsDue();
    await runQueue();
    expect((await leadRow(id)).s).toBe('sent');
    expect(sink.messages).toHaveLength(1);
  });

  it('a transient 4xx from the server is retried and delivered once the server recovers', async () => {
    const id = await newLead({ name: 'Synthetic Lead Temp' });
    sink.setMode('tempfail-451');
    await runQueue();
    expect((await leadRow(id)).s).toBe('failed');
    expect(sink.messages).toHaveLength(0);
    sink.setMode('accept');
    await makeJobsDue();
    await runQueue();
    expect((await leadRow(id)).s).toBe('sent');
    expect(sink.messages).toHaveLength(1);
  });

  it('a permanent rejection (5xx recipient) parks the lead as dead without further retries', async () => {
    const id = await newLead({ name: 'Synthetic Lead Hard' });
    sink.setMode('reject-recipient-550');
    await runQueue();
    expect((await leadRow(id)).s).toBe('dead');
    expect(sink.messages).toHaveLength(0);
    sink.setMode('accept');
    await makeJobsDue();
    await runQueue();
    expect(sink.messages).toHaveLength(0); // dead is never retried automatically
    expect((await leadRow(id)).s).toBe('dead');
  });

  it('attempts are bounded: the last allowed failure parks the lead as dead', async () => {
    const id = await newLead({ name: 'Synthetic Lead Cap' });
    await pool.query("update contact_leads set notification_attempts = $2, notification_state = 'failed' where id = $1", [id, MAX_ATTEMPTS - 1]);
    sink.setMode('tempfail-451');
    await expect(deliverLeadNotification(payload, id)).resolves.toBe('dead');
    expect((await leadRow(id)).s).toBe('dead');
  });
});

describe('idempotency', () => {
  it('duplicate jobs and concurrent executions send exactly one e-mail', async () => {
    const id = await newLead({ name: 'Synthetic Lead Dup' });
    for (let i = 0; i < 3; i += 1) {
      await payload.jobs.queue({ task: 'send-lead-notification', queue: 'lead-mail', input: { leadId: Number(id) } });
    }
    expect(await jobCount(id)).toBe(4);

    // Two overlapping queue runs can trip Payload's own job bookkeeping (a job deleted by the other run); the
    // production callers swallow that, and the claim below is what guarantees a single delivery.
    await Promise.all([
      runQueue().catch(() => undefined),
      runQueue().catch(() => undefined),
      deliverLeadNotification(payload, id),
      deliverLeadNotification(payload, id),
      deliverLeadNotification(payload, id),
    ]);
    expect(sink.messages).toHaveLength(1);
    expect((await leadRow(id)).s).toBe('sent');
    await expect(deliverLeadNotification(payload, id)).resolves.toBe('skipped_not_claimable');
    expect(sink.messages).toHaveLength(1);
  });
});

describe('restart recovery', () => {
  it('a delivery stranded by a crash (claimed, job stuck processing) is re-queued and delivered once', async () => {
    const id = await newLead({ name: 'Synthetic Lead Crash' });
    // The process died mid-delivery: the row was claimed, its lease has since expired, and the job row was left
    // `processing` (Payload never unlocks such a job by itself).
    await pool.query(
      "update contact_leads set notification_state='sending', notification_attempts=1, notification_lease_until = now() - interval '5 minutes' where id = $1",
      [id],
    );
    await pool.query("update payload_jobs set processing = true where input->>'leadId' = $1", [String(id)]);
    await runQueue();
    expect(sink.messages).toHaveLength(0); // the stuck job is invisible to the queue

    expect(await reconcileLeadNotifications(payload)).toBeGreaterThanOrEqual(1);
    await runQueue();
    expect((await leadRow(id)).s).toBe('sent');
    expect(sink.messages).toHaveLength(1);
  });

  it('a lease that is still valid is NOT stolen (another worker is sending)', async () => {
    const id = await newLead({ name: 'Synthetic Lead Held' });
    await pool.query(
      "update contact_leads set notification_state='sending', notification_attempts=1, notification_lease_until = now() + interval '5 minutes' where id = $1",
      [id],
    );
    await expect(deliverLeadNotification(payload, id)).resolves.toBe('skipped_not_claimable');
    expect(sink.messages).toHaveLength(0);
  });
});

describe('safety of what is stored and logged', () => {
  it('header-injection attempts stay inside the body and never create headers', async () => {
    const id = await newLead({ name: 'Synthetic Evil\r\nBcc: attacker@example.test', message: 'x\r\nBcc: attacker@example.test' });
    await runQueue();
    expect((await leadRow(id)).s).toBe('sent');
    const mail = sink.messages[0]!;
    const headers = mail.raw.split('\r\n\r\n')[0]!;
    expect(headers).not.toMatch(/^Bcc:/im);
    expect(mail.to).toEqual([RECIPIENT]);
  });

  it('job rows, job logs and console output contain no lead PII, even when delivery fails', async () => {
    const spies = (['log', 'info', 'warn', 'error', 'debug'] as const).map((m) => vi.spyOn(console, m).mockImplementation(() => undefined));
    const id = await newLead({ name: 'Synthetic Lead Quiet', phone: '0900000099', message: 'secret-looking synthetic body' });
    sink.setMode('tempfail-451');
    await runQueue();
    sink.setMode('accept');
    await makeJobsDue();
    await runQueue();

    const jobs =
      JSON.stringify((await pool.query('select * from payload_jobs')).rows) + JSON.stringify((await pool.query('select * from payload_jobs_log')).rows);
    const logged = JSON.stringify(spies.flatMap((s) => s.mock.calls));
    spies.forEach((s) => s.mockRestore());
    for (const secret of ['Synthetic Lead Quiet', '0900000099', 'secret-looking synthetic body', RECIPIENT]) {
      expect(jobs, `job tables leak ${secret}`).not.toContain(secret);
      expect(logged, `console leaks ${secret}`).not.toContain(secret);
    }
    expect((await leadRow(id)).s).toBe('sent');
  });

  it('only ADMIN may see the queue or the leads; the public and EDITOR cannot', async () => {
    // The first local-API user is forced to ADMIN by the bootstrap policy; the second one keeps the requested role.
    await payload.create({ collection: 'users', data: { email: 'admin@example.test', password: syntheticPassword('Admin'), role: 'ADMIN' } });
    const editor = await payload.create({ collection: 'users', data: { email: 'editor@example.test', password: syntheticPassword('Editor'), role: 'EDITOR' } });
    const asEditor = { user: { ...editor, collection: 'users' } as never, overrideAccess: false as const };
    await expect(payload.find({ collection: 'payload-jobs', overrideAccess: false })).rejects.toThrow();
    await expect(payload.find({ collection: 'payload-jobs', ...asEditor })).rejects.toThrow();
    await expect(payload.find({ collection: 'contact-leads', ...asEditor })).rejects.toThrow();
  });
});
