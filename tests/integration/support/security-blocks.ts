import pg from 'pg';
import { describe, expect, it } from 'vitest';
import { MARKERS, PRIVATE_MARKERS } from './markers';

// W5B2: actual HTTP proof against the real Next server and the disposable database owned by http-smoke.test.ts.
// Registered from that file so the build, server and fixture are shared (one `next build` within the CI budget).
// The order of the blocks matters: the anonymous probes run while the users table is still empty, the bootstrap
// block then initialises it exactly once, and the authenticated (ADMIN/EDITOR) blocks use the accounts it created.

type Media = { id: number; filename: string; url: string };

export type SecurityContext = {
  readonly base: string;
  readonly smokeUrl: string;
  readonly fixture: { approved: Media; unconfirmed: Media; approvedPdf: Media; unconfirmedPdf: Media; projectId: number };
  readonly bootstrapToken: string;
  readonly adminPassword: string;
  readonly editorPassword: string;
  readonly publishedSlug: string;
  get: (route: string, init?: RequestInit) => Promise<Response>;
  runFixture: (cmd: string, extra?: Record<string, string>) => Promise<Record<string, unknown>>;
};

const pngBytes = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSDAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
  'base64',
);
const pdfBytes = Buffer.from(
  '%PDF-1.4\n1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n2 0 obj\n<< /Type /Pages /Kids [] /Count 0 >>\nendobj\n' +
    'xref\n0 3\n0000000000 65535 f \n0000000009 00000 n \n0000000058 00000 n \ntrailer\n<< /Size 3 /Root 1 0 R >>\nstartxref\n110\n%%EOF\n',
  'latin1',
);

export function registerSecurityBlocks(ctx: SecurityContext): void {
  const json = { 'content-type': 'application/json' };
  const as = (token: string) => ({ authorization: `JWT ${token}` });

  const sql = async <T extends pg.QueryResultRow>(text: string, values: unknown[] = []): Promise<T[]> => {
    const client = new pg.Client({ connectionString: ctx.smokeUrl });
    await client.connect();
    try {
      return (await client.query<T>(text, values)).rows;
    } finally {
      await client.end();
    }
  };
  const count = async (table: 'users' | 'media_assets' | 'contact_leads') =>
    Number((await sql<{ n: number }>(`select count(*)::int as n from ${table}`))[0]?.n);

  const expectNoPrivate = (body: string, label: string) => {
    for (const marker of PRIVATE_MARKERS) expect(body, `${label} leaked ${marker}`).not.toContain(marker);
  };

  const login = async (email: string, password: string) => {
    const res = await fetch(`${ctx.base}/api/users/login`, { method: 'POST', headers: json, body: JSON.stringify({ email, password }) });
    expect(res.status, `login ${email}`).toBe(200);
    return ((await res.json()) as { token: string }).token;
  };

  describe('W5B2 HTTP: anonymous REST cannot reach drafts, versions, internal notes or hidden files', () => {
    const probes = (): string[] => [
      '/api/projects?draft=true&depth=2&limit=100',
      '/api/projects?draft=true&where[slug][equals]=synthetic-smoke-published&depth=3',
      `/api/projects/${ctx.fixture.projectId}?draft=true`,
      `/api/projects/${ctx.fixture.projectId}?draft=true&depth=3`,
      `/api/projects/${ctx.fixture.projectId}?depth=5&populate[media-assets][source]=true`,
      `/api/projects/${ctx.fixture.projectId}?select[summary]=true&select[legacyUrls]=true&draft=true`,
      '/api/projects?select[legacyUrls]=true&depth=2',
      '/api/projects?populate[media-assets][source]=true&depth=3',
      '/api/projects?depth=2&trash=true',
      '/api/media-assets?depth=2&limit=100',
      '/api/media-assets?select[source]=true&depth=2',
      `/api/media-assets/${ctx.fixture.approvedPdf.id}?select[source]=true`,
      `/api/media-assets/${ctx.fixture.approvedPdf.id}?draft=true&depth=2`,
      '/api/documents?draft=true&depth=3',
      '/api/documents?depth=3&populate[media-assets][source]=true',
      '/api/globals/site-settings?draft=true',
      '/api/globals/site-settings?draft=true&depth=3',
      '/api/globals/about-page?draft=true',
      '/api/globals/about-page?draft=true&depth=2&select[title]=true',
      '/api/globals/about-page',
    ];

    it('every draft/versions/depth/populate/select probe stays free of private drafts, legacy URLs and source notes', async () => {
      const list = probes();
      expect(list.length).toBe(20);
      for (const route of list) {
        const res = await ctx.get(route);
        expect(res.status, route).toBeLessThan(500);
        expectNoPrivate(await res.text(), route);
      }
    });

    it('versions endpoints are closed to anonymous requests (collections and globals)', async () => {
      for (const route of [
        '/api/projects/versions',
        `/api/projects/versions?where[parent][equals]=${ctx.fixture.projectId}`,
        `/api/projects/${ctx.fixture.projectId}/versions`,
        '/api/globals/site-settings/versions',
        '/api/globals/about-page/versions',
        '/api/documents/versions',
        '/api/media-assets/versions',
      ]) {
        const res = await ctx.get(route);
        expect([401, 403, 404], route).toContain(res.status);
        expectNoPrivate(await res.text(), route);
      }
    });

    it('a hidden field cannot be used as a query oracle either', async () => {
      for (const route of [
        '/api/media-assets?where[source][contains]=PRIVATE-MEDIA-SOURCE',
        '/api/projects?where[legacyUrls.url][contains]=PRIVATE-LEGACY-URL&draft=true',
        '/api/projects?where[summary][contains]=PRIVATE-DRAFT-SUMMARY&draft=true',
      ]) {
        const res = await ctx.get(route);
        if (res.status === 200) expect(((await res.json()) as { totalDocs: number }).totalDocs, route).toBe(0);
        else expect(res.status, route).toBeLessThan(500);
      }
    });

    it('approved positive controls: the published record is served (not the newer private draft) without internal fields', async () => {
      const res = await ctx.get('/api/projects?where[slug][equals]=synthetic-smoke-published&depth=1');
      expect(res.status).toBe(200);
      const body = (await res.json()) as { totalDocs: number; docs: Record<string, unknown>[] };
      expect(body.totalDocs).toBe(1);
      const doc = body.docs[0]!;
      expect(doc.summary).toBe(MARKERS.publicSummary);
      expect(doc).not.toHaveProperty('legacyUrls');
      const [approvedImage, hiddenImage] = doc.images as unknown[];
      // The UNCONFIRMED image is not populated (a bare id at most): no alt, url, filename or source note.
      expect(typeof hiddenImage === 'object' && hiddenImage !== null ? (hiddenImage as { url?: string }).url : undefined).toBeUndefined();
      expect(typeof approvedImage === 'object' && approvedImage !== null ? (approvedImage as { source?: string }).source : undefined).toBeUndefined();

      const singleton = (await (await ctx.get('/api/globals/about-page')).json()) as { title?: string };
      expect(singleton.title).toBe(MARKERS.publicAbout);
      const settings = (await (await ctx.get('/api/globals/site-settings')).json()) as { contact?: { hotline?: string } };
      expect(settings.contact?.hotline).toBe('0900 000 000');
    });

    it('approved document file is served; the document pointing at an UNCONFIRMED file exposes no file', async () => {
      const res = await ctx.get('/api/documents?depth=2&limit=50');
      expect(res.status).toBe(200);
      const docs = ((await res.json()) as { docs: { title: string; file: unknown }[] }).docs;
      const ok = docs.find((d) => d.title === 'Synthetic Smoke Approved Document');
      expect((ok?.file as { url?: string } | undefined)?.url).toBe(ctx.fixture.approvedPdf.url);
      const hidden = docs.find((d) => d.title === 'Synthetic Smoke Hidden Document');
      expect(typeof hidden?.file === 'object' && hidden.file !== null ? (hidden.file as { url?: string }).url : undefined).toBeUndefined();
      expect(JSON.stringify(docs)).not.toContain(ctx.fixture.unconfirmedPdf.filename);
    });

    it('public pages render the CONFIRMED approved customer facts and nothing from drafts or internal notes', async () => {
      const confirmed = await (await ctx.get('/du-an/synthetic-smoke-confirmed')).text();
      expect(confirmed).toContain(MARKERS.confirmedAddress);
      expect(confirmed).toContain(MARKERS.confirmedFeedback);
      const html = await (await ctx.get(`/du-an/${ctx.publishedSlug}`)).text();
      expect(html).toContain(MARKERS.publicSummary);
      expectNoPrivate(html, 'project page');
      // LEGACY-SOURCE profiles show no customer facts.
      expect(html).not.toContain(MARKERS.confirmedAddress);
      for (const route of ['/', '/gioi-thieu', '/du-an', '/tuyen-dung']) {
        expectNoPrivate(await (await ctx.get(route)).text(), route);
      }
    });
  });

  describe('W5B2 HTTP: GraphQL and playground are not available (actual requests, not inferred from REST)', () => {
    const targets = ['/api/graphql', '/api/graphql-playground', '/api/graphql?query=%7B__typename%7D', '/api/graphql/'];

    it.each(targets)('%s returns 404 for GET, HEAD, POST and OPTIONS without data', async (route) => {
      for (const method of ['GET', 'HEAD', 'POST', 'OPTIONS'] as const) {
        const res = await ctx.get(route, {
          method,
          ...(method === 'POST' ? { headers: json, body: JSON.stringify({ query: '{ __schema { types { name } } }' }) } : {}),
        });
        expect(res.status, `${method} ${route}`).toBe(404);
        const body = await res.text();
        expect(body).not.toContain('__schema');
        expect(body).not.toMatch(/"data"\s*:/);
      }
    });

    it('the playground page does not exist', async () => {
      const res = await ctx.get('/api/graphql-playground', { headers: { accept: 'text/html' } });
      expect(res.status).toBe(404);
      expect(await res.text()).not.toMatch(/GraphQL Playground|graphiql/i);
    });
  });

  describe('W5B2 HTTP: initial ADMIN bootstrap and role boundaries', () => {
    const firstRegister = (email: string, token?: string) =>
      fetch(`${ctx.base}/api/users/first-register`, {
        method: 'POST',
        headers: { ...json, ...(token ? { 'x-bootstrap-token': token } : {}) },
        body: JSON.stringify({ email, password: ctx.adminPassword, role: 'ADMIN' }),
      });
    const adminEmail = 'synthetic-admin@example.invalid';
    const editorEmail = 'synthetic-editor@example.invalid';
    let adminToken = '';
    let editorToken = '';

    it('starts uninitialised, and an uninitialised public first-register is refused without the operator token', async () => {
      expect(await count('users')).toBe(0);
      expect((await firstRegister('attacker@example.invalid')).status).toBe(403);
      expect((await firstRegister('attacker@example.invalid', 'wrong-token-wrong-token-wrong-token-0')).status).toBe(403);
      expect((await firstRegister('attacker@example.invalid', ctx.bootstrapToken.slice(0, 20))).status).toBe(403);
      // The token is not accepted through other channels (query string).
      const viaQuery = await fetch(`${ctx.base}/api/users/first-register?x-bootstrap-token=${ctx.bootstrapToken}`, {
        method: 'POST',
        headers: json,
        body: JSON.stringify({ email: 'attacker@example.invalid', password: ctx.adminPassword }),
      });
      expect(viaQuery.status).toBe(403);
      // Anonymous creation through the ordinary collection endpoint cannot bootstrap either.
      const direct = await fetch(`${ctx.base}/api/users`, {
        method: 'POST',
        headers: { ...json, 'x-bootstrap-token': ctx.bootstrapToken },
        body: JSON.stringify({ email: 'attacker@example.invalid', password: ctx.adminPassword, role: 'ADMIN' }),
      });
      expect([401, 403]).toContain(direct.status);
      expect(await count('users')).toBe(0);
    });

    it('concurrent first-register requests with the valid token create exactly one account, and it is ADMIN', async () => {
      const results = await Promise.all(
        Array.from({ length: 6 }, (_, i) => firstRegister(i === 0 ? adminEmail : `racer-${i}@example.invalid`, ctx.bootstrapToken)),
      );
      const statuses = results.map((r) => r.status);
      expect(statuses.filter((s) => s === 200)).toHaveLength(1);
      expect(statuses.filter((s) => s === 403)).toHaveLength(5);
      expect(await count('users')).toBe(1);
      const rows = await sql<{ email: string; role: string }>('select email, role from users');
      expect(rows).toHaveLength(1);
      expect(rows[0]!.role).toBe('ADMIN');
      adminToken = await login(rows[0]!.email, ctx.adminPassword);
    });

    it('after initialisation first-register cannot create another account over HTTP, with or without the token', async () => {
      for (const token of [undefined, ctx.bootstrapToken]) {
        expect((await firstRegister('second-admin@example.invalid', token)).status, String(token)).toBe(403);
      }
      const anonymousCreate = await fetch(`${ctx.base}/api/users`, {
        method: 'POST',
        headers: json,
        body: JSON.stringify({ email: 'x@example.invalid', password: ctx.adminPassword }),
      });
      expect([401, 403]).toContain(anonymousCreate.status);
      expect(await count('users')).toBe(1);
    });

    it('ADMIN manages users and creates an EDITOR; the EDITOR cannot escalate or manage users', async () => {
      const created = await fetch(`${ctx.base}/api/users`, {
        method: 'POST',
        headers: { ...json, ...as(adminToken) },
        body: JSON.stringify({ email: editorEmail, password: ctx.editorPassword, role: 'EDITOR' }),
      });
      expect(created.status).toBe(201);
      const editor = ((await created.json()) as { doc: { id: number; role: string } }).doc;
      expect(editor.role).toBe('EDITOR');
      expect(await count('users')).toBe(2);
      expect(((await (await fetch(`${ctx.base}/api/users`, { headers: as(adminToken) })).json()) as { totalDocs: number }).totalDocs).toBe(2);

      editorToken = await login(editorEmail, ctx.editorPassword);
      // An EDITOR sees only their own record and cannot create, promote or delete accounts.
      expect(((await (await fetch(`${ctx.base}/api/users`, { headers: as(editorToken) })).json()) as { totalDocs: number }).totalDocs).toBe(1);
      const create = await fetch(`${ctx.base}/api/users`, {
        method: 'POST',
        headers: { ...json, ...as(editorToken) },
        body: JSON.stringify({ email: 'e2@example.invalid', password: ctx.editorPassword, role: 'ADMIN' }),
      });
      expect([401, 403]).toContain(create.status);
      const promote = await fetch(`${ctx.base}/api/users/${editor.id}`, {
        method: 'PATCH',
        headers: { ...json, ...as(editorToken) },
        body: JSON.stringify({ role: 'ADMIN' }),
      });
      expect([401, 403]).toContain(promote.status);
      const del = await fetch(`${ctx.base}/api/users/${editor.id}`, { method: 'DELETE', headers: as(editorToken) });
      expect([401, 403]).toContain(del.status);
      expect((await sql<{ role: string }>('select role from users where email = $1', [editorEmail]))[0]?.role).toBe('EDITOR');
      expect(await count('users')).toBe(2);
      // An EDITOR cannot change the ADMIN-only singletons.
      const settings = await fetch(`${ctx.base}/api/globals/site-settings`, {
        method: 'POST',
        headers: { ...json, ...as(editorToken) },
        body: JSON.stringify({ contact: { hotline: '0911 111 111' } }),
      });
      expect([401, 403]).toContain(settings.status);
    });

    it('staff (and only staff) can read versions and drafts: the anonymous probes above are therefore not vacuous', async () => {
      for (const token of [adminToken, editorToken]) {
        const res = await fetch(`${ctx.base}/api/projects/${ctx.fixture.projectId}/versions`, { headers: as(token) });
        expect(res.status).toBe(200);
        expect(await res.text()).toContain(MARKERS.draftSummary);
      }
      expect((await ctx.get(`/api/projects/${ctx.fixture.projectId}/versions`)).status).toBeGreaterThanOrEqual(401);
    });
  });

  describe('W5B2 HTTP: actual upload restrictions (SVG, MIME spoofing, size) with a PDF / raster positive control', () => {
    let token = '';
    const upload = async (name: string, type: string, bytes: Buffer) => {
      const form = new FormData();
      form.set('_payload', JSON.stringify({ alt: `synthetic ${name}`, rightsStatus: 'UNCONFIRMED' }));
      form.set('file', new Blob([new Uint8Array(bytes)], { type }), name);
      return fetch(`${ctx.base}/api/media-assets`, { method: 'POST', headers: as(token), body: form });
    };

    it('signs in as the ADMIN created by the bootstrap block', async () => {
      const email = (await sql<{ email: string }>(`select email from users where role = 'ADMIN' limit 1`))[0]!.email;
      token = await login(email, ctx.adminPassword);
    });

    it('rejects SVG, spoofed MIME types, active-content extensions and non-content bytes; nothing is stored', async () => {
      const before = await count('media_assets');
      const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>');
      const html = Buffer.from('<!doctype html><script>alert(1)</script>');
      const cases: [string, string, Buffer][] = [
        ['evil.svg', 'image/svg+xml', svg],
        ['evil-as-png.png', 'image/png', svg], // SVG bytes claiming to be PNG
        ['evil-html-as-png.png', 'image/png', html], // HTML bytes claiming to be PNG
        ['evil-html-as-jpg.jpg', 'image/jpeg', html],
        ['evil.html', 'text/html', html],
        ['png-as-html.html', 'text/html', pngBytes], // real PNG bytes, active extension and type
        ['fake.pdf', 'application/pdf', html], // not a PDF
        ['script.js', 'application/javascript', Buffer.from('alert(1)')],
      ];
      for (const [name, type, bytes] of cases) {
        const res = await upload(name, type, bytes);
        expect(res.status, name).toBeGreaterThanOrEqual(400);
        expect(res.status, name).toBeLessThan(500);
      }
      expect(await count('media_assets')).toBe(before);
    });

    it('rejects an oversized upload (HTTP 4xx, nothing stored)', async () => {
      const before = await count('media_assets');
      const res = await upload('too-big.png', 'image/png', Buffer.concat([pngBytes, Buffer.alloc(10_000_001)]));
      expect(res.status).toBeGreaterThanOrEqual(400);
      expect(res.status).toBeLessThan(500);
      expect(await count('media_assets')).toBe(before);
    });

    it('accepts a real PNG and a real PDF; new uploads default to UNCONFIRMED and are not publicly readable', async () => {
      for (const [name, type, bytes] of [
        ['control.png', 'image/png', pngBytes],
        ['control.pdf', 'application/pdf', pdfBytes],
      ] as const) {
        const res = await upload(name, type, bytes);
        expect(res.status, name).toBe(201);
        const doc = ((await res.json()) as { doc: { rightsStatus: string; filename: string; mimeType: string } }).doc;
        expect(doc.rightsStatus).toBe('UNCONFIRMED');
        expect(doc.mimeType).toBe(type);
        const anonymous = await ctx.get(`/api/media-assets/file/${encodeURIComponent(doc.filename)}`);
        expect(anonymous.status).not.toBe(200);
        expect(Buffer.from(await anonymous.arrayBuffer()).subarray(0, 4).toString('latin1')).not.toBe('%PDF');
      }
    });

    it('anonymous users cannot upload', async () => {
      const before = await count('media_assets');
      const form = new FormData();
      form.set('_payload', JSON.stringify({ alt: 'x', rightsStatus: 'APPROVED' }));
      form.set('file', new Blob([new Uint8Array(pngBytes)], { type: 'image/png' }), 'anon.png');
      const res = await fetch(`${ctx.base}/api/media-assets`, { method: 'POST', body: form });
      expect([401, 403]).toContain(res.status);
      expect(await count('media_assets')).toBe(before);
    });
  });

  describe('W5B2 HTTP: rights revocation on originals, thumbnails and conditional requests', () => {
    const fileUrl = (m: Media) => `/api/media-assets/file/${encodeURIComponent(m.filename)}`;
    const noBytes = async (res: Response, label: string) => {
      expect(res.status, label).not.toBe(200);
      expect(res.status, label).not.toBe(304);
      expect(res.headers.get('content-type') ?? '', label).not.toMatch(/pdf|^image\//);
      expect(Buffer.from(await res.arrayBuffer()).subarray(0, 4).toString('latin1'), label).not.toBe('%PDF');
    };

    it('UNCONFIRMED original (PDF) and derived thumbnail-shaped URLs never serve bytes', async () => {
      for (const method of ['GET', 'HEAD'] as const) {
        await noBytes(await ctx.get(fileUrl(ctx.fixture.unconfirmedPdf), { method }), `${method} unconfirmed`);
      }
      // No imageSizes/thumbnails are generated; a crafted thumbnail path of an UNCONFIRMED or unknown file is a miss.
      const stem = ctx.fixture.unconfirmed.filename.replace(/\.png$/, '');
      for (const crafted of [`${stem}-400x300.png`, `${stem}-thumbnail.png`, `${stem}.png?width=64`]) {
        await noBytes(await ctx.get(`/api/media-assets/file/${crafted}`), crafted);
      }
    });

    it('APPROVED original warms (GET, conditional) and, once revoked, denies GET/HEAD/conditional requests with no bytes and no 304', async () => {
      const warm = await ctx.get(fileUrl(ctx.fixture.approvedPdf));
      expect(warm.status).toBe(200);
      expect(warm.headers.get('content-type')).toMatch(/^application\/pdf/);
      expect(Buffer.from(await warm.arrayBuffer()).subarray(0, 5).toString('latin1')).toBe('%PDF-');
      const etag = warm.headers.get('etag');
      const lastModified = warm.headers.get('last-modified');
      // While approved, a conditional request is answered with 200 or 304: this is the cache the revocation must beat.
      const conditional = await ctx.get(fileUrl(ctx.fixture.approvedPdf), {
        headers: { ...(etag ? { 'if-none-match': etag } : {}), ...(lastModified ? { 'if-modified-since': lastModified } : {}) },
      });
      expect([200, 304]).toContain(conditional.status);

      const revoked = await ctx.runFixture('revoke', { SMOKE_FIXTURE_MEDIA_ID: String(ctx.fixture.approvedPdf.id) });
      expect(revoked).toEqual({ id: ctx.fixture.approvedPdf.id, rightsStatus: 'UNCONFIRMED' });

      const future = new Date(Date.now() + 86_400_000).toUTCString();
      const variants: [string, RequestInit][] = [
        ['GET', {}],
        ['HEAD', { method: 'HEAD' }],
        ['conditional etag', { headers: { 'if-none-match': etag ?? '*' } }],
        ['conditional etag *', { headers: { 'if-none-match': '*' } }],
        ['conditional since', { headers: { 'if-modified-since': lastModified ?? future } }],
        ['conditional since (future)', { headers: { 'if-modified-since': future } }],
        ['range', { headers: { range: 'bytes=0-4' } }],
        ['conditional both', { headers: { 'if-none-match': etag ?? '*', 'if-modified-since': lastModified ?? future } }],
      ];
      for (const [label, init] of variants) await noBytes(await ctx.get(fileUrl(ctx.fixture.approvedPdf), init), label);
      // The public documents list drops the revoked file as well.
      expect(await (await ctx.get('/api/documents?depth=2&limit=50')).text()).not.toContain(ctx.fixture.approvedPdf.filename);
    });

    it('the Next image optimizer stays disabled: no rights-unaware cache of media bytes exists', async () => {
      const res = await ctx.get(`/_next/image?url=${encodeURIComponent(fileUrl(ctx.fixture.approved))}&w=64&q=75`);
      expect(res.status).toBe(404);
    });
  });

  describe('W5B2 HTTP: canonical Origin validation compares the full origin against explicit trusted configuration', () => {
    const lead = (phone: string) =>
      JSON.stringify({ name: 'Synthetic W5B2 Person', phone, requestType: 'bao-gia', message: 'synthetic w5b2 message', consent: true, sourcePage: '/lien-he' });
    const send = (phone: string, headers: Record<string, string>) =>
      fetch(`${ctx.base}/lien-he/gui`, { method: 'POST', headers: { ...json, ...headers }, body: lead(phone) });
    const stored = async (phone: string) =>
      Number((await sql<{ n: number }>('select count(*)::int as n from contact_leads where phone = $1', [phone]))[0]?.n);

    it('accepts the configured SITE_URL origin and the explicitly trusted alternate origin', async () => {
      expect((await send('0900000301', { origin: ctx.base })).status).toBe(200);
      expect((await send('0900000302', { origin: 'https://www.bmsl-trusted.invalid' })).status).toBe(200);
      expect(await stored('0900000301')).toBe(1);
      expect(await stored('0900000302')).toBe(1);
    });

    it('rejects an alternate scheme, an alternate port, an unrelated origin and a look-alike; nothing is stored', async () => {
      const url = new URL(ctx.base);
      const port = Number(url.port);
      const rejected: [string, string][] = [
        ['0900000311', `https://${url.host}`], // same host and port, other scheme
        ['0900000312', `http://${url.hostname}:${port + 1}`], // same host, other port
        ['0900000313', `http://localhost:${port}`], // other host name for the same listener
        ['0900000314', 'https://evil.invalid'],
        ['0900000315', 'http://www.bmsl-trusted.invalid'], // trusted host, wrong scheme
        ['0900000316', 'https://www.bmsl-trusted.invalid:8443'], // trusted host, wrong port
        ['0900000317', 'null'],
      ];
      for (const [phone, origin] of rejected) {
        expect((await send(phone, { origin })).status, origin).toBe(403);
        expect(await stored(phone), origin).toBe(0);
      }
    });

    it('does not treat the Host or forwarded headers as alternate origins', async () => {
      const res = await send('0900000321', {
        origin: 'https://evil.invalid',
        'x-forwarded-host': 'evil.invalid',
        'x-forwarded-proto': 'https',
        forwarded: 'host=evil.invalid;proto=https',
      });
      expect(res.status).toBe(403);
      expect(await stored('0900000321')).toBe(0);
      // A browser-declared cross-site request is refused even with the right Origin header.
      expect((await send('0900000322', { origin: ctx.base, 'sec-fetch-site': 'cross-site' })).status).toBe(403);
      expect(await stored('0900000322')).toBe(0);
    });
  });
}
