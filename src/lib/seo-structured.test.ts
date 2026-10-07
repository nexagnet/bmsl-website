import { describe, expect, it } from 'vitest';
import { buildMetadata } from './metadata';
import {
  buildSitemapEntries,
  fetchAllPages,
  SITEMAP_MAX_URLS,
  toArticle,
  toJob,
  toProject,
  toPublicImage,
} from './public-content';
import {
  absoluteContentUrl,
  isApprovedMediaPath,
  isPublicContentPath,
  isPublicSlug,
  normalizeSiteUrl,
} from './seo';
import { getSiteUrl, STATIC_PUBLIC_PATHS } from './site';
import { articleLd, breadcrumbLd, confirmedJobPostingLd, isoDate, jobPostingLd, organizationLd, serializeJsonLd } from './structured-data';

const SITE = 'https://example.test';
const pub = { _status: 'published' };

const UNSAFE_PATHS = [
  '/du-an/../../admin',
  '/du-an/%2e%2e/%2e%2e/admin',
  '/du-an/%2E%2E%2Fadmin',
  '/du-an/x?utm_source=a',
  '/du-an/x#frag',
  '/du-an\\x',
  '/du-an/..\\admin',
  '/du-an//x',
  '/du-an/x/',
  '/admin',
  '/admin/collections/users',
  '/api/users',
  '/api/media-assets/file/a.jpg',
  '//evil.example/du-an/x',
  'du-an/x',
  '/unknown/x',
  '/du-an/UPPER',
  '/du-an/x y',
  '',
];

describe('strict public path validation', () => {
  it('accepts the fixed IA and slugged content paths', () => {
    for (const p of [...STATIC_PUBLIC_PATHS, '/dich-vu/bao-ve', '/du-an/p-1', '/kien-thuc/c/a', '/tuyen-dung/j']) {
      expect(isPublicContentPath(p), p).toBe(true);
    }
  });

  it.each(UNSAFE_PATHS)('rejects %j as a content path', (p) => {
    expect(isPublicContentPath(p)).toBe(false);
  });

  it('keeps the media path check separate: a media file is a valid image path but not a content route', () => {
    expect(isApprovedMediaPath('/api/media-assets/file/a-1.jpg')).toBe(true);
    expect(isPublicContentPath('/api/media-assets/file/a-1.jpg')).toBe(false);
    for (const p of [
      '/api/media-assets/file/../../users',
      '/api/media-assets/file/%2e%2e',
      '/api/media-assets/file/a.jpg?x=1',
      '/api/media-assets/file/a#x',
      '/api/users/me',
      'https://cdn.evil.example/a.jpg',
      '//cdn.evil.example/a.jpg',
      '/media/a.jpg',
    ]) {
      expect(isApprovedMediaPath(p), p).toBe(false);
    }
  });

  it('accepts encoded Unicode/space media filenames and ASCII, rejects unsafe variants', () => {
    const base = '/api/media-assets/file/';
    for (const f of [
      '%E1%BA%A2nh%20ch%E1%BB%A5p%20m%C3%A0n%20h%C3%ACnh%202026-08-29%20220316.png',
      'a-1.jpg',
      'My_Photo.2.PNG',
    ]) {
      expect(isApprovedMediaPath(base + f), f).toBe(true);
    }
    for (const f of [
      '%',
      '%E1%BA',
      '%ZZ',
      'a%2Fb.png',
      'a%2fb.png',
      'a%5Cb.png',
      '%2e%2e',
      '%2e%2e%2fusers',
      '%252e%252e',
      'a%252Fb',
      '..',
      '.hidden',
      'a..b.png',
      '%00.png',
      'a%0Ab.png',
      'a.png?x=1',
      'a.png#x',
      'a b.png',
      'a/b.png',
      'a\\b.png',
      '',
    ]) {
      expect(isApprovedMediaPath(base + f), f).toBe(false);
    }
    for (const p of [
      '/api/users/me',
      '/api/media-assets/file',
      '/api/media-assets/other/a.png',
      'https://cdn.evil.example/api/media-assets/file/a.png',
      '//cdn.evil.example/api/media-assets/file/a.png',
      null,
    ]) {
      expect(isApprovedMediaPath(p), String(p)).toBe(false);
    }
  });

  it('validates slugs', () => {
    expect(isPublicSlug('bao-ve-1')).toBe(true);
    for (const s of ['', '..', 'a/b', 'a b', 'A', 'a--b', '-a', 'a-', '%2e', 'a?b', 'a\\b', 1, null, 'a'.repeat(121)]) {
      expect(isPublicSlug(s), String(s)).toBe(false);
    }
  });
});

describe('SITE_URL validation', () => {
  it('normalizes a bare origin and defaults to localhost only when unset', () => {
    expect(normalizeSiteUrl('https://example.test/')).toBe('https://example.test');
    expect(getSiteUrl({})).toBe('http://localhost:3000');
    expect(getSiteUrl({ SITE_URL: ' https://bmsl.example ' })).toBe('https://bmsl.example');
  });

  it.each([
    'javascript:alert(1)',
    'ftp://example.test',
    'not a url',
    'https://user:pw@example.test',
    'https://example.test/path',
    'https://example.test/?q=1',
    'https://example.test/#x',
  ])('rejects %j', (raw) => {
    expect(() => normalizeSiteUrl(raw)).toThrow();
    expect(() => getSiteUrl({ SITE_URL: raw })).toThrow();
  });
});

describe('slug and image safety in mappers', () => {
  it('drops documents whose slug could alter the URL', () => {
    for (const slug of ['../../admin', '%2e%2e', 'a?b', 'a#b', 'a\\b', '/admin', 'A B']) {
      expect(toProject({ ...pub, id: 1, name: 'P', slug }), slug).toBeUndefined();
      expect(toArticle({ ...pub, id: 1, title: 'A', slug, category: { ...pub, id: 2, name: 'C', slug: 'c' } }), slug).toBeUndefined();
      expect(toArticle({ ...pub, id: 1, title: 'A', slug: 'a', category: { ...pub, id: 2, name: 'C', slug } }), slug).toBeUndefined();
    }
  });

  it('refuses approved media that points to a remote host or another route', () => {
    const base = { id: 1, alt: 'a', rightsStatus: 'APPROVED' };
    expect(toPublicImage({ ...base, url: 'https://cdn.evil.example/a.jpg' })).toBeUndefined();
    expect(toPublicImage({ ...base, url: '/api/users' })).toBeUndefined();
    expect(toPublicImage({ ...base, url: '/api/media-assets/file/a.jpg' })?.url).toBe('/api/media-assets/file/a.jpg');
  });
});

describe('metadata output', () => {
  it('emits canonical and OG url for a safe path, noindex when the CMS says so', () => {
    const m = buildMetadata('/du-an/p', 'P', { noindex: true });
    expect(m.alternates?.canonical).toBe('/du-an/p');
    expect(m.openGraph).toMatchObject({ url: '/du-an/p' });
    expect(m.robots).toEqual({ index: false, follow: false });
  });

  it.each(UNSAFE_PATHS.filter(Boolean))('never emits canonical/OG url for %j and noindexes it', (p) => {
    const m = buildMetadata(p, 'T', { noindex: false });
    expect(m.alternates).toBeUndefined();
    expect(JSON.stringify(m.openGraph)).not.toContain('"url"');
    expect(m.robots).toEqual({ index: false, follow: false });
  });

  it('only passes approved same-site media as the OG image', () => {
    const ok = { id: '1', alt: 'a', url: '/api/media-assets/file/a.jpg' };
    expect(buildMetadata('/', 'T', { noindex: false, image: ok }).openGraph).toMatchObject({ images: [{ url: ok.url }] });
    const remote = { ...ok, url: 'https://evil.example/a.jpg' };
    expect(JSON.stringify(buildMetadata('/', 'T', { noindex: false, image: remote }).openGraph)).not.toContain('evil');
  });
});

describe('sitemap', () => {
  it('drops every unsafe or private path', () => {
    const urls = buildSitemapEntries(SITE, ['/'], UNSAFE_PATHS).map((e) => e.url);
    expect(urls).toEqual([SITE]);
  });

  it('is not capped at 500: 1200 synthetic items are all listed', () => {
    const content = Array.from({ length: 1200 }, (_, i) => `/du-an/p-${i}`);
    expect(buildSitemapEntries(SITE, STATIC_PUBLIC_PATHS, content)).toHaveLength(STATIC_PUBLIC_PATHS.length + 1200);
  });

  it('fails loudly above the protocol limit instead of truncating', () => {
    const content = Array.from({ length: SITEMAP_MAX_URLS + 1 }, (_, i) => `/du-an/p-${i}`);
    expect(() => buildSitemapEntries(SITE, [], content)).toThrow(/limit/);
  });
});

describe('fetchAllPages', () => {
  const source = (total: number, size: number) => async (page: number) => {
    const start = (page - 1) * size;
    const docs = Array.from({ length: Math.max(0, Math.min(size, total - start)) }, (_, i) => start + i);
    return { docs, hasNextPage: start + size < total };
  };

  it('reads every page, past 500 items', async () => {
    expect(await fetchAllPages(source(1203, 200))).toHaveLength(1203);
  });

  it('propagates a failure on a later page rather than returning a partial list', async () => {
    const failing = async (page: number) => {
      if (page === 3) throw new Error('db down');
      return source(1000, 200)(page);
    };
    await expect(fetchAllPages(failing)).rejects.toThrow('db down');
  });

  it('refuses a runaway pagination loop', async () => {
    await expect(fetchAllPages(async () => ({ docs: [1], hasNextPage: true }), 5)).rejects.toThrow(/exceeded/);
  });
});

describe('JSON-LD', () => {
  it('escapes script-breaking characters', () => {
    const hostile = `</script><script>alert(1)</script> & ${String.fromCharCode(0x2028, 0x2029)}`;
    const out = serializeJsonLd({ name: hostile });
    expect(out).not.toMatch(/[<>&]/);
    expect(out).not.toContain(String.fromCharCode(0x2028));
    expect(out).not.toContain(String.fromCharCode(0x2029));
    expect(JSON.parse(out).name).toBe(hostile);
  });

  it('builds Organization without inventing legal, address or contact facts', () => {
    expect(organizationLd(SITE)).toEqual({ '@context': 'https://schema.org', '@type': 'Organization', name: 'BMSL', url: SITE });
    expect(JSON.stringify(organizationLd(SITE))).not.toMatch(/address|telephone|legalName|LocalBusiness/);
  });

  it('builds BreadcrumbList only from safe paths', () => {
    const ld = breadcrumbLd(SITE, [
      { name: 'Dự án', path: '/du-an' },
      { name: 'P', path: '/du-an/p' },
    ]);
    expect(ld).toMatchObject({ '@type': 'BreadcrumbList' });
    expect((ld?.itemListElement as { item: string; position: number }[]).map((i) => i.item)).toEqual([
      `${SITE}/du-an`,
      `${SITE}/du-an/p`,
    ]);
    for (const bad of UNSAFE_PATHS.filter(Boolean)) {
      expect(breadcrumbLd(SITE, [{ name: 'x', path: bad }]), bad).toBeUndefined();
    }
  });

  it('builds Article only with a valid date and safe path; no author is invented', () => {
    const ld = articleLd(SITE, { title: 'A', path: '/kien-thuc/c/a', publishedAt: '2026-01-02T03:04:05.000Z' });
    expect(ld).toMatchObject({ '@type': 'Article', datePublished: '2026-01-02T03:04:05.000Z' });
    expect(ld).not.toHaveProperty('author');
    expect(articleLd(SITE, { title: 'A', path: '/kien-thuc/c/a' })).toBeUndefined();
    expect(articleLd(SITE, { title: 'A', path: '/kien-thuc/c/a', publishedAt: 'yesterday' })).toBeUndefined();
    expect(articleLd(SITE, { title: 'A', path: '/du-an/../../admin', publishedAt: '2026-01-02' })).toBeUndefined();
    expect(
      articleLd(SITE, { title: 'A', path: '/kien-thuc/c/a', publishedAt: '2026-01-02', imageUrl: 'https://evil.example/a.jpg' }),
    ).not.toHaveProperty('image');
  });

  it('builds JobPosting only when every required semantic field is published', () => {
    const full = {
      title: 'J',
      description: 'Mô tả',
      datePosted: '2026-01-02',
      location: { addressLocality: 'Hà Nội', addressCountry: 'VN' },
    };
    expect(jobPostingLd(SITE, full)).toMatchObject({ '@type': 'JobPosting', datePosted: '2026-01-02' });
    expect(jobPostingLd(SITE, { ...full, datePosted: undefined })).toBeUndefined();
    expect(jobPostingLd(SITE, { ...full, location: undefined })).toBeUndefined();
    expect(jobPostingLd(SITE, { ...full, description: ' ' })).toBeUndefined();
  });

  describe('confirmed recruitment facts', () => {
    const body = (t: string) => ({ root: { children: [{ type: 'paragraph', children: [{ type: 'text', text: t }] }] } });
    const base = {
      ...pub,
      id: 1,
      title: 'Synthetic job',
      slug: 'synthetic-job',
      description: body('Synthetic description'),
      sourceStatus: 'CONFIRMED',
      datePosted: '2026-03-04T00:00:00.000Z',
      jobLocation: { addressLocality: 'Synthetic City', addressCountry: 'ZZ' },
      createdAt: '2020-01-01T00:00:00.000Z',
    };
    const ld = (over: Record<string, unknown>) => {
      const job = toJob({ ...base, ...over });
      return job ? confirmedJobPostingLd(SITE, job) : undefined;
    };

    it('emits JobPosting from operator-entered fields only', () => {
      expect(ld({})).toMatchObject({
        '@type': 'JobPosting',
        title: 'Synthetic job',
        description: 'Synthetic description',
        datePosted: '2026-03-04T00:00:00.000Z',
        jobLocation: { address: { addressLocality: 'Synthetic City', addressCountry: 'ZZ' } },
      });
      expect(JSON.stringify(ld({}))).not.toContain('2020-01-01');
    });

    it('emits nothing when unconfirmed, unpublished or missing a fact', () => {
      expect(ld({ sourceStatus: 'LEGACY-SOURCE' })).toBeUndefined();
      expect(ld({ sourceStatus: undefined })).toBeUndefined();
      expect(ld({ _status: 'draft' })).toBeUndefined();
      expect(ld({ datePosted: undefined })).toBeUndefined(); // createdAt is never a fallback
      expect(ld({ datePosted: 'yesterday' })).toBeUndefined();
      expect(ld({ jobLocation: undefined })).toBeUndefined();
      expect(ld({ jobLocation: { addressLocality: 'Synthetic City' } })).toBeUndefined(); // no assumed country
      expect(ld({ jobLocation: { addressCountry: 'ZZ' } })).toBeUndefined();
      expect(ld({ jobLocation: { addressLocality: 'Synthetic City', addressCountry: 'Zzz' } })).toBeUndefined();
      expect(ld({ description: body(' ') })).toBeUndefined();
    });
  });

  it('accepts only ISO dates', () => {
    expect(isoDate('2026-02-30')).toBeUndefined();
    expect(isoDate('2026-01-02')).toBe('2026-01-02');
    expect(isoDate('<script>')).toBeUndefined();
  });

  it('absoluteContentUrl refuses unsafe paths', () => {
    expect(absoluteContentUrl(SITE, '/')).toBe(SITE);
    expect(absoluteContentUrl(SITE, '/du-an/../../admin')).toBeUndefined();
  });
});
