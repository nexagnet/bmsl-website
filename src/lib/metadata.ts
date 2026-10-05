import type { Metadata } from 'next';
import type { PublicSeo } from './public-content';
import { isApprovedMediaPath, isPublicContentPath } from './seo';
import { SITE_NAME } from './site';

/**
 * Metadata from CMS SEO fields when present; falls back to the page title. Canonical is a relative path
 * (metadataBase in layout) and must be a valid public content path: an unsafe path yields no canonical/OG url.
 */
export function buildMetadata(
  path: string,
  fallbackTitle: string,
  seo?: PublicSeo,
  fallbackDescription?: string,
): Metadata {
  const title = seo?.title ?? fallbackTitle;
  const description = seo?.description ?? fallbackDescription;
  const safePath = isPublicContentPath(path) ? path : undefined;
  const image = seo?.image && isApprovedMediaPath(seo.image.url) ? seo.image : undefined;
  return {
    title,
    ...(description ? { description } : {}),
    ...(safePath ? { alternates: { canonical: safePath } } : {}),
    robots: seo?.noindex || !safePath ? { index: false, follow: false } : undefined,
    openGraph: {
      title,
      ...(description ? { description } : {}),
      ...(safePath ? { url: safePath } : {}),
      siteName: SITE_NAME,
      locale: 'vi_VN',
      type: 'website',
      ...(image ? { images: [{ url: image.url, alt: image.alt }] } : {}),
    },
  };
}
