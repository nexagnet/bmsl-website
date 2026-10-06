// Observes a container that must NEVER report ready (e.g. configured with a missing database).
// Only connection/network failures of the probe are tolerated ("not listening yet"); any observed HTTP 200 fails
// immediately, so a later 503 or exit can never mask a ready report.

export type NeverReadyOptions = {
  isRunning: () => Promise<boolean>;
  /** Returns the HTTP status; a connection/network failure must reject (fetch rejects with TypeError/AbortError). */
  probe: () => Promise<number>;
  sleep: (ms: number) => Promise<void>;
  now?: () => number;
  timeoutMs: number;
  intervalMs?: number;
};

const isConnectionFailure = (error: unknown) =>
  error instanceof TypeError || (error instanceof Error && (error.name === 'AbortError' || error.name === 'TimeoutError'));

export async function observeNeverReady({ isRunning, probe, sleep, now = Date.now, timeoutMs, intervalMs = 1500 }: NeverReadyOptions): Promise<'exited' | 'unavailable'> {
  const deadline = now() + timeoutMs;
  while (now() < deadline) {
    if (!(await isRunning())) return 'exited';
    let status: number | undefined;
    try {
      status = await probe();
    } catch (error) {
      if (!isConnectionFailure(error)) throw error;
    }
    if (status === 200) throw new Error('container reported /healthz 200 although its database does not exist');
    if (status === 503) return 'unavailable';
    await sleep(intervalMs);
  }
  throw new Error('container neither exited nor reported unavailable before the deadline');
}
