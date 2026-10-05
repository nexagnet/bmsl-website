import { describe, expect, it } from 'vitest';
import { getDatabaseUrl } from './database';

describe('getDatabaseUrl', () => {
  it('returns the configured URL', () => {
    expect(getDatabaseUrl({ DATABASE_URL: 'postgresql://u:p@localhost:5432/d' })).toBe(
      'postgresql://u:p@localhost:5432/d',
    );
  });

  it('throws when DATABASE_URL is missing or blank', () => {
    expect(() => getDatabaseUrl({})).toThrow('DATABASE_URL is required');
    expect(() => getDatabaseUrl({ DATABASE_URL: '  ' })).toThrow('DATABASE_URL is required');
  });
});
