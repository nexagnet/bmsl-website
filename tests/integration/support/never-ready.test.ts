import { describe, expect, it } from 'vitest';
import { observeNeverReady } from './never-ready';

const base = { sleep: async () => undefined, timeoutMs: 1000, intervalMs: 1 };
const clock = () => {
  let t = 0;
  return () => (t += 10);
};

describe('observeNeverReady', () => {
  it('fails immediately on a 200 even if the container later returns 503 or exits', async () => {
    const statuses = [200, 503];
    await expect(
      observeNeverReady({ ...base, now: clock(), isRunning: async () => true, probe: async () => statuses.shift() ?? 503 }),
    ).rejects.toThrow('reported /healthz 200');
    expect(statuses).toEqual([503]);
    const exiting = [true, false];
    await expect(
      observeNeverReady({ ...base, now: clock(), isRunning: async () => exiting.shift() ?? false, probe: async () => 200 }),
    ).rejects.toThrow('reported /healthz 200');
  });

  it('tolerates connection failures, then accepts 503 or an exit', async () => {
    const calls = [new TypeError('fetch failed'), Object.assign(new Error('t'), { name: 'TimeoutError' }), 503] as const;
    let i = 0;
    const probe = async () => {
      const next = calls[i++];
      if (typeof next === 'number') return next;
      throw next;
    };
    expect(await observeNeverReady({ ...base, now: clock(), isRunning: async () => true, probe })).toBe('unavailable');
    expect(await observeNeverReady({ ...base, now: clock(), isRunning: async () => false, probe })).toBe('exited');
  });

  it('does not swallow non-network errors and never passes on timeout', async () => {
    await expect(
      observeNeverReady({ ...base, now: clock(), isRunning: async () => true, probe: async () => Promise.reject(new Error('assertion')) }),
    ).rejects.toThrow('assertion');
    await expect(
      observeNeverReady({ ...base, now: clock(), isRunning: async () => true, probe: async () => Promise.reject(new TypeError('x')) }),
    ).rejects.toThrow('deadline');
  });
});
