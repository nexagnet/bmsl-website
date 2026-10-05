import type { Payload } from 'payload';
import { REQUEST_TYPES } from '../collections/ContactLeads';
import { type ContactLeadInput, createContactLead } from './contact-lead';

// Public submission path for /lien-he. Pure parsing/validation first, then durable persistence,
// then the (currently no-op) notification hook. No third-party CAPTCHA.

/** Honeypot field name: hidden from humans, so any value marks the request as bot-like. */
export const HONEYPOT_FIELD = 'website';

const LIMITS = { name: 120, phone: 20, email: 254, message: 4000, sourcePage: 200, utm: 200 } as const;
const UTM_KEYS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content'] as const;
// Vietnamese numbers: 0xxxxxxxxx or +84/84xxxxxxxxx once separators are removed.
const PHONE = /^(?:\+?84|0)\d{8,10}$/;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type ContactField = 'name' | 'phone' | 'email' | 'requestType' | 'message' | 'consent';

export type ParsedContact =
  | { kind: 'bot' }
  | { kind: 'invalid'; fields: ContactField[] }
  | { kind: 'valid'; lead: ContactLeadInput };

const str = (value: unknown): string => (typeof value === 'string' ? value.trim() : '');

const isConsent = (value: unknown): boolean => value === true || value === 'true' || value === 'on';

/** Accepts only same-site paths so the stored sourcePage cannot be an arbitrary string. */
const sourcePageOf = (value: unknown): string => {
  const page = str(value);
  return page.startsWith('/') && !page.startsWith('//') && page.length <= LIMITS.sourcePage ? page : '/lien-he';
};

const utmOf = (value: unknown): Record<string, string> | undefined => {
  if (!value || typeof value !== 'object') return undefined;
  const out: Record<string, string> = {};
  for (const key of UTM_KEYS) {
    const v = str((value as Record<string, unknown>)[key]);
    if (v) out[key] = v.slice(0, LIMITS.utm);
  }
  return Object.keys(out).length ? out : undefined;
};

export function parseContactSubmission(raw: unknown): ParsedContact {
  const body = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  if (str(body[HONEYPOT_FIELD])) return { kind: 'bot' };

  const name = str(body.name);
  const phone = str(body.phone);
  const email = str(body.email);
  const message = str(body.message);
  const requestType = str(body.requestType);
  const fields: ContactField[] = [];

  if (!name || name.length > LIMITS.name) fields.push('name');
  if (!PHONE.test(phone.replace(/[\s.\-()]/g, '')) || phone.length > LIMITS.phone) fields.push('phone');
  if (email && (email.length > LIMITS.email || !EMAIL.test(email))) fields.push('email');
  if (!(REQUEST_TYPES as readonly string[]).includes(requestType)) fields.push('requestType');
  if (!message || message.length > LIMITS.message) fields.push('message');
  if (!isConsent(body.consent)) fields.push('consent');
  if (fields.length) return { kind: 'invalid', fields };

  return {
    kind: 'valid',
    lead: {
      name,
      phone,
      email: email || undefined,
      requestType: requestType as ContactLeadInput['requestType'],
      message,
      consent: true,
      sourcePage: sourcePageOf(body.sourcePage),
      utm: utmOf(body.utm),
    },
  };
}

/** Notification hook. Disabled by default: no provider is approved yet (OWNER-DECISION). */
export type LeadNotifier = (lead: { id: number | string }) => Promise<void>;
export const noopNotifier: LeadNotifier = async () => {};

export type SubmitResult =
  | { status: 200; body: { ok: true; persisted?: true } }
  | { status: 400; body: { ok: false; fields: ContactField[] } }
  | { status: 500; body: { ok: false; error: 'persist_failed' } };

/**
 * Success is returned only after the ContactLead row is durably stored. Notification runs afterwards
 * and its failure never affects the result. Bot-like requests get the same success shape but nothing
 * is stored, so a bot learns nothing.
 */
export async function submitContact(
  payload: Payload,
  raw: unknown,
  notify: LeadNotifier = noopNotifier,
): Promise<SubmitResult> {
  const parsed = parseContactSubmission(raw);
  if (parsed.kind === 'bot') return { status: 200, body: { ok: true } };
  if (parsed.kind === 'invalid') return { status: 400, body: { ok: false, fields: parsed.fields } };

  let lead: { id: number | string };
  try {
    lead = await createContactLead(payload, parsed.lead);
  } catch (error) {
    console.error('contact lead persistence failed', error instanceof Error ? error.message : 'unknown');
    return { status: 500, body: { ok: false, error: 'persist_failed' } };
  }

  try {
    await notify(lead);
  } catch (error) {
    console.error('contact lead notification failed', error instanceof Error ? error.message : 'unknown');
  }
  // `persisted` is the only signal the client may use to emit the form_submit analytics event.
  return { status: 200, body: { ok: true, persisted: true } };
}
