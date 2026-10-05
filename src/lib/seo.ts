/** Routes that must never be indexed or listed in the sitemap. */
export const PRIVATE_PATH_PREFIXES = ['/admin', '/api'] as const;

export const isPrivatePath = (path: string): boolean =>
  PRIVATE_PATH_PREFIXES.some((p) => path === p || path.startsWith(`${p}/`));

// --- Public content slugs and paths -------------------------------------------------------------
// CMS slugs are editor-entered free text. Every canonical URL, sitemap entry and JSON-LD url is built
// only from slugs that pass this check, so a slug can never add a path segment, traversal, query,
// fragment or a private destination.

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
export const MAX_SLUG_LENGTH = 120;

/** Lowercase ASCII words joined by single hyphens; anything else (dots, slashes, %, ?, #, \) is rejected. */
export const isPublicSlug = (value: unknown): value is string =>
  typeof value === 'string' && value.length <= MAX_SLUG_LENGTH && SLUG.test(value);

/** Fixed first segments of the public IA that content slugs live under (docs/blueprint/05). */
const CONTENT_SECTIONS = ['dich-vu', 'du-an', 'kien-thuc', 'tuyen-dung'] as const;
const STATIC_ROUTES = ['/', '/gioi-thieu', '/quy-trinh-minh-bach', '/lien-he'] as const;

/**
 * True only for an indexable public route: a fixed IA route, a section index, a section/<slug> or
 * kien-thuc/<category>/<slug>. No query, fragment, encoding, backslash, dot segment or private prefix.
 */
export function isPublicContentPath(path: unknown): path is string {
  if (typeof path !== 'string') return false;
  if ((STATIC_ROUTES as readonly string[]).includes(path)) return true;
  if (!path.startsWith('/') || isPrivatePath(path)) return false;
  const segments = path.slice(1).split('/');
  const [section, ...rest] = segments;
  if (!(CONTENT_SECTIONS as readonly string[]).includes(section ?? '')) return false;
  const max = section === 'kien-thuc' ? 2 : 1;
  if (rest.length > max) return false;
  return rest.every(isPublicSlug);
}

/** Sitemaps protocol limit per file. Exceeding it is an error, never a silent truncation. */
export const SITEMAP_MAX_URLS = 50_000;

// --- Site origin ----------------------------------------------------------------------------------

export const DEFAULT_SITE_URL = 'http://localhost:3000';

/**
 * SITE_URL must be a bare http(s) origin (no credentials, path, query or fragment). Unset means the local
 * development default; a set-but-invalid value throws so a misconfiguration never silently changes canonicals.
 */
export function normalizeSiteUrl(raw: string | undefined): string {
  const value = raw?.trim();
  if (!value) return DEFAULT_SITE_URL;
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error('SITE_URL must be an absolute http(s) origin');
  }
  const bare = url.pathname === '/' && !url.search && !url.hash && !value.includes('?') && !value.includes('#');
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || !bare) {
    throw new Error('SITE_URL must be an http(s) origin without credentials, path, query or fragment');
  }
  return url.origin;
}

// --- Approved media paths ---------------------------------------------------------------------------
// Separate from content paths: /api/media-assets/file/... is a valid image path but never an indexable route.

const MEDIA_FILE = /^\/api\/media-assets\/file\/[A-Za-z0-9._~%@+-]+(?:\?t=\d+)?$/;

/** Same-site Payload media file path only. Remote hosts, traversal and encoded dot/slash segments are rejected. */
export function isApprovedMediaPath(value: unknown): value is string {
  if (typeof value !== 'string' || value.length > 300 || !MEDIA_FILE.test(value)) return false;
  const file = value.slice('/api/media-assets/file/'.length).split('?')[0] ?? '';
  return file !== '.' && file !== '..' && !/%(?:2e|2f|5c|00)/i.test(file);
}

// --- Structured data (JSON-LD) ------------------------------------------------------------------------

/** Serialises JSON-LD for an inline <script>: `<`, `>`, `&` and line separators can never close or alter the tag. */
export const serializeJsonLd = (data: unknown): string =>
  JSON.stringify(data)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026')
    .replaceAll(String.fromCharCode(0x2028), '\\u2028')
    .replaceAll(String.fromCharCode(0x2029), '\\u2029');

const absolute = (origin: string, path: string): string | undefined =>
  isPublicContentPath(path) ? (path === '/' ? origin : `${origin}${path}`) : undefined;

type Ld = Record<string, unknown>;

export function organizationLd(origin: string, name: string): Ld {
  return { '@context': 'https://schema.org', '@type': 'Organization', name, url: origin };
}

/** BreadcrumbList; items with an unsafe path are dropped, and no list is produced when nothing is valid. */
export function breadcrumbLd(origin: string, items: { name: string; path: string }[]): Ld | undefined {
  const list = items.flatMap((item) => {
    const url = absolute(origin, item.path);
    return url && item.name.trim() ? [{ name: item.name.trim(), item: url }] : [];
  });
  if (list.length !== items.length || list.length === 0) return undefined;
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: list.map((entry, i) => ({ '@type': 'ListItem', position: i + 1, ...entry })),
  };
}

const validIso = (value: string | undefined): string | undefined => {
  if (!value || !/^\d{4}-\d{2}-\d{2}/.test(value)) return undefined;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? undefined : d.toISOString();
};

/** Article needs a headline, a safe canonical path and a valid published date. No author is invented. */
export function articleLd(
  origin: string,
  a: { headline: string; path: string; publishedAt?: string; imageUrl?: string; description?: string },
): Ld | undefined {
  const url = absolute(origin, a.path);
  const datePublished = validIso(a.publishedAt);
  if (!url || !datePublished || !a.headline.trim()) return undefined;
  return {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: a.headline.trim(),
    mainEntityOfPage: url,
    datePublished,
    ...(a.description ? { description: a.description } : {}),
    ...(a.imageUrl && isApprovedMediaPath(a.imageUrl) ? { image: `${origin}${a.imageUrl}` } : {}),
  };
}

/**
 * JobPosting only when every required property is published: title, description, posting date, hiring
 * organisation name and a job location with an address locality. Otherwise nothing is emitted.
 */
export function jobPostingLd(
  origin: string,
  j: {
    title: string;
    path: string;
    description?: string;
    datePosted?: string;
    organizationName: string;
    addressLocality?: string;
    addressCountry?: string;
  },
): Ld | undefined {
  const url = absolute(origin, j.path);
  const datePosted = validIso(j.datePosted);
  if (!url || !datePosted || !j.title.trim() || !j.description?.trim() || !j.addressLocality?.trim() || !j.addressCountry?.trim()) {
    return undefined;
  }
  return {
    '@context': 'https://schema.org',
    '@type': 'JobPosting',
    title: j.title.trim(),
    description: j.description.trim(),
    datePosted,
    url,
    hiringOrganization: { '@type': 'Organization', name: j.organizationName, sameAs: origin },
    jobLocation: {
      '@type': 'Place',
      address: { '@type': 'PostalAddress', addressLocality: j.addressLocality.trim(), addressCountry: j.addressCountry.trim() },
    },
  };
}

// LocalBusiness is intentionally NOT implemented: there is no confirmed address (UNCONFIRMED contact data).
