import type { ProjectView } from './public-content';

export const PROJECTS_PAGE_SIZE = 6;

export type ProjectFilter = { slug: string; name: string; href: string };

const serviceSlug = (href: string) => href.split('/').filter(Boolean).pop() ?? '';

/** One filter per service that at least one listed project uses, in first-seen order. Nothing is invented. */
export function projectFilters(projects: ProjectView[]): ProjectFilter[] {
  const seen = new Map<string, ProjectFilter>();
  for (const p of projects)
    for (const s of p.services) {
      const slug = serviceSlug(s.href);
      if (slug && !seen.has(slug)) seen.set(slug, { slug, name: s.name, href: s.href });
    }
  return [...seen.values()];
}

export type ProjectPage = { items: ProjectView[]; page: number; totalPages: number; active?: string };

/** `service` and `page` come straight from the query string: unknown service falls back to all, page is clamped. */
export function paginateProjects(projects: ProjectView[], service?: string | string[], page?: string | string[]): ProjectPage {
  const wanted = typeof service === 'string' ? service : '';
  const active = projectFilters(projects).find((f) => f.slug === wanted)?.slug;
  const filtered = active ? projects.filter((p) => p.services.some((s) => serviceSlug(s.href) === active)) : projects;
  const totalPages = Math.max(1, Math.ceil(filtered.length / PROJECTS_PAGE_SIZE));
  const n = Math.floor(Number(typeof page === 'string' ? page : 1)) || 1;
  const current = Math.min(Math.max(1, n), totalPages);
  return { items: filtered.slice((current - 1) * PROJECTS_PAGE_SIZE, current * PROJECTS_PAGE_SIZE), page: current, totalPages, active };
}
