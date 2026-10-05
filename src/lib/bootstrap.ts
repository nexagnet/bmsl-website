import { createHash, timingSafeEqual } from 'node:crypto';

// Initial ADMIN bootstrap policy (W5B2). Payload's public POST /api/users/first-register creates the first user with
// overrideAccess while the users table is empty, so on an uninitialised public site anyone could claim ADMIN. Over
// HTTP the first account is therefore only accepted with an operator-provisioned secret. No default secret exists:
// without INITIAL_ADMIN_BOOTSTRAP_TOKEN the HTTP bootstrap is closed and the first ADMIN must be created through the
// local API (operator CLI/seed), which is not reachable from the network.

export const BOOTSTRAP_TOKEN_ENV = 'INITIAL_ADMIN_BOOTSTRAP_TOKEN';
export const BOOTSTRAP_TOKEN_HEADER = 'x-bootstrap-token';
export const BOOTSTRAP_TOKEN_MIN_LENGTH = 32;

/** Stable key of the PostgreSQL advisory lock that serialises concurrent first-account creations. */
export const BOOTSTRAP_LOCK_KEY = 5_201_005_001;

export type BootstrapInput = {
  /** Payload's req.payloadAPI: 'REST' | 'GraphQL' | 'local'. */
  api: string | undefined;
  /** Number of existing users, counted after the bootstrap lock was taken. */
  userCount: number;
  requesterIsAdmin: boolean;
  headerToken: string | null | undefined;
  configuredToken: string | undefined;
};

export type BootstrapDecision =
  | { allow: true; forceAdmin: boolean }
  | { allow: false; reason: 'initialized' | 'bootstrap-closed' | 'bad-token' };

const digest = (value: string) => createHash('sha256').update(value).digest();

const usableToken = (configured: string | undefined): string | undefined => {
  const value = configured?.trim();
  return value && value.length >= BOOTSTRAP_TOKEN_MIN_LENGTH ? value : undefined;
};

/** Constant-time comparison; the configured token must also be long enough to be an operator-generated secret. */
export function tokenMatches(provided: string | null | undefined, configured: string | undefined): boolean {
  const expected = usableToken(configured);
  if (!expected || !provided) return false;
  return timingSafeEqual(digest(provided.trim()), digest(expected));
}

export function decideUserCreation(input: BootstrapInput): BootstrapDecision {
  if (input.api === 'local') return { allow: true, forceAdmin: input.userCount === 0 };
  if (input.requesterIsAdmin) return { allow: true, forceAdmin: false };
  // A network request that is not an authenticated ADMIN can only ever be the first-register bootstrap.
  if (input.userCount > 0) return { allow: false, reason: 'initialized' };
  if (!usableToken(input.configuredToken)) return { allow: false, reason: 'bootstrap-closed' };
  return tokenMatches(input.headerToken, input.configuredToken)
    ? { allow: true, forceAdmin: true }
    : { allow: false, reason: 'bad-token' };
}
