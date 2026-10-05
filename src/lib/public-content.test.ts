import { describe, expect, it } from 'vitest';
import {
  buildSitemapEntries,
  hasRichText,
  toArticle,
  toDocument,
  toJob,
  toPage,
  toProject,
  toPublicImage,
  toSeo,
  toService,
} from './public-content';
import { NAV_ITEMS, STATIC_PUBLIC_PATHS, SURVEY_CTA } from './site';

const approved = { id: 1, alt: 'Ảnh', url: '/media/a.jpg', rightsStatus: 'APPROVED' };
const pub = { _status: 'published' };

describe('site IA', () => {
  it('has the 8 contracted areas and the survey CTA', () => {
    expect(NAV_ITEMS).toHaveLength(8);
    expect(STATIC_PUBLIC_PATHS).toEqual(
      expect.arrayContaining(['/', '/gioi-thieu', '/dich-vu', '/du-an', '/quy-trinh-minh-bach', '/kien-thuc', '/tuyen-dung', '/lien-he']),
    );
    expect(SURVEY_CTA.href).toBe('/lien-he?requestType=khao-sat');
  });
});

describe('published-only mapping', () => {
  it('drops drafts and docs without status', () => {
    const base = { id: 1, name: 'x', slug: 'x', title: 'x' };
    for (const map of [toService, toProject, toJob, toArticle, toDocument, toPage]) {
      expect(map({ ...base, _status: 'draft' })).toBeFalsy();
      expect(map(base)).toBeFalsy();
    }
  });
});

describe('media rights gate', () => {
  it('accepts only populated APPROVED media', () => {
    expect(toPublicImage(approved)?.url).toBe('/media/a.jpg');
    expect(toPublicImage({ ...approved, rightsStatus: 'UNCONFIRMED' })).toBeUndefined();
    expect(toPublicImage(7)).toBeUndefined();
    expect(toPublicImage({ ...approved, alt: '' })).toBeUndefined();
  });

  it('never exposes remote or protocol-relative image hosts, even for APPROVED media', () => {
    for (const url of ['https://evil.test/a.jpg', '//evil.test/a.jpg', 'javascript:alert(1)', '/a\\b.jpg']) {
      expect(toPublicImage({ ...approved, url })).toBeUndefined();
    }
    expect(toPublicImage({ ...approved, url: '/api/media-assets/file/a.jpg' })?.url).toBe('/api/media-assets/file/a.jpg');
  });

  it('filters unapproved project images and SEO og image', () => {
    const p = toProject({
      ...pub,
      id: 1,
      name: 'P',
      slug: 'p',
      images: [approved, { ...approved, id: 2, rightsStatus: 'UNCONFIRMED' }, 3],
    });
    expect(p?.images).toHaveLength(1);
    expect(toSeo({ ogImage: { ...approved, rightsStatus: 'UNCONFIRMED' } }).image).toBeUndefined();
  });

  it('hides documents whose file is not approved', () => {
    expect(toDocument({ ...pub, id: 1, title: 'D', file: { ...approved, rightsStatus: 'UNCONFIRMED' } })).toBeUndefined();
    expect(toDocument({ ...pub, id: 1, title: 'D', file: approved })?.url).toBe('/media/a.jpg');
  });
});

describe('UNCONFIRMED optional data', () => {
  it('hides BQT feedback unless approvedBySource', () => {
    const doc = { ...pub, id: 1, name: 'P', slug: 'p' };
    expect(toProject({ ...doc, bqtFeedback: { text: 'ok', approvedBySource: false } })?.bqtFeedback).toBeUndefined();
    expect(toProject({ ...doc, bqtFeedback: { text: 'ok' } })?.bqtFeedback).toBeUndefined();
    expect(toProject({ ...doc, bqtFeedback: { text: 'ok', approvedBySource: true } })?.bqtFeedback).toBe('ok');
  });

  it('omits empty project facts instead of inventing values', () => {
    const p = toProject({ ...pub, id: 1, name: 'P', slug: 'p', address: '  ', scale: null, operatingSince: '2020' });
    expect(p?.facts).toEqual([{ label: 'Vận hành từ', value: '2020' }]);
    expect(toProject({ ...pub, id: 1, name: 'P', slug: 'p' })?.facts).toEqual([]);
  });

  it('leaves job salary/benefits/deadline undefined when empty', () => {
    const j = toJob({ ...pub, id: 1, title: 'J', slug: 'j', salary: '', deadline: null });
    expect(j?.salary).toBeUndefined();
    expect(j?.deadline).toBeUndefined();
    expect(hasRichText(j?.benefits)).toBe(false);
  });

  it('detects empty vs non-empty rich text', () => {
    const empty = { root: { children: [{ type: 'paragraph', children: [] }] } };
    const filled = { root: { children: [{ type: 'paragraph', children: [{ text: 'Xin chào' }] }] } };
    expect(hasRichText(empty)).toBe(false);
    expect(hasRichText(filled)).toBe(true);
  });
});

describe('route mapping', () => {
  it('builds canonical hrefs', () => {
    expect(toService({ ...pub, id: 1, name: 'Bảo vệ', slug: 'bao-ve' })?.href).toBe('/dich-vu/bao-ve');
    expect(toProject({ ...pub, id: 1, name: 'P', slug: 'p' })?.href).toBe('/du-an/p');
    expect(toJob({ ...pub, id: 1, title: 'J', slug: 'j' })?.href).toBe('/tuyen-dung/j');
    const article = toArticle({
      ...pub,
      id: 1,
      title: 'A',
      slug: 'a',
      category: { ...pub, id: 2, name: 'C', slug: 'c' },
    });
    expect(article?.href).toBe('/kien-thuc/c/a');
  });

  it('does not expose an article whose category is unpublished or unreadable', () => {
    expect(toArticle({ ...pub, id: 1, title: 'A', slug: 'a', category: 2 })).toBeUndefined();
    expect(toArticle({ ...pub, id: 1, title: 'A', slug: 'a', category: { _status: 'draft', id: 2, name: 'C', slug: 'c' } })).toBeUndefined();
  });
});

describe('sitemap entries', () => {
  it('includes public routes and content, de-duplicated, excluding admin/api', () => {
    const urls = buildSitemapEntries(
      'https://example.test',
      STATIC_PUBLIC_PATHS,
      ['/dich-vu/bao-ve', '/dich-vu/bao-ve', '/admin/x', '/api/users'],
    ).map((e) => e.url);
    expect(urls).toContain('https://example.test');
    expect(urls).toContain('https://example.test/lien-he');
    expect(urls.filter((u) => u.endsWith('/dich-vu/bao-ve'))).toHaveLength(1);
    expect(urls.some((u) => /\/(admin|api)(\/|$)/.test(u))).toBe(false);
  });
});
