import { describe, expect, it } from 'vitest';
import { buildMetadata } from './metadata';
import {
  buildSitemapEntries,
  toArticle,
  toCategory,
  toJob,
  toProject,
  toPublicImage,
  toService,
} from './public-content';
import {
  articleLd,
  breadcrumbLd,
  isApprovedMediaPath,
  isPublicContentPath,
  isPublicSlug,
  jobPostingLd,
  normalizeSiteUrl,
  organizationLd,
  serializeJsonLd,
  SITEMAP_MAX_URLS,
} from './seo';
import { getSiteUrl, STATIC_PUBLIC_PATHS } from './site';

const ORIGIN = 'https://example.test';
const pub = { _status: 'published' };

const UNSAFE_PATHS = [
  '/du-an/../../admin',
  '/du-an/..%2f..%2fadmin',
  '/du-an/%2e%2e/admin',
  '/du-an/x?next=/admin',
  '/du-an/x#frag',
  '/du-an\\x',
  '/du-an/x\\..\\admin',
  '/admin',
  '/api/users',
  '/dich-vu/a/b',
  '/kien-thuc/a/b/c',
  '//evil.test/x',
  'https://evil.test/dich-vu/x',
  '/du-an/UPPER',
  '/du-an/with space',
  '/du-an/',
  '/unknown/x',
];

describe('public slug / path validation', () => {
  it('accepts normal slugs and routes', () => {
    for (const s of ['a', 'bao-ve-toa-nha', 'jsc34', 'a1-b2']) expect(isPublicSlug(s)).toBe(true);
    for (const p of ['/', '/du-an', '/du-an/jsc34', '/kien-thuc/c/a', '/lien-he', '/dich-vu/bao-ve']) {
      expect(isPublicContentPath(p)).toBe(true);
    }
  });

  it('rejects traversal, encoding, query, fragment, backslash and private destinations', () => {
    for (const s of ['..', '.', 'a/b', 'a%2fb', 'a?b', 'a#b', 'a\\b', '-a', 'a--b', 'a_b', '', 'x'.repeat(121)]) {
      expect(isPublicSlug(s), s).toBe(false);
    }
    for (const p of UNSAFE_PATHS) expect(isPublicContentPath(p), p).toBe(false);
    expect(isPublicContentPath(undefined)).toBe(false);
  });

  it('mappers drop documents with unsafe slugs (no canonical can be built from them)', () => {
    for (const slug of ['../../admin', 'a/b', 'a?x=1', 'a#b', '%2e%2e', 'A']) {
      expect(toService({ ...pub, id: 1, name: 'x', slug })).toBeUndefined();
      expect(toProject({ ...pub, id: 1, name: 'x', slug })).toBeUndefined();
      expect(toJob({ ...pub, id: 1, title: 'x', slug })).toBeUndefined();
      expect(toCategory({ ...pub, id: 1, name: 'x', slug })).toBeUndefined();
      const category = { ...pub, id: 2, name: 'C', slug: 'c' };
      expect(toArticle({ ...pub, id: 1, title: 'x', slug, category })).toBeUndefined();
      expect(toArticle({ ...pub, id: 1, title: 'x', slug: 'ok', category: { ...category, slug } })).toBeUndefined();
    }
  });
});

describe('SITE_URL validation', () => {
  it('uses the local default only when unset and normalises a bare origin', () => {
    expect(normalizeSiteUrl(undefined)).toBe('http://localhost:3000');
    expect(normalizeSiteUrl('')).toBe('http://localhost:3000');
    expect(normalizeSiteUrl('https://bmsl.example/')).toBe('https://bmsl.example');
    expect(getSiteUrl({ SITE_URL: ' https://bmsl.example ' })).toBe('https://bmsl.example');
  });

  it('rejects a malformed or unsafe value instead of falling back', () => {
    for (const bad of [
      'not a url',
      'javascript:alert(1)',
      'ftp://x.test',
      'https://user:pw@x.test',
      'https://x.test/path',
      'https://x.test?x=1',
      'https://x.test#frag',
      'https://x.test/?',
    ]) {
      expect(() => normalizeSiteUrl(bad), bad).toThrow(/SITE_URL/);
    }
  });
});

describe('approved media path validation (separate from content paths)', () => {
  it('accepts only same-site Payload media file paths', () => {
    expect(isApprovedMediaPath('/api/media-assets/file/a.png')).toBe(true);
    expect(isApprovedMediaPath('/api/media-assets/file/a-1.png?t=123')).toBe(true);
    // a valid image path is not an indexable content route
    expect(isPublicContentPath('/api/media-assets/file/a.png')).toBe(false);
    for (const u of [
      'https://evil.test/a.png',
      '//evil.test/a.png',
      '/api/media-assets/file/../../admin',
      '/api/media-assets/file/..',
      '/api/media-assets/file/%2e%2e',
      '/api/media-assets/file/a%2f..%2fb',
      '/api/media-assets/file/a.png?x=<script>',
      '/api/users',
      '/_next/image?url=%2Fapi%2Fmedia-assets%2Ffile%2Fa.png&w=64&q=75',
    ]) {
      expect(isApprovedMediaPath(u), u).toBe(false);
    }
    expect(toPublicImage({ id: 1, alt: 'a', rightsStatus: 'APPROVED', url: 'https://evil.test/a.png' })).toBeUndefined();
  });
});

describe('metadata canonical / OG safety', () => {
  it('emits canonical, og:url and approved image for a valid path', () => {
    const m = buildMetadata('/du-an/p', 'P', {
      noindex: false,
      image: { id: '1', alt: 'alt', url: '/api/media-assets/file/a.png' },
    });
    expect(m.alternates?.canonical).toBe('/du-an/p');
    expect(m.openGraph?.url).toBe('/du-an/p');
    expect(JSON.stringify(m.openGraph)).toContain('/api/media-assets/file/a.png');
  });

  it('never emits a canonical/og:url for unsafe paths, and marks them noindex', () => {
    for (const p of UNSAFE_PATHS) {
      const m = buildMetadata(p, 'x');
      expect(m.alternates, p).toBeUndefined();
      expect(m.openGraph?.url, p).toBeUndefined();
      expect(m.robots).toEqual({ index: false, follow: false });
    }
  });

  it('drops an unapproved OG image url', () => {
    const m = buildMetadata('/du-an/p', 'P', { noindex: false, image: { id: '1', alt: 'a', url: 'https://evil.test/a.png' } });
    expect(m.openGraph).not.toHaveProperty('images');
  });
});

describe('sitemap', () => {
  it('drops traversal / encoded / query / fragment / private paths', () => {
    const urls = buildSitemapEntries(ORIGIN, ['/'], [...UNSAFE_PATHS, '/du-an/ok']).map((e) => e.url);
    expect(urls).toEqual([ORIGIN, `${ORIGIN}/du-an/ok`]);
  });

  it('excludes noindex singleton routes', () => {
    const urls = buildSitemapEntries(ORIGIN, STATIC_PUBLIC_PATHS, [], ['/', '/gioi-thieu']).map((e) => e.url);
    expect(urls).not.toContain(ORIGIN);
    expect(urls).not.toContain(`${ORIGIN}/gioi-thieu`);
    expect(urls).toContain(`${ORIGIN}/lien-he`);
  });

  it('has no 500-entry cap: 1,200 synthetic items are all listed', () => {
    const content = Array.from({ length: 1200 }, (_, i) => `/du-an/item-${i}`);
    expect(buildSitemapEntries(ORIGIN, STATIC_PUBLIC_PATHS, content)).toHaveLength(STATIC_PUBLIC_PATHS.length + 1200);
  });

  it('fails loudly above the protocol limit instead of truncating', () => {
    const content = Array.from({ length: SITEMAP_MAX_URLS + 1 }, (_, i) => `/du-an/item-${i}`);
    expect(() => buildSitemapEntries(ORIGIN, [], content)).toThrow(/per-file limit/);
  });
});

describe('JSON-LD', () => {
  it('escapes script-closing and markup characters', () => {
    const separators = String.fromCharCode(0x2028, 0x2029);
    const out = serializeJsonLd({ name: '</script><script>alert(1)</script> & <b>', sep: separators });
    expect(out).not.toMatch(new RegExp(`[<>&${separators}]`));
    expect(JSON.parse(out).name).toBe('</script><script>alert(1)</script> & <b>');
  });

  it('builds Organization with only the name and origin (no invented legal/address data)', () => {
    expect(organizationLd(ORIGIN, 'BMSL')).toEqual({
      '@context': 'https://schema.org',
      '@type': 'Organization',
      name: 'BMSL',
      url: ORIGIN,
    });
  });

  it('builds BreadcrumbList only from safe public paths', () => {
    const ld = breadcrumbLd(ORIGIN, [
      { name: 'Dự án', path: '/du-an' },
      { name: 'P', path: '/du-an/p' },
    ]);
    expect(ld?.itemListElement).toEqual([
      { '@type': 'ListItem', position: 1, name: 'Dự án', item: `${ORIGIN}/du-an` },
      { '@type': 'ListItem', position: 2, name: 'P', item: `${ORIGIN}/du-an/p` },
    ]);
    expect(breadcrumbLd(ORIGIN, [{ name: 'x', path: '/du-an/../../admin' }])).toBeUndefined();
  });

  it('builds Article only with a valid date, safe path and approved image', () => {
    const ld = articleLd(ORIGIN, {
      headline: 'T',
      path: '/kien-thuc/c/a',
      publishedAt: '2026-01-02T03:04:05.000Z',
      imageUrl: '/api/media-assets/file/a.png',
    });
    expect(ld).toMatchObject({ '@type': 'Article', headline: 'T', datePublished: '2026-01-02T03:04:05.000Z' });
    expect(ld?.image).toBe(`${ORIGIN}/api/media-assets/file/a.png`);
    expect(ld).not.toHaveProperty('author');
    expect(articleLd(ORIGIN, { headline: 'T', path: '/kien-thuc/c/a' })).toBeUndefined();
    expect(articleLd(ORIGIN, { headline: 'T', path: '/kien-thuc/c/a', publishedAt: 'not a date' })).toBeUndefined();
    expect(articleLd(ORIGIN, { headline: 'T', path: '/a?x', publishedAt: '2026-01-02' })).toBeUndefined();
    expect(
      articleLd(ORIGIN, { headline: 'T', path: '/kien-thuc/c/a', publishedAt: '2026-01-02', imageUrl: 'https://evil.test/a.png' }),
    ).not.toHaveProperty('image');
  });

  it('builds JobPosting only when every required property is published', () => {
    const full = {
      title: 'J',
      path: '/tuyen-dung/j',
      description: 'd',
      datePosted: '2026-01-02',
      organizationName: 'BMSL',
      addressLocality: 'Hà Nội',
      addressCountry: 'VN',
    };
    expect(jobPostingLd(ORIGIN, full)).toMatchObject({ '@type': 'JobPosting', title: 'J' });
    for (const missing of ['description', 'datePosted', 'addressLocality', 'addressCountry'] as const) {
      expect(jobPostingLd(ORIGIN, { ...full, [missing]: undefined }), missing).toBeUndefined();
    }
    expect(jobPostingLd(ORIGIN, { ...full, path: '/tuyen-dung/../x' })).toBeUndefined();
  });
});
