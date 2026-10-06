export type GateTransport = (request: {
  url: string;
  headers: Record<string, string>;
  signal: AbortSignal;
  timeoutMs?: number;
}) => Promise<{ status: number; headers: { get(name: string): string | null | undefined }; text: string }>;

export type GateOutcome = {
  exitCode: number;
  status: 'pass' | 'fail';
  reason: string;
  sha?: string;
  runId?: number;
  attempt?: number;
};

export const GATE: {
  readonly repository: string;
  readonly branch: string;
  readonly workflowId: number;
  readonly workflowPath: string;
  readonly apiBase: string;
  readonly jobs: Readonly<Record<string, string>>;
};
export const EXIT: Readonly<Record<'PASS' | 'FAIL' | 'CONFIG' | 'SUPERSEDED' | 'TIMEOUT' | 'API' | 'SIGTERM', number>>;
export const LIMITS: Readonly<Record<string, number>>;
export function readConfig(env?: Record<string, string | undefined>): {
  sha: string;
  token: string | undefined;
  timeoutMs: number;
  pollMs: number;
};
export const fetchTransport: GateTransport;
export function runGate(options?: {
  env?: Record<string, string | undefined>;
  transport?: GateTransport;
  now?: () => number;
  sleep?: (ms: number, signal: AbortSignal) => Promise<void>;
  signal?: AbortSignal;
}): Promise<GateOutcome>;
export function main(options?: Parameters<typeof runGate>[0]): Promise<number>;
