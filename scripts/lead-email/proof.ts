import { getPayload } from 'payload';
import config from '../../src/payload.config';
import { handleContactPost } from '../../src/lib/contact-endpoint';

// LOCAL PROOF for Issue #82 (synthetic data only; refuses anything but the throwaway Docker stack on loopback).
//   payload run scripts/lead-email/proof.ts -- submit    submit ONE synthetic lead through the public endpoint code
//   payload run scripts/lead-email/proof.ts -- recover   start a fresh process; wait for the queued mail to arrive
//   payload run scripts/lead-email/proof.ts -- status    print the outbox state of every lead (no lead content)
// Run `submit` while Mailpit is stopped, restart nothing but the process, start Mailpit, then run `recover`.

const phase = process.argv.at(-1);
const MAILPIT_API = process.env.MAILPIT_API ?? 'http://127.0.0.1:18026';
const host = new URL(process.env.DATABASE_URL ?? 'postgresql://invalid').hostname;
if (!['127.0.0.1', 'localhost', '::1'].includes(host) || !MAILPIT_API.startsWith('http://127.0.0.1')) {
  throw new Error('Refusing to run: the proof only targets the local throwaway stack');
}

const payload = await getPayload({ config });
const pool = (payload.db as unknown as { pool: { query: (sql: string) => Promise<{ rows: unknown[] }> } }).pool;
const rows = async () =>
  (await pool.query('select id, notification_state as state, notification_attempts as attempts, notification_last_error as error from contact_leads order by id')).rows;
const mailpitCount = async () => {
  try {
    return ((await (await fetch(`${MAILPIT_API}/api/v1/messages`)).json()) as { total: number }).total;
  } catch {
    return 'mailpit-unreachable';
  }
};
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

if (phase === 'submit') {
  const response = await handleContactPost(
    new Request('http://localhost/lien-he/gui', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        name: 'Synthetic Proof Lead',
        phone: '0900000042',
        requestType: 'khao-sat',
        message: 'Synthetic proof message, no real person.',
        consent: true,
        sourcePage: '/lien-he',
      }),
    }),
    { getPayload: async () => payload, allow: () => true },
  );
  console.log('submit ->', response.status, JSON.stringify(await response.json()));
  await sleep(6000); // let the fire-and-forget queue run attempt (and fail while Mailpit is down) finish
  console.log('outbox after submit:', JSON.stringify(await rows()), 'mailpit messages:', await mailpitCount());
} else if (phase === 'recover') {
  // onInit already swept (reconcile + run) when this instance started; give the queue time to deliver.
  for (let i = 0; i < 20; i += 1) {
    const state = (await rows() as { state: string }[]).map((r) => r.state);
    if (state.length && state.every((s) => s === 'sent')) break;
    await sleep(1000);
  }
  console.log('outbox after restart:', JSON.stringify(await rows()), 'mailpit messages:', await mailpitCount());
} else {
  console.log('outbox:', JSON.stringify(await rows()), 'mailpit messages:', await mailpitCount());
}
await payload.destroy();
process.exit(0);
