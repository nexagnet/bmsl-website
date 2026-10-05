import { readFileSync } from 'node:fs';
import path from 'node:path';
import { getPayload } from 'payload';
import config from '../payload.config';
import { getDatabaseUrl } from '../lib/database';
import { assertImportAllowed, parseArgs } from './cli';
import { formatReport, runLegacyImport } from './importer';

// Manual, local/staging-only: `pnpm migrate:legacy [--input <file outside the repo>] [--write]`.
// Dry-run by default; never wired into build/start/CI deploy.
const args = parseArgs(process.argv.slice(2));
assertImportAllowed({
  write: args.write,
  env: process.env,
  databaseUrl: getDatabaseUrl(),
  repoRoot: path.resolve(import.meta.dirname, '../..'),
  inputPath: args.input,
});

const externalInput = args.input ? (JSON.parse(readFileSync(args.input, 'utf8')) as unknown) : undefined;
const payload = await getPayload({ config });
const report = await runLegacyImport(payload, { write: args.write, externalInput });
console.log(formatReport(report));
console.log(JSON.stringify(report, null, 2));
await payload.destroy();
process.exit(0);
