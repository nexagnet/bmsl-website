import { sql } from '@payloadcms/db-postgres/drizzle';
import { Forbidden, type CollectionConfig } from 'payload';
import { adminOnly, adminOnlyField, adminOrSelf, isAdmin, ROLES, staffOnly } from '../access';
import {
  BOOTSTRAP_LOCK_KEY,
  BOOTSTRAP_TOKEN_ENV,
  BOOTSTRAP_TOKEN_HEADER,
  decideUserCreation,
} from '../lib/bootstrap';

type TransactionSessions = Record<string, { db: { execute: (query: unknown) => Promise<unknown> } } | undefined>;

// Provisional security default (not a BMSL business decision): only ADMIN manages users.
// An EDITOR can sign in to the admin panel and read only their own record.
export const Users: CollectionConfig = {
  slug: 'users',
  labels: { singular: 'Tài khoản', plural: 'Tài khoản' },
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
      // Bootstrap (see src/lib/bootstrap.ts): the very first account is the top-level ADMIN handed to BMSL. Over HTTP
      // it needs the operator-provisioned token; once any user exists no unauthenticated request can create one.
      // The PostgreSQL advisory lock is held until the surrounding transaction ends, so concurrent first-register
      // requests are serialised and the loser counts the winner's committed user.
      async ({ data, operation, req }) => {
        if (operation !== 'create') return data;
        const sessions = (req.payload.db as unknown as { sessions?: TransactionSessions }).sessions;
        const transaction = req.transactionID ? sessions?.[String(await req.transactionID)]?.db : undefined;
        if (transaction) await transaction.execute(sql`select pg_advisory_xact_lock(${BOOTSTRAP_LOCK_KEY})`);
        else if (req.payloadAPI !== 'local') throw new Forbidden(req.t); // fail closed: creation cannot be serialised
        const { totalDocs } = await req.payload.count({ collection: 'users', overrideAccess: true, req });
        const decision = decideUserCreation({
          api: req.payloadAPI,
          userCount: totalDocs,
          requesterIsAdmin: isAdmin(req.user),
          headerToken: req.headers.get(BOOTSTRAP_TOKEN_HEADER),
          configuredToken: process.env[BOOTSTRAP_TOKEN_ENV],
        });
        if (!decision.allow) throw new Forbidden(req.t);
        return decision.forceAdmin ? { ...data, role: 'ADMIN' } : data;
      },
    ],
  },
  fields: [
    {
      name: 'role',
      type: 'select',
      required: true,
      defaultValue: 'EDITOR',
      label: 'Vai trò',
      options: ROLES.map((r) => ({ label: r === 'ADMIN' ? 'Quản trị viên (ADMIN)' : 'Biên tập viên (EDITOR)', value: r })),
      admin: { description: 'Chỉ quản trị viên được đổi vai trò. Biên tập viên chỉ xem được tài khoản của chính mình.' },
      access: { create: adminOnlyField, update: adminOnlyField },
    },
  ],
};
