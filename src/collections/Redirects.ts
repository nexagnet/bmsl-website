import type { CollectionConfig } from 'payload';
import { adminOnly } from '../access';

export const Redirects: CollectionConfig = {
  slug: 'redirects',
  admin: { useAsTitle: 'from' },
  access: { read: adminOnly, create: adminOnly, update: adminOnly, delete: adminOnly },
  fields: [
    { name: 'from', type: 'text', required: true, unique: true, index: true },
    { name: 'to', type: 'text', required: true },
    { name: 'type', type: 'select', required: true, defaultValue: '301', options: ['301'] },
  ],
};
