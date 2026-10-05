import { describe, expect, it } from 'vitest';
import {
  assertSafeAdminUrl,
  assertWorkerTarget,
  databaseUrlFor,
  INVOCATION_DB,
  newInvocationDatabaseName,
} from './disposable-db';
import { createOwnedDatabase, dropDisposableDatabase, ownsDatabase, waitForNoSessions } from './db-lifecycle';

// Pure (no PostgreSQL needed): the safety rules of the integration entrypoint and the ownership gate of the drop
// helpers. A fake admin client records every statement so we can prove nothing was executed for refused targets.

const fakeAdmin = (fail = false) => {
  const statements: string[] = [];
  const client = {
    statements,
    query: async (text: string) => {
      statements.push(text);
      if (fail && text.startsWith('create database')) throw new Error('database "x" already exists');
      return { rows: [] };
    },
  };
  return client as unknown as import('pg').Client & { statements: string[] };
};

describe('invocation database naming', () => {
  it('is random, prefixed and matches the invocation pattern', () => {
    const a = newInvocationDatabaseName();
    expect(a).toMatch(INVOCATION_DB);
    expect(newInvocationDatabaseName()).not.toBe(a);
  });
});

describe('administrative URL safety', () => {
  it('accepts an explicit local postgres URL naming a database', () => {
    expect(assertSafeAdminUrl('postgresql://u:p@localhost:5432/bmsl_test').hostname).toBe('localhost');
    expect(assertSafeAdminUrl('postgres://u:p@127.0.0.1/bmsl_test').pathname).toBe('/bmsl_test');
    expect(assertSafeAdminUrl('postgres://u:p@[::1]:5432/bmsl_test').hostname).toBe('[::1]');
  });

  it.each([
    [undefined, /required/],
    ['', /required/],
    ['not a url', /not a valid URL/],
    ['mysql://u:p@localhost/db', /postgres/],
    ['postgresql://u:p@db.example.com:5432/bmsl', /non-local host/],
    ['postgresql://u:p@10.0.0.5:5432/bmsl', /non-local host/],
    ['postgresql://u:p@localhost.evil.test/bmsl', /non-local host/],
    ['postgresql://u:p@localhost:5432/', /name a database/],
    ['postgresql://u:p@localhost:5432/bmsl?host=db.example.com', /override its target via host/],
    ['postgresql://u:p@localhost:5432/bmsl?hostaddr=10.0.0.5&service=prod', /hostaddr, service/],
    ['postgresql://u:p@localhost:5432/bmsl_it_0123456789abcdef', /nest/],
  ])('rejects %s', (raw, message) => {
    expect(() => assertSafeAdminUrl(raw)).toThrow(message);
  });

  it('derives the invocation URL without changing host, credentials or port', () => {
    const admin = assertSafeAdminUrl('postgresql://u:p@localhost:5433/bmsl_test');
    expect(databaseUrlFor(admin, 'bmsl_it_0123456789abcdef')).toBe('postgresql://u:p@localhost:5433/bmsl_it_0123456789abcdef');
  });
});

describe('worker target check', () => {
  const name = 'bmsl_it_0123456789abcdef';
  it('accepts only the invocation database', () => {
    expect(() => assertWorkerTarget(`postgresql://u:p@localhost:5432/${name}`, name)).not.toThrow();
  });

  it('rejects the shared database, another invocation database, a remote host and a missing entrypoint', () => {
    expect(() => assertWorkerTarget('postgresql://u:p@localhost:5432/bmsl_test', name)).toThrow(/not the invocation database/);
    expect(() => assertWorkerTarget('postgresql://u:p@localhost:5432/bmsl_it_ffffffffffffffff', name)).toThrow(/not the invocation database/);
    expect(() => assertWorkerTarget(`postgresql://u:p@db.example.com:5432/${name}`, name)).toThrow(/not local/);
    expect(() => assertWorkerTarget(undefined, name)).toThrow(/did not provide/);
    expect(() => assertWorkerTarget(`postgresql://u:p@localhost:5432/${name}`, undefined)).toThrow(/did not provide/);
  });
});

describe('ownership: a disposable-looking name is not ownership', () => {
  it('refuses to drop a database with a valid prefix that this run did not create, and executes nothing', async () => {
    const admin = fakeAdmin();
    await expect(dropDisposableDatabase(admin, 'bmsl_it_aaaaaaaaaaaaaaaa')).rejects.toThrow(/not created by this run/);
    await expect(dropDisposableDatabase(admin, 'bmsl_http_smoke_aaaaaaaaaaaa')).rejects.toThrow(/not created by this run/);
    expect(admin.statements).toEqual([]);
  });

  it('refuses names outside the disposable pattern even when asked to create or drop them', async () => {
    const admin = fakeAdmin();
    for (const name of ['postgres', 'bmsl', 'bmsl_test', 'bmsl_it_short', 'bmsl_it_0123456789abcdef"; drop database x; --']) {
      await expect(createOwnedDatabase(admin, name), name).rejects.toThrow(/non-disposable/);
      await expect(dropDisposableDatabase(admin, name), name).rejects.toThrow(/non-disposable/);
      await expect(waitForNoSessions(admin, name), name).rejects.toThrow(/non-disposable/);
    }
    expect(admin.statements).toEqual([]);
  });

  it('a CREATE that failed (for example because the database already existed) is never recorded as owned', async () => {
    const admin = fakeAdmin(true);
    await expect(createOwnedDatabase(admin, 'bmsl_it_bbbbbbbbbbbbbbbb')).rejects.toThrow(/already exists/);
    expect(ownsDatabase('bmsl_it_bbbbbbbbbbbbbbbb')).toBe(false);
    await expect(dropDisposableDatabase(admin, 'bmsl_it_bbbbbbbbbbbbbbbb')).rejects.toThrow(/not created by this run/);
    expect(admin.statements.some((s) => s.startsWith('drop database'))).toBe(false);
  });

  it('after a successful CREATE the database is owned and is dropped exactly once, only when no session remains', async () => {
    const admin = fakeAdmin();
    await createOwnedDatabase(admin, 'bmsl_it_cccccccccccccccc');
    expect(ownsDatabase('bmsl_it_cccccccccccccccc')).toBe(true);
    await dropDisposableDatabase(admin, 'bmsl_it_cccccccccccccccc', 1000);
    expect(admin.statements.filter((s) => s.startsWith('drop database'))).toEqual(['drop database if exists "bmsl_it_cccccccccccccccc"']);
    expect(ownsDatabase('bmsl_it_cccccccccccccccc')).toBe(false);
    await expect(dropDisposableDatabase(admin, 'bmsl_it_cccccccccccccccc')).rejects.toThrow(/not created by this run/);
  });
});
