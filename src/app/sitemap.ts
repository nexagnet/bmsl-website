import type { MetadataRoute } from 'next';
import { getContentPaths, getNoindexStaticPaths } from '../lib/cms';
import { buildSitemapEntries } from '../lib/public-content';
import { getSiteUrl, STATIC_PUBLIC_PATHS } from '../lib/site';

// Rendered per request: content lives in PostgreSQL, which is not available at build time.
export const dynamic = 'force-dynamic';

// Lists the fixed public IA (minus published noindex singletons) plus every published CMS item. A database
// failure fails the request instead of returning a truncated sitemap; /admin and /api are never listed.
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const noindex = new Set(await getNoindexStaticPaths());
  return buildSitemapEntries(
    getSiteUrl(),
    STATIC_PUBLIC_PATHS.filter((p) => !noindex.has(p)),
    await getContentPaths(),
  );
}
