// Client-safe (no CMS imports). The list mirrors REQUEST_TYPES in collections/ContactLeads; a unit test keeps them equal.
export const REQUEST_TYPE_OPTIONS = ['khao-sat', 'bao-gia', 'khac'] as const;
export type RequestTypeOption = (typeof REQUEST_TYPE_OPTIONS)[number];
export const DEFAULT_REQUEST_TYPE: RequestTypeOption = 'khao-sat';

/** ?requestType=bao-gia|khac|khao-sat prefills the form; anything else (unknown, repeated, empty) uses the default. */
export function requestTypeFromSearch(search: string): RequestTypeOption {
  const values = new URLSearchParams(search).getAll('requestType');
  const value = values.length === 1 ? values[0] : '';
  return (REQUEST_TYPE_OPTIONS as readonly string[]).includes(value) ? (value as RequestTypeOption) : DEFAULT_REQUEST_TYPE;
}

const KNOWN_CONTEXTS: Record<string, string> = {
  'ho-so-nang-luc': 'Tôi muốn nhận hồ sơ năng lực của BMSL.',
};
const PROJECT_SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/**
 * Optional message prefill from ?context=<known key> or ?project=<slug>. Only a fixed key or a strictly shaped slug
 * is ever echoed; anything else (unknown, repeated, over-long) yields '' so nothing user-supplied is reflected.
 */
export function contextMessageFromSearch(search: string): string {
  const params = new URLSearchParams(search);
  const contexts = params.getAll('context');
  if (contexts.length === 1 && Object.hasOwn(KNOWN_CONTEXTS, contexts[0])) return KNOWN_CONTEXTS[contexts[0]];
  const projects = params.getAll('project');
  if (projects.length === 1 && projects[0].length <= 100 && PROJECT_SLUG.test(projects[0]))
    return `Tôi muốn đăng ký tham quan dự án (${projects[0]}).`;
  return '';
}
