import { describe, expect, it } from 'vitest';
import { buildSitemapEntries } from './public-content';
import {
  articleJsonLd,
  assertSitemapSize,
  breadcrumbJsonLd,
  collectAllPages,
  jobPostingJsonLd,
  organizationJsonLd,
  parseSearchConsoleToken,
  parseSiteUrl,
  safeHttpUrl,
  serializeJsonLd,
  SITEMAP_MAX_URLS,
} from './seo';
import { getSiteUrl } from './site';

const BASE = 'https://bmsl.example';

describe('SITE_URL validation', () => {
  it('normalises a valid origin and defaults only when unset', () => {
    expect(parseSiteUrl('https://bmsl.example/')).toBe(BASE);
    expect(getSiteUrl({})).toBe('http://localhost:3000');
    expect(getSiteUrl({ SITE_URL: ' https://bmsl.example/ ' })).toBe(BASE);
  });

  it.each(['javascript:alert(1)', 'ftp://bmsl.example', 'bmsl.example', 'https://u:p@bmsl.example', 'https://bmsl.example/x', 'https://bmsl.example/?a=1', 'https://bmsl.example/#h'])(
    'rejects unsafe value %s',
    (value) => {
      expect(() => parseSiteUrl(value)).toThrow();
      expect(() => getSiteUrl({ SITE_URL: value })).toThrow();
    },
  );
});

describe('sitemap pagination', () => {
  it('collects every page of 1,200 synthetic items (no silent 500 cap)', async () => {
    const all = Array.from({ length: 1200 }, (_, i) => `/kien-thuc/c/bai-${i}`);
    const size = 200;
    const calls: number[] = [];
    const docs = await collectAllPages(async (page) => {
      calls.push(page);
      return { docs: all.slice((page - 1) * size, page * size), totalPages: Math.ceil(all.length / size) };
    });
    expect(docs).toHaveLength(1200);
    expect(calls).toEqual([1, 2, 3, 4, 5, 6]);
    const entries = buildSitemapEntries(BASE, ['/'], docs);
    expect(entries).toHaveLength(1201);
    expect(new Set(entries.map((e) => e.url)).size).toBe(1201);
  });

  it('propagates read failures instead of truncating, and stops a runaway source', async () => {
    await expect(collectAllPages(async () => Promise.reject(new Error('db down')))).rejects.toThrow('db down');
    await expect(collectAllPages(async () => ({ docs: [1], totalPages: 99 }), 3)).rejects.toThrow('pagination exceeded');
  });

  it('fails loudly above the protocol limit', () => {
    expect(() => assertSitemapSize(SITEMAP_MAX_URLS)).not.toThrow();
    expect(() => assertSitemapSize(SITEMAP_MAX_URLS + 1)).toThrow('per-file limit');
  });
});

describe('JSON-LD', () => {
  it('escapes script-breaking characters', () => {
    const out = serializeJsonLd({ name: '</script><script>alert(1)</script> &  ' });
    expect(out).not.toContain('<');
    expect(out).not.toContain('>');
    expect(out).not.toContain('&');
    expect(out).not.toContain(' ');
    expect(JSON.parse(out).name).toBe('</script><script>alert(1)</script> &  ');
  });

  it('Organization has only name/url/validated https-or-http sameAs; no invented facts', () => {
    const ld = organizationJsonLd(BASE, 'BMSL', ['https://facebook.com/x', 'javascript:alert(1)', 'data:text/html,x', 'not a url']);
    expect(ld).toEqual({ '@context': 'https://schema.org', '@type': 'Organization', name: 'BMSL', url: BASE, sameAs: ['https://facebook.com/x'] });
    expect(Object.keys(organizationJsonLd(BASE, 'BMSL'))).not.toContain('sameAs');
    const text = JSON.stringify(ld);
    for (const key of ['address', 'telephone', 'legalName', 'taxID', 'LocalBusiness']) expect(text).not.toContain(key);
  });

  it('BreadcrumbList uses absolute URLs and drops unsafe paths', () => {
    const ld = breadcrumbJsonLd(BASE, [
      { name: 'Kiến thức', path: '/kien-thuc' },
      { name: 'Evil', path: '//evil.test/x' },
      { name: 'Bài', path: '/kien-thuc/a/b' },
    ]) as { itemListElement: { position: number; item: string }[] };
    expect(ld.itemListElement.map((i) => [i.position, i.item])).toEqual([
      [1, `${BASE}/kien-thuc`],
      [2, `${BASE}/kien-thuc/a/b`],
    ]);
    expect(breadcrumbJsonLd(BASE, [])).toBeNull();
  });

  it('Article needs a valid publish date and never invents an author', () => {
    expect(articleJsonLd(BASE, 'BMSL', { title: 'T', path: '/kien-thuc/a/b' })).toBeNull();
    expect(articleJsonLd(BASE, 'BMSL', { title: 'T', path: '/kien-thuc/a/b', publishedAt: 'garbage' })).toBeNull();
    const ld = articleJsonLd(BASE, 'BMSL', {
      title: 'T',
      path: '/kien-thuc/a/b',
      publishedAt: '2026-01-02T03:04:05Z',
      imageUrl: 'https://evil.test/x.jpg',
    })!;
    expect(ld.datePublished).toBe('2026-01-02T03:04:05.000Z');
    expect(ld.image).toBeUndefined();
    expect(ld.author).toBeUndefined();
    expect(articleJsonLd(BASE, 'BMSL', { title: 'T', path: '/kien-thuc/a/b', publishedAt: '2026-01-02', imageUrl: '/api/media-assets/file/a.png' })!.image).toEqual([
      `${BASE}/api/media-assets/file/a.png`,
    ]);
  });

  it('JobPosting is emitted only when every required field is published', () => {
    const full = { title: 'Nhân viên', path: '/tuyen-dung/nv', description: 'Mô tả', datePosted: '2026-02-01', addressLocality: 'Hà Nội' };
    expect(jobPostingJsonLd(BASE, 'BMSL', full)).toMatchObject({ '@type': 'JobPosting', datePosted: '2026-02-01T00:00:00.000Z' });
    for (const missing of ['description', 'datePosted', 'addressLocality'] as const) {
      expect(jobPostingJsonLd(BASE, 'BMSL', { ...full, [missing]: undefined })).toBeNull();
    }
    expect(jobPostingJsonLd(BASE, 'BMSL', { ...full, path: 'https://evil.test' })).toBeNull();
  });
});

describe('input validators', () => {
  it('safeHttpUrl accepts only credential-free http(s)', () => {
    expect(safeHttpUrl('https://a.example/x')).toBe('https://a.example/x');
    for (const bad of ['javascript:x', 'https://u:p@a.example', '', undefined, 5]) expect(safeHttpUrl(bad)).toBeUndefined();
  });

  it('Search Console token charset/length', () => {
    expect(parseSearchConsoleToken('abcDEF123_-abcDEF123_-xyz')).toBeDefined();
    for (const bad of ['short', '"><script>alert(1)</script>aaaaaaaaaaaa', 'a'.repeat(101), undefined]) {
      expect(parseSearchConsoleToken(bad)).toBeUndefined();
    }
  });
});
