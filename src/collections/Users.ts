import type { CollectionConfig } from 'payload';

// Auth only. Roles (ADMIN/EDITOR) and access policy are a separate task contract.
export const Users: CollectionConfig = {
  slug: 'users',
  admin: { useAsTitle: 'email' },
  auth: true,
  fields: [],
};
