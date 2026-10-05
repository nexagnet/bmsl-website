import type { Access, FieldAccess } from 'payload';

export const ROLES = ['ADMIN', 'EDITOR'] as const;
export type Role = (typeof ROLES)[number];

type MaybeUser = { collection?: string; role?: unknown; id?: unknown } | null | undefined;

export const roleOf = (user: MaybeUser): Role | null =>
  user && user.collection === 'users' && (ROLES as readonly unknown[]).includes(user.role)
    ? (user.role as Role)
    : null;

export const isAdmin = (user: MaybeUser): boolean => roleOf(user) === 'ADMIN';
export const isStaff = (user: MaybeUser): boolean => roleOf(user) !== null;

export const adminOnly: Access = ({ req }) => isAdmin(req.user);
export const staffOnly = ({ req }: { req: { user?: MaybeUser } }): boolean => isStaff(req.user);
export const nobody: Access = () => false;
export const adminOnlyField: FieldAccess = ({ req }) => isAdmin(req.user);

/** Staff read everything (drafts included); the public reads published documents only. */
export const publishedOrStaff: Access = ({ req }) =>
  isStaff(req.user) ? true : { _status: { equals: 'published' } };

/** ADMIN reads all users; EDITOR reads only their own record; everyone else nothing. */
export const adminOrSelf: Access = ({ req }) => {
  if (isAdmin(req.user)) return true;
  if (isStaff(req.user) && req.user) return { id: { equals: req.user.id } };
  return false;
};
