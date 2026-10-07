import type { WpMedia, WpPost, WpSnapshot, WpTerm } from './generator';

// Read-only access to the public legacy WordPress site, shared by the pack generator and the source audit.
// Only https://binhminhsonglo.vn is contacted (public REST, sitemap, /wp-content/uploads); nothing here writes anywhere.

export const SITE = 'https://binhminhsonglo.vn';
export const FETCH_TIMEOUT_MS = 30_000;
export const HEADERS = { 'user-agent': 'bmsl-website-seed-generator (read-only audit)', accept: 'application/json, image/*, */*' };

export type Fetcher = (url: URL, init: { headers: Record<string, string>; redirect: 'error'; signal: AbortSignal }) => Promise<Response>;

export async function get(url: string, kind: 'json-or-xml' | 'image', fetcher: Fetcher = fetch, backoffMs = 2000) {
  const u = new URL(url);
  const allowedPath =
    kind === 'image'
      ? u.pathname.startsWith('/wp-content/uploads/')
      : u.pathname.startsWith('/wp-json/wp/v2/') || /^\/wp-sitemap[\w-]*\.xml$/.test(u.pathname) || u.pathname === '/';
  if (u.origin !== SITE || !allowedPath || u.pathname.includes('..') || u.username || u.password) throw new Error(`Refusing to fetch ${u.origin}${u.pathname}`);
  // redirect: 'error' so a redirect can never lead to another host. The legacy server is slow and throttles bursts:
  // a network error or a 429/5xx is retried with backoff; any other answer (including 404) is returned as it is.
  let last: unknown;
  for (let attempt = 1; attempt <= 4; attempt += 1) {
    try {
      const res = await fetcher(u, { headers: HEADERS, redirect: 'error', signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
      if (res.status !== 429 && res.status < 500) return res;
      last = new Error(`HTTP ${res.status}`);
    } catch (error) {
      last = error;
    }
    await new Promise((resolve) => setTimeout(resolve, attempt * backoffMs));
  }
  throw last instanceof Error ? last : new Error('fetch failed');
}

/**
 * Lists a WordPress collection page by page. `orderby=id&order=asc` is part of every request as a precaution: the default
 * order (date) is not total, so items that share a timestamp could repeat or be skipped across pages. (On the legacy site
 * both orders listed the same 293 media items; the 12 missing from the 305 it reports are not visible to anonymous callers.)
 */
export async function pagedJson<T>(endpoint: string, params: string, optional = false, fetcher: Fetcher = fetch): Promise<T[]> {
  const out: T[] = [];
  for (let page = 1; ; page += 1) {
    const res = await get(`${SITE}/wp-json/wp/v2/${endpoint}?${params}&orderby=id&order=asc&page=${page}`, 'json-or-xml', fetcher);
    if (!res.ok) {
      if (optional) break;
      throw new Error(`${endpoint} page ${page}: HTTP ${res.status}`);
    }
    out.push(...((await res.json()) as T[]));
    if (page >= Number(res.headers.get('x-wp-totalpages') ?? '1')) break;
  }
  return out;
}

/** The `X-WP-Total` the server reports for a collection (what it says exists, whether or not it lists every item). */
export async function reportedTotal(endpoint: string, fetcher: Fetcher = fetch): Promise<number | undefined> {
  const res = await get(`${SITE}/wp-json/wp/v2/${endpoint}?per_page=1&_fields=id`, 'json-or-xml', fetcher);
  const n = Number(res.headers.get('x-wp-total'));
  return res.ok && Number.isFinite(n) ? n : undefined;
}

export async function loadSnapshot(fetcher: Fetcher = fetch): Promise<WpSnapshot> {
  const fields = '_fields=id,date_gmt,slug,status,title,content,excerpt,featured_media,categories';
  const posts = await pagedJson<WpPost>('posts', `per_page=100&${fields}`, false, fetcher);
  const pages = await pagedJson<WpPost>('pages', `per_page=100&${fields}`, false, fetcher);
  const categories = await pagedJson<WpTerm>('categories', 'per_page=100&_fields=id,slug,name', false, fetcher);
  // The public media list omits attachments of non-public parents; whatever is listed only improves alt text/covers.
  const media = await pagedJson<WpMedia>('media', 'per_page=50&_fields=id,source_url,alt_text,post', true, fetcher);

  const sitemapUrls = new Set<string>();
  const index = await (await get(`${SITE}/wp-sitemap.xml`, 'json-or-xml', fetcher)).text();
  for (const loc of index.matchAll(/<loc>([^<]+)<\/loc>/g)) {
    const child = await (await get(loc[1]!, 'json-or-xml', fetcher)).text();
    for (const l of child.matchAll(/<loc>([^<]+)<\/loc>/g)) sitemapUrls.add(l[1]!);
  }
  const home = await (await get(`${SITE}/`, 'json-or-xml', fetcher)).text();
  const wordpress = /<meta name="generator" content="WordPress ([\d.]+)"/.exec(home)?.[1] ?? 'version not stated';
  return { site: SITE, wordpress, posts, pages, categories, media, sitemapUrls: [...sitemapUrls].sort() };
}
