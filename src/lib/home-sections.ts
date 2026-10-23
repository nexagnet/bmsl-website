// Middle sections of the home page, between the hero and the closing survey CTA. The CMS may reorder or hide them;
// an empty list keeps the original order, so existing content is unchanged.

export const HOME_SECTIONS = [
  { value: 'stats', label: 'Số liệu năng lực' },
  { value: 'services', label: 'Dịch vụ' },
  { value: 'projects', label: 'Dự án' },
  { value: 'process', label: 'Quy trình & Minh bạch' },
  { value: 'articles', label: 'Tin tức / Bài viết' },
] as const;

export type HomeSectionId = (typeof HOME_SECTIONS)[number]['value'];

export const DEFAULT_HOME_ORDER: HomeSectionId[] = HOME_SECTIONS.map((s) => s.value);

export type HomeLayout = { order: HomeSectionId[]; projectsLimit: number; articlesLimit: number };

const isRec = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const clamp = (v: unknown, fallback: number) =>
  typeof v === 'number' && Number.isInteger(v) && v >= 1 && v <= 12 ? v : fallback;

export function toHomeLayout(d: unknown): HomeLayout {
  const doc = isRec(d) ? d : {};
  const rows = (Array.isArray(doc.sections) ? doc.sections : []).filter(isRec);
  const order: HomeSectionId[] = [];
  for (const r of rows) {
    const id = DEFAULT_HOME_ORDER.find((x) => x === r.section);
    if (id && r.visible !== false && !order.includes(id)) order.push(id);
  }
  return {
    order: rows.length ? order : [...DEFAULT_HOME_ORDER],
    projectsLimit: clamp(doc.projectsLimit, 6),
    articlesLimit: clamp(doc.articlesLimit, 3),
  };
}
