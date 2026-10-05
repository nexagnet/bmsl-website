import { describe, expect, it } from 'vitest';
import { getPayloadEnv, resolvePayloadEnv } from './env';

const ok = { DATABASE_URL: 'postgresql://u:p@localhost:5432/d', PAYLOAD_SECRET: 'synthetic-secret' };

describe('getPayloadEnv', () => {
  it('returns configured values', () => {
    expect(getPayloadEnv(ok)).toEqual({
      databaseUrl: ok.DATABASE_URL,
      payloadSecret: 'synthetic-secret',
    });
  });

  it('throws a clear error when DATABASE_URL or PAYLOAD_SECRET is missing or blank', () => {
    expect(() => getPayloadEnv({ PAYLOAD_SECRET: 's' })).toThrow('DATABASE_URL is required');
    expect(() => getPayloadEnv({ DATABASE_URL: 'x' })).toThrow('PAYLOAD_SECRET is required');
    expect(() => getPayloadEnv({ ...ok, PAYLOAD_SECRET: '  ' })).toThrow(
      'PAYLOAD_SECRET is required',
    );
  });
});

describe('resolvePayloadEnv', () => {
  it('fails fast outside the build phase', () => {
    expect(() => resolvePayloadEnv({})).toThrow('DATABASE_URL is required');
  });

  it('allows inert placeholders only during next build', () => {
    const env = resolvePayloadEnv({ NEXT_PHASE: 'phase-production-build' });
    expect(env.databaseUrl).toContain('build-only');
    expect(env.payloadSecret).toContain('build-only');
  });
});
