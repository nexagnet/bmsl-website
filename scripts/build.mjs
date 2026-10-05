// Ordinary application build, portable across shells (POSIX sh, Windows cmd, PowerShell):
//   1. `payload generate:importmap` with NEXT_PHASE=phase-production-build set for THAT child only, so the Payload
//      config loads without a database exactly as it does under `next build` (see resolvePayloadEnv);
//   2. `next build` with the caller's environment untouched, so production runtime env stays fail-fast.
// A failed or signalled generator aborts the build before `next build` starts.
/* global process, console */
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export const BUILD_PHASE = 'phase-production-build';

export const buildSteps = (rootDir = root) => [
  {
    name: 'payload generate:importmap',
    script: path.join(rootDir, 'node_modules', 'payload', 'bin.js'),
    args: ['generate:importmap'],
    env: { NEXT_PHASE: BUILD_PHASE },
  },
  {
    name: 'next build',
    script: path.join(rootDir, 'node_modules', 'next', 'dist', 'bin', 'next'),
    args: ['build'],
    env: {},
  },
];

/** Runs the steps in order with `node`, no shell. Returns the exit code of the first failing step, else 0. */
export function runBuild({ spawn = spawnSync, env = process.env, cwd = root, steps = buildSteps(cwd), node = process.execPath } = {}) {
  for (const step of steps) {
    const result = spawn(node, [step.script, ...step.args], { cwd, env: { ...env, ...step.env }, stdio: 'inherit' });
    if (result.error) {
      console.error(`build: ${step.name} could not start: ${result.error.message}`);
      return 1;
    }
    if (result.status !== 0) {
      console.error(`build: ${step.name} failed (${result.signal ?? `exit ${result.status}`}); aborting`);
      return result.status || 1;
    }
  }
  return 0;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exitCode = runBuild();
}
