import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { assertImportAllowed, parseArgs } from './cli';
import { parseExternalInput } from './external-input';
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
    const remote = 'postgresql://u:p@db.example.test:5432/bmsl';
    expect(() => assertImportAllowed({ ...ok, databaseUrl: remote })).toThrow(/non-local|staging/i);
    expect(() =>
      assertImportAllowed({ ...ok, databaseUrl: remote, env: { BMSL_IMPORT_ALLOW_STAGING: 'true' } }),
    ).not.toThrow();
    expect(() =>
      assertImportAllowed({ ...ok, databaseUrl: remote, env: { NODE_ENV: 'production', BMSL_IMPORT_ALLOW_STAGING: 'true' } }),
    ).toThrow(/production/i);
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

  it('requires a title and plain-text paragraphs only', () => {
    expect(parseExternalInput({ articles: [{ legacyUrl: base.legacyUrl, approval: approved }] }, manifest).rejected).toHaveLength(1);
    const r = parseExternalInput({ articles: [{ ...base, paragraphs: ['one', 'two'], approval: approved }] }, manifest);
    expect(r.articles[0].paragraphs).toEqual(['one', 'two']);
    expect(parseExternalInput({ articles: [{ ...base, paragraphs: [1], approval: approved }] }, manifest).rejected).toHaveLength(1);
  });
});
