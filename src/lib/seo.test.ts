import { describe, expect, it } from 'vitest';
import nextConfig from '../../next.config.mjs';
import robots from '../app/robots';
import { buildSitemapEntries } from './public-content';
import { isPrivatePath } from './seo';

describe('admin exclusion from indexing', () => {
  it('classifies admin and api paths as private', () => {
    expect(isPrivatePath('/admin')).toBe(true);
    expect(isPrivatePath('/admin/collections/users')).toBe(true);
    expect(isPrivatePath('/api/users')).toBe(true);
    expect(isPrivatePath('/administrator-guide')).toBe(false);
    expect(isPrivatePath('/')).toBe(false);
  });

  it('robots.txt disallows /admin and /api', () => {
    const rule = [robots().rules].flat()[0];
    expect(rule?.disallow).toEqual(expect.arrayContaining(['/admin', '/api']));
  });

  it('sitemap never lists private paths', () => {
    const entries = buildSitemapEntries('https://example.test', ['/', '/admin', '/api/users'], ['/admin/x', '/dich-vu/bao-ve']);
    expect(entries).toHaveLength(2);
    for (const entry of entries) {
      expect(isPrivatePath(new URL(entry.url).pathname)).toBe(false);
    }
  });

  it('sends X-Robots-Tag noindex for admin and api responses', async () => {
    const headers = await (nextConfig as { headers: () => Promise<{ source: string; headers: { key: string; value: string }[] }[]> }).headers();
    for (const source of ['/admin/:path*', '/api/:path*']) {
      const rule = headers.find((h) => h.source === source);
      expect(rule?.headers).toContainEqual({ key: 'X-Robots-Tag', value: 'noindex, nofollow' });
    }
  });
});
