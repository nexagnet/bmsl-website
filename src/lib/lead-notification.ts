import type { Payload } from 'payload';
import { LEAD_EMAIL_QUEUE, type LeadEmailConfig, resolveLeadEmailConfig } from './lead-email-config';

// Durable ContactLead e-mail notification (Issue #82).
//
// Source of truth = the `notification` group ON THE LEAD ROW (a transactional outbox). Payload's Jobs Queue is only
// the trigger/retry scheduler: a job carries nothing but the lead id, is created in the SAME database transaction as
// the lead (see ContactLeads hooks), and can be lost, duplicated or stuck without ever losing a lead or sending twice,
// because every delivery first CLAIMS the row with one atomic conditional UPDATE.
//
//   pending ──claim──▶ sending ──SMTP accepted──▶ sent
//      ▲                  │ transient error ──▶ failed ──(retry/reconcile: claim again)
//      │                  │ permanent error / attempts exhausted ──▶ dead   (operator re-queues by setting pending)
//   not_configured: lead arrived while the feature was OFF; never sent retroactively.
//
// Nothing in this file logs, throws or stores a lead value: failures keep a short error CODE only.

export const NOTIFICATION_STATES = ['not_configured', 'pending', 'sending', 'sent', 'failed', 'dead'] as const;
export type NotificationState = (typeof NOTIFICATION_STATES)[number];

/** Claims per lead before it is parked as `dead`. */
export const MAX_ATTEMPTS = 8;
/** A claimed delivery that did not finish within this window is presumed crashed and may be claimed again. */
export const LEASE_SECONDS = 120;
export const TASK_SLUG = 'send-lead-notification';

type Pool = { query: (text: string, values?: unknown[]) => Promise<{ rows: Record<string, unknown>[]; rowCount: number | null }> };
const poolOf = (payload: Payload): Pool => (payload.db as unknown as { pool: Pool }).pool;

/** Transient vs permanent classification of a delivery error; only the code ever leaves this function. */
export function classifyMailError(error: unknown): { code: string; permanent: boolean } {
  const e = (error ?? {}) as { code?: unknown; responseCode?: unknown };
  const raw = typeof e.code === 'string' ? e.code : '';
  const code = /^[A-Z][A-Z0-9_]{1,31}$/.test(raw) ? raw : 'SEND_FAILED';
  const response = typeof e.responseCode === 'number' ? e.responseCode : 0;
  // 5xx other than the authentication family (535 etc. is fixable by correcting credentials) is a rejection a retry cannot cure.
  const permanent = response >= 500 && response < 600 && response !== 535 && response !== 534 && response !== 530;
  return { code, permanent };
}

type LeadRow = {
  id: number | string;
  name: string;
  phone: string;
  email?: string | null;
  requestType: string;
  message: string;
  sourcePage: string;
};

const TYPE_LABEL: Record<string, string> = { 'khao-sat': 'Khảo sát', 'bao-gia': 'Báo giá', khac: 'Khác' };
const oneLine = (value: string) => value.replace(/[\r\n]+/g, ' ').trim();

/** The subject carries no personal data; the body (to BMSL's own inbox) carries what staff need to call back. */
export function buildLeadMessage(lead: LeadRow, config: Extract<LeadEmailConfig, { enabled: true }>) {
  const domain = config.from.split('@')[1] ?? 'localhost';
  return {
    to: config.to,
    from: config.from,
    // Stable per lead: a re-delivery after a crash window carries the same Message-ID so the mailbox can dedupe.
    messageId: `<bmsl-lead-${lead.id}@${domain}>`,
    subject: `[BMSL] Yêu cầu liên hệ mới #${lead.id} — ${TYPE_LABEL[lead.requestType] ?? lead.requestType}`,
    text: [
      `Có yêu cầu liên hệ mới từ website (mã #${lead.id}).`,
      '',
      `Họ tên: ${oneLine(lead.name)}`,
      `Điện thoại: ${oneLine(lead.phone)}`,
      `Email: ${lead.email ? oneLine(lead.email) : '(không cung cấp)'}`,
      `Loại yêu cầu: ${TYPE_LABEL[lead.requestType] ?? lead.requestType}`,
      `Trang gửi: ${oneLine(lead.sourcePage)}`,
      '',
      'Nội dung:',
      lead.message,
      '',
      'Thư tự động. Xem và xử lý trong trang quản trị (Yêu cầu liên hệ).',
    ].join('\n'),
  };
}

export type DeliveryResult = 'sent' | 'skipped_disabled' | 'skipped_not_claimable' | 'dead';

/** Atomically takes the delivery. Exactly one concurrent caller gets `true`; none gets it for a `sent`/`dead` lead. */
export async function claimLead(payload: Payload, id: number | string): Promise<boolean> {
  const result = await poolOf(payload).query(
    `UPDATE contact_leads
        SET notification_state = 'sending',
            notification_attempts = coalesce(notification_attempts, 0) + 1,
            notification_last_attempt_at = now(),
            notification_lease_until = now() + ($2::int * interval '1 second')
      WHERE id = $1
        AND ( notification_state IN ('pending', 'failed')
              OR (notification_state = 'sending' AND notification_lease_until < now()) )
        AND coalesce(notification_attempts, 0) < $3::int`,
    [id, LEASE_SECONDS, MAX_ATTEMPTS],
  );
  return (result.rowCount ?? 0) === 1;
}

async function settle(payload: Payload, id: number | string, state: 'sent' | 'failed' | 'dead', code?: string) {
  await poolOf(payload).query(
    `UPDATE contact_leads
        SET notification_state = $2::enum_contact_leads_notification_state,
            notification_lease_until = NULL,
            notification_sent_at = CASE WHEN $2::text = 'sent' THEN now() ELSE notification_sent_at END,
            notification_last_error = $3
      WHERE id = $1 AND notification_state = 'sending'`,
    [id, state, code ?? null],
  );
}

/**
 * One delivery attempt. Resolves with the outcome for expected conditions and THROWS a code-only error when the job
 * should be retried by the Jobs Queue (transient failure), so the queue's own backoff/retry applies.
 */
export async function deliverLeadNotification(
  payload: Payload,
  id: number | string,
  env: Record<string, string | undefined> = process.env,
): Promise<DeliveryResult> {
  const config = resolveLeadEmailConfig(env);
  if (!config.enabled) return 'skipped_disabled';
  if (!(await claimLead(payload, id))) return 'skipped_not_claimable';

  let lead: LeadRow;
  try {
    lead = (await payload.findByID({ collection: 'contact-leads', id, overrideAccess: true, depth: 0 })) as unknown as LeadRow;
  } catch {
    await settle(payload, id, 'failed', 'LEAD_UNREADABLE');
    throw new Error('lead_mail_failed:LEAD_UNREADABLE');
  }

  try {
    await payload.sendEmail(buildLeadMessage(lead, config));
  } catch (error) {
    const { code, permanent } = classifyMailError(error);
    const attempts = Number(
      (await poolOf(payload).query('SELECT notification_attempts AS n FROM contact_leads WHERE id = $1', [id])).rows[0]?.n ?? 0,
    );
    if (permanent || attempts >= MAX_ATTEMPTS) {
      await settle(payload, id, 'dead', code);
      return 'dead';
    }
    await settle(payload, id, 'failed', code);
    throw new Error(`lead_mail_failed:${code}`);
  }

  await settle(payload, id, 'sent');
  return 'sent';
}

/** Queues a fresh delivery job for the lead. `req` joins the caller's transaction when given. */
export async function queueLeadNotification(payload: Payload, id: number | string, req?: unknown) {
  await payload.jobs.queue({
    task: TASK_SLUG,
    queue: LEAD_EMAIL_QUEUE,
    input: { leadId: Number(id) },
    ...(req ? { req: req as never } : {}),
  } as never);
}

/**
 * Re-queues every lead whose delivery is not finished and not currently held: covers jobs lost or stranded by a
 * crash/restart (Payload never unlocks a job left `processing`) and leads re-opened by an operator. Cheap and safe to
 * repeat: a duplicate job simply loses the claim. Returns how many jobs were queued.
 */
export async function reconcileLeadNotifications(
  payload: Payload,
  options: { quietSeconds?: number; limit?: number } = {},
): Promise<number> {
  const { quietSeconds = 0, limit = 50 } = options;
  const { rows } = await poolOf(payload).query(
    `SELECT id FROM contact_leads
      WHERE coalesce(notification_attempts, 0) < $3::int
        AND ( (notification_state IN ('pending', 'failed')
               AND coalesce(notification_last_attempt_at, created_at) < now() - ($1::int * interval '1 second'))
              OR (notification_state = 'sending' AND notification_lease_until < now()) )
      ORDER BY id LIMIT $2::int`,
    [quietSeconds, limit, MAX_ATTEMPTS],
  );
  for (const row of rows) await queueLeadNotification(payload, row.id as number);
  return rows.length;
}

/** Runs queued deliveries now. Never throws: the public request must not depend on it. */
export async function runLeadNotificationQueue(payload: Payload): Promise<void> {
  try {
    await payload.jobs.run({ queue: LEAD_EMAIL_QUEUE, limit: 5, silent: true });
  } catch (error) {
    console.error('lead notification run failed', error instanceof Error ? error.name : 'unknown');
  }
}
