// Production readiness for platform health checks (Northflank). Ready means the app's own initialized Payload
// runtime (shared adapter pool, committed migrations applied at init by prodMigrations) answers a query AND every
// committed migration is recorded as applied. The body is a fixed, minimal string: no database, credential, error
// or migration detail is ever exposed. No new pool/client is created: the Payload adapter's pool is reused.

export type ReadinessDeps = {
  /** Runs a read-only query on the already initialized Payload database; rejects on any failure. */
  appliedMigrations: () => Promise<string[]>;
  /** Names of the committed migrations (src/migrations) the running build expects. */
  expectedMigrations: readonly string[];
  timeoutMs?: number;
};

export const READINESS_TIMEOUT_MS = 3000;

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
