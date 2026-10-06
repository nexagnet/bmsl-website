// Container entrypoint: validates the runtime contract, then runs `next start` bound to 0.0.0.0 and the platform PORT.
// Fails closed (exit 1, fixed message, no values printed) when DATABASE_URL / PAYLOAD_SECRET are missing, when
// BMSL_MEDIA_DIR is missing or not an absolute path, or when the media directory is not writable by this (non-root) user.
// It never runs migrations itself: Payload applies the committed migrations (prodMigrations) when the service
// initializes at runtime, never during the image build. No advisory lock is claimed for that step, so a single
// instance is required.
/* global process, console */
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/** Pure planning step (unit-tested). Throws Error with a fixed, value-free message on any contract violation. */
export function planStart(env = process.env) {
  for (const name of ['DATABASE_URL', 'PAYLOAD_SECRET']) {
    if (!env[name]?.trim()) throw new Error(`${name} is required`);
  }
  const rawPort = env.PORT?.trim() || '3000';
  const port = Number(rawPort);
  if (!/^\d+$/.test(rawPort) || port < 1 || port > 65535) throw new Error('PORT must be an integer from 1 to 65535');
  // Required in the container: the default media/ directory would be ephemeral container storage.
  const rawMedia = env.BMSL_MEDIA_DIR?.trim();
  if (!rawMedia) throw new Error('BMSL_MEDIA_DIR is required (absolute path of the persistent media volume)');
  if (!path.isAbsolute(rawMedia)) throw new Error('BMSL_MEDIA_DIR must be an absolute path');
  return {
    port,
    mediaDir: path.resolve(rawMedia),
    args: [path.join(root, 'node_modules', 'next', 'dist', 'bin', 'next'), 'start', '-H', '0.0.0.0', '-p', String(port)],
  };
}

/** The media directory must exist (created if missing) and be writable by the runtime user: no silent ephemeral use. */
export function assertMediaWritable(dir, fsApi = fs) {
  try {
    fsApi.mkdirSync(dir, { recursive: true });
    fsApi.accessSync(dir, fs.constants.W_OK);
  } catch {
    throw new Error('BMSL_MEDIA_DIR is not writable by the runtime user');
  }
}

export function main(env = process.env) {
  let plan;
  try {
    plan = planStart(env);
    assertMediaWritable(plan.mediaDir);
  } catch (error) {
    console.error(`container-start: ${error instanceof Error ? error.message : 'invalid configuration'}`);
    return 1;
  }
  const child = spawn(process.execPath, plan.args, { cwd: root, env, stdio: 'inherit' });
  for (const signal of ['SIGTERM', 'SIGINT']) process.on(signal, () => child.kill(signal));
  child.on('exit', (code, signal) => process.exit(code ?? (signal ? 1 : 0)));
  child.on('error', () => process.exit(1));
  return undefined;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const code = main();
  if (code !== undefined) process.exitCode = code;
}
