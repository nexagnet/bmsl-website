import type { Metadata } from 'next';
import type { PublicSeo } from './public-content';
import { isApprovedMediaPath, isPublicContentPath } from './seo';
import { SITE_NAME } from './site';

/**
 * Metadata from CMS SEO fields when present; falls back to the page title. Canonical is a relative path
 * (metadataBase in layout) and is emitted only for a validated public content path; an unsafe path gets no
 * canonical and is noindexed instead.
 */
export function buildMetadata(
  path: string,
  fallbackTitle: string,
  seo?: PublicSeo,
  fallbackDescription?: string,
): Metadata {
  const title = seo?.title ?? fallbackTitle;
  const description = seo?.description ?? fallbackDescription;
  const safePath = isPublicContentPath(path);
  const image = seo?.image && isApprovedMediaPath(seo.image.url) ? seo.image : undefined;
  return {
    title,
    ...(description ? { description } : {}),
    ...(safePath ? { alternates: { canonical: path } } : {}),
    robots: seo?.noindex || !safePath ? { index: false, follow: false } : undefined,
    openGraph: {
      title,
      ...(description ? { description } : {}),
      siteName: SITE_NAME,
      locale: 'vi_VN',
      type: 'website',
      ...(safePath ? { url: path } : {}),
      ...(image ? { images: [{ url: image.url }] } : {}),
    },
  };
}
