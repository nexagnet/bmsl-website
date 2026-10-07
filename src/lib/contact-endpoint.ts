import type { Payload } from 'payload';
import {
  BodyTooLargeError,
  createRateLimiter,
  isJsonContentType,
  isSameSiteRequest,
  rateLimitFromEnv,
  readBoundedBody,
} from './request-guard';
import { type LeadNotifier, submitContact } from './contact-submission';
import { resolveLeadEmailConfig } from './lead-email-config';
import { runLeadNotificationQueue } from './lead-notification';

// HTTP layer of the write-only /lien-he/gui endpoint. Every failure answers with a fixed, PII-free JSON body, and
// nothing in this file logs request content.

export const MAX_BODY_BYTES = 16_384;

const fail = (status: number, extra: Record<string, unknown> = {}, headers?: HeadersInit) =>
  Response.json({ ok: false, ...extra }, { status, headers });

type Deps = {
  getPayload: () => Promise<Payload>;
  allow?: () => boolean;
  /** Injectable notifier (tests). Default: nudge the durable queue; see below. */
  notify?: (payload: Payload) => LeadNotifier;
};

// The durable work (outbox row + queued job) was already committed with the lead. This only asks the queue to run it now
// instead of waiting for the next autoRun tick; it is not awaited, never throws and does nothing while e-mail is OFF.
const defaultNotify = (payload: Payload): LeadNotifier => async () => {
  if (resolveLeadEmailConfig().enabled) void runLeadNotificationQueue(payload);
};

let sharedLimiter: ReturnType<typeof createRateLimiter> | undefined;
const defaultAllow = () => (sharedLimiter ??= createRateLimiter(rateLimitFromEnv())).allow();

export async function handleContactPost(request: Request, deps: Deps): Promise<Response> {
  if (!isSameSiteRequest(request)) return fail(403, { error: 'forbidden_origin' });
  if (!isJsonContentType(request)) return fail(415, { error: 'unsupported_media_type' });

  let text: string;
  try {
    text = await readBoundedBody(request, MAX_BODY_BYTES);
  } catch (error) {
    if (error instanceof BodyTooLargeError) return fail(413, { fields: [] });
    return fail(400, { fields: [] });
  }

  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return fail(400, { fields: [] });
  }
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) return fail(400, { fields: [] });

  // Counted only for well-formed, same-site JSON and before any database work, so an abuse burst
  // never reaches PostgreSQL.
  if (!(deps.allow ?? defaultAllow)()) return fail(429, { error: 'rate_limited' }, { 'retry-after': '60' });

  let payload: Payload;
  try {
    payload = await deps.getPayload();
  } catch {
    console.error('contact backend initialisation failed');
    return fail(503, { error: 'unavailable' }, { 'retry-after': '30' });
  }

  try {
    const result = await submitContact(payload, raw, (deps.notify ?? defaultNotify)(payload));
    return Response.json(result.body, { status: result.status });
  } catch {
    console.error('contact submission failed unexpectedly');
    return fail(500, { error: 'persist_failed' });
  }
}
