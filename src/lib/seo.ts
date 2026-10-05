/** Routes that must never be indexed or listed in the sitemap. */
export const PRIVATE_PATH_PREFIXES = ['/admin', '/api'] as const;

export const isPrivatePath = (path: string): boolean =>
  PRIVATE_PATH_PREFIXES.some((p) => path === p || path.startsWith(`${p}/`));

/** Sitemaps protocol limit per file; exceeding it must fail loudly instead of silently truncating. */
export const SITEMAP_MAX_URLS = 50_000;

/**
 * Validated site origin: absolute http(s) URL with no credentials, path, query or hash.
 * Throws on anything else so a mistyped SITE_URL can never leak into canonical/OG/sitemap output.
 */
export function parseSiteUrl(raw: string): string {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error('SITE_URL must be an absolute http(s) URL');
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') throw new Error('SITE_URL must use http or https');
  if (url.username || url.password) throw new Error('SITE_URL must not contain credentials');
  if ((url.pathname !== '/' && url.pathname !== '') || url.search || url.hash) {
    throw new Error('SITE_URL must be an origin only (no path, query or hash)');
  }
  return url.origin;
}

/** http(s) URL only (no credentials); anything else is dropped. Used for sameAs and other outbound links. */
export function safeHttpUrl(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  try {
    const url = new URL(value.trim());
    if ((url.protocol !== 'https:' && url.protocol !== 'http:') || url.username || url.password) return undefined;
    return url.href;
  } catch {
    return undefined;
  }
}

/** Same-site path (`/x`), never protocol-relative or containing backslashes/control characters. */
export const isSitePath = (value: string): boolean =>
  value.startsWith('/') &&
  !value.startsWith('//') &&
  ![...value].some((ch) => ch === '\\' || ch.charCodeAt(0) < 0x20 || ch.charCodeAt(0) === 0x7f);

/** Serialises JSON-LD for an inline <script>: `<`, `>`, `&` and line separators can never close the tag. */
export function serializeJsonLd(data: unknown): string {
  return JSON.stringify(data)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026')
    .replaceAll(String.fromCharCode(0x2028), '\\u2028')
    .replaceAll(String.fromCharCode(0x2029), '\\u2029');
}

/** Google Search Console `google-site-verification` token charset; anything else is ignored. */
export const parseSearchConsoleToken = (v: unknown): string | undefined =>
  typeof v === 'string' && /^[A-Za-z0-9_-]{20,100}$/.test(v.trim()) ? v.trim() : undefined;

export type JsonLd = Record<string, unknown>;
type Crumb = { name: string; path: string };

const abs = (base: string, path: string) => (path === '/' ? base : `${base}${path}`);

/** Only the facts we really publish: name, URL and validated social profiles. No legal name, address or phone invented. */
export function organizationJsonLd(base: string, name: string, socialUrls: readonly string[] = []): JsonLd {
  const sameAs = socialUrls.map(safeHttpUrl).filter((u): u is string => !!u);
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name,
    url: base,
    ...(sameAs.length ? { sameAs } : {}),
  };
}

export function breadcrumbJsonLd(base: string, crumbs: readonly Crumb[]): JsonLd | null {
  const items = crumbs.filter((c) => c.name && isSitePath(c.path));
  if (items.length === 0) return null;
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((c, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: c.name,
      item: abs(base, c.path),
    })),
  };
}

const isoDate = (v?: string): string | undefined => {
  if (!v) return undefined;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? undefined : d.toISOString();
};

export function articleJsonLd(
  base: string,
  publisherName: string,
  a: { title: string; path: string; publishedAt?: string; imageUrl?: string; description?: string },
): JsonLd | null {
  const datePublished = isoDate(a.publishedAt);
  if (!a.title || !isSitePath(a.path) || !datePublished) return null;
  return {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: a.title,
    datePublished,
    mainEntityOfPage: abs(base, a.path),
    ...(a.description ? { description: a.description } : {}),
    ...(a.imageUrl && isSitePath(a.imageUrl) ? { image: [abs(base, a.imageUrl)] } : {}),
    publisher: { '@type': 'Organization', name: publisherName, url: base },
  };
}

export type JobPostingInput = {
  title: string;
  path: string;
  description?: string; // plain text
  datePosted?: string;
  validThrough?: string;
  /** Published job location; never defaulted from the (unconfirmed) company address. */
  addressLocality?: string;
};

/**
 * JobPosting only when the published fields satisfy the required semantics (title, description, datePosted,
 * hiringOrganization, jobLocation). Missing data means no markup: nothing is fabricated.
 */
export function jobPostingJsonLd(base: string, orgName: string, j: JobPostingInput): JsonLd | null {
  const datePosted = isoDate(j.datePosted);
  if (!j.title || !j.description || !datePosted || !j.addressLocality || !isSitePath(j.path)) return null;
  const validThrough = isoDate(j.validThrough);
  return {
    '@context': 'https://schema.org',
    '@type': 'JobPosting',
    title: j.title,
    description: j.description,
    datePosted,
    ...(validThrough ? { validThrough } : {}),
    url: abs(base, j.path),
    hiringOrganization: { '@type': 'Organization', name: orgName, sameAs: base },
    jobLocation: {
      '@type': 'Place',
      address: { '@type': 'PostalAddress', addressLocality: j.addressLocality, addressCountry: 'VN' },
    },
  };
}

/** Collects every page of a paginated source; guards against a source that never terminates. */
export async function collectAllPages<T>(
  fetchPage: (page: number) => Promise<{ docs: T[]; totalPages: number }>,
  maxPages = 1000,
): Promise<T[]> {
  const out: T[] = [];
  for (let page = 1; page <= maxPages; page++) {
    const r = await fetchPage(page);
    out.push(...r.docs);
    if (page >= r.totalPages) return out;
  }
  throw new Error(`pagination exceeded ${maxPages} pages`);
}

export function assertSitemapSize(count: number): void {
  if (count > SITEMAP_MAX_URLS) {
    throw new Error(`sitemap has ${count} URLs, above the ${SITEMAP_MAX_URLS} per-file limit; split into a sitemap index`);
  }
}
