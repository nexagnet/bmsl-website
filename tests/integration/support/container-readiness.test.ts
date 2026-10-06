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

describe('Dockerfile / .dockerignore assumptions', () => {
  const docker = read('Dockerfile');

  it('pins Node 22, pnpm 10.34.4, frozen lockfile and the ordinary build', () => {
    expect(docker).toMatch(/FROM node:22\S* AS base/);
    expect(docker).toContain('pnpm@10.34.4');
    expect(docker).toContain('pnpm install --frozen-lockfile');
    expect(docker).toMatch(/RUN pnpm build\b/);
  });

  it('runs as non-root and never applies migrations or injects secrets at build time', () => {
    expect(docker).toMatch(/^USER node$/m);
    expect(docker).not.toMatch(/migrate|seed|DATABASE_URL|PAYLOAD_SECRET|ARG |COPY \. /);
    expect(docker).toContain('container-start.mjs');
  });

  it('keeps credentials, env files, media, backups and VCS out of the build context', () => {
    const ignore = read('.dockerignore').split('\n').map((l) => l.trim());
    for (const entry of ['.git', '.env', '.env.*', 'media', 'backups', 'node_modules', '.next', '*.bmslarc', '*.dump']) {
      expect(ignore).toContain(entry);
    }
    expect(ignore).toContain('!.env.example');
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
