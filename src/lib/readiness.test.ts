import { describe, expect, it } from 'vitest';
import { checkReadiness, readinessResponse, singleflight } from './readiness';

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

describe('singleflight', () => {
  it('runs the work once for concurrent callers, keeps the slot while it is stuck, and releases it when it settles', async () => {
    let runs = 0;
    let release!: (v: string[]) => void;
    const probe = singleflight(
      () =>
        new Promise<string[]>((resolve) => {
          runs += 1;
          release = resolve;
        }),
    );
    const many = Array.from({ length: 20 }, () => probe());
    expect(runs).toBe(1);
    // A caller that timed out does not free the slot: another probe still shares the same stuck work.
    expect(await checkReadiness({ expectedMigrations: expected, appliedMigrations: probe, timeoutMs: 10 })).toEqual({ ready: false });
    expect(runs).toBe(1);
    release(['a', 'b']);
    expect((await Promise.all(many)).every((r) => r.length === 2)).toBe(true);
    const next = probe();
    expect(runs).toBe(2);
    release(['a', 'b']);
    await next;
  });

  it('releases the slot after a failure so a later probe can recover', async () => {
    let runs = 0;
    const probe = singleflight(async () => {
      runs += 1;
      if (runs === 1) throw new Error('down');
      return ['a', 'b'];
    });
    expect(await checkReadiness({ expectedMigrations: expected, appliedMigrations: probe })).toEqual({ ready: false });
    expect(await checkReadiness({ expectedMigrations: expected, appliedMigrations: probe })).toEqual({ ready: true });
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
