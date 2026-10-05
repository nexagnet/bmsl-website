import { describe, expect, it } from 'vitest';
import type { PayloadRequest } from 'payload';
import { adminOnly, adminOrSelf, isAdmin, isStaff, nobody, publishedOrStaff, staffOnly } from './index';

const req = (user: unknown) => ({ req: { user } as unknown as PayloadRequest }) as never;
const admin = { id: 1, collection: 'users', role: 'ADMIN' };
const editor = { id: 2, collection: 'users', role: 'EDITOR' };

describe('role helpers', () => {
  it('recognises only users-collection ADMIN/EDITOR roles', () => {
    expect(isAdmin(admin)).toBe(true);
    expect(isAdmin(editor)).toBe(false);
    expect(isStaff(editor)).toBe(true);
    expect(isStaff({ collection: 'users', role: 'OWNER' })).toBe(false);
    expect(isStaff({ collection: 'other', role: 'ADMIN' })).toBe(false);
    expect(isStaff(null)).toBe(false);
  });
});

describe('access functions', () => {
  it('adminOnly allows ADMIN only', () => {
    expect(adminOnly(req(admin))).toBe(true);
    expect(adminOnly(req(editor))).toBe(false);
    expect(adminOnly(req(undefined))).toBe(false);
  });

  it('staffOnly allows ADMIN and EDITOR', () => {
    expect(staffOnly(req(admin))).toBe(true);
    expect(staffOnly(req(editor))).toBe(true);
    expect(staffOnly(req(undefined))).toBe(false);
  });

  it('publishedOrStaff restricts the public to published documents', () => {
    expect(publishedOrStaff(req(editor))).toBe(true);
    expect(publishedOrStaff(req(undefined))).toEqual({ _status: { equals: 'published' } });
  });

  it('adminOrSelf scopes EDITOR to their own record', () => {
    expect(adminOrSelf(req(admin))).toBe(true);
    expect(adminOrSelf(req(editor))).toEqual({ id: { equals: 2 } });
    expect(adminOrSelf(req(undefined))).toBe(false);
  });

  it('nobody denies everyone', () => {
    expect(nobody(req(admin))).toBe(false);
  });
});
