import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { REQUIRED_CHECKS } from './autopilot-core.mjs';
import { evaluatePreflight } from './preflight.mjs';
import { decideAutonomy, evaluateRequiredChecks } from './policy.mjs';
import { isProtectedPath } from './validate-diff.mjs';
import { stagePnpmLockfile } from './stage-pnpm-lockfile.mjs';

test('BMSL requires verify + integration on the exact head', () => {
  assert.deepEqual(REQUIRED_CHECKS, ['verify', 'integration']);
  const head = 'a'.repeat(40);
  const app = { slug: 'github-actions' };
  const ci = evaluateRequiredChecks([
    { id: 1, name: 'verify', head_sha: head, app, status: 'completed', conclusion: 'success' },
    { id: 2, name: 'integration', head_sha: head, app, status: 'completed', conclusion: 'success' },
  ], head);
  assert.equal(ci.ok, true);
});

test('R3 is blocked before Claude receives secrets', () => {
  const result = evaluatePreflight({
    eventLabel: 'autopilot:ready',
    issue: { state: 'open', labels: ['autopilot:ready', 'risk:R3'] },
  });
  assert.equal(result.decision, 'BLOCK');
});

test('R2 can build but remains human-merge gated', () => {
  const pre = evaluatePreflight({
    eventLabel: 'autopilot:ready',
    issue: { state: 'open', labels: ['autopilot:ready', 'risk:R2'] },
  });
  assert.equal(pre.decision, 'RUN');
  assert.equal(pre.needsHuman, true);
  assert.deepEqual(
    decideAutonomy({ risk: 'R2', ci: { ok: true }, review: { verdict: 'PASS' }, protectedPaths: [], humanHold: false }),
    { action: 'WAIT_HUMAN', reason: 'REVIEW_PASS_WAITING_HUMAN' },
  );
});

test('control-plane paths stay protected from normal agents', () => {
  for (const path of ['.github/workflows/ci.yml', 'tools/autopilot/preflight.mjs', 'AGENTS.md', 'CLAUDE.md', '.mcp.json']) {
    assert.equal(isProtectedPath(path), true, path);
  }
});

test('scratch pnpm lockfile can only be staged as pnpm-lock.yaml', () => {
  const root = mkdtempSync(join(tmpdir(), 'bmsl-lock-stage-'));
  const repository = join(root, 'repo');
  const scratch = join(root, 'scratch');
  mkdirSync(repository);
  mkdirSync(scratch);

  try {
    execFileSync('git', ['init', '-q'], { cwd: repository });
    const lockfile = "lockfileVersion: '9.0'\nsettings:\n  autoInstallPeers: true\n";
    const source = join(scratch, 'pnpm-lock.yaml');
    writeFileSync(source, lockfile);

    const blob = stagePnpmLockfile({ sourcePath: source, cwd: repository });
    assert.match(blob, /^[0-9a-f]{40,64}$/);

    const staged = execFileSync('git', ['show', ':pnpm-lock.yaml'], {
      cwd: repository,
      encoding: 'utf8',
    });
    assert.equal(staged, lockfile);

    const invalid = join(scratch, 'not-a-lockfile.txt');
    writeFileSync(invalid, lockfile);
    assert.throws(
      () => stagePnpmLockfile({ sourcePath: invalid, cwd: repository }),
      /SOURCE_BASENAME_MUST_BE_PNPM_LOCK/,
    );

    writeFileSync(source, '');
    assert.throws(
      () => stagePnpmLockfile({ sourcePath: source, cwd: repository }),
      /LOCKFILE_EMPTY/,
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('builder keeps a finite max-turns cap with headroom over the W3A run (63 turns)', () => {
  const workflow = readFileSync(
    new URL('../../.github/workflows/autopilot-builder.yml', import.meta.url),
    'utf8',
  );
  const caps = [...workflow.matchAll(/--max-turns\s+(\d+)/g)].map((m) => Number(m[1]));
  assert.equal(caps.length, 1, 'builder must declare exactly one --max-turns');
  assert.ok(caps[0] >= 80, `cap ${caps[0]} would fail a 63-turn successful session`);
  assert.ok(caps[0] <= 100, `cap ${caps[0]} is no longer a tight loop bound`);
});
