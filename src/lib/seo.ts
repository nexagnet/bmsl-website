/** Routes that must never be indexed or listed in the sitemap. */
export const PRIVATE_PATH_PREFIXES = ['/admin', '/api'] as const;

export const isPrivatePath = (path: string): boolean =>
  PRIVATE_PATH_PREFIXES.some((p) => path === p || path.startsWith(`${p}/`));

/** Top-level sections that carry indexable public content (docs/blueprint/05 §1). */
const PUBLIC_SECTIONS = [
  'gioi-thieu',
  'dich-vu',
  'du-an',
  'quy-trinh-minh-bach',
  'kien-thuc',
  'tuyen-dung',
  'lien-he',
] as const;

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const MAX_SLUG = 120;
const MAX_PATH = 400;

/** A CMS slug that is safe as a URL path segment: lowercase ASCII words joined by single hyphens. */
export const isPublicSlug = (slug: unknown): slug is string =>
  typeof slug === 'string' && slug.length <= MAX_SLUG && SLUG.test(slug);

/**
 * An indexable public content path: "/" or "/<section>/<slug>[/<slug>]". Rejects query, fragment, backslash,
 * percent-encoding (so encoded traversal never normalizes into something else), dot segments, empty segments,
 * unknown sections and private routes. This is NOT the media-path check (see isApprovedMediaPath).
 */
export function isPublicContentPath(path: unknown): path is string {
  if (typeof path !== 'string' || path.length === 0 || path.length > MAX_PATH) return false;
  if (path === '/') return true;
  if (!path.startsWith('/') || isPrivatePath(path)) return false;
  const segments = path.slice(1).split('/');
  if (!(PUBLIC_SECTIONS as readonly string[]).includes(segments[0] as string)) return false;
  return segments.every(isPublicSlug);
}

const MEDIA_PREFIX = '/api/media-assets/file/';
// Raw filename segment: unreserved characters and percent escapes only (query, hash, slash, backslash never match).
const MEDIA_RAW_SEGMENT = /^[A-Za-z0-9._~%-]{1,600}$/;
// Decoded filename must not hold control/line-separator characters, path separators or a "%" (double encoding).
const MEDIA_FORBIDDEN_DECODED = /[\p{Cc}\p{Zl}\p{Zp}/\\%]/u;

/**
 * Same-site path of an uploaded media file. Only this exact shape may reach <img>, OG or JSON-LD images:
 * "/api/media-assets/file/<one filename>" where the filename is plain ASCII or valid percent-encoded UTF-8 (Payload
 * encodes spaces and Unicode). The segment is decoded exactly once; malformed encodings, decoded separators, control
 * characters, dot segments and double encoding (a decoded "%") are rejected.
 */
export const isApprovedMediaPath = (path: unknown): path is string => {
  if (typeof path !== 'string' || !path.startsWith(MEDIA_PREFIX)) return false;
  const raw = path.slice(MEDIA_PREFIX.length);
  if (!MEDIA_RAW_SEGMENT.test(raw)) return false;
  let name: string;
  try {
    name = decodeURIComponent(raw);
  } catch {
    return false;
  }
  return (
    name.length > 0 &&
    name.length <= 200 &&
    !name.startsWith('.') &&
    !name.includes('..') &&
    !MEDIA_FORBIDDEN_DECODED.test(name)
  );
};

/** SITE_URL must be a bare http(s) origin; anything else is a configuration error, never silently repaired. */
export function normalizeSiteUrl(raw: string): string {
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    throw new Error('SITE_URL must be an absolute http(s) URL');
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') throw new Error('SITE_URL must use http or https');
  if (url.username || url.password) throw new Error('SITE_URL must not contain credentials');
  if (url.search || url.hash || url.pathname !== '/') {
    throw new Error('SITE_URL must be an origin only (no path, query or fragment)');
  }
  return url.origin;
}

/** Absolute URL for a validated public content path; undefined when the path is not safe to publish. */
export const absoluteContentUrl = (siteUrl: string, path: string): string | undefined =>
  isPublicContentPath(path) ? (path === '/' ? siteUrl : `${siteUrl}${path}`) : undefined;
