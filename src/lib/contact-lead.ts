import type { Payload } from 'payload';
import { REQUEST_TYPES } from '../collections/ContactLeads';

export type ContactLeadInput = {
  name: string;
  phone: string;
  email?: string;
  requestType: (typeof REQUEST_TYPES)[number];
  message: string;
  consent: boolean;
  sourcePage: string;
  utm?: Record<string, string>;
  spamScore?: number;
};

export function validateContactLead(input: ContactLeadInput): void {
  if (!input.name?.trim()) throw new Error('name is required');
  if (!input.phone?.trim()) throw new Error('phone is required');
  if (!input.message?.trim()) throw new Error('message is required');
  if (!input.sourcePage?.trim()) throw new Error('sourcePage is required');
  if (!REQUEST_TYPES.includes(input.requestType)) throw new Error('requestType is invalid');
  if (input.consent !== true) throw new Error('consent is required');
}

/**
 * Persists the lead in PostgreSQL via the Local API (trusted server code). Notification side effects,
 * when added later, must run only after this resolves, and their failure must never lose the lead.
 */
export async function createContactLead(payload: Payload, input: ContactLeadInput) {
  validateContactLead(input);
  return payload.create({
    collection: 'contact-leads',
    overrideAccess: true,
    data: {
      name: input.name.trim(),
      phone: input.phone.trim(),
      email: input.email?.trim() || undefined,
      requestType: input.requestType,
      message: input.message.trim(),
      consent: { given: true, at: new Date().toISOString() },
      sourcePage: input.sourcePage.trim(),
      utm: input.utm,
      spamScore: input.spamScore,
      status: 'new',
    },
  });
}
