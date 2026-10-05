import { describe, expect, it } from 'vitest';
import { BUILD_PHASE, buildSteps, runBuild } from '../../../scripts/build.mjs';

type Call = { node: string; args: string[]; env: Record<string, string | undefined> };
const fake = (statuses: (number | Error)[]) => {
  const calls: Call[] = [];
  const spawn = (node: string, args: string[], opts: { env: Record<string, string | undefined> }) => {
    calls.push({ node, args, env: opts.env });
    const s = statuses[calls.length - 1] ?? 0;
    return s instanceof Error ? { error: s, status: null } : { status: s };
  };
  return { calls, spawn };
};
const quiet = () => {
  const orig = console.error;
  console.error = () => undefined;
  return () => (console.error = orig);
};

describe('portable ordinary build launcher', () => {
  it('generates the import map first, then runs next build', () => {
    const { calls, spawn } = fake([0, 0]);
    expect(runBuild({ spawn, env: {}, cwd: '/r', steps: buildSteps('/r') })).toBe(0);
    expect(calls).toHaveLength(2);
    expect(calls[0]?.args.join(' ')).toMatch(/payload.*bin\.js generate:importmap$/);
    expect(calls[1]?.args.join(' ')).toMatch(/next.*bin.*next build$/);
  });

  it('scopes NEXT_PHASE to the generator only and keeps the caller env otherwise', () => {
    const { calls, spawn } = fake([0, 0]);
    runBuild({ spawn, env: { KEEP: 'yes' }, cwd: '/r', steps: buildSteps('/r') });
    expect(calls[0]?.env).toMatchObject({ NEXT_PHASE: BUILD_PHASE, KEEP: 'yes' });
    expect(calls[1]?.env.NEXT_PHASE).toBeUndefined();
    expect(calls[1]?.env.KEEP).toBe('yes');
  });

  it('never invents database or secret values for either step', () => {
    const { calls, spawn } = fake([0, 0]);
    runBuild({ spawn, env: {}, cwd: '/r', steps: buildSteps('/r') });
    for (const c of calls) {
      expect(c.env.DATABASE_URL).toBeUndefined();
      expect(c.env.PAYLOAD_SECRET).toBeUndefined();
    }
  });

  it('aborts without running next build when the generator fails', () => {
    const restore = quiet();
    const { calls, spawn } = fake([3, 0]);
    expect(runBuild({ spawn, env: {}, cwd: '/r', steps: buildSteps('/r') })).toBe(3);
    restore();
    expect(calls).toHaveLength(1);
  });

  it('aborts when the generator cannot start, and propagates a next build failure', () => {
    const restore = quiet();
    const a = fake([new Error('ENOENT')]);
    expect(runBuild({ spawn: a.spawn, env: {}, cwd: '/r', steps: buildSteps('/r') })).toBe(1);
    expect(a.calls).toHaveLength(1);
    const b = fake([0, 2]);
    expect(runBuild({ spawn: b.spawn, env: {}, cwd: '/r', steps: buildSteps('/r') })).toBe(2);
    restore();
  });

  it('invokes node directly (no shell prefix), so it is valid under Windows cmd', () => {
    const { calls, spawn } = fake([0, 0]);
    runBuild({ spawn, env: {}, cwd: '/r', steps: buildSteps('/r'), node: 'node' });
    expect(calls.every((c) => c.node === 'node')).toBe(true);
  });
});
