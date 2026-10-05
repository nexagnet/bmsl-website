import type { CollectionConfig } from 'payload';
import { adminOnly, nobody } from '../access';

export const REQUEST_TYPES = ['khao-sat', 'bao-gia', 'khac'] as const;

// PII-capable durable business data (blueprint 06 §5). Provisional security defaults, NOT BMSL decisions:
// - read/update: ADMIN only (EDITOR visibility is an OPEN OWNER-DECISION; no extra privilege granted);
// - delete: nobody via API (retention/deletion policy is an OPEN OWNER-DECISION);
// - create: ADMIN or trusted server code via the Local API (see lib/contact-lead.ts). No public
//   REST/GraphQL create until W4 adds anti-spam.
export const ContactLeads: CollectionConfig = {
  slug: 'contact-leads',
  admin: { useAsTitle: 'name' },
  access: { read: adminOnly, create: adminOnly, update: adminOnly, delete: nobody },
  fields: [
    { name: 'name', type: 'text', required: true },
    { name: 'phone', type: 'text', required: true },
    { name: 'email', type: 'email' },
    {
      name: 'requestType',
      type: 'select',
      required: true,
      options: [...REQUEST_TYPES],
    },
    { name: 'message', type: 'textarea', required: true },
    {
      name: 'consent',
      type: 'group',
      fields: [
        { name: 'given', type: 'checkbox', required: true },
        { name: 'at', type: 'date', required: true },
      ],
    },
    { name: 'sourcePage', type: 'text', required: true },
    { name: 'utm', type: 'json' },
    {
      name: 'status',
      type: 'select',
      required: true,
      defaultValue: 'new',
      options: ['new', 'handled'],
    },
    { name: 'spamScore', type: 'number' },
  ],
};
