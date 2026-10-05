/** Routes that must never be indexed or listed in the sitemap. */
export const PRIVATE_PATH_PREFIXES = ['/admin', '/api'] as const;

export const isPrivatePath = (path: string): boolean =>
  PRIVATE_PATH_PREFIXES.some((p) => path === p || path.startsWith(`${p}/`));
