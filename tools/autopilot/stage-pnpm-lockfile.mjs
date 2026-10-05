#!/usr/bin/env node

import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { basename, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export function stagePnpmLockfile({ sourcePath, cwd = process.cwd() }) {
  if (!sourcePath) throw new Error('SOURCE_PATH_REQUIRED');

  const absolute = resolve(sourcePath);
  if (basename(absolute) !== 'pnpm-lock.yaml') throw new Error('SOURCE_BASENAME_MUST_BE_PNPM_LOCK');

  const content = readFileSync(absolute);
  if (content.length === 0) throw new Error('LOCKFILE_EMPTY');

  const text = content.toString('utf8');
  if (!/^lockfileVersion:\s*['"]?[0-9.]+['"]?/m.test(text)) {
    throw new Error('LOCKFILE_FORMAT_INVALID');
  }

  const blob = execFileSync('git', ['hash-object', '-w', '--stdin'], {
    cwd,
    input: content,
    encoding: 'utf8',
  }).trim();

  if (!/^[0-9a-f]{40,64}$/.test(blob)) throw new Error('GIT_BLOB_SHA_INVALID');

  execFileSync(
    'git',
    ['update-index', '--add', '--cacheinfo', '100644', blob, 'pnpm-lock.yaml'],
    { cwd, stdio: ['ignore', 'pipe', 'pipe'] },
  );

  return blob;
}

function main() {
  const sourcePath = process.argv[2];
  const blob = stagePnpmLockfile({ sourcePath });
  console.log(`STAGED_PNPM_LOCKFILE blob=${blob}`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  try {
    main();
  } catch (error) {
    console.error(`::error::STAGE_PNPM_LOCKFILE ${error.message}`);
    process.exit(2);
  }
}
