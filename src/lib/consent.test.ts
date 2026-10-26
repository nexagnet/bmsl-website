import { describe, expect, it } from 'vitest';
import {
  CONSENT_MAX_AGE_MS,
  CONSENT_STORAGE_KEY,
  gaCookieNames,
  parseConsent,
  readConsent,
  writeConsent,
} from './consent';

const NOW = 1_800_000_000_000;
const memory = () => {
  const m = new Map<string, string>();
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v) };
};

describe('cookie consent storage', () => {
  it('has no decision by default (nothing granted)', () => {
    expect(readConsent(memory(), NOW)).toBeUndefined();
    expect(readConsent(undefined, NOW)).toBeUndefined();
  });

  it('round-trips grant and refusal', () => {
    for (const analytics of [true, false]) {
      const s = memory();
      expect(writeConsent(s, analytics, NOW)).toBe(true);
      expect(readConsent(s, NOW + 1000)).toEqual({ analytics, at: NOW });
    }
  });

  it('rejects malformed, wrong-version, future and expired values', () => {
    const ok = JSON.stringify({ v: 1, analytics: true, at: NOW });
    expect(parseConsent(ok, NOW)).toEqual({ analytics: true, at: NOW });
    for (const raw of [
      'nope',
      '{}',
      JSON.stringify({ v: 2, analytics: true, at: NOW }),
      JSON.stringify({ v: 1, analytics: 'yes', at: NOW }),
      JSON.stringify({ v: 1, analytics: true, at: NOW + 3_600_000 }),
      ok,
    ]) {
      const now = raw === ok ? NOW + CONSENT_MAX_AGE_MS + 1 : NOW;
      expect(parseConsent(raw, now)).toBeUndefined();
    }
  });

  it('survives blocked storage', () => {
    const blocked = {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('blocked');
      },
    };
    expect(readConsent(blocked, NOW)).toBeUndefined();
    expect(writeConsent(blocked, true, NOW)).toBe(false);
    expect(CONSENT_STORAGE_KEY).toBe('bmsl_cookie_consent');
  });

  it('finds only Google Analytics cookies', () => {
    expect(gaCookieNames('a=1; _ga=GA1.1.2; _ga_ABC123=x; _gid=3; sid=9; _gat_gtag_G_X=1')).toEqual([
      '_ga',
      '_ga_ABC123',
      '_gid',
      '_gat_gtag_G_X',
    ]);
    expect(gaCookieNames('')).toEqual([]);
  });
});
