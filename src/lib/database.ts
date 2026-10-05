export function getDatabaseUrl(env: Record<string, string | undefined> = process.env): string {
  const url = env.DATABASE_URL?.trim();
  if (!url) throw new Error('DATABASE_URL is required');
  return url;
}
