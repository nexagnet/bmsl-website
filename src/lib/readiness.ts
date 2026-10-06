// Production readiness for platform health checks (Northflank). Ready means the app's own initialized Payload
// runtime (shared adapter pool, committed migrations applied at init by prodMigrations) answers a query AND every
// committed migration is recorded as applied. The body is a fixed, minimal string: no database, credential, error
// or migration detail is ever exposed. No new pool/client is created: the Payload adapter's pool is reused.
//
// Bounding: the HTTP-level timeout below only stops WAITING. The database work itself is bounded by the route (a
// transaction with SET LOCAL lock_timeout/statement_timeout, and the pool connectionTimeoutMillis for acquisition),
// and `singleflight` guarantees at most one probe query is ever outstanding, however many probes arrive.

export type ReadinessDeps = {
  /** Runs a read-only query on the already initialized Payload database; rejects on any failure. */
  appliedMigrations: () => Promise<string[]>;
  /** Names of the committed migrations (src/migrations) the running build expects. */
  expectedMigrations: readonly string[];
  timeoutMs?: number;
};

export const READINESS_TIMEOUT_MS = 3000;
/** Server-side bounds for the probe query; both are below READINESS_TIMEOUT_MS so the database work ends first. */
export const READINESS_DB_TIMEOUT_MS = 2000;

export type Readiness = { ready: boolean };

const withTimeout = <T>(work: Promise<T>, ms: number): Promise<T> =>
  new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('readiness timeout')), ms);
    work.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error: unknown) => {
        clearTimeout(timer);
        reject(error instanceof Error ? error : new Error('readiness failure'));
      },
    );
  });

/**
 * Shares one in-flight run between all concurrent callers. The slot is released only when the underlying work
 * settles (not when a caller times out), so a stuck query can never be multiplied by repeated probes.
 */
export function singleflight<T>(run: () => Promise<T>): () => Promise<T> {
  let inflight: Promise<T> | undefined;
  return () => {
    if (!inflight) {
      const current = run().finally(() => {
        if (inflight === current) inflight = undefined;
      });
      inflight = current;
    }
    return inflight;
  };
}

/** Never throws and never carries error details out: any failure, timeout or missing migration is `not ready`. */
export async function checkReadiness(deps: ReadinessDeps): Promise<Readiness> {
  try {
    const applied = new Set(await withTimeout(deps.appliedMigrations(), deps.timeoutMs ?? READINESS_TIMEOUT_MS));
    return { ready: deps.expectedMigrations.every((name) => applied.has(name)) };
  } catch {
    return { ready: false };
  }
}

const HEADERS = { 'cache-control': 'no-store', 'content-type': 'application/json' } as const;

export const readinessResponse = ({ ready }: Readiness): Response =>
  new Response(JSON.stringify({ status: ready ? 'ok' : 'unavailable' }), { status: ready ? 200 : 503, headers: HEADERS });
