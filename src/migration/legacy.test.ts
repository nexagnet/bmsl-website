import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import nextConfig from '../../next.config.mjs';
import { STATIC_PUBLIC_PATHS } from '../lib/site';
import articleCandidates from './article-candidates.json';
import manifest from './legacy-manifest.json';
import {
  buildRedirectRules,
  normalizeSameSitePath,
  toNextRedirects,
  validateManifest,
  validateRedirectRules,
} from './legacy.mjs';

const blueprint = (file: string) => readFileSync(path.resolve(__dirname, '../../docs/blueprint', file), 'utf8');

type InventoryRow = { id: number; legacyPath: string; action: string; target?: string };

/** Independent parse of the canonical 47-row inventory (docs/blueprint/01). */
function parseInventory(): InventoryRow[] {
  const rows: InventoryRow[] = [];
  for (const line of blueprint('01-url-inventory.md').split('\n')) {
    const cells = line.split('|').map((c) => c.trim());
    if (!/^\d+$/.test(cells[1] ?? '')) continue;
    const id = Number(cells[1]);
    const raw = (cells[2] ?? '').replace(/`/g, '');
    const legacyPath = raw.startsWith('/') ? raw : `/${raw}/`;
    // posts/pages: [#, url, type, action, target, note]; taxonomy/author: [#, url, action, target, note]
    const actionCell = id <= 38 ? cells[4] : cells[3];
    const targetCell = id <= 38 ? cells[5] : cells[4];
    const action = /^(KEEP|REWRITE|MERGE|DROP|OWNER-DECISION)/.exec(actionCell ?? '')?.[1] ?? '';
    const target = /`(\/[^`]*)`/.exec(targetCell ?? '')?.[1];
    rows.push({ id, legacyPath, action, target });
  }
  return rows;
}

const entries = manifest.entries;
const strip = (p: string) => (p.length > 1 ? p.replace(/\/+$/, '') : p);

describe('legacy manifest: 47/47 inventory coverage', () => {
  const inventory = parseInventory();

  it('the canonical inventory itself has 47 rows', () => {
    expect(inventory).toHaveLength(47);
  });

  it('manifest lists exactly the 47 inventory URLs with the inventory action', () => {
    expect(entries).toHaveLength(47);
    for (const row of inventory) {
      const entry = entries.find((e) => e.id === row.id);
      expect(entry, `missing #${row.id}`).toBeDefined();
      expect(entry?.legacyPath).toBe(row.legacyPath);
      expect(entry?.action, `#${row.id} action`).toBe(row.action);
    }
    expect(new Set(entries.map((e) => e.legacyPath)).size).toBe(47);
  });

  it('records the inventory proposed destination separately from the active target', () => {
    for (const row of inventory) {
      if (!row.target) continue; // #21 only says "same as #5"
      const entry = entries.find((e) => e.id === row.id);
      expect(entry?.proposedTarget, `#${row.id} proposed`).toBe(strip(row.target));
    }
    expect(entries.find((e) => e.id === 21)?.proposedTarget).toBe(entries.find((e) => e.id === 5)?.proposedTarget);
  });

  it('keeps the source-type split 36 posts + 2 pages + 8 taxonomy + 1 author', () => {
    const count = (t: string) => entries.filter((e) => e.sourceType === t).length;
    expect([count('post'), count('page'), count('taxonomy'), count('author')]).toEqual([36, 2, 8, 1]);
  });

  it('passes manifest validation against the real public routes', () => {
    expect(validateManifest(manifest, { publicRoutes: STATIC_PUBLIC_PATHS })).toEqual([]);
  });
});

describe('legacy manifest: projects', () => {
  const projects = entries.filter((e) => e.kind === 'project');

  it('preserves 18 project source URLs mapping to 17 distinct profiles', () => {
    expect(projects).toHaveLength(18);
    expect(new Set(projects.map((p) => p.projectSlug)).size).toBe(17);
    expect(manifest.projects).toHaveLength(17);
    expect(new Set(manifest.projects.map((p) => p.slug))).toEqual(new Set(projects.map((p) => p.projectSlug)));
  });

  it('maps both Hoc vien Quoc phong sources to one profile', () => {
    const hv = projects.filter((p) => p.projectSlug === 'hoc-vien-quoc-phong');
    expect(hv.map((p) => p.id).sort((a, b) => a - b)).toEqual([5, 21]);
  });

  it('takes project slugs/names from the canonical project inventory (03)', () => {
    const slugs = [...blueprint('03-project-inventory.md').matchAll(/\|\s*`([a-z0-9-]+)`\s*\|/g)].map((m) => m[1]);
    expect(new Set(manifest.projects.map((p) => p.slug))).toEqual(new Set(slugs));
  });

  it('treats /354-2 as company office/About, never a project', () => {
    const office = entries.find((e) => e.legacyPath === '/354-2/');
    expect(office?.kind).toBe('about');
    expect(office?.proposedTarget).toBe('/gioi-thieu');
    expect(manifest.projects.some((p) => p.slug.includes('354'))).toBe(false);
  });

  it('carries no invented operating facts in the manifest', () => {
    const json = JSON.stringify(manifest);
    for (const banned of ['address', 'scale', 'operatingSince', 'đang vận hành', '610', '700']) {
      expect(json).not.toContain(banned);
    }
  });
});

describe('dispositions, fallbacks and approval states', () => {
  it('root / is an identity HTTP 200, never a redirect', () => {
    const home = entries.find((e) => e.legacyPath === '/');
    expect(home?.disposition).toBe('identity');
    expect(home?.activeTarget).toBe('/');
    expect(buildRedirectRules(manifest).some((r) => r.source === '/')).toBe(false);
  });

  it('every other entry has a deterministic redirect disposition', () => {
    for (const e of entries.filter((x) => x.id !== 37)) expect(e.disposition).toBe('redirect');
    expect(buildRedirectRules(manifest)).toHaveLength(46);
  });

  it('active targets are existing public routes unless a detail is confirmed published', () => {
    for (const e of entries) {
      if (e.targetState === 'published') continue;
      expect(STATIC_PUBLIC_PATHS, `#${e.id} -> ${e.activeTarget}`).toContain(e.activeTarget);
    }
    expect(entries.filter((e) => e.targetState === 'published')).toHaveLength(0);
  });

  it('fallback entries keep the proposed detail target unconfirmed and separate', () => {
    const fallbacks = entries.filter((e) => e.targetState === 'fallback');
    expect(fallbacks.length).toBeGreaterThan(0);
    for (const e of fallbacks) {
      expect(e.activeTarget).not.toBe(e.proposedTarget);
      expect(e.fallbackReason).toMatch(/^(detail-not-published|category-not-approved)$/);
    }
  });

  it('unapproved categories fall back to /kien-thuc; none is marked approved', () => {
    for (const e of entries.filter((x) => x.proposedTarget.startsWith('/kien-thuc/'))) {
      expect(e.activeTarget).toBe('/kien-thuc');
    }
    expect(entries.some((e) => (e.approvalStatus as string) === 'APPROVED')).toBe(false);
    expect(entries.find((e) => e.id === 43)?.approvalStatus).toBe('OWNER-DECISION');
  });
});

describe('article candidates and approval queue', () => {
  it('lists candidates without claiming any migration or selection approval', () => {
    expect(articleCandidates.selectionApproved).toBe(false);
    expect(articleCandidates.migratedArticleCount).toBe(0);
    const ids = articleCandidates.candidates.map((c) => c.manifestId);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(entries.some((e) => e.id === id)).toBe(true);
    expect(articleCandidates.candidates.filter((c) => c.tier === 'proposed-first-ten')).toHaveLength(10);
  });

  it('covers every article-kind inventory entry', () => {
    const ids = new Set(articleCandidates.candidates.map((c) => c.manifestId));
    for (const e of entries.filter((x) => x.kind === 'article')) expect(ids.has(e.id)).toBe(true);
  });

  it('requires approvals for every candidate', () => {
    for (const c of articleCandidates.candidates) {
      expect(c.approvalsRequired).toEqual(expect.arrayContaining(['selection', 'content', 'category']));
    }
  });
});

describe('same-site path validation', () => {
  it.each([
    ['/a/b/', '/a/b'],
    ['/a/b', '/a/b'],
    ['/', '/'],
    ['/gioi-thieu-tong-qua/', '/gioi-thieu-tong-qua'],
  ])('normalizes %s -> %s', (input, expected) => {
    expect(normalizeSameSitePath(input)).toBe(expected);
  });

  it.each([
    'https://evil.example/x',
    'http://evil.example',
    '//evil.example/x',
    '/\\evil.example',
    '\\\\evil.example',
    'javascript:alert(1)',
    'data:text/html,x',
    'relative/path',
    '',
    '/a\nb',
    '/a\tb',
    '/a\u0000b',
    '/a b',
    '/a?x=1',
    '/a#frag',
    '/a//b',
    '/a/../b',
    '/%2e%2e/x',
    '/admin',
    '/admin/collections',
    '/api/users',
    '/api',
  ])('rejects unsafe path %j', (input) => {
    expect(() => normalizeSameSitePath(input)).toThrow();
  });

  it('rejects non-strings', () => {
    expect(() => normalizeSameSitePath(undefined as unknown as string)).toThrow();
  });
});

describe('redirect rule validation: duplicates, cycles, chains', () => {
  const rule = (source: string, destination: string) => ({ source, destination, statusCode: 301 });

  it('real rules are valid: no loops, no chains, no duplicates', () => {
    expect(validateRedirectRules(buildRedirectRules(manifest))).toEqual([]);
  });

  it('flags duplicate sources', () => {
    expect(validateRedirectRules([rule('/a', '/x'), rule('/a/', '/y')]).join('\n')).toMatch(/duplicate/i);
  });

  it('flags self redirects and cycles', () => {
    expect(validateRedirectRules([rule('/a', '/a')]).join('\n')).toMatch(/self|loop|cycle/i);
    expect(validateRedirectRules([rule('/a', '/b'), rule('/b', '/a')]).join('\n')).toMatch(/cycle|chain/i);
  });

  it('flags redirect chains', () => {
    expect(validateRedirectRules([rule('/a', '/b'), rule('/b', '/c')]).join('\n')).toMatch(/chain/i);
  });

  it('flags unsafe destinations and non-301 codes', () => {
    expect(validateRedirectRules([rule('/a', 'https://evil.example')]).join('\n')).toMatch(/destination/i);
    expect(validateRedirectRules([{ source: '/a', destination: '/b', statusCode: 302 }]).join('\n')).toMatch(/301/);
  });

  it('manifest validation rejects an external active target and a root self-redirect', () => {
    const bad = structuredClone(manifest);
    bad.entries[1].activeTarget = 'https://evil.example';
    expect(validateManifest(bad, { publicRoutes: STATIC_PUBLIC_PATHS }).length).toBeGreaterThan(0);
    const selfRedirect = structuredClone(manifest);
    selfRedirect.entries.find((e) => e.id === 37)!.disposition = 'redirect';
    expect(validateManifest(selfRedirect, { publicRoutes: STATIC_PUBLIC_PATHS }).length).toBeGreaterThan(0);
  });

  it('manifest validation rejects a dead-end target (unpublished detail not marked published)', () => {
    const bad = structuredClone(manifest);
    bad.entries.find((e) => e.id === 6)!.activeTarget = '/du-an/ecolife-tay-ho';
    expect(validateManifest(bad, { publicRoutes: STATIC_PUBLIC_PATHS }).join('\n')).toMatch(/dead-end|fallback|public route/i);
  });

  it('manifest validation rejects a missing/duplicate inventory entry', () => {
    const missing = structuredClone(manifest);
    missing.entries.pop();
    expect(validateManifest(missing, { publicRoutes: STATIC_PUBLIC_PATHS }).length).toBeGreaterThan(0);
  });
});

describe('runtime redirect config (next.config.mjs)', () => {
  type Config = {
    skipTrailingSlashRedirect?: boolean;
    redirects: () => Promise<{ source: string; destination: string; statusCode?: number; permanent?: boolean }[]>;
  };
  const config = nextConfig as unknown as Config;

  it('emits one direct 301 per non-root legacy URL, no 308 permanent variant', async () => {
    const redirects = await config.redirects();
    expect(redirects).toHaveLength(46);
    for (const r of redirects) {
      expect(r.statusCode).toBe(301);
      expect(r.permanent).toBeUndefined();
    }
  });

  it('matches the validated rules and never redirects the homepage', async () => {
    const redirects = await config.redirects();
    expect(redirects).toEqual(toNextRedirects(buildRedirectRules(manifest)));
    expect(redirects.some((r) => r.source === '/')).toBe(false);
  });

  it('sources are the no-slash form and skipTrailingSlashRedirect avoids a 308-then-301 chain', async () => {
    // Next compiles source "/x" to ^/x(?:/)?$, so both /x and /x/ hit the 301 directly; with the default
    // internal "/:path+/ -> /:path+" 308 rule first, /x/ would chain. Verified against a real next start.
    expect(config.skipTrailingSlashRedirect).toBe(true);
    for (const r of await config.redirects()) {
      expect(r.source).not.toMatch(/\/$/);
      expect(r.destination).not.toMatch(/.\/$/);
    }
  });

  it('destinations are no-slash same-site paths, with no destination that is itself a source', async () => {
    const redirects = await config.redirects();
    const sources = new Set(redirects.map((r) => r.source));
    for (const r of redirects) {
      expect(r.destination.startsWith('/')).toBe(true);
      expect(r.destination.startsWith('//')).toBe(false);
      expect(sources.has(r.destination)).toBe(false);
    }
  });

  it('keeps the existing noindex headers', async () => {
    const headers = await (nextConfig as unknown as { headers: () => Promise<{ source: string }[]> }).headers();
    expect(headers.map((h) => h.source)).toEqual(expect.arrayContaining(['/admin/:path*', '/api/:path*']));
  });
});
