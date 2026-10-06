import type { GateTransport } from '../../../scripts/cd/gate-main-ci.mjs';

// Synthetic, in-memory model of the GitHub REST surface the CD gate reads. No network, no credential.

export const SHA = 'b3db97cbe1aad2f05fcb5f17b4cefe7db20d70f0';
export const OTHER_SHA = '0123456789abcdef0123456789abcdef01234567';
export const REPO = 'nexagnet/bmsl-website';
export const WORKFLOW_ID = 375023465;

type Json = Record<string, unknown>;

export const step = (name: string, conclusion: string | null = 'success', status = 'completed'): Json => ({ name, status, conclusion });

export const job = (name: string, over: Json = {}, runId = 900, attempt = 1, sha = SHA): Json => ({
  id: Math.floor(Math.random() * 1e9) + 1,
  run_id: runId,
  run_attempt: attempt,
  head_sha: sha,
  name,
  status: 'completed',
  conclusion: 'success',
  steps: [
    step('Set up job'),
    step(name === 'verify' ? 'Application verify scripts' : 'Required application integration suite'),
    step('Complete job'),
  ],
  ...over,
});

export const run = (over: Json = {}): Json => ({
  id: 900,
  run_number: 10,
  run_attempt: 1,
  workflow_id: WORKFLOW_ID,
  path: '.github/workflows/ci.yml',
  event: 'push',
  head_branch: 'main',
  head_sha: SHA,
  status: 'completed',
  conclusion: 'success',
  head_repository: { full_name: REPO },
  repository: { full_name: REPO },
  ...over,
});

export type World = {
  main: string | (() => string);
  runs: Json[] | (() => Json[]);
  runById: (id: number) => Json | undefined;
  jobs: (id: number, attempt: number) => Json[];
  /** Pre-empts routes: return a response to override, undefined to continue. */
  override?: (path: string, call: number) => { status: number; headers?: Record<string, string>; text?: string } | undefined;
  /** Page size used for pagination simulation. */
  pageSize?: number;
};

export const goodWorld = (): World => {
  const r = run();
  return {
    main: SHA,
    runs: [r],
    runById: (id) => (id === 900 ? r : undefined),
    jobs: (id, attempt) => [job('verify', {}, id, attempt), job('integration', {}, id, attempt)],
  };
};

const resolve = <T>(v: T | (() => T)): T => (typeof v === 'function' ? (v as () => T)() : v);

export function makeTransport(world: World): { transport: GateTransport; calls: string[] } {
  const calls: string[] = [];
  const transport: GateTransport = async ({ url }) => {
    const u = new URL(url);
    if (u.origin !== 'https://api.github.com') throw new Error('unexpected host');
    const p = u.pathname + u.search;
    calls.push(p);
    const forced = world.override?.(u.pathname, calls.length);
    if (forced) {
      return { status: forced.status, headers: new Headers(forced.headers), text: forced.text ?? '{}' };
    }
    const ok = (body: unknown) => ({ status: 200, headers: new Headers(), text: JSON.stringify(body) });
    const notFound = { status: 404, headers: new Headers(), text: '{}' };
    const pageSize = world.pageSize ?? 100;
    const page = Number(u.searchParams.get('page') ?? '1');
    const paged = (key: string, all: Json[]) => ok({ total_count: all.length, [key]: all.slice((page - 1) * pageSize, page * pageSize) });
    let m: RegExpMatchArray | null;
    if (u.pathname === `/repos/${REPO}/branches/main`) return ok({ commit: { sha: resolve(world.main) } });
    if (u.pathname === `/repos/${REPO}/actions/workflows/${WORKFLOW_ID}/runs`) {
      const q = u.searchParams;
      if (q.get('branch') !== 'main' || q.get('event') !== 'push' || !/^[0-9a-f]{40}$/.test(q.get('head_sha') ?? '')) return notFound;
      return paged('workflow_runs', resolve(world.runs));
    }
    if ((m = u.pathname.match(new RegExp(`^/repos/${REPO}/actions/runs/(\\d+)/attempts/(\\d+)/jobs$`)))) {
      return paged('jobs', world.jobs(Number(m[1]), Number(m[2])));
    }
    if ((m = u.pathname.match(new RegExp(`^/repos/${REPO}/actions/runs/(\\d+)$`)))) {
      const found = world.runById(Number(m[1]));
      return found ? ok(found) : notFound;
    }
    return notFound;
  };
  return { transport, calls };
}
