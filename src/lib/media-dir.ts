import path from 'node:path';

export const MEDIA_DIR_ENV = 'BMSL_MEDIA_DIR';

/**
 * Where uploaded media lives on disk. Defaults to the repository `media/` directory; an operator who hosts media on a
 * separate volume sets BMSL_MEDIA_DIR to an ABSOLUTE path. A relative value is refused instead of being resolved
 * against whatever the working directory happens to be (fail closed, never a silent fallback).
 */
export function resolveMediaDir(env: Record<string, string | undefined>, defaultDir: string): string {
  const raw = env[MEDIA_DIR_ENV]?.trim();
  if (!raw) return defaultDir;
  if (!path.isAbsolute(raw)) throw new Error(`${MEDIA_DIR_ENV} must be an absolute path`);
  return path.resolve(raw);
}
