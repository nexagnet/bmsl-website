import { describe, expect, it } from 'vitest';
import { checkReadiness, readinessResponse } from './readiness';

const expected = ['a', 'b'];

describe('checkReadiness', () => {
  it('is ready only when every committed migration is applied', async () => {
    expect(await checkReadiness({ expectedMigrations: expected, appliedMigrations: async () => ['a', 'b', 'c'] })).toEqual({ ready: true });
    expect(await checkReadiness({ expectedMigrations: expected, appliedMigrations: async () => ['a'] })).toEqual({ ready: false });
    expect(await checkReadiness({ expectedMigrations: expected, appliedMigrations: async () => [] })).toEqual({ ready: false });
  });

  it('is not ready (and never throws) when the database query fails', async () => {
    const r = await checkReadiness({
      expectedMigrations: expected,
      appliedMigrations: async () => {
        throw new Error('connect ECONNREFUSED postgresql://user:secret@db:5432/x');
      },
    });
    expect(r).toEqual({ ready: false });
  });

  it('is not ready when the query hangs past the timeout', async () => {
    const r = await checkReadiness({ expectedMigrations: expected, appliedMigrations: () => new Promise(() => undefined), timeoutMs: 20 });
    expect(r).toEqual({ ready: false });
  });
});

describe('readinessResponse', () => {
  it('answers 200 / 503 with a fixed, no-store, detail-free body', async () => {
    const ok = readinessResponse({ ready: true });
    const down = readinessResponse({ ready: false });
    expect([ok.status, down.status]).toEqual([200, 503]);
    expect(ok.headers.get('cache-control')).toBe('no-store');
    expect(await ok.json()).toEqual({ status: 'ok' });
    expect(await down.text()).toBe('{"status":"unavailable"}');
  });
});
