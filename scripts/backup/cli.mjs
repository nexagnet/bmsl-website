// Operator entrypoint. Every input is an explicit flag; database URLs are read from the NAMED environment variable so
// that no credential appears in a process argument list, shell history or log. Output is JSON without secrets, and a
// failure prints only `toPublicError` text (fixed descriptions, tool name + exit/signal/timeout, SQLSTATE/system codes):
// never PostgreSQL tool output, row values or connection details.
//
//   node scripts/backup/cli.mjs backup  --out DIR --source-commit SHA --media-dir DIR --database-url-env NAME --confirm-writes-paused
//   node scripts/backup/cli.mjs verify  --bundle DIR
//   node scripts/backup/cli.mjs restore --bundle DIR --target-dir DIR --database-name bmsl_restore_<hex> --admin-database-url-env NAME [--cleanup]
//
// See docs/runbooks/backup-restore.md.
/* global process, console */
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { createBackup, newRestoreDatabaseName, restoreBundle, verifyBundle } from './bundle.mjs';
import { parseDatabaseUrl, toPublicError } from './safety.mjs';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

const needEnv = (env, flag, name) => {
  if (!name) throw new Error(`${flag} is required (the NAME of an environment variable that holds the database URL)`);
  const value = env[name];
  if (!value) throw new Error(`environment variable ${name} is empty or unset`);
  return value;
};

/** Passwords of the database URLs named on the command line, so a failure message can be scrubbed of them. */
export function secretsFromArgs(argv, env) {
  const secrets = [];
  argv.forEach((arg, i) => {
    if (arg !== '--database-url-env' && arg !== '--admin-database-url-env') return;
    try {
      const password = parseDatabaseUrl(env[argv[i + 1] ?? ''] ?? '').password;
      if (password) secrets.push(password);
    } catch {
      /* an unusable URL has nothing to scrub */
    }
  });
  return secrets;
}

export async function main(argv, env = process.env) {
  const [command, ...rest] = argv;
  const common = { allowPositionals: false, strict: true };
  if (command === 'backup') {
    const { values } = parseArgs({
      args: rest,
      ...common,
      options: {
        out: { type: 'string' },
        'source-commit': { type: 'string' },
        'media-dir': { type: 'string' },
        'database-url-env': { type: 'string' },
        'confirm-writes-paused': { type: 'boolean' },
        'timeout-seconds': { type: 'string' },
      },
    });
    const result = await createBackup({
      outDir: values.out,
      sourceCommit: values['source-commit'],
      mediaDir: values['media-dir'],
      databaseUrl: needEnv(env, '--database-url-env', values['database-url-env']),
      confirmWritesPaused: values['confirm-writes-paused'] === true,
      repoRoot,
      timeoutMs: values['timeout-seconds'] ? Number(values['timeout-seconds']) * 1000 : undefined,
    });
    return { ok: true, bundle: result.bundleDir, source: result.manifest.source.commit, migrations: result.manifest.database.migrations.length, mediaFiles: result.manifest.media.fileCount };
  }
  if (command === 'verify') {
    const { values } = parseArgs({ args: rest, ...common, options: { bundle: { type: 'string' } } });
    if (!values.bundle) throw new Error('--bundle is required');
    const manifest = verifyBundle(values.bundle);
    return { ok: true, source: manifest.source.commit, createdAt: manifest.createdAt };
  }
  if (command === 'restore') {
    const { values } = parseArgs({
      args: rest,
      ...common,
      options: {
        bundle: { type: 'string' },
        'target-dir': { type: 'string' },
        'database-name': { type: 'string' },
        'admin-database-url-env': { type: 'string' },
        cleanup: { type: 'boolean' },
        'timeout-seconds': { type: 'string' },
      },
    });
    if (!values.bundle) throw new Error('--bundle is required');
    const result = await restoreBundle({
      bundleDir: values.bundle,
      targetDir: values['target-dir'],
      databaseName: values['database-name'] ?? undefined,
      adminDatabaseUrl: needEnv(env, '--admin-database-url-env', values['admin-database-url-env']),
      repoRoot,
      timeoutMs: values['timeout-seconds'] ? Number(values['timeout-seconds']) * 1000 : undefined,
    });
    const report = { ok: true, created: result.resources, verification: result.verification, cleanedUp: false };
    if (values.cleanup) {
      await result.cleanup();
      report.cleanedUp = true;
    } else {
      report.note = 'resources were kept; drop the database and delete the directory listed under "created" when finished';
    }
    return report;
  }
  throw new Error(`usage: cli.mjs <backup|verify|restore> [flags]; generate a restore name with: node -e "console.log('${newRestoreDatabaseName()}')"`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    console.log(JSON.stringify(await main(process.argv.slice(2))));
    process.exit(0);
  } catch (error) {
    console.error(JSON.stringify({ ok: false, error: toPublicError(error, secretsFromArgs(process.argv.slice(2), process.env)) }));
    process.exit(1);
  }
}
