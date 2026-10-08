import path from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { assertImportAllowed, describeMode, initAfterGuard, parseArgs } from './cli';
import { ExternalInputError, parseExternalInput } from './external-input';
import manifest from './legacy-manifest.json';

const repoRoot = path.resolve(__dirname, '../..');
const approved = { contentApproved: true, approvedBy: 'synthetic approver', approvedAt: '2026-01-01' };
const base = { legacyUrl: '/xu-huong-phat-trien-nganh-dich-vu-bao-ve-co-hoi-va-thach-thuc/', title: 'Synthetic title' };

describe('cli arguments', () => {
  it('is dry-run unless --write is passed', () => {
    expect(parseArgs([]).write).toBe(false);
    expect(parseArgs(['--input', '/x/y.json']).write).toBe(false);
    expect(parseArgs(['--write']).write).toBe(true);
    expect(parseArgs(['--input', '/x/y.json'])).toMatchObject({ input: '/x/y.json' });
  });

  it('rejects unknown flags and a missing --input value', () => {
    expect(() => parseArgs(['--force'])).toThrow();
    expect(() => parseArgs(['--input'])).toThrow();
  });
});

describe('import safety guard', () => {
  const local = 'postgresql://u:p@localhost:5432/bmsl_test';
  const ok = { write: true, env: {}, databaseUrl: local, repoRoot };

  it('allows dry-run and local writes', () => {
    expect(() => assertImportAllowed({ ...ok, write: false })).not.toThrow();
    expect(() => assertImportAllowed(ok)).not.toThrow();
  });

  it('refuses writes in production or against a non-local DB without explicit staging opt-in', () => {
    expect(() => assertImportAllowed({ ...ok, env: { NODE_ENV: 'production' } })).toThrow(/production/i);
    // NODE_ENV=production on a local DB with no declaration is still denied
    expect(() => assertImportAllowed({ ...ok, env: { NODE_ENV: 'production', BMSL_IMPORT_ALLOW_STAGING: 'true' } })).toThrow(/BMSL_IMPORT_TARGET_ENV/);
    const remote = 'postgresql://u:p@db.example.test:5432/bmsl';
    expect(() => assertImportAllowed({ ...ok, databaseUrl: remote })).toThrow(/non-local|staging/i);
    // staging permission alone is no longer enough: a complete declaration + ack is required
    expect(() => assertImportAllowed({ ...ok, databaseUrl: remote, env: { BMSL_IMPORT_ALLOW_STAGING: 'true' } })).toThrow(/BMSL_IMPORT_TARGET_ENV/);
    expect(() =>
      assertImportAllowed({ ...ok, databaseUrl: remote, env: { NODE_ENV: 'development', BMSL_IMPORT_ALLOW_STAGING: 'true' } }),
    ).toThrow(/BMSL_IMPORT_TARGET_ENV/);
    expect(() =>
      assertImportAllowed({ ...ok, databaseUrl: remote, env: { NODE_ENV: 'production', BMSL_IMPORT_ALLOW_STAGING: 'true' } }),
    ).toThrow(/BMSL_IMPORT_TARGET_ENV/);
  });

  describe('NODE_ENV=production optimized runtime on an owner-declared DEV target', () => {
    const remote = 'postgresql://user:s3cretpw@db.dev.example.test:5432/bmsl_dev';
    const prod = { NODE_ENV: 'production' };
    const declared = {
      ...prod,
      BMSL_IMPORT_ALLOW_STAGING: 'true',
      BMSL_IMPORT_TARGET_ENV: 'dev',
      BMSL_IMPORT_TARGET_ACK: 'db.dev.example.test/bmsl_dev',
    };
    const run = (env: Record<string, string | undefined>, over: Record<string, unknown> = {}) =>
      assertImportAllowed({ ...ok, databaseUrl: remote, env, ...over });

    it('allows write with declaration + exact ack + staging permission, without touching NODE_ENV', () => {
      const env = { ...declared };
      expect(() => run(env)).not.toThrow();
      expect(env.NODE_ENV).toBe('production');
      expect(() => run({ ...declared, BMSL_IMPORT_TARGET_ENV: 'staging' })).not.toThrow();
      expect(() => assertImportAllowed({ ...ok, env: { ...declared, BMSL_IMPORT_TARGET_ACK: 'localhost/bmsl_test' } })).not.toThrow();
    });

    it('fails closed on absent, production, unknown or ambiguous declaration', () => {
      for (const v of [undefined, '', 'production', 'prod', 'test', 'dev,production']) {
        const env = { ...declared, BMSL_IMPORT_TARGET_ENV: v };
        expect(() => run(env)).toThrow(/BMSL_IMPORT_TARGET_ENV/);
      }
    });

    it('fails closed on missing or mismatched acknowledgement (host or database)', () => {
      for (const ack of [undefined, '', 'db.dev.example.test', 'db.dev.example.test/other', 'other.example.test/bmsl_dev', 'DB.DEV.example.test/bmsl_dev']) {
        expect(() => run({ ...declared, BMSL_IMPORT_TARGET_ACK: ack })).toThrow(/BMSL_IMPORT_TARGET_ACK/);
      }
    });

    it('still needs explicit --write and BMSL_IMPORT_ALLOW_STAGING', () => {
      expect(() => run({ ...declared, BMSL_IMPORT_ALLOW_STAGING: undefined })).toThrow(/BMSL_IMPORT_ALLOW_STAGING/);
      expect(() => run(prod)).toThrow(/BMSL_IMPORT_ALLOW_STAGING/);
      // write absent: a non-local production-mode dry-run needs the declaration too
      expect(() => run(prod, { write: false })).toThrow(/BMSL_IMPORT_TARGET_ENV/);
      expect(() => run(declared, { write: false })).not.toThrow();
    });

    it('rejects a half-declared non-production staging write and unparseable URLs, never echoing credentials', () => {
      const env = { BMSL_IMPORT_ALLOW_STAGING: 'true', BMSL_IMPORT_TARGET_ENV: 'production' };
      expect(() => run(env)).toThrow(/BMSL_IMPORT_TARGET_ENV/);
      for (const bad of ['not a url s3cretpw', 'postgresql://user:s3cretpw@host', 'postgresql://user:s3cretpw@/db']) {
        let message = '';
        try {
          run(declared, { databaseUrl: bad });
        } catch (e) {
          message = (e as Error).message;
        }
        expect(message).not.toBe('');
        expect(message).not.toContain('s3cretpw');
      }
      for (const env2 of [{ ...declared, BMSL_IMPORT_TARGET_ACK: 'x/y' }, prod]) {
        try {
          run(env2);
        } catch (e) {
          expect((e as Error).message).not.toContain('s3cretpw');
        }
      }
    });

    it('labels dry-run as migration-capable, not read-only', () => {
      expect(describeMode(false)).toMatch(/NOT read-only/);
      expect(describeMode(true)).toMatch(/WRITE/);
    });
  });

  describe('non-local target is denied by default regardless of NODE_ENV and write/dry-run', () => {
    const remote = 'postgresql://user:s3cretpw@db.dev.example.test/bmsl_dev';
    const full = { BMSL_IMPORT_ALLOW_STAGING: 'true', BMSL_IMPORT_TARGET_ENV: 'dev', BMSL_IMPORT_TARGET_ACK: 'db.dev.example.test/bmsl_dev' };
    const run = (env: Record<string, string | undefined>, over: Record<string, unknown> = {}) =>
      assertImportAllowed({ ...ok, databaseUrl: remote, env, ...over });

    it('refuses unset/development/test NODE_ENV with only the staging flag, for write and dry-run', () => {
      for (const nodeEnv of [undefined, 'development', 'test']) {
        for (const write of [true, false]) {
          expect(() => run({ NODE_ENV: nodeEnv }, { write })).toThrow(/non-local/);
          expect(() => run({ NODE_ENV: nodeEnv, BMSL_IMPORT_ALLOW_STAGING: 'true' }, { write })).toThrow(/BMSL_IMPORT_TARGET_ENV/);
          expect(() => run({ NODE_ENV: nodeEnv, ...full, BMSL_IMPORT_TARGET_ACK: undefined }, { write })).toThrow(/BMSL_IMPORT_TARGET_ACK/);
          expect(() => run({ NODE_ENV: nodeEnv, ...full }, { write })).not.toThrow();
        }
      }
    });

    it('refuses a production declaration and a half declaration', () => {
      expect(() => run({ ...full, BMSL_IMPORT_TARGET_ENV: 'production' }, { write: false })).toThrow(/BMSL_IMPORT_TARGET_ENV/);
      expect(() => run({ BMSL_IMPORT_TARGET_ENV: 'dev', BMSL_IMPORT_TARGET_ACK: full.BMSL_IMPORT_TARGET_ACK })).toThrow(/non-local/);
    });

    it('refuses a local DB under NODE_ENV=production dry-run without declaration', () => {
      expect(() => assertImportAllowed({ ...ok, write: false, env: { NODE_ENV: 'production' } })).toThrow(/production/);
    });

    it('binds the acknowledgement to the port (implicit 5432 normalized)', () => {
      const withPort = 'postgresql://u:p@db.dev.example.test:6543/bmsl_dev';
      expect(() => run(full, { databaseUrl: withPort })).toThrow(/BMSL_IMPORT_TARGET_ACK/);
      expect(() => run({ ...full, BMSL_IMPORT_TARGET_ACK: 'db.dev.example.test:6543/bmsl_dev' }, { databaseUrl: withPort })).not.toThrow();
      expect(() => run(full, { databaseUrl: 'postgres://u:p@db.dev.example.test:5432/bmsl_dev' })).not.toThrow();
      expect(() => run({ ...full, BMSL_IMPORT_TARGET_ACK: 'db.dev.example.test:5432/bmsl_dev' })).toThrow(/BMSL_IMPORT_TARGET_ACK/);
    });

    it('refuses ambiguous or non-postgres URLs without echoing them, even for local hosts', () => {
      const bad = [
        'mysql://u:s3cretpw@db.dev.example.test/bmsl_dev',
        'http://u:s3cretpw@db.dev.example.test/bmsl_dev',
        'postgresql://u:s3cretpw@a.example.test,b.example.test/bmsl_dev',
        'postgresql://u:s3cretpw@db.dev.example.test/',
        'postgresql://u:s3cretpw@db.dev.example.test/bmsl_dev?host=prod.example.test',
        'postgresql://u:s3cretpw@db.dev.example.test/bmsl_dev?port=6543',
        'postgresql://u:s3cretpw@db.dev.example.test/bmsl_dev?dbname=prod',
        'postgresql://u:s3cretpw@db.dev.example.test/bmsl%ZZ',
        'postgresql://u:s3cretpw@localhost/bmsl_test?hostaddr=10.0.0.1',
        'postgresql://u:s3cretpw@db.dev.example.test:99999/bmsl_dev',
      ];
      for (const databaseUrl of bad) {
        let message = '';
        try {
          run(full, { databaseUrl });
        } catch (e) {
          message = (e as Error).message;
        }
        expect(message, databaseUrl.replace('s3cretpw', '***')).toMatch(/unambiguous/);
        expect(message).not.toContain('s3cretpw');
        expect(message).not.toContain('prod.example');
      }
      expect(() => run(full, { databaseUrl: `${remote}?sslmode=require` })).not.toThrow();
    });

    it('never calls the Payload initializer when the guard refuses, and calls it once when allowed', async () => {
      const init = vi.fn(async () => 'payload');
      await expect(initAfterGuard({ ...ok, write: false, databaseUrl: remote, env: {} }, init)).rejects.toThrow(/non-local/);
      await expect(initAfterGuard({ ...ok, databaseUrl: remote, env: { BMSL_IMPORT_ALLOW_STAGING: 'true' } }, init)).rejects.toThrow();
      expect(init).not.toHaveBeenCalled();
      await expect(initAfterGuard({ ...ok, write: false, databaseUrl: remote, env: full }, init)).resolves.toBe('payload');
      expect(init).toHaveBeenCalledTimes(1);
    });
  });

  it('refuses input files stored inside this public repository', () => {
    expect(() => assertImportAllowed({ ...ok, inputPath: path.join(repoRoot, 'data/articles.json') })).toThrow(/repository|repo/i);
    expect(() => assertImportAllowed({ ...ok, inputPath: '/var/private/bmsl/articles.json' })).not.toThrow();
  });
});

describe('external article input validation', () => {
  it('accepts approved input for a known article candidate; no category is forced', () => {
    const r = parseExternalInput({ articles: [{ ...base, approval: approved }] }, manifest);
    expect(r.rejected).toEqual([]);
    expect(r.pending).toEqual([]);
    expect(r.articles).toHaveLength(1);
    expect(r.articles[0]).toMatchObject({
      legacyUrl: base.legacyUrl,
      slug: 'xu-huong-phat-trien-nganh-dich-vu-bao-ve-co-hoi-va-thach-thuc',
      title: 'Synthetic title',
    });
    expect(r.articles[0].categorySlug).toBeUndefined();
  });

  it('keeps unapproved input out of the import and queues it as pending approval', () => {
    const r = parseExternalInput({ articles: [{ ...base }, { ...base, legacyUrl: '/chuc-mung-ngay-quoc-te-phu-nu-8-3/', approval: { contentApproved: false } }] }, manifest);
    expect(r.articles).toEqual([]);
    expect(r.pending).toHaveLength(2);
  });

  it('rejects URLs outside the 47-URL inventory and non-article entries', () => {
    const outside = parseExternalInput({ articles: [{ ...base, legacyUrl: '/not-in-inventory/', approval: approved }] }, manifest);
    expect(outside.articles).toEqual([]);
    expect(outside.rejected).toHaveLength(1);
    const project = parseExternalInput({ articles: [{ ...base, legacyUrl: '/chung-cu-ecolife-tay-ho-dang-van-hanh/', approval: approved }] }, manifest);
    expect(project.rejected).toHaveLength(1);
  });

  it('accepts a legacy URL without the trailing slash', () => {
    const r = parseExternalInput({ articles: [{ ...base, legacyUrl: base.legacyUrl.replace(/\/$/, ''), approval: approved }] }, manifest);
    expect(r.articles).toHaveLength(1);
    expect(r.articles[0].legacyUrl).toBe(base.legacyUrl);
  });

  it('rejects media, html and unknown keys: media is never imported automatically', () => {
    for (const extra of [{ cover: 'https://x.example/a.jpg' }, { images: ['a.jpg'] }, { media: [] }, { html: '<p>x</p>' }, { phone: '0' }]) {
      const r = parseExternalInput({ articles: [{ ...base, ...extra, approval: approved }] }, manifest);
      expect(r.articles).toEqual([]);
      expect(r.rejected).toHaveLength(1);
    }
  });

  it('rejects duplicate legacy URLs, bad slugs and malformed documents', () => {
    const dup = parseExternalInput({ articles: [{ ...base, approval: approved }, { ...base, approval: approved }] }, manifest);
    expect(dup.articles).toHaveLength(1);
    expect(dup.rejected).toHaveLength(1);
    expect(parseExternalInput({ articles: [{ ...base, slug: 'Bad Slug!', approval: approved }] }, manifest).rejected).toHaveLength(1);
    expect(() => parseExternalInput(null, manifest)).toThrow();
    expect(() => parseExternalInput({ articles: 'x' }, manifest)).toThrow();
  });

  it('rejects malformed or unknown root keys before anything could be written', () => {
    for (const bad of [{ articles: 'bad' }, { articles: [], extra: 1 }, { articles: [], phone: '0900000000' }, [], 'x', 5, null]) {
      expect(() => parseExternalInput(bad, manifest)).toThrow(ExternalInputError);
    }
    expect(() => parseExternalInput({ articles: [] }, manifest)).not.toThrow();
  });

  it('accepts exactly the article sources plus the listed candidates #4 and #31, keeping their redirect disposition', () => {
    const accepted = manifest.entries.filter((e) => {
      const r = parseExternalInput({ articles: [{ ...base, legacyUrl: e.legacyPath, approval: approved }] }, manifest);
      return r.articles.length === 1;
    });
    const expected = manifest.entries.filter((e) => e.kind === 'article' || e.id === 4 || e.id === 31);
    expect(accepted.map((e) => e.id).sort((a, b) => a - b)).toEqual(expected.map((e) => e.id).sort((a, b) => a - b));
    const byId = (id: number) => manifest.entries.find((e) => e.id === id)!;
    expect([byId(4).kind, byId(31).kind]).toEqual(['service', 'about']);
    expect([byId(4).disposition, byId(31).disposition]).toEqual(['redirect', 'redirect']);
    // Other non-article kinds (home, contact, project, category, author) stay rejected.
    for (const kind of ['home', 'contact', 'project', 'category', 'author']) {
      const entry = manifest.entries.find((e) => e.kind === kind)!;
      const r = parseExternalInput({ articles: [{ ...base, legacyUrl: entry.legacyPath, approval: approved }] }, manifest);
      expect(r.articles).toEqual([]);
      expect(r.rejected).toHaveLength(1);
    }
  });

  it('never echoes raw input values into reasons or reports', () => {
    const secret = '/private-0987654321-nguyen-van-a';
    const r = parseExternalInput(
      { articles: [{ legacyUrl: secret, title: 'x' }, { ...base, secretKey0912345678: 1, approval: approved }, { legacyUrl: 'https://evil.example/x?p=0912345678' }] },
      manifest,
    );
    const text = JSON.stringify(r.rejected);
    expect(r.rejected).toHaveLength(3);
    for (const leak of ['0987654321', 'nguyen', '0912345678', 'evil.example']) expect(text).not.toContain(leak);
  });

  it('requires a title and plain-text paragraphs only', () => {
    expect(parseExternalInput({ articles: [{ legacyUrl: base.legacyUrl, approval: approved }] }, manifest).rejected).toHaveLength(1);
    const r = parseExternalInput({ articles: [{ ...base, paragraphs: ['one', 'two'], approval: approved }] }, manifest);
    expect(r.articles[0].paragraphs).toEqual(['one', 'two']);
    expect(parseExternalInput({ articles: [{ ...base, paragraphs: [1], approval: approved }] }, manifest).rejected).toHaveLength(1);
  });
});
