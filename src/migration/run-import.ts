import { readFileSync } from 'node:fs';
import path from 'node:path';
import type { Payload } from 'payload';
import { getPayload } from 'payload';
import config from '../payload.config';
import { getDatabaseUrl } from '../lib/database';
import { assertImportAllowed, describeMode, initAfterGuard, parseArgs } from './cli';
import { parseExternalInput } from './external-input';
import manifest from './legacy-manifest.json';
import { formatReport, runLegacyImport } from './importer';
import type { LegacyManifest } from './legacy.mjs';

// Manual, local/staging-only: `pnpm migrate:legacy [--input <file outside the repo>] [--write]`.
// Dry-run by default; never wired into build/start/CI deploy.
// Everything that can be checked without a database (arguments, guard, input file, input shape) runs first,
// so an invalid input never starts Payload and never writes. Messages never echo input values.
let payload: Payload | undefined;
let exitCode = 0;
try {
  const args = parseArgs(process.argv.slice(2));
  const guard = {
    write: args.write,
    env: process.env,
    databaseUrl: getDatabaseUrl(),
    repoRoot: path.resolve(import.meta.dirname, '../..'),
    inputPath: args.input,
  };
  assertImportAllowed(guard);

  let externalInput: unknown;
  if (args.input) {
    let text: string;
    try {
      text = readFileSync(args.input, 'utf8');
    } catch {
      throw new Error('Input file could not be read');
    }
    try {
      externalInput = JSON.parse(text) as unknown;
    } catch {
      throw new Error('Input file is not valid JSON');
    }
    parseExternalInput(externalInput, manifest as LegacyManifest);
  }

  try {
    console.log(describeMode(args.write));
    payload = await initAfterGuard(guard, () => getPayload({ config }));
    const report = await runLegacyImport(payload, { write: args.write, externalInput });
    console.log(formatReport(report));
    console.log(JSON.stringify(report, null, 2));
  } catch (error) {
    const { name, code } = error as { name?: string; code?: string };
    throw new Error(`Import failed (${[name, code].filter(Boolean).join(' ')}); details withheld to avoid logging private data`);
  }
} catch (error) {
  console.error(`Import aborted: ${(error as Error).message}`);
  exitCode = 1;
} finally {
  await payload?.destroy();
}
process.exit(exitCode);
