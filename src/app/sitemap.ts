import type { MetadataRoute } from 'next';
import { getSitemapData } from '../lib/cms';
import { buildSitemapEntries } from '../lib/public-content';
import { getSiteUrl, STATIC_PUBLIC_PATHS } from '../lib/site';

// Rendered per request: content lives in PostgreSQL, which is not available at build time.
export const dynamic = 'force-dynamic';

// Fixed public IA + every published, indexable CMS document (all pages, no cap) minus noindex singletons.
// A database failure rejects (HTTP 500) rather than serving a truncated sitemap; /admin and /api are never listed.
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const { contentPaths, excludedPaths } = await getSitemapData();
  return buildSitemapEntries(getSiteUrl(), STATIC_PUBLIC_PATHS, contentPaths, excludedPaths);
}
