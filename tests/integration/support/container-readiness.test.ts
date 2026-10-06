import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { assertMediaWritable, main, planStart } from '../../../scripts/container-start.mjs';

const root = path.resolve(import.meta.dirname, '../../..');
const read = (name: string) => readFileSync(path.join(root, name), 'utf8');
const ok = { DATABASE_URL: 'postgresql://x', PAYLOAD_SECRET: 's', BMSL_MEDIA_DIR: '/data/media' };

describe('container start contract', () => {
  it('binds 0.0.0.0 on the platform PORT (default 3000)', () => {
    expect(planStart(ok).args.slice(-4)).toEqual(['-H', '0.0.0.0', '-p', '3000']);
    expect(planStart({ ...ok, PORT: '8080' }).args.slice(-2)).toEqual(['-p', '8080']);
    for (const PORT of ['0', '70000', 'abc', '80;ls']) expect(() => planStart({ ...ok, PORT })).toThrow('PORT');
  });

  it('fails closed without DATABASE_URL / PAYLOAD_SECRET and never prints their values', () => {
    expect(() => planStart({ ...ok, DATABASE_URL: ' ' })).toThrow('DATABASE_URL is required');
    expect(() => planStart({ ...ok, PAYLOAD_SECRET: undefined })).toThrow('PAYLOAD_SECRET is required');
    const errors: unknown[] = [];
    const orig = console.error;
    console.error = (m: unknown) => void errors.push(m);
    try {
      expect(main({ ...ok, DATABASE_URL: undefined, PAYLOAD_SECRET: 'top-secret-value' })).toBe(1);
    } finally {
      console.error = orig;
    }
    expect(JSON.stringify(errors)).not.toContain('top-secret-value');
  });

  it('requires an absolute, writable persistent media directory', () => {
    expect(() => planStart({ ...ok, BMSL_MEDIA_DIR: undefined })).toThrow('BMSL_MEDIA_DIR is required');
    expect(() => planStart({ ...ok, BMSL_MEDIA_DIR: 'media' })).toThrow('absolute');
    expect(() =>
      assertMediaWritable('/x', {
        mkdirSync: () => undefined,
        accessSync: () => {
          throw new Error('EACCES');
        },
      }),
    ).toThrow('not writable');
  });
});

/** Files tracked by Git (what a clean checkout / `docker build` context of the repository really contains). */
const trackedFiles = (): Set<string> =>
  new Set(execFileSync('git', ['ls-files', '-z'], { cwd: root, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }).split('\0').filter(Boolean));

/** Minimal .dockerignore matcher for the entry shapes this repository uses (name, name/, *.ext, prefix.*, !negation). */
function ignored(rel: string, patterns: string[]): boolean {
  const segments = rel.split('/');
  let result = false;
  for (const raw of patterns) {
    const negate = raw.startsWith('!');
    const p = (negate ? raw.slice(1) : raw).replace(/\/$/, '');
    const hit =
      p.startsWith('*.') ? rel.endsWith(p.slice(1))
      : p.endsWith('.*') ? segments[0]!.startsWith(p.slice(0, -1))
      : rel === p || rel.startsWith(`${p}/`);
    if (hit) result = !negate;
  }
  return result;
}

/** Sources of every `COPY` that reads from the build context (not `--from=`), relative to the context root. */
const contextCopySources = (docker: string): string[] =>
  docker
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => /^COPY\s/.test(l) && !l.includes('--from='))
    .flatMap((l) => l.replace(/^COPY\s+/, '').split(/\s+/).slice(0, -1));

describe('Dockerfile / .dockerignore assumptions', () => {
  const docker = read('Dockerfile');

  it('pins Node 22, pnpm 10.34.4, frozen lockfile and the ordinary build', () => {
    expect(docker).toMatch(/FROM node:22\S* AS base/);
    expect(docker).toContain('pnpm@10.34.4');
    expect(docker).toContain('pnpm install --frozen-lockfile');
    expect(docker).toMatch(/RUN pnpm build\b/);
  });

  it('runs as non-root and never applies migrations or injects secrets at build time', () => {
    // Explicit user AND group (Northflank derives persistent-volume ownership from the image group).
    expect(docker).toMatch(/^USER node:node$/m);
    expect(docker).toContain('chown -R node:node /data/media');
    // The trusted CD gate ships in the image and needs no application secrets.
    expect(docker).toContain('COPY --from=build /app/scripts/cd/gate-main-ci.mjs ./scripts/cd/gate-main-ci.mjs');
    expect(docker).not.toMatch(/migrate|seed|DATABASE_URL|PAYLOAD_SECRET|COPY \. /);
    expect(docker).toContain('container-start.mjs');
  });

  it('only exposes the two NON-SECRET header switches as build args, both defaulting to off', () => {
    const args = docker.split('\n').filter((l) => /^ARG /.test(l.trim()));
    expect(args.map((l) => l.trim())).toEqual(['ARG HSTS_ENABLED=false', 'ARG CSP_ALLOW_GA4=false']);
  });

  it('keeps credentials, env files, media, backups and VCS out of the build context', () => {
    const ignore = read('.dockerignore').split('\n').map((l) => l.trim());
    for (const entry of ['.git', '.env', '.env.*', 'media', 'backups', 'node_modules', '.next', '*.bmslarc', '*.dump']) {
      expect(ignore).toContain(entry);
    }
    expect(ignore).toContain('!.env.example');
  });

  it('every COPY input from the build context is tracked in Git and not excluded by .dockerignore', () => {
    const sources = contextCopySources(docker);
    expect(sources).toEqual(expect.arrayContaining(['package.json', 'pnpm-lock.yaml', 'tsconfig.json', 'next.config.mjs', 'scripts', 'src']));
    const tracked = trackedFiles();
    const patterns = read('.dockerignore')
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l && !l.startsWith('#'));
    for (const src of sources) {
      const clean = src.replace(/\/$/, '');
      const isTracked = tracked.has(clean) || [...tracked].some((f) => f.startsWith(`${clean}/`));
      expect(isTracked, `COPY input "${src}" is not tracked in Git (a clean checkout cannot build)`).toBe(true);
      expect(ignored(clean, patterns), `COPY input "${src}" is excluded by .dockerignore`).toBe(false);
    }
    // Regression: a previous revision copied a .npmrc that this repository does not track.
    expect(sources).not.toContain('.npmrc');
  });

  it('the files the build imports from outside src/ are copied into the build stage', () => {
    const sources = new Set(contextCopySources(docker).map((s) => s.replace(/\/$/, '')));
    const copiedBy = (rel: string) => sources.has(rel) || [...sources].some((s) => rel.startsWith(`${s}/`));
    // next.config.mjs relative imports, and the modules scripts/build.mjs runs, must be inside copied paths.
    const imports = [...read('next.config.mjs').matchAll(/from '\.\/([^']+)'/g)].map((m) => m[1]!);
    expect(imports.length).toBeGreaterThan(0);
    for (const rel of imports) expect(copiedBy(rel), `${rel} is imported by next.config.mjs but not COPY'd`).toBe(true);
    expect(copiedBy('scripts/build.mjs')).toBe(true);
    expect(copiedBy('scripts/container-start.mjs')).toBe(true);
  });
});

describe('health route', () => {
  const route = read('src/app/healthz/route.ts');
  it('is GET-only, dynamic, and reuses the Payload singleton instead of creating a pool', () => {
    expect(route).toContain('export const GET');
    expect(route).toMatch(/export const dynamic = 'force-dynamic'/);
    expect(route).not.toMatch(/export const (POST|PUT|PATCH|DELETE)|new Pool|new pg\.|pg\.Client|new Client/);
    expect(route).toContain('getPayload({ config })');
  });
});
