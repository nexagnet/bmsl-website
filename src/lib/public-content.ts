import { isApprovedMediaPath, isPrivatePath, isPublicContentPath, isPublicSlug } from './seo';
import { paths } from './site';

// Pure mappers from CMS documents to public view models. They are defensive on purpose:
// the access layer is authoritative, these only guarantee that nothing unpublished,
// unapproved or empty ever reaches a template.

type Doc = Record<string, unknown>;

const isDoc = (v: unknown): v is Doc => typeof v === 'object' && v !== null && !Array.isArray(v);

/** Trimmed non-empty string, otherwise undefined (optional unknown fields are hidden, never invented). */
export const text = (v: unknown): string | undefined =>
  typeof v === 'string' && v.trim() !== '' ? v.trim() : undefined;

/** A slug becomes part of canonical/sitemap/JSON-LD URLs, so anything outside the strict slug shape is dropped. */
const slugOf = (v: unknown): string | undefined => {
  const s = text(v);
  return s && isPublicSlug(s) ? s : undefined;
};

export const isPublished =(doc: unknown): doc is Doc => isDoc(doc) && doc._status === 'published';

export type PublicImage = { id: string; alt: string; url: string; width?: number; height?: number };

/** Only populated, APPROVED media with a url and alt text. A bare id (access-denied relation) is dropped. */
export function toPublicImage(v: unknown): PublicImage | undefined {
  if (!isDoc(v) || v.rightsStatus !== 'APPROVED') return undefined;
  const url = text(v.url);
  const alt = text(v.alt);
  // Only same-site media file paths: no remote hosts, no arbitrary paths (rights are enforced by the file route).
  if (!url || !alt || !isApprovedMediaPath(url)) return undefined;
  return {
    id: String(v.id),
    alt,
    url,
    width: typeof v.width === 'number' ? v.width : undefined,
    height: typeof v.height === 'number' ? v.height : undefined,
  };
}

export const toPublicImages = (v: unknown): PublicImage[] =>
  (Array.isArray(v) ? v : []).map(toPublicImage).filter((i): i is PublicImage => !!i);

export type PublicSeo = { title?: string; description?: string; image?: PublicImage; noindex: boolean };

export function toSeo(v: unknown): PublicSeo {
  const seo = isDoc(v) ? v : {};
  return {
    title: text(seo.title),
    description: text(seo.metaDescription),
    image: toPublicImage(seo.ogImage),
    noindex: seo.noindex === true,
  };
}

export type ServiceView = {
  id: string;
  name: string;
  slug: string;
  summary?: string;
  body: unknown;
  href: string;
  seo: PublicSeo;
};

export function toService(d: unknown): ServiceView | undefined {
  if (!isPublished(d)) return undefined;
  const name = text(d.name);
  const slug = slugOf(d.slug);
  if (!name || !slug) return undefined;
  return {
    id: String(d.id),
    name,
    slug,
    summary: text(d.summary),
    body: d.body,
    href: paths.service(slug),
    seo: toSeo(d.seo),
  };
}

export type CategoryView = { id: string; name: string; slug: string; href: string };

export function toCategory(d: unknown): CategoryView | undefined {
  if (!isPublished(d)) return undefined;
  const name = text(d.name);
  const slug = slugOf(d.slug);
  return name && slug ? { id: String(d.id), name, slug, href: paths.category(slug) } : undefined;
}

export type ProjectView = {
  id: string;
  name: string;
  slug: string;
  href: string;
  summary?: string;
  facts: { label: string; value: string }[];
  services: { name: string; href: string }[];
  images: PublicImage[];
  bqtFeedback?: string;
  seo: PublicSeo;
};

export function toProject(d: unknown): ProjectView | undefined {
  if (!isPublished(d)) return undefined;
  const name = text(d.name);
  const slug = slugOf(d.slug);
  if (!name || !slug) return undefined;
  const facts = [
    { label: 'Vị trí', value: text(d.address) },
    { label: 'Quy mô', value: text(d.scale) },
    { label: 'Vận hành từ', value: text(d.operatingSince) },
  ].filter((f): f is { label: string; value: string } => !!f.value);
  const services = (Array.isArray(d.services) ? d.services : [])
    .map(toService)
    .filter((s): s is ServiceView => !!s)
    .map((s) => ({ name: s.name, href: s.href }));
  const bqt = isDoc(d.bqtFeedback) ? d.bqtFeedback : {};
  return {
    id: String(d.id),
    name,
    slug,
    href: paths.project(slug),
    summary: text(d.summary),
    facts,
    services,
    images: toPublicImages(d.images),
    // BQT feedback is shown only when the source explicitly approved it.
    bqtFeedback: bqt.approvedBySource === true ? text(bqt.text) : undefined,
    seo: toSeo(d.seo),
  };
}

export type ArticleView = {
  id: string;
  title: string;
  slug: string;
  href: string;
  excerpt?: string;
  body: unknown;
  category: CategoryView;
  cover?: PublicImage;
  publishedAt?: string;
  seo: PublicSeo;
};

/** An article needs a published category to have a canonical URL; otherwise it is not public. */
export function toArticle(d: unknown): ArticleView | undefined {
  if (!isPublished(d)) return undefined;
  const title = text(d.title);
  const slug = slugOf(d.slug);
  const category = toCategory(d.category);
  if (!title || !slug || !category) return undefined;
  return {
    id: String(d.id),
    title,
    slug,
    href: paths.article(category.slug, slug),
    excerpt: text(d.excerpt),
    body: d.body,
    category,
    cover: toPublicImage(d.cover),
    publishedAt: text(d.publishedAt),
    seo: toSeo(d.seo),
  };
}

export type JobView = {
  id: string;
  title: string;
  slug: string;
  href: string;
  description: unknown;
  requirements: unknown;
  benefits: unknown;
  salary?: string;
  deadline?: string;
  applyInstruction?: string;
  seo: PublicSeo;
};

export function toJob(d: unknown): JobView | undefined {
  if (!isPublished(d)) return undefined;
  const title = text(d.title);
  const slug = slugOf(d.slug);
  if (!title || !slug) return undefined;
  return {
    id: String(d.id),
    title,
    slug,
    href: paths.job(slug),
    description: d.description,
    requirements: d.requirements,
    benefits: d.benefits,
    salary: text(d.salary),
    deadline: text(d.deadline),
    applyInstruction: text(d.applyInstruction),
    seo: toSeo(d.seo),
  };
}

export type DocumentView = { id: string; title: string; description?: string; category?: string; url: string };

/** A download is public only when its file is APPROVED media. */
export function toDocument(d: unknown): DocumentView | undefined {
  if (!isPublished(d)) return undefined;
  const title = text(d.title);
  const file = toPublicImage(d.file);
  return title && file
    ? { id: String(d.id), title, description: text(d.description), category: text(d.category), url: file.url }
    : undefined;
}

export type PageView = { title?: string; body: unknown; seo: PublicSeo };

/** Singleton pages: null (safe empty state) unless published. */
export function toPage(d: unknown): PageView | null {
  if (!isPublished(d)) return null;
  return { title: text(d.title), body: d.body, seo: toSeo(d.seo) };
}

/** True when a Lexical value holds at least one block with content. */
export function hasRichText(v: unknown): boolean {
  if (!isDoc(v) || !isDoc(v.root) || !Array.isArray(v.root.children)) return false;
  const nonEmpty = (n: unknown): boolean => {
    if (!isDoc(n)) return false;
    if (typeof n.text === 'string' && n.text.trim() !== '') return true;
    return Array.isArray(n.children) && n.children.some(nonEmpty);
  };
  return v.root.children.some(nonEmpty);
}

export const formatDate = (iso?: string): string | undefined => {
  if (!iso) return undefined;
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? undefined
    : new Intl.DateTimeFormat('vi-VN', { dateStyle: 'long', timeZone: 'Asia/Ho_Chi_Minh' }).format(d);
};

/** Sitemap protocol limit for one file. Exceeding it must fail loudly rather than silently truncate. */
export const SITEMAP_MAX_URLS = 50_000;

export type PageOf<T> = { docs: T[]; hasNextPage: boolean };

/** Reads every page of a collection. Errors propagate: a partial sitemap is worse than a failed one. */
export async function fetchAllPages<T>(fetchPage: (page: number) => Promise<PageOf<T>>, maxPages = 1000): Promise<T[]> {
  const out: T[] = [];
  for (let page = 1; page <= maxPages; page += 1) {
    const result = await fetchPage(page);
    out.push(...result.docs);
    if (!result.hasNextPage) return out;
  }
  throw new Error(`pagination exceeded ${maxPages} pages`);
}

/** Absolute, de-duplicated sitemap entries; only validated public content paths are emitted. */
export function buildSitemapEntries(
  baseUrl: string,
  staticPaths: readonly string[],
  contentPaths: readonly string[],
): { url: string }[] {
  const seen = new Set<string>();
  const out: { url: string }[] = [];
  for (const p of [...staticPaths, ...contentPaths]) {
    if (isPrivatePath(p) || !isPublicContentPath(p)) continue;
    const url = p === '/' ? baseUrl : `${baseUrl}${p}`;
    if (!seen.has(url)) {
      seen.add(url);
      out.push({ url });
    }
  }
  if (out.length > SITEMAP_MAX_URLS) {
    throw new Error(`sitemap has ${out.length} URLs, above the ${SITEMAP_MAX_URLS} limit; split it before publishing`);
  }
  return out;
}
