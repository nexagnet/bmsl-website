import type { MetadataRoute } from 'next';
import { getContentPaths } from '../lib/cms';
import { buildSitemapEntries } from '../lib/public-content';
import { getSiteUrl, STATIC_PUBLIC_PATHS } from '../lib/site';

// Rendered per request: content lives in PostgreSQL, which is not available at build time.
export const dynamic = 'force-dynamic';

// Lists the fixed public IA plus published CMS content; /admin and /api are never listed.
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  return buildSitemapEntries(getSiteUrl(), STATIC_PUBLIC_PATHS, await getContentPaths());
}
