import { describe, expect, it } from 'vitest';
import { paginateProjects, projectFilters, PROJECTS_PAGE_SIZE } from './project-filter';
import type { ProjectView } from './public-content';

const project = (n: number, services: string[]): ProjectView => ({
  id: String(n),
  name: `P${n}`,
  slug: `p${n}`,
  href: `/du-an/p${n}`,
  facts: [],
  services: services.map((s) => ({ name: s.toUpperCase(), href: `/dich-vu/${s}` })),
  images: [],
  seo: {} as ProjectView['seo'],
});

describe('project filter and pagination', () => {
  const all = [project(1, ['a']), project(2, ['b']), project(3, ['a', 'b']), project(4, [])];

  it('builds filters only from services used by projects', () => {
    expect(projectFilters(all).map((f) => f.slug)).toEqual(['a', 'b']);
    expect(projectFilters([project(1, [])])).toEqual([]);
  });

  it('filters by service and ignores unknown or repeated values', () => {
    expect(paginateProjects(all, 'a').items.map((p) => p.name)).toEqual(['P1', 'P3']);
    expect(paginateProjects(all, 'zzz').items).toHaveLength(4);
    expect(paginateProjects(all, ['a', 'b']).active).toBeUndefined();
  });

  it('paginates and clamps the page', () => {
    const many = Array.from({ length: PROJECTS_PAGE_SIZE + 1 }, (_, i) => project(i, []));
    expect(paginateProjects(many).totalPages).toBe(2);
    expect(paginateProjects(many, undefined, '2').items).toHaveLength(1);
    expect(paginateProjects(many, undefined, '99').page).toBe(2);
    expect(paginateProjects(many, undefined, '-3').page).toBe(1);
    expect(paginateProjects(many, undefined, 'abc').page).toBe(1);
  });
});
