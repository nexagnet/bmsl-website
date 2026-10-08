import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { buildSitemapEntries, toArticle, toDocument, toJob, toProject } from './public-content';
import { STATIC_PUBLIC_PATHS } from './site';

// Issue #84: synthetic proof of the editorial gates behind the eight-page matrix. Fixtures are invented test data,
// never BMSL content. They prove the mappers and the sitemap; they do not prove any real BMSL fact.

const read = (rel: string) => JSON.parse(readFileSync(new URL(rel, import.meta.url), 'utf8'));
const approved = { id: 1, alt: 'Ảnh thử', url: '/api/media-assets/file/a.jpg', rightsStatus: 'APPROVED' };
const pub = { _status: 'published' };
const category = { ...pub, id: 5, name: 'Chuyên mục thử', slug: 'chuyen-muc-thu' };

describe('contract ceilings and backlog are not auto-published', () => {
  it('keeps the 15 WordPress article candidates as unapproved backlog', () => {
    const c = read('../migration/article-candidates.json');
    expect(c.candidates).toHaveLength(15);
    expect(c.selectionApproved).toBe(false);
    expect(c.migratedArticleCount).toBe(0);
  });

  it('seeds legacy projects only as unconfirmed records (17, below the 21 ceiling), never CONFIRMED', () => {
    const { records } = read('../seed/bmsl-legacy/records/projects.json');
    expect(records).toHaveLength(17);
    expect(records.length).toBeLessThanOrEqual(21);
    for (const r of records) expect(r.sourceStatus).not.toBe('CONFIRMED');
  });

  it('exposes exactly the eight contracted static routes', () => {
    expect(STATIC_PUBLIC_PATHS).toHaveLength(8);
  });
});

describe('published + approved review flow (synthetic)', () => {
  const project = { ...pub, id: 1, name: 'Dự án thử', slug: 'du-an-thu', images: [approved] };

  it('hides a published project until sourceStatus is CONFIRMED, then shows only approved images', () => {
    expect(toProject({ ...project, sourceStatus: 'LEGACY-SOURCE' })).toBeUndefined();
    expect(toProject({ ...project, sourceStatus: 'UNCONFIRMED' })).toBeUndefined();
    expect(toProject({ ...project, sourceStatus: 'CONFIRMED' })?.images).toHaveLength(1);
    const revoked = { ...project, sourceStatus: 'CONFIRMED', images: [{ ...approved, rightsStatus: 'REVOKED' }] };
    expect(toProject(revoked)?.images).toEqual([]);
  });

  it('hides empty project facts instead of inventing them', () => {
    expect(toProject({ ...project, sourceStatus: 'CONFIRMED' })?.facts).toEqual([]);
  });

  it('drops an article without a published category, and a job or document without confirmation or approved file', () => {
    const article = { ...pub, id: 2, title: 'Bài thử', slug: 'bai-thu' };
    expect(toArticle({ ...article, category: { ...category, _status: 'draft' } })).toBeUndefined();
    expect(toArticle({ ...article, category })?.href).toBe('/kien-thuc/chuyen-muc-thu/bai-thu');
    const job = { ...pub, id: 3, title: 'Vị trí thử', slug: 'vi-tri-thu' };
    expect(toJob({ ...job, sourceStatus: 'UNCONFIRMED' })).toBeUndefined();
    expect(toJob({ ...job, sourceStatus: 'CONFIRMED' })?.salary).toBeUndefined();
    const doc = { ...pub, id: 4, title: 'Tài liệu thử' };
    expect(toDocument({ ...doc, file: { ...approved, rightsStatus: 'UNCONFIRMED' } })).toBeUndefined();
    expect(toDocument({ ...doc, file: approved })?.url).toBe(approved.url);
  });

  it('puts only validated public paths in the sitemap', () => {
    const entries = buildSitemapEntries('https://example.test', STATIC_PUBLIC_PATHS, ['/du-an/du-an-thu', '/admin', '/api/x']);
    const urls = entries.map((e) => e.url);
    expect(urls).toContain('https://example.test/du-an/du-an-thu');
    expect(urls.some((u) => u.includes('/admin') || u.includes('/api'))).toBe(false);
    expect(urls).toHaveLength(9);
  });
});
