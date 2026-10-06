import { spawn, spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { afterAll, describe, expect, it } from 'vitest';
import { EXIT, GATE, readConfig, runGate } from '../../../scripts/cd/gate-main-ci.mjs';
import { goodWorld, job, makeTransport, OTHER_SHA, run, SHA, step, type World } from './cd-gate-fixture';

const root = path.resolve(import.meta.dirname, '../../..');
const env = { BMSL_TARGET_SHA: SHA };
const noSleep = async () => undefined;

type Mutate = (w: World) => void;
async function gate(mutate: Mutate = () => undefined, extraEnv: Record<string, string> = {}, opts: { sleep?: (ms: number) => Promise<void>; now?: () => number } = {}) {
  const world = goodWorld();
  mutate(world);
  const { transport, calls } = makeTransport(world);
  const outcome = await runGate({ env: { ...env, ...extraEnv }, transport, sleep: opts.sleep ?? noSleep, ...(opts.now ? { now: opts.now } : {}) });
  return { outcome, calls };
}

describe('CD gate: fixed trusted identity', () => {
  it('pins the repository, branch, workflow id/path and the two required jobs/steps', () => {
    expect(GATE).toMatchObject({ repository: 'nexagnet/bmsl-website', branch: 'main', workflowId: 375023465, workflowPath: '.github/workflows/ci.yml' });
    expect(GATE.jobs).toEqual({ verify: 'Application verify scripts', integration: 'Required application integration suite' });
  });
});

describe('CD gate: configuration', () => {
  it('requires a 40-hex SHA and bounds the tunables, never echoing values', () => {
    for (const bad of [undefined, '', 'abc', 'g'.repeat(40), `${SHA}0`, 'main']) {
      expect(() => readConfig({ BMSL_TARGET_SHA: bad })).toThrow('BMSL_TARGET_SHA');
    }
    expect(readConfig({ BMSL_TARGET_SHA: SHA.toUpperCase() }).sha).toBe(SHA);
    expect(() => readConfig({ ...env, BMSL_GATE_TIMEOUT_SECONDS: '999999' })).toThrow('BMSL_GATE_TIMEOUT_SECONDS');
    expect(() => readConfig({ ...env, BMSL_GATE_POLL_SECONDS: '0' })).toThrow('BMSL_GATE_POLL_SECONDS');
    try {
      readConfig({ ...env, BMSL_GITHUB_TOKEN: 'tok en\nsecret' });
      expect.unreachable();
    } catch (error) {
      expect(String(error)).not.toContain('secret');
    }
  });

  it('exits CONFIG for an invalid SHA without any API call', async () => {
    const { transport, calls } = makeTransport(goodWorld());
    const outcome = await runGate({ env: { BMSL_TARGET_SHA: 'nope' }, transport, sleep: noSleep });
    expect(outcome.exitCode).toBe(EXIT.CONFIG);
    expect(calls).toHaveLength(0);
  });
});

describe('CD gate: exact-main PASS', () => {
  it('passes for the valid exact-main run and reports only safe metadata', async () => {
    const { outcome, calls } = await gate();
    expect(outcome).toMatchObject({ exitCode: EXIT.PASS, status: 'pass', sha: SHA, runId: 900, attempt: 1 });
    expect(calls.some((c) => c.includes('/runs/900/attempts/1/jobs'))).toBe(true);
    expect(calls.every((c) => !c.includes('token'))).toBe(true);
  });

  it('waits (bounded) while pending, then passes', async () => {
    let polls = 0;
    const sleeps: number[] = [];
    const { outcome } = await gate(
      (w) => {
        const done = run();
        w.runs = () => (++polls < 3 ? [run({ status: 'in_progress', conclusion: null })] : [done]);
        w.runById = () => done;
      },
      { BMSL_GATE_POLL_SECONDS: '5' },
      { sleep: async (ms) => void sleeps.push(ms) },
    );
    expect(outcome.exitCode).toBe(EXIT.PASS);
    expect(sleeps).toEqual([5000, 5000]);
  });

  it('waits for a run that has not appeared yet', async () => {
    let polls = 0;
    const { outcome } = await gate((w) => {
      w.runs = () => (++polls < 2 ? [] : [run()]);
    });
    expect(outcome.exitCode).toBe(EXIT.PASS);
  });

  it('does not fetch jobs while the run is pending (rate-limit friendly)', async () => {
    let polls = 0;
    const { calls } = await gate((w) => {
      w.runs = () => (++polls < 4 ? [run({ status: 'queued', conclusion: null })] : [run()]);
    });
    const jobCalls = calls.filter((c) => c.includes('/jobs'));
    expect(jobCalls).toHaveLength(1);
  });
});

describe('CD gate: fails closed', () => {
  const cases: [string, Mutate, number][] = [
    ['main already moved past the candidate', (w) => void (w.main = OTHER_SHA), EXIT.SUPERSEDED],
    ['main moves while verifying', (w) => {
      let n = 0;
      w.main = () => (++n < 2 ? SHA : OTHER_SHA);
    }, EXIT.SUPERSEDED],
    ['run concluded failure', (w) => void (w.runs = [run({ conclusion: 'failure' })]), EXIT.FAIL],
    ['run cancelled', (w) => void (w.runs = [run({ conclusion: 'cancelled' })]), EXIT.FAIL],
    ['run timed out', (w) => void (w.runs = [run({ conclusion: 'timed_out' })]), EXIT.FAIL],
    ['run skipped', (w) => void (w.runs = [run({ conclusion: 'skipped' })]), EXIT.FAIL],
    ['run neutral', (w) => void (w.runs = [run({ conclusion: 'neutral' })]), EXIT.FAIL],
    ['run success but verify job failed', (w) => void (w.jobs = (id, a) => [job('verify', { conclusion: 'failure' }, id, a), job('integration', {}, id, a)]), EXIT.FAIL],
    ['integration job skipped', (w) => void (w.jobs = (id, a) => [job('verify', {}, id, a), job('integration', { conclusion: 'skipped' }, id, a)]), EXIT.FAIL],
    ['integration job missing', (w) => void (w.jobs = (id, a) => [job('verify', {}, id, a)]), EXIT.FAIL],
    ['verify job missing (renamed job)', (w) => void (w.jobs = (id, a) => [job('lint', {}, id, a), job('integration', {}, id, a)]), EXIT.FAIL],
    ['duplicate required job', (w) => void (w.jobs = (id, a) => [job('verify', {}, id, a), job('verify', {}, id, a), job('integration', {}, id, a)]), EXIT.FAIL],
    ['job not completed', (w) => void (w.jobs = (id, a) => [job('verify', {}, id, a), job('integration', { status: 'in_progress', conclusion: null }, id, a)]), EXIT.FAIL],
    ['application verify step skipped inside a successful job', (w) => void (w.jobs = (id, a) => [
      job('verify', { steps: [step('Application verify scripts', 'skipped')] }, id, a),
      job('integration', {}, id, a),
    ]), EXIT.FAIL],
    ['integration suite step skipped inside a successful job', (w) => void (w.jobs = (id, a) => [
      job('verify', {}, id, a),
      job('integration', { steps: [step('Required application integration suite', 'skipped')] }, id, a),
    ]), EXIT.FAIL],
    ['required step missing from job', (w) => void (w.jobs = (id, a) => [job('verify', { steps: [step('Set up job')] }, id, a), job('integration', {}, id, a)]), EXIT.FAIL],
    ['job for another head_sha', (w) => void (w.jobs = (id, a) => [job('verify', {}, id, a, OTHER_SHA), job('integration', {}, id, a)]), EXIT.FAIL],
    ['job for another run_id', (w) => void (w.jobs = (_id, a) => [job('verify', {}, 1, a), job('integration', {}, 1, a)]), EXIT.FAIL],
    ['job from another attempt', (w) => void (w.jobs = (id) => [job('verify', {}, id, 7), job('integration', {}, id, 7)]), EXIT.FAIL],
  ];
  it.each(cases)('%s', async (_name, mutate, code) => {
    const { outcome } = await gate(mutate);
    expect(outcome.exitCode).toBe(code);
    expect(outcome.status).toBe('fail');
  });
});

describe('CD gate: spoof, stale and rerun protection', () => {
  const spoofs: [string, Partial<Record<string, unknown>>][] = [
    ['unrelated workflow id', { workflow_id: 111 }],
    ['unrelated workflow path (name-only spoof)', { path: '.github/workflows/other.yml', name: 'ci' }],
    ['pull_request event', { event: 'pull_request' }],
    ['other branch', { head_branch: 'feature' }],
    ['stale head SHA', { head_sha: OTHER_SHA }],
    ['fork head repository', { head_repository: { full_name: 'attacker/bmsl-website' } }],
    ['other repository', { repository: { full_name: 'attacker/bmsl-website' } }],
  ];
  it.each(spoofs)('ignores a successful run with %s (never accepted, bounded wait then timeout)', async (_n, over) => {
    let t = 0;
    const { outcome } = await gate((w) => void (w.runs = [run(over)]), { BMSL_GATE_TIMEOUT_SECONDS: '10', BMSL_GATE_POLL_SECONDS: '5' }, { now: () => (t += 3000) });
    expect(outcome.exitCode).toBe(EXIT.TIMEOUT);
  });

  it('a run object whose detail read disagrees with the list is rejected', async () => {
    const { outcome } = await gate((w) => void (w.runById = () => run({ workflow_id: 111 })));
    expect(outcome.exitCode).toBe(EXIT.FAIL);
  });

  it('uses the NEWEST run: an older successful run does not rescue a newer failed one', async () => {
    const { outcome } = await gate((w) => {
      w.runs = [run({ id: 800, run_number: 9 }), run({ id: 900, run_number: 10, conclusion: 'failure' })];
    });
    expect(outcome.exitCode).toBe(EXIT.FAIL);
    expect(outcome.runId).toBe(900);
  });

  it('an earlier successful attempt is not accepted after a rerun is pending (latest attempt is pending -> bounded timeout)', async () => {
    let t = 0;
    const { outcome, calls } = await gate(
      (w) => {
        w.runs = [run({ run_attempt: 2, status: 'in_progress', conclusion: null })];
      },
      { BMSL_GATE_TIMEOUT_SECONDS: '10', BMSL_GATE_POLL_SECONDS: '5' },
      { now: () => (t += 3000) },
    );
    expect(outcome.exitCode).toBe(EXIT.TIMEOUT);
    expect(calls.some((c) => c.includes('/attempts/1/'))).toBe(false);
  });

  it('a rerun that fails after a successful first attempt fails (latest attempt wins)', async () => {
    const { outcome } = await gate((w) => void (w.runs = [run({ run_attempt: 2, conclusion: 'failure' })]));
    expect(outcome.exitCode).toBe(EXIT.FAIL);
  });

  it('explicitly queries the latest attempt jobs endpoint', async () => {
    const { calls, outcome } = await gate((w) => {
      const r = run({ run_attempt: 3 });
      w.runs = [r];
      w.runById = () => r;
    });
    expect(outcome.exitCode).toBe(EXIT.PASS);
    expect(calls.some((c) => c.startsWith('/repos/nexagnet/bmsl-website/actions/runs/900/attempts/3/jobs'))).toBe(true);
  });

  it('detects a rerun that starts between verification and acceptance', async () => {
    let reads = 0;
    const { outcome } = await gate((w) => {
      w.runById = () => (++reads < 2 ? run() : run({ run_attempt: 2, status: 'in_progress', conclusion: null }));
    });
    expect(outcome.exitCode).toBe(EXIT.FAIL);
  });

  it('detects a newer run for the same SHA appearing before acceptance', async () => {
    let lists = 0;
    const { outcome } = await gate((w) => {
      w.runs = () => (++lists < 2 ? [run()] : [run(), run({ id: 901, run_number: 11, status: 'queued', conclusion: null })]);
      w.runById = (id) => (id === 900 ? run() : undefined);
    });
    expect(outcome.exitCode).toBe(EXIT.FAIL);
  });
});

describe('CD gate: pagination', () => {
  it('collects every page of jobs (small pages) and still passes', async () => {
    const { outcome, calls } = await gate((w) => {
      w.pageSize = 1;
      w.jobs = (id, a) => [job('verify', {}, id, a), job('integration', {}, id, a)];
    });
    expect(outcome.exitCode).toBe(EXIT.PASS);
    expect(calls.filter((c) => c.includes('/jobs')).length).toBeGreaterThanOrEqual(2);
  });

  it('the required job on page 2 is found (not truncated away)', async () => {
    const { outcome } = await gate((w) => {
      w.pageSize = 1;
      w.jobs = (id, a) => [job('integration', {}, id, a), job('verify', {}, id, a)];
    });
    expect(outcome.exitCode).toBe(EXIT.PASS);
  });

  it('fails when the job list is truncated (total_count larger than what is served)', async () => {
    const { outcome } = await gate((w) => {
      w.override = (p) =>
        p.endsWith('/jobs') ? { status: 200, text: JSON.stringify({ total_count: 5, jobs: [job('verify'), job('integration')].slice(0, 0) }) } : undefined;
    });
    expect(outcome.exitCode).toBe(EXIT.FAIL);
    expect(outcome.reason).toContain('truncated');
  });

  it('fails when the run list is truncated', async () => {
    const { outcome } = await gate((w) => {
      w.override = (p) => (p.endsWith('/runs') ? { status: 200, text: JSON.stringify({ total_count: 3, workflow_runs: [run()] }) } : undefined);
    });
    expect(outcome.exitCode).toBe(EXIT.FAIL);
  });
});

describe('CD gate: API errors, rate limits, timeouts', () => {
  const body = (status: number, text = '{}', headers: Record<string, string> = {}) => ({ status, text, headers });

  it.each([
    ['malformed JSON', body(200, '<html>not json')],
    ['non-object JSON', body(200, '[]')],
    ['HTTP 404', body(404)],
    ['HTTP 401', body(401)],
    ['HTTP 403 without rate-limit headers', body(403)],
  ])('%s on the first request fails closed', async (_n, response) => {
    const { outcome } = await gate((w) => void (w.override = () => response));
    expect(outcome.exitCode).toBe(EXIT.API);
  });

  it('malformed branch payload fails closed', async () => {
    const { outcome } = await gate((w) => void (w.override = (p) => (p.endsWith('/branches/main') ? body(200, JSON.stringify({ commit: {} })) : undefined)));
    expect(outcome.exitCode).toBe(EXIT.API);
  });

  it('malformed run list payload fails closed', async () => {
    const { outcome } = await gate((w) => void (w.override = (p) => (p.endsWith('/runs') ? body(200, JSON.stringify({ workflow_runs: 'x' })) : undefined)));
    expect(outcome.exitCode).toBe(EXIT.API);
  });

  it('retries a transient 5xx a bounded number of times, then passes or fails', async () => {
    const pass = await gate((w) => void (w.override = (_p, call) => (call === 1 ? body(503) : undefined)));
    expect(pass.outcome.exitCode).toBe(EXIT.PASS);
    const fails = await gate((w) => void (w.override = () => body(503)));
    expect(fails.outcome.exitCode).toBe(EXIT.API);
    expect(fails.calls).toHaveLength(3);
  });

  it('a thrown transport error (network/timeout) is retried then fails closed', async () => {
    let calls = 0;
    const outcome = await runGate({
      env,
      transport: async () => {
        calls++;
        throw new Error('ETIMEDOUT with secret details');
      },
      sleep: noSleep,
    });
    expect(outcome.exitCode).toBe(EXIT.API);
    expect(calls).toBe(3);
    expect(JSON.stringify(outcome)).not.toContain('secret');
  });

  it('honours Retry-After when it fits before the deadline', async () => {
    const sleeps: number[] = [];
    const { outcome } = await gate(
      (w) => void (w.override = (_p, call) => (call === 1 ? body(429, '{}', { 'retry-after': '7' }) : undefined)),
      {},
      { sleep: async (ms) => void sleeps.push(ms) },
    );
    expect(outcome.exitCode).toBe(EXIT.PASS);
    expect(sleeps[0]).toBe(8000);
  });

  it('fails closed (no wait) when rate-limit reset is beyond the overall deadline', async () => {
    const sleeps: number[] = [];
    const t0 = 1_700_000_000_000;
    const { outcome } = await gate(
      (w) => void (w.override = () => body(403, '{}', { 'x-ratelimit-remaining': '0', 'x-ratelimit-reset': String(t0 / 1000 + 3000) })),
      { BMSL_GATE_TIMEOUT_SECONDS: '60' },
      { now: () => t0, sleep: async (ms) => void sleeps.push(ms) },
    );
    expect(outcome.exitCode).toBe(EXIT.API);
    expect(outcome.reason).toContain('rate limited');
    expect(sleeps).toEqual([]);
  });

  it('waits for an x-ratelimit-reset inside the deadline', async () => {
    const sleeps: number[] = [];
    const t0 = 1_700_000_000_000;
    const { outcome } = await gate(
      (w) => void (w.override = (_p, call) => (call === 1 ? body(403, '{}', { 'x-ratelimit-remaining': '0', 'x-ratelimit-reset': String(t0 / 1000 + 5) }) : undefined)),
      { BMSL_GATE_TIMEOUT_SECONDS: '60' },
      { now: () => t0, sleep: async (ms) => void sleeps.push(ms) },
    );
    expect(outcome.exitCode).toBe(EXIT.PASS);
    expect(sleeps[0]).toBe(6000);
  });

  it('pending beyond the overall timeout exits TIMEOUT (no infinite job)', async () => {
    let t = 0;
    const { outcome } = await gate((w) => void (w.runs = [run({ status: 'in_progress', conclusion: null })]), { BMSL_GATE_TIMEOUT_SECONDS: '20', BMSL_GATE_POLL_SECONDS: '5' }, { now: () => (t += 1000) });
    expect(outcome.exitCode).toBe(EXIT.TIMEOUT);
  });

  it('never sends the token anywhere but the Authorization header and never outputs it', async () => {
    const token = 'ghp_synthetictokenvalue1234567890';
    const seen: Record<string, string>[] = [];
    const world = goodWorld();
    const inner = makeTransport(world).transport;
    const outcome = await runGate({
      env: { ...env, BMSL_GITHUB_TOKEN: token },
      transport: (req) => (seen.push(req.headers), inner(req)),
      sleep: noSleep,
    });
    expect(outcome.exitCode).toBe(EXIT.PASS);
    expect(seen.every((h) => h.authorization === `Bearer ${token}`)).toBe(true);
    expect(JSON.stringify(outcome)).not.toContain(token);
    const unauth = await gate();
    expect(unauth.outcome.exitCode).toBe(EXIT.PASS);
  });

  it('exits with the SIGTERM code when aborted while waiting', async () => {
    const controller = new AbortController();
    const world = goodWorld();
    world.runs = [run({ status: 'queued', conclusion: null })];
    const inner = makeTransport(world).transport;
    const outcome = await runGate({
      env: { ...env, BMSL_GATE_POLL_SECONDS: '60' },
      transport: async (req) => {
        if (req.url.includes('/runs?')) controller.abort();
        return inner(req);
      },
      signal: controller.signal,
    });
    expect(outcome.exitCode).toBe(EXIT.SIGTERM);
  });
});

/**
 * Runnable job entrypoint: `node scripts/cd/gate-main-ci.mjs` is spawned for real, with a preloaded module that
 * replaces globalThis.fetch by the synthetic API (a test-only preload; the shipped script has no test hook).
 */
describe('CD gate: job entrypoint exit codes (real process, synthetic fetch)', () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'bmsl-cd-gate-'));
  const preload = path.join(dir, 'preload.mjs');

  const writePreload = (scenario: string) => {
    writeFileSync(
      preload,
      `
const SHA = ${JSON.stringify(SHA)};
const base = { id: 900, run_number: 10, run_attempt: 1, workflow_id: 375023465, path: '.github/workflows/ci.yml', event: 'push', head_branch: 'main', head_sha: SHA, status: 'completed', conclusion: 'success', head_repository: { full_name: 'nexagnet/bmsl-website' }, repository: { full_name: 'nexagnet/bmsl-website' } };
const scenario = ${JSON.stringify(scenario)};
let polls = 0;
const mkJob = (name, step) => ({ id: 1, run_id: 900, run_attempt: 1, head_sha: SHA, name, status: 'completed', conclusion: 'success', steps: [{ name: step, status: 'completed', conclusion: scenario === 'skipped-step' && name === 'integration' ? 'skipped' : 'success' }] });
const json = (body, status = 200) => new Response(JSON.stringify(body), { status });
globalThis.fetch = async (url) => {
  const u = new URL(String(url));
  if (u.origin !== 'https://api.github.com') throw new Error('unexpected host');
  const p = u.pathname;
  if (scenario === 'api-error') return json({}, 500);
  if (p.endsWith('/branches/main')) return json({ commit: { sha: scenario === 'superseded' ? '0'.repeat(40) : SHA } });
  if (p.endsWith('/runs')) {
    const pending = scenario === 'pending-then-pass' && ++polls < 2;
    const run = scenario === 'failed' ? { ...base, conclusion: 'failure' } : pending ? { ...base, status: 'in_progress', conclusion: null } : base;
    return json({ total_count: 1, workflow_runs: [run] });
  }
  if (p.endsWith('/jobs')) return json({ total_count: 2, jobs: [mkJob('verify', 'Application verify scripts'), mkJob('integration', 'Required application integration suite')] });
  if (p.endsWith('/runs/900')) return json(base);
  return json({}, 404);
};
`,
    );
  };

  const exec = (scenario: string, envOver: Record<string, string> = { BMSL_TARGET_SHA: SHA }, signalAfterMs?: number) => {
    writePreload(scenario);
    return spawnSync(process.execPath, ['--import', pathToFileURL(preload).href, 'scripts/cd/gate-main-ci.mjs'], {
      cwd: root,
      env: { NODE_ENV: 'test', PATH: process.env.PATH ?? '', BMSL_GATE_POLL_SECONDS: '1', BMSL_GATE_TIMEOUT_SECONDS: '30', ...envOver },
      encoding: 'utf8',
      timeout: signalAfterMs ?? 60_000,
      killSignal: 'SIGTERM',
    });
  };

  it('valid exact-main PASS exits 0 and prints only safe metadata', () => {
    const r = exec('pass');
    expect(r.status).toBe(0);
    expect(JSON.parse(r.stdout)).toEqual({ gate: 'bmsl-main-ci', status: 'pass', reason: 'exact-main ci verified', sha: SHA, runId: 900, attempt: 1 });
  });

  it('pending then PASS exits 0', () => {
    expect(exec('pending-then-pass').status).toBe(0);
  });

  it.each([
    ['failed', EXIT.FAIL],
    ['skipped-step', EXIT.FAIL],
    ['superseded', EXIT.SUPERSEDED],
    ['api-error', EXIT.API],
  ])('%s exits %i', { timeout: 30_000 }, (scenario, code) => {
    const r = exec(scenario);
    expect(r.status).toBe(code);
    expect(r.stdout).toBe('');
  });

  it('invalid SHA exits 2 safely, without echoing the value', () => {
    const r = exec('pass', { BMSL_TARGET_SHA: 'not-a-sha-SECRET' });
    expect(r.status).toBe(EXIT.CONFIG);
    expect(r.stderr).not.toContain('SECRET');
  });

  it('needs no web runtime configuration: no DATABASE_URL / PAYLOAD_SECRET / media dir', () => {
    const r = exec('pass', { BMSL_TARGET_SHA: SHA });
    expect(r.status).toBe(0);
  });

  it('SIGTERM while pending exits 143 promptly', async () => {
    // A run that stays pending forever: only the signal can end it.
    writeFileSync(preload, readPending());
    const child = spawn(process.execPath, ['--import', pathToFileURL(preload).href, 'scripts/cd/gate-main-ci.mjs'], {
      cwd: root,
      env: { NODE_ENV: 'test', PATH: process.env.PATH ?? '', BMSL_TARGET_SHA: SHA, BMSL_GATE_POLL_SECONDS: '60', BMSL_GATE_TIMEOUT_SECONDS: '600' },
      stdio: 'ignore',
    });
    await new Promise((r) => setTimeout(r, 1500));
    child.kill('SIGTERM');
    const code = await new Promise<number | null>((resolve) => child.on('exit', (c) => resolve(c)));
    expect(code).toBe(EXIT.SIGTERM);
  }, 30_000);

  afterAll(() => rmSync(dir, { recursive: true, force: true }));

  function readPending(): string {
    return `
const SHA = ${JSON.stringify(SHA)};
const json = (b) => new Response(JSON.stringify(b), { status: 200 });
globalThis.fetch = async (url) => {
  const p = new URL(String(url)).pathname;
  if (p.endsWith('/branches/main')) return json({ commit: { sha: SHA } });
  return json({ total_count: 1, workflow_runs: [{ id: 900, run_number: 10, run_attempt: 1, workflow_id: 375023465, path: '.github/workflows/ci.yml', event: 'push', head_branch: 'main', head_sha: SHA, status: 'queued', conclusion: null, head_repository: { full_name: 'nexagnet/bmsl-website' }, repository: { full_name: 'nexagnet/bmsl-website' } }] });
};
`;
  }
});
