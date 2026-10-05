import type { Metadata } from 'next';
import type { PublicSeo } from './public-content';
import { SITE_NAME } from './site';

/** Metadata from CMS SEO fields when present; falls back to the page title. Canonical is a relative path (metadataBase in layout). */
export function buildMetadata(
  path: string,
  fallbackTitle: string,
  seo?: PublicSeo,
  fallbackDescription?: string,
): Metadata {
  const title = seo?.title ?? fallbackTitle;
  const description = seo?.description ?? fallbackDescription;
  return {
    title,
    ...(description ? { description } : {}),
    alternates: { canonical: path },
    robots: seo?.noindex ? { index: false, follow: false } : undefined,
    openGraph: {
      title,
      ...(description ? { description } : {}),
      siteName: SITE_NAME,
      locale: 'vi_VN',
      type: 'website',
      ...(seo?.image ? { images: [{ url: seo.image.url }] } : {}),
    },
  };
}
