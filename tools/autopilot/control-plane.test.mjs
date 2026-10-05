import test from 'node:test';
import assert from 'node:assert/strict';

import { REQUIRED_CHECKS } from './autopilot-core.mjs';
import { evaluatePreflight } from './preflight.mjs';
import { decideAutonomy, evaluateRequiredChecks } from './policy.mjs';
import { isProtectedPath } from './validate-diff.mjs';

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
