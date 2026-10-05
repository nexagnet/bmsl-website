import { readFileSync } from 'node:fs';
import path from 'node:path';
import { getPayload, type Payload } from 'payload';
import config from '../payload.config';
import { getDatabaseUrl } from '../lib/database';
import { assertImportAllowed, parseArgs } from './cli';
import { formatReport, runLegacyImport } from './importer';
import { parseExternalInput } from './external-input';
import manifest from './legacy-manifest.json';
import type { LegacyManifest } from './legacy.mjs';

// Manual, local/staging-only: `pnpm migrate:legacy [--input <file outside the repo>] [--write]`.
// Dry-run by default; never wired into build/start/CI deploy.
let payload: Payload | undefined;
let exitCode = 0;
try {
  const args = parseArgs(process.argv.slice(2));
  assertImportAllowed({
    write: args.write,
    env: process.env,
    databaseUrl: getDatabaseUrl(),
    repoRoot: path.resolve(import.meta.dirname, '../..'),
    inputPath: args.input,
  });

  let externalInput: unknown;
  if (args.input) {
    try {
      externalInput = JSON.parse(readFileSync(args.input, 'utf8'));
    } catch {
      // The parser message can quote raw private input, so it is never printed.
      throw new Error('External input file could not be read or is not valid JSON');
    }
    // Fail before Payload or the database is even initialised.
    parseExternalInput(externalInput, manifest as LegacyManifest);
  }

  payload = await getPayload({ config });
  const report = await runLegacyImport(payload, { write: args.write, externalInput });
  console.log(formatReport(report));
  console.log(JSON.stringify(report, null, 2));
} catch (error) {
  exitCode = 1;
  console.error(`Legacy import failed: ${error instanceof Error ? error.message : 'unknown error'}`);
} finally {
  await payload?.destroy();
}
process.exit(exitCode);
