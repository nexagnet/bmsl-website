import type { MetadataRoute } from 'next';

// Public pages are added with the W2/W4 templates; /admin and /api are never listed.
export default function sitemap(): MetadataRoute.Sitemap {
  return [];
}
