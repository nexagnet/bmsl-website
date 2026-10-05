export type PayloadEnv = { databaseUrl: string; payloadSecret: string };

function required(env: Record<string, string | undefined>, name: string): string {
  const value = env[name]?.trim();
  if (!value) throw new Error(`${name} is required (Payload CMS cannot start without it)`);
  return value;
}

/** Fails fast on missing runtime configuration; never falls back to empty strings. */
export function getPayloadEnv(env: Record<string, string | undefined> = process.env): PayloadEnv {
  return {
    databaseUrl: required(env, 'DATABASE_URL'),
    payloadSecret: required(env, 'PAYLOAD_SECRET'),
  };
}

/**
 * `next build` imports the Payload config to collect route data without a database.
 * Only that phase may use inert build-only values; every runtime path still fails fast.
 */
export function resolvePayloadEnv(env: Record<string, string | undefined> = process.env): PayloadEnv {
  if (env.NEXT_PHASE === 'phase-production-build') {
    return {
      databaseUrl:
        env.DATABASE_URL?.trim() || 'postgresql://build-only:build-only@127.0.0.1:5432/build_only',
      payloadSecret: env.PAYLOAD_SECRET?.trim() || 'build-only-not-a-runtime-secret',
    };
  }
  return getPayloadEnv(env);
}
