import { describe, expect, it } from 'vitest';
import { BOOTSTRAP_TOKEN_MIN_LENGTH, decideUserCreation, tokenMatches } from './bootstrap';

const token = 'synthetic-bootstrap-token-0123456789abcdef';
const base = { api: 'REST', userCount: 0, requesterIsAdmin: false, headerToken: token, configuredToken: token };

describe('initial ADMIN bootstrap policy', () => {
  it('the token must be long enough and exactly equal', () => {
    expect(token.length).toBeGreaterThanOrEqual(BOOTSTRAP_TOKEN_MIN_LENGTH);
    expect(tokenMatches(token, token)).toBe(true);
    expect(tokenMatches(`${token}x`, token)).toBe(false);
    expect(tokenMatches(null, token)).toBe(false);
    expect(tokenMatches('short', 'short')).toBe(false);
    expect(tokenMatches('', '')).toBe(false);
  });

  it('HTTP first-register is accepted only with the configured token, and then forces ADMIN', () => {
    expect(decideUserCreation(base)).toEqual({ allow: true, forceAdmin: true });
    expect(decideUserCreation({ ...base, headerToken: undefined })).toEqual({ allow: false, reason: 'bad-token' });
    expect(decideUserCreation({ ...base, headerToken: 'wrong-wrong-wrong-wrong-wrong-wrong-0' })).toEqual({
      allow: false,
      reason: 'bad-token',
    });
  });

  it('is closed over HTTP when the operator configured no (or a weak) token: no invented default', () => {
    expect(decideUserCreation({ ...base, configuredToken: undefined })).toEqual({ allow: false, reason: 'bootstrap-closed' });
    expect(decideUserCreation({ ...base, configuredToken: '', headerToken: '' })).toEqual({ allow: false, reason: 'bootstrap-closed' });
    expect(decideUserCreation({ ...base, configuredToken: 'short', headerToken: 'short' })).toEqual({
      allow: false,
      reason: 'bootstrap-closed',
    });
  });

  it('once initialised, an unauthenticated HTTP create is refused even with the right token', () => {
    expect(decideUserCreation({ ...base, userCount: 1 })).toEqual({ allow: false, reason: 'initialized' });
    expect(decideUserCreation({ ...base, userCount: 1, headerToken: undefined, configuredToken: undefined })).toEqual({
      allow: false,
      reason: 'initialized',
    });
  });

  it('an authenticated ADMIN creates normal accounts (never auto-promoted); the local API bootstraps the first ADMIN', () => {
    expect(decideUserCreation({ ...base, userCount: 3, requesterIsAdmin: true })).toEqual({ allow: true, forceAdmin: false });
    expect(decideUserCreation({ ...base, api: 'local', userCount: 0, configuredToken: undefined })).toEqual({
      allow: true,
      forceAdmin: true,
    });
    expect(decideUserCreation({ ...base, api: 'local', userCount: 2 })).toEqual({ allow: true, forceAdmin: false });
  });
});
