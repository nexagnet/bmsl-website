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

const PROJECT_SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/**
 * Optional message prefill from ?project=<slug> (the project visit action). Only a strictly shaped slug is ever echoed,
 * inside a fixed sentence; anything else (unknown shape, repeated, over-long) yields '' so nothing user-supplied is reflected.
 */
export function contextMessageFromSearch(search: string): string {
  const projects = new URLSearchParams(search).getAll('project');
  const slug = projects.length === 1 ? projects[0] : '';
  return slug.length > 0 && slug.length <= 100 && PROJECT_SLUG.test(slug) ? `Tôi muốn đăng ký tham quan dự án (${slug}).` : '';
}
