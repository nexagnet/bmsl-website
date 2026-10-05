import { richTextToPlain, type JobView } from './public-content';
import { absoluteContentUrl, isApprovedMediaPath } from './seo';
import { SITE_NAME } from './site';

// JSON-LD builders. They return undefined instead of guessing: only published, validated fields are used and no
// legal name, address, author or job fact is ever invented. LocalBusiness is intentionally absent until BMSL
// confirms an address (docs/blueprint/06 §6).

type Json = Record<string, unknown>;

// Built from char codes so the source file never contains raw U+2028/U+2029.
const LINE_SEPARATOR = String.fromCharCode(0x2028);
const PARAGRAPH_SEPARATOR = String.fromCharCode(0x2029);

/** Serializes for an inline <script>: `<`, `>`, `&` and the JS line separators cannot terminate or break out of it. */
export const serializeJsonLd = (data: unknown): string =>
  JSON.stringify(data)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026')
    .split(LINE_SEPARATOR)
    .join('\\u2028')
    .split(PARAGRAPH_SEPARATOR)
    .join('\\u2029');

const CTX = 'https://schema.org';

/** ISO-8601 date or date-time only; anything else is dropped so malformed dates never reach structured data. */
export const isoDate = (v: unknown): string | undefined => {
  if (typeof v !== 'string' || !/^\d{4}-\d{2}-\d{2}(?:T[\d:.]+(?:Z|[+-]\d{2}:\d{2})?)?$/.test(v)) return undefined;
  if (Number.isNaN(new Date(v).getTime())) return undefined;
  // V8 rolls 2026-02-30 over to March; require the calendar day to exist.
  const [y, m, d] = v.slice(0, 10).split('-').map(Number) as [number, number, number];
  const day = new Date(Date.UTC(y, m - 1, d));
  return day.getUTCFullYear() === y && day.getUTCMonth() === m - 1 && day.getUTCDate() === d ? v : undefined;
};

export const organizationLd = (siteUrl: string): Json => ({
  '@context': CTX,
  '@type': 'Organization',
  name: SITE_NAME,
  url: siteUrl,
});

export function breadcrumbLd(siteUrl: string, crumbs: { name: string; path: string }[]): Json | undefined {
  if (crumbs.length === 0) return undefined;
  const items: Json[] = [];
  for (const [i, crumb] of crumbs.entries()) {
    const item = absoluteContentUrl(siteUrl, crumb.path);
    if (!item || !crumb.name.trim()) return undefined;
    items.push({ '@type': 'ListItem', position: i + 1, name: crumb.name, item });
  }
  return { '@context': CTX, '@type': 'BreadcrumbList', itemListElement: items };
}

export function articleLd(
  siteUrl: string,
  a: { title: string; path: string; publishedAt?: string; description?: string; imageUrl?: string },
): Json | undefined {
  const url = absoluteContentUrl(siteUrl, a.path);
  const datePublished = isoDate(a.publishedAt);
  if (!url || !datePublished || !a.title.trim()) return undefined;
  return {
    '@context': CTX,
    '@type': 'Article',
    headline: a.title,
    mainEntityOfPage: url,
    datePublished,
    ...(a.description ? { description: a.description } : {}),
    ...(a.imageUrl && isApprovedMediaPath(a.imageUrl) ? { image: `${siteUrl}${a.imageUrl}` } : {}),
    publisher: { '@type': 'Organization', name: SITE_NAME, url: siteUrl },
  };
}

export type JobPostingInput = {
  title: string;
  description?: string;
  datePosted?: string;
  validThrough?: string;
  /** Operator-entered job location; never inferred. */
  location?: {
    streetAddress?: string;
    addressLocality: string;
    addressRegion?: string;
    postalCode?: string;
    addressCountry: string;
  };
};

/** Google requires title, description, datePosted, hiringOrganization and jobLocation: all or nothing. */
export function jobPostingLd(siteUrl: string, j: JobPostingInput): Json | undefined {
  const datePosted = isoDate(j.datePosted);
  const description = j.description?.trim();
  if (!j.title.trim() || !description || !datePosted || !j.location) return undefined;
  const validThrough = isoDate(j.validThrough);
  return {
    '@context': CTX,
    '@type': 'JobPosting',
    title: j.title,
    description,
    datePosted,
    ...(validThrough ? { validThrough } : {}),
    hiringOrganization: { '@type': 'Organization', name: SITE_NAME, sameAs: siteUrl },
    jobLocation: { '@type': 'Place', address: { '@type': 'PostalAddress', ...j.location } },
  };
}

/**
 * JobPosting for a public job page. Public jobs are CONFIRMED already (mapper gate); the date and location must have
 * been entered by staff: createdAt is never used for the date, no location or country is assumed, anything missing emits none.
 */
export function confirmedJobPostingLd(siteUrl: string, job: JobView): Json | undefined {
  return jobPostingLd(siteUrl, {
    title: job.title,
    description: richTextToPlain(job.description),
    datePosted: job.datePosted,
    validThrough: job.deadline,
    location: job.location,
  });
}
