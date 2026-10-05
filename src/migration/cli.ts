import path from 'node:path';

export type CliArgs = { write: boolean; input?: string };

/** Dry-run unless `--write` is passed explicitly. */
export function parseArgs(argv: readonly string[]): CliArgs {
  const args: CliArgs = { write: false };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--write') args.write = true;
    else if (arg === '--input') {
      const value = argv[(i += 1)];
      if (!value || value.startsWith('--')) throw new Error('--input requires a file path');
      args.input = value;
    } else throw new Error(`Unknown argument: ${arg}`);
  }
  return args;
}

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '::1', '[::1]']);

/** Throws unless the run is safe: local/staging only, never production, never raw input inside this repo. */
export function assertImportAllowed(options: {
  write: boolean;
  env: Record<string, string | undefined>;
  databaseUrl: string;
  repoRoot: string;
  inputPath?: string;
}): void {
  const { write, env, databaseUrl, repoRoot, inputPath } = options;
  if (inputPath) {
    const rel = path.relative(repoRoot, path.resolve(inputPath));
    if (rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel))) {
      throw new Error('Refusing input stored inside this public repository; keep raw legacy data outside the repo');
    }
  }
  if (!write) return;
  if (env.NODE_ENV === 'production') throw new Error('Refusing to write in production');
  const host = new URL(databaseUrl).hostname;
  if (!LOCAL_HOSTS.has(host) && env.BMSL_IMPORT_ALLOW_STAGING !== 'true') {
    throw new Error(`Refusing to write to a non-local database (${host}); set BMSL_IMPORT_ALLOW_STAGING=true only for staging`);
  }
}
