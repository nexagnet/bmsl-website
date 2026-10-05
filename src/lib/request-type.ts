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
