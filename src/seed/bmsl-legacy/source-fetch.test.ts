import { describe, expect, it } from 'vitest';
import { type Fetcher, get, pagedJson, reportedTotal } from './source-fetch';

const json = (body: unknown, headers: Record<string, string> = {}, status = 200) => new Response(JSON.stringify(body), { status, headers });

describe('pagedJson', () => {
  it('asks for a total order on every page and follows X-WP-TotalPages', async () => {
    const urls: string[] = [];
    const fetcher: Fetcher = async (url) => {
      urls.push(url.toString());
      const page = Number(url.searchParams.get('page'));
      return json([{ id: page }], { 'x-wp-totalpages': '3' });
    };
    const items = await pagedJson<{ id: number }>('media', 'per_page=50', true, fetcher);
    expect(items.map((i) => i.id)).toEqual([1, 2, 3]);
    expect(urls).toHaveLength(3);
    for (const u of urls) {
      const q = new URL(u).searchParams;
      expect(q.get('orderby')).toBe('id');
      expect(q.get('order')).toBe('asc');
    }
  });

  it('stops quietly on an optional collection that is refused, but fails a required one', async () => {
    const refuse: Fetcher = async () => json({ code: 'rest_forbidden' }, {}, 401);
    expect(await pagedJson('media', 'per_page=50', true, refuse)).toEqual([]);
    await expect(pagedJson('posts', 'per_page=100', false, refuse)).rejects.toThrow('posts page 1: HTTP 401');
  });
});

describe('get', () => {
  it('refuses another host, a path outside the allowed set and a redirecting request', async () => {
    const never: Fetcher = async () => {
      throw new Error('must not be called');
    };
    await expect(get('https://example.com/wp-json/wp/v2/posts', 'json-or-xml', never)).rejects.toThrow('Refusing to fetch');
    await expect(get('https://binhminhsonglo.vn/wp-admin/', 'json-or-xml', never)).rejects.toThrow('Refusing to fetch');
    await expect(get('https://binhminhsonglo.vn/wp-content/uploads/../wp-config.php', 'image', never)).rejects.toThrow('Refusing to fetch');
    let init: Parameters<Fetcher>[1] | undefined;
    await get('https://binhminhsonglo.vn/wp-json/wp/v2/posts', 'json-or-xml', async (_u, i) => ((init = i), json([])));
    expect(init?.redirect).toBe('error');
  });

  it('retries a 429 and a network error, then returns the answer', async () => {
    let calls = 0;
    const fetcher: Fetcher = async () => {
      calls += 1;
      if (calls === 1) return json({}, {}, 429);
      if (calls === 2) throw new Error('socket hang up');
      return json([{ ok: true }]);
    };
    const res = await get('https://binhminhsonglo.vn/wp-json/wp/v2/posts', 'json-or-xml', fetcher, 0);
    expect(res.status).toBe(200);
    expect(calls).toBe(3);
  });

  it('returns a 404 as it is instead of retrying', async () => {
    let calls = 0;
    const res = await get('https://binhminhsonglo.vn/wp-json/wp/v2/posts/1', 'json-or-xml', async () => ((calls += 1), json({}, {}, 404)), 0);
    expect(res.status).toBe(404);
    expect(calls).toBe(1);
  });
});

describe('reportedTotal', () => {
  it('reads X-WP-Total', async () => {
    expect(await reportedTotal('media', async () => json([], { 'x-wp-total': '305' }))).toBe(305);
  });
});
