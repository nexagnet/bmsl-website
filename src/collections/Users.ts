import type { CollectionConfig } from 'payload';
import { adminOnly, adminOnlyField, adminOrSelf, ROLES, staffOnly } from '../access';

// Provisional security default (not a BMSL business decision): only ADMIN manages users.
// An EDITOR can sign in to the admin panel and read only their own record.
export const Users: CollectionConfig = {
  slug: 'users',
  admin: { useAsTitle: 'email' },
  auth: { maxLoginAttempts: 5, lockTime: 10 * 60 * 1000, tokenExpiration: 7200 },
  access: {
    admin: staffOnly,
    create: adminOnly,
    read: adminOrSelf,
    update: adminOnly,
    delete: adminOnly,
  },
  hooks: {
    beforeValidate: [
      // Bootstrap: the very first account is the top-level ADMIN handed to BMSL.
      async ({ data, operation, req }) => {
        if (operation !== 'create') return data;
        const { totalDocs } = await req.payload.count({
          collection: 'users',
          overrideAccess: true,
          req,
        });
        return totalDocs === 0 ? { ...data, role: 'ADMIN' } : data;
      },
    ],
  },
  fields: [
    {
      name: 'role',
      type: 'select',
      required: true,
      defaultValue: 'EDITOR',
      options: ROLES.map((r) => ({ label: r, value: r })),
      access: { create: adminOnlyField, update: adminOnlyField },
    },
  ],
};
