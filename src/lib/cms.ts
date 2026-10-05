import config from '@payload-config';
import { getPayload } from 'payload';
import {
  type ArticleView,
  type CategoryView,
  type DocumentView,
  type JobView,
  type PageView,
  type ProjectView,
  type ServiceView,
  toArticle,
  toCategory,
  toDocument,
  toJob,
  toPage,
  toProject,
  toService,
} from './public-content';
import { collectAllPages } from './seo';
import { EMPTY_SITE_SETTINGS, type SiteSettingsView, toSiteSettings } from './site-settings';

// Public read path. Every query runs with overrideAccess:false and no user, so collection access
// (published-only content, APPROVED-only media, BQT approval gate) stays authoritative; the mappers
// in public-content.ts re-check as a second line of defence. Failures degrade to empty states.

const PUBLIC = { overrideAccess: false, depth: 2, draft: false } as const;
export const PAGE_SIZE = 12;

const cms = () => getPayload({ config });

async function safe<T>(fallback: T, run: () => Promise<T>): Promise<T> {
  try {
    return await run();
  } catch (error) {
    console.error('public CMS read failed', error instanceof Error ? error.message : error);
    return fallback;
  }
}

const compact = <T>(items: (T | undefined)[]): T[] => items.filter((i): i is T => i !== undefined);

export type PageSlug = 'home-page' | 'about-page' | 'process-page' | 'contact-page';

export const getPage = (slug: PageSlug): Promise<PageView | null> =>
  safe(null, async () => toPage(await (await cms()).findGlobal({ slug, ...PUBLIC })));

export const getServices = (): Promise<ServiceView[]> =>
  safe([], async () => {
    const r = await (await cms()).find({ collection: 'service-areas', sort: 'order', limit: 50, ...PUBLIC });
    return compact(r.docs.map(toService));
  });

export const getService = (slug: string): Promise<ServiceView | null> =>
  safe(null, async () => {
    const r = await (await cms()).find({
      collection: 'service-areas',
      where: { slug: { equals: slug } },
      limit: 1,
      ...PUBLIC,
    });
    return toService(r.docs[0]) ?? null;
  });

export const getProjects = (limit = 100): Promise<ProjectView[]> =>
  safe([], async () => {
    const r = await (await cms()).find({ collection: 'projects', sort: 'name', limit, ...PUBLIC });
    return compact(r.docs.map(toProject));
  });

export const getProject = (slug: string): Promise<ProjectView | null> =>
  safe(null, async () => {
    const r = await (await cms()).find({
      collection: 'projects',
      where: { slug: { equals: slug } },
      limit: 1,
      ...PUBLIC,
    });
    return toProject(r.docs[0]) ?? null;
  });

export const getCategories = (): Promise<CategoryView[]> =>
  safe([], async () => {
    const r = await (await cms()).find({ collection: 'article-categories', sort: 'order', limit: 50, ...PUBLIC });
    return compact(r.docs.map(toCategory));
  });

export const getCategory = async (slug: string): Promise<CategoryView | null> =>
  (await getCategories()).find((c) => c.slug === slug) ?? null;

export type ArticlePage = { articles: ArticleView[]; page: number; totalPages: number };

export const getArticles = (opts: { categoryId?: string; page?: number; limit?: number } = {}): Promise<ArticlePage> => {
  const page = Math.max(1, Math.floor(opts.page ?? 1) || 1);
  return safe({ articles: [], page, totalPages: 1 }, async () => {
    const r = await (await cms()).find({
      collection: 'articles',
      sort: '-publishedAt',
      page,
      limit: opts.limit ?? PAGE_SIZE,
      ...(opts.categoryId ? { where: { category: { equals: opts.categoryId } } } : {}),
      ...PUBLIC,
    });
    return { articles: compact(r.docs.map(toArticle)), page, totalPages: Math.max(1, r.totalPages) };
  });
};

export const getArticle = (categorySlug: string, slug: string): Promise<ArticleView | null> =>
  safe(null, async () => {
    const r = await (await cms()).find({
      collection: 'articles',
      where: { slug: { equals: slug } },
      limit: 1,
      ...PUBLIC,
    });
    const article = toArticle(r.docs[0]);
    return article && article.category.slug === categorySlug ? article : null;
  });

export const getJobs = (): Promise<JobView[]> =>
  safe([], async () => {
    const r = await (await cms()).find({ collection: 'job-postings', sort: '-createdAt', limit: 50, ...PUBLIC });
    return compact(r.docs.map(toJob));
  });

export const getJob = (slug: string): Promise<JobView | null> =>
  safe(null, async () => {
    const r = await (await cms()).find({
      collection: 'job-postings',
      where: { slug: { equals: slug } },
      limit: 1,
      ...PUBLIC,
    });
    return toJob(r.docs[0]) ?? null;
  });

export const getDocuments = (): Promise<DocumentView[]> =>
  safe([], async () => {
    const r = await (await cms()).find({ collection: 'documents', limit: 20, ...PUBLIC });
    return compact(r.docs.map(toDocument));
  });

/** Published SiteSettings only (draft/absent => analytics off, no contact links). Failures degrade to empty settings. */
export const getSiteSettings = (): Promise<SiteSettingsView> =>
  safe(EMPTY_SITE_SETTINGS, async () => toSiteSettings(await (await cms()).findGlobal({ slug: 'site-settings', ...PUBLIC })));

/** Every published item of a collection, page by page: the sitemap never silently stops at a fixed limit. */
const getAll = <T>(collection: 'service-areas' | 'projects' | 'article-categories' | 'articles' | 'job-postings', map: (d: unknown) => T | undefined): Promise<T[]> =>
  collectAllPages(async (page) => {
    const r = await (await cms()).find({ collection, sort: 'createdAt', page, limit: SITEMAP_PAGE_SIZE, ...PUBLIC });
    return { docs: compact(r.docs.map(map)), totalPages: r.totalPages };
  });

const SITEMAP_PAGE_SIZE = 200;

/** Singleton routes whose page document can be marked noindex in the CMS. */
const SINGLETON_ROUTES: Record<string, PageSlug> = {
  '/': 'home-page',
  '/gioi-thieu': 'about-page',
  '/quy-trinh-minh-bach': 'process-page',
  '/lien-he': 'contact-page',
};

/** Fixed IA paths minus singleton pages an editor marked noindex. */
export async function getIndexableStaticPaths(staticPaths: readonly string[]): Promise<string[]> {
  const flags = await Promise.all(
    staticPaths.map(async (path) => {
      const slug = SINGLETON_ROUTES[path];
      return slug ? (await getPage(slug))?.seo.noindex === true : false;
    }),
  );
  return staticPaths.filter((_, i) => !flags[i]);
}

/**
 * Public URLs of CMS content that is published and not marked noindex. Unlike the listing helpers this reads
 * every page; a read failure throws (the sitemap must not be silently truncated), so it is not wrapped in safe().
 */
export async function getContentPaths(): Promise<string[]> {
  const [services, projects, categories, articles, jobs] = await Promise.all([
    getAll('service-areas', toService),
    getAll('projects', toProject),
    getAll('article-categories', toCategory),
    getAll('articles', toArticle),
    getAll('job-postings', toJob),
  ]);
  return [
    ...services.filter((s) => !s.seo.noindex).map((s) => s.href),
    ...projects.filter((p) => !p.seo.noindex).map((p) => p.href),
    ...categories.map((c) => c.href),
    ...articles.filter((a) => !a.seo.noindex).map((a) => a.href),
    ...jobs.filter((j) => !j.seo.noindex).map((j) => j.href),
  ];
}
