import type { MetadataRoute } from 'next';
import { getContentPaths, getIndexableStaticPaths } from '../lib/cms';
import { buildSitemapEntries } from '../lib/public-content';
import { assertSitemapSize } from '../lib/seo';
import { getSiteUrl, STATIC_PUBLIC_PATHS } from '../lib/site';

// Rendered per request: content lives in PostgreSQL, which is not available at build time.
export const dynamic = 'force-dynamic';

// Lists the fixed public IA (minus noindex singletons) plus every published, indexable CMS item (all pages,
// no fixed cap); /admin and /api are never listed. Exceeding the protocol limit fails loudly.
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [staticPaths, contentPaths] = await Promise.all([getIndexableStaticPaths(STATIC_PUBLIC_PATHS), getContentPaths()]);
  const entries = buildSitemapEntries(getSiteUrl(), staticPaths, contentPaths);
  assertSitemapSize(entries.length);
  return entries;
}
