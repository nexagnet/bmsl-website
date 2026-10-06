// Exact-main CI gate for the native Northflank continuous-delivery workflow (job entrypoint).
//
//   node scripts/cd/gate-main-ci.mjs        (env: BMSL_TARGET_SHA, optional BMSL_GITHUB_TOKEN)
//
// Exit 0 ONLY when the candidate commit is still the head of nexagnet/bmsl-website `main` AND the trusted CI workflow
// (workflow id 375023465, .github/workflows/ci.yml) has a completed, successful LATEST ATTEMPT of its newest `push`
// run for exactly that commit, where BOTH required jobs (`verify`, `integration`) and their application steps
// completed with success. Every other situation (malformed input or response, API error, rate limit that would cross
// the deadline, pending past the deadline, failed/cancelled/skipped/neutral/timed-out CI, spoofed or stale run, rerun
// race, truncated pagination, duplicate/missing job, superseded main) exits non-zero. It never waits unboundedly.
//
// Read-only GitHub REST calls to the fixed host api.github.com. The optional token is read from the environment only,
// is sent only as an Authorization header and is never printed; neither response bodies nor headers are ever logged.
// stdout/stderr carry only fixed reason codes and the validated SHA / run id / attempt number.
//
// This script gates; it does not deploy anything and holds no platform credential.
/* global process, console, fetch, setTimeout, clearTimeout, AbortController, AbortSignal */
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const GATE = Object.freeze({
  repository: 'nexagnet/bmsl-website',
  branch: 'main',
  workflowId: 375023465,
  workflowPath: '.github/workflows/ci.yml',
  apiBase: 'https://api.github.com',
  // Required job name -> the application step inside it that must itself have completed with success.
  jobs: Object.freeze({
    verify: 'Application verify scripts',
    integration: 'Required application integration suite',
  }),
});

export const EXIT = Object.freeze({
  PASS: 0,
  FAIL: 1,
  CONFIG: 2,
  SUPERSEDED: 3,
  TIMEOUT: 4,
  API: 5,
  SIGTERM: 143,
});

export const LIMITS = Object.freeze({
  requestTimeoutMs: 15_000,
  maxBodyBytes: 5 * 1024 * 1024,
  maxAttemptsPerRequest: 3,
  maxPages: 5,
  perPage: 100,
  defaultTimeoutSeconds: 1500,
  maxTimeoutSeconds: 3600,
  // Unauthenticated GitHub API quota is small (60/hour per IP): pending polls cost ONE request each (the run list);
  // the heavier jobs/branch requests happen only once the run is completed.
  defaultPollSeconds: 60,
  minPollSeconds: 1,
  maxPollSeconds: 300,
  rateLimitMarginMs: 1000,
});

class GateError extends Error {
  constructor(exitCode, reason) {
    super(reason);
    this.exitCode = exitCode;
    this.reason = reason;
  }
}
const fail = (reason) => new GateError(EXIT.FAIL, reason);
const apiFail = (reason) => new GateError(EXIT.API, reason);

const SHA_RE = /^[0-9a-f]{40}$/;
const TOKEN_RE = /^[\x21-\x7e]{1,255}$/;

/** Validates the environment. Throws GateError(CONFIG) with a fixed message that never contains a value. */
export function readConfig(env = process.env) {
  const rawSha = env.BMSL_TARGET_SHA?.trim().toLowerCase();
  if (!rawSha || !SHA_RE.test(rawSha)) throw new GateError(EXIT.CONFIG, 'BMSL_TARGET_SHA must be a 40-hex commit SHA');
  const token = env.BMSL_GITHUB_TOKEN?.trim() || undefined;
  if (token !== undefined && !TOKEN_RE.test(token)) throw new GateError(EXIT.CONFIG, 'BMSL_GITHUB_TOKEN has an invalid format');
  const bounded = (name, min, max, fallback) => {
    const raw = env[name]?.trim();
    if (!raw) return fallback;
    const n = Number(raw);
    if (!/^\d+$/.test(raw) || n < min || n > max) throw new GateError(EXIT.CONFIG, `${name} must be an integer from ${min} to ${max}`);
    return n;
  };
  return {
    sha: rawSha,
    token,
    timeoutMs: bounded('BMSL_GATE_TIMEOUT_SECONDS', 1, LIMITS.maxTimeoutSeconds, LIMITS.defaultTimeoutSeconds) * 1000,
    pollMs: bounded('BMSL_GATE_POLL_SECONDS', LIMITS.minPollSeconds, LIMITS.maxPollSeconds, LIMITS.defaultPollSeconds) * 1000,
  };
}

/** Production transport: bounded, no redirects, body size capped. Returns { status, headers, text }. */
export async function fetchTransport({ url, headers, signal }) {
  const res = await fetch(url, {
    method: 'GET',
    headers,
    redirect: 'error',
    signal: AbortSignal.any([signal, AbortSignal.timeout(LIMITS.requestTimeoutMs)]),
  });
  const text = await res.text();
  if (text.length > LIMITS.maxBodyBytes) throw new Error('response too large');
  return { status: res.status, headers: { get: (n) => res.headers.get(n) }, text };
}

const abortable = (ms, signal) =>
  new Promise((resolve, reject) => {
    if (signal.aborted) return reject(new GateError(EXIT.SIGTERM, 'terminated'));
    const timer = setTimeout(() => {
      signal.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      clearTimeout(timer);
      reject(new GateError(EXIT.SIGTERM, 'terminated'));
    };
    signal.addEventListener('abort', onAbort, { once: true });
  });

const isObject = (v) => typeof v === 'object' && v !== null && !Array.isArray(v);
const isId = (v) => Number.isSafeInteger(v) && v > 0;

/**
 * Runs the gate. Everything external is injectable (transport, clock, sleep, abort signal) so the logic is testable
 * without network. Returns { exitCode, status, reason, sha, runId?, attempt? } and never throws.
 */
export async function runGate({
  env = process.env,
  transport = fetchTransport,
  now = Date.now,
  sleep = abortable,
  signal = new AbortController().signal,
} = {}) {
  let config;
  try {
    config = readConfig(env);
  } catch (error) {
    return { exitCode: error.exitCode ?? EXIT.CONFIG, status: 'fail', reason: error.reason ?? 'invalid configuration' };
  }
  const { sha, token, timeoutMs, pollMs } = config;
  const deadline = now() + timeoutMs;
  const state = { sha };

  const headers = {
    accept: 'application/vnd.github+json',
    'x-github-api-version': '2022-11-28',
    'user-agent': 'bmsl-cd-gate',
    ...(token ? { authorization: `Bearer ${token}` } : {}),
  };

  /** One bounded, retried GET. Returns parsed JSON object. Rate limits wait only if the wait fits before the deadline. */
  async function get(pathAndQuery) {
    const url = `${GATE.apiBase}${pathAndQuery}`;
    for (let attempt = 1; ; attempt++) {
      if (signal.aborted) throw new GateError(EXIT.SIGTERM, 'terminated');
      if (now() >= deadline) throw new GateError(EXIT.TIMEOUT, 'overall timeout');
      let res;
      try {
        res = await transport({ url, headers, signal });
      } catch {
        if (signal.aborted) throw new GateError(EXIT.SIGTERM, 'terminated');
        if (attempt >= LIMITS.maxAttemptsPerRequest) throw apiFail('github api unreachable');
        await waitWithinDeadline(1000 * attempt);
        continue;
      }
      const status = res?.status;
      if (status === 200) {
        let body;
        try {
          body = JSON.parse(res.text);
        } catch {
          throw apiFail('malformed github response');
        }
        if (!isObject(body)) throw apiFail('malformed github response');
        return body;
      }
      const retryAfter = Number(res?.headers?.get?.('retry-after'));
      const remaining = res?.headers?.get?.('x-ratelimit-remaining');
      const reset = Number(res?.headers?.get?.('x-ratelimit-reset'));
      const limited = status === 429 || (status === 403 && (Number.isFinite(retryAfter) || remaining === '0'));
      if (limited) {
        let waitMs;
        if (Number.isFinite(retryAfter) && retryAfter >= 0) waitMs = retryAfter * 1000;
        else if (Number.isFinite(reset) && reset > 0) waitMs = reset * 1000 - now();
        else throw apiFail('github rate limited');
        waitMs = Math.max(waitMs, 0) + LIMITS.rateLimitMarginMs;
        // Never cross the overall deadline to honour a limit: fail closed instead.
        if (now() + waitMs >= deadline) throw apiFail('github rate limited beyond deadline');
        if (attempt >= LIMITS.maxAttemptsPerRequest) throw apiFail('github rate limited');
        await sleep(waitMs, signal);
        continue;
      }
      if (typeof status === 'number' && status >= 500 && attempt < LIMITS.maxAttemptsPerRequest) {
        await waitWithinDeadline(1000 * attempt);
        continue;
      }
      throw apiFail(`github api status ${Number.isInteger(status) ? status : 'unknown'}`);
    }
  }

  async function waitWithinDeadline(ms) {
    if (now() + ms >= deadline) throw new GateError(EXIT.TIMEOUT, 'overall timeout');
    await sleep(ms, signal);
  }

  const repoPath = `/repos/${GATE.repository}`;

  /** Current head of main, strictly validated. */
  async function currentMain() {
    const body = await get(`${repoPath}/branches/${GATE.branch}`);
    const head = body.commit?.sha;
    if (typeof head !== 'string' || !SHA_RE.test(head)) throw apiFail('malformed github response');
    return head;
  }

  /** Strict trust check of a workflow-run object against the fixed identity and the candidate SHA. */
  function assertTrustedRun(run) {
    if (!isObject(run) || !isId(run.id) || !isId(run.run_attempt)) return false;
    return (
      run.workflow_id === GATE.workflowId &&
      run.path === GATE.workflowPath &&
      run.event === 'push' &&
      run.head_branch === GATE.branch &&
      run.head_sha === sha &&
      run.head_repository?.full_name === GATE.repository &&
      run.repository?.full_name === GATE.repository
    );
  }

  /** Newest trusted push run for the exact SHA (highest run_number), or undefined when none exists yet. */
  async function newestRun() {
    const runs = [];
    let total;
    for (let page = 1; page <= LIMITS.maxPages; page++) {
      const body = await get(
        `${repoPath}/actions/workflows/${GATE.workflowId}/runs?branch=${GATE.branch}&event=push&head_sha=${sha}&per_page=${LIMITS.perPage}&page=${page}`,
      );
      if (!Array.isArray(body.workflow_runs) || !Number.isSafeInteger(body.total_count) || body.total_count < 0) {
        throw apiFail('malformed github response');
      }
      total = body.total_count;
      runs.push(...body.workflow_runs);
      if (runs.length >= total) break;
      if (body.workflow_runs.length === 0) throw fail('truncated run list');
    }
    if (runs.length < total) throw fail('truncated run list');
    const trusted = runs.filter(assertTrustedRun);
    if (trusted.length === 0) return undefined;
    const top = Math.max(...trusted.map((r) => (Number.isSafeInteger(r.run_number) ? r.run_number : -1)));
    const newest = trusted.filter((r) => r.run_number === top);
    if (top < 0 || newest.length !== 1) throw fail('ambiguous newest run');
    return newest[0];
  }

  async function fetchRun(id) {
    const run = await get(`${repoPath}/actions/runs/${id}`);
    if (run.id !== id || !assertTrustedRun(run)) throw fail('run is not the trusted workflow run for the candidate');
    return run;
  }

  /** Explicitly fetches the jobs of one attempt (paginated, complete) and verifies the two required jobs and steps. */
  async function verifyAttemptJobs(run) {
    const jobs = [];
    let total;
    for (let page = 1; page <= LIMITS.maxPages; page++) {
      const body = await get(
        `${repoPath}/actions/runs/${run.id}/attempts/${run.run_attempt}/jobs?per_page=${LIMITS.perPage}&page=${page}`,
      );
      if (!Array.isArray(body.jobs) || !Number.isSafeInteger(body.total_count) || body.total_count < 0) {
        throw apiFail('malformed github response');
      }
      total = body.total_count;
      jobs.push(...body.jobs);
      if (jobs.length >= total) break;
      if (body.jobs.length === 0) throw fail('truncated job list');
    }
    if (jobs.length < total) throw fail('truncated job list');
    for (const job of jobs) {
      if (!isObject(job) || job.run_id !== run.id || job.head_sha !== sha) throw fail('job does not belong to the candidate run');
      if (job.run_attempt !== undefined && job.run_attempt !== run.run_attempt) throw fail('job belongs to another attempt');
    }
    for (const [jobName, stepName] of Object.entries(GATE.jobs)) {
      const matching = jobs.filter((j) => j.name === jobName);
      if (matching.length === 0) throw fail(`required job missing: ${jobName}`);
      if (matching.length > 1) throw fail(`duplicate required job: ${jobName}`);
      const job = matching[0];
      if (job.status !== 'completed' || job.conclusion !== 'success') throw fail(`required job not successful: ${jobName}`);
      if (!Array.isArray(job.steps)) throw fail(`required job has no steps: ${jobName}`);
      const steps = job.steps.filter((s) => isObject(s) && s.name === stepName);
      if (steps.length !== 1) throw fail(`required step missing or duplicated in ${jobName}`);
      if (steps[0].status !== 'completed' || steps[0].conclusion !== 'success') {
        throw fail(`required step not successful in ${jobName}`);
      }
    }
  }

  const result = (exitCode, status, reason) => ({ exitCode, status, reason, ...state });

  try {
    if ((await currentMain()) !== sha) throw new GateError(EXIT.SUPERSEDED, 'main has moved past the candidate');

    for (;;) {
      if (signal.aborted) throw new GateError(EXIT.SIGTERM, 'terminated');
      const newest = await newestRun();
      if (newest !== undefined) {
        state.runId = newest.id;
        state.attempt = newest.run_attempt;
        if (newest.status === 'completed') {
          if (newest.conclusion !== 'success') throw fail(`ci run concluded ${String(newest.conclusion).replace(/[^a-z_]/g, '') || 'unknown'}`);
          const run = await fetchRun(newest.id);
          if (run.status === 'completed' && run.conclusion === 'success') {
            state.attempt = run.run_attempt;
            await verifyAttemptJobs(run);
            // Re-read before accepting: a rerun started meanwhile (new attempt, pending or failed) must not be missed.
            const again = await fetchRun(run.id);
            const latest = await newestRun();
            if (
              again.run_attempt !== run.run_attempt ||
              again.status !== 'completed' ||
              again.conclusion !== 'success' ||
              latest?.id !== run.id ||
              latest.run_attempt !== run.run_attempt
            ) {
              throw fail('ci run changed while verifying (rerun or newer run)');
            }
            if ((await currentMain()) !== sha) throw new GateError(EXIT.SUPERSEDED, 'main has moved past the candidate');
            return result(EXIT.PASS, 'pass', 'exact-main ci verified');
          }
          // Completed in the list but not yet in the run read (or a rerun just started): treat as pending.
          if (run.status === 'completed') throw fail(`ci run concluded ${String(run.conclusion).replace(/[^a-z_]/g, '') || 'unknown'}`);
        }
      }
      // Pending: a missing run, or one queued/in_progress/waiting. Bounded wait; never past the deadline.
      await waitWithinDeadline(pollMs);
    }
  } catch (error) {
    if (error instanceof GateError) return result(error.exitCode, 'fail', error.reason);
    return result(EXIT.FAIL, 'fail', 'unexpected gate error');
  }
}

/** Entrypoint: wires SIGTERM/SIGINT to an abort and reports only safe metadata. */
export async function main(options = {}) {
  const controller = new AbortController();
  const onSignal = () => controller.abort();
  process.once('SIGTERM', onSignal);
  process.once('SIGINT', onSignal);
  const outcome = await runGate({ ...options, signal: controller.signal });
  process.off('SIGTERM', onSignal);
  process.off('SIGINT', onSignal);
  const line = JSON.stringify({
    gate: 'bmsl-main-ci',
    status: outcome.status,
    reason: outcome.reason,
    ...(outcome.sha ? { sha: outcome.sha } : {}),
    ...(outcome.runId ? { runId: outcome.runId } : {}),
    ...(outcome.attempt ? { attempt: outcome.attempt } : {}),
  });
  if (outcome.exitCode === EXIT.PASS) console.log(line);
  else console.error(line);
  return outcome.exitCode;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exitCode = await main();
}
