import path from 'node:path';
import type { Payload } from 'payload';
import { getPayload } from 'payload';
import { getDatabaseUrl } from '../../lib/database';
import { assertImportAllowed, describeMode } from '../../migration/cli';
import config from '../../payload.config';
import { formatSeedReport, loadPack, runSeed } from './loader';

// Manual, local/staging-only: `pnpm seed:bmsl-legacy [--dry-run | --write]`. Dry-run is the default.
//   * Offline: reads only the committed pack in src/seed/bmsl-legacy (no WordPress, no network).
//   * Never wired into build, start or deploy. Writes are refused when NODE_ENV=production and when the database
//     host is not local, unless BMSL_IMPORT_ALLOW_STAGING=true is set for an isolated staging database.
//   * The pack is validated BEFORE Payload starts: an invalid pack writes nothing.
//   * Existing records are never modified; a second run creates nothing. Everything is a draft/UNCONFIRMED.
// Messages never echo content values.
function parseSeedArgs(argv: readonly string[]): { write: boolean } {
  let write = false;
  let explicitDryRun = false;
  for (const arg of argv) {
    if (arg === '--write') write = true;
    else if (arg === '--dry-run') explicitDryRun = true;
    else throw new Error(`Unknown argument: ${arg}`);
  }
  if (write && explicitDryRun) throw new Error('--write and --dry-run cannot be combined');
  return { write };
}

let payload: Payload | undefined;
let exitCode = 0;
try {
  const args = parseSeedArgs(process.argv.slice(2));
  assertImportAllowed({
    write: args.write,
    env: process.env,
    databaseUrl: getDatabaseUrl(),
    repoRoot: path.resolve(import.meta.dirname, '../../..'),
  });
  const loaded = loadPack();
  try {
    console.log(describeMode(args.write));
    payload = await getPayload({ config });
    const report = await runSeed(payload, loaded, { write: args.write });
    console.log(formatSeedReport(report));
    console.log(JSON.stringify({ ...report, created: report.created.length, skipped: report.skipped.length }, null, 2));
  } catch (error) {
    const { name, code } = error as { name?: string; code?: string };
    throw new Error(`Seed failed (${[name, code].filter(Boolean).join(' ')}); details withheld to avoid logging content`);
  }
} catch (error) {
  console.error(`Seed aborted: ${(error as Error).message}`);
  exitCode = 1;
} finally {
  await payload?.destroy();
}
process.exit(exitCode);
