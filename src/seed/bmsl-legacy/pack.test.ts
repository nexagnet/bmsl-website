import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import legacyManifest from '../../migration/legacy-manifest.json';
import { loadPack, PACK_DIR } from './loader';
import { type LexicalDoc } from './lexical';
import { COMMITTED_IMAGE_CLASSES, lexicalNodes, MAX_ASSET_BYTES, type Pack, packProblems, uploadKeysOf } from './pack';
import { normalizeImageUrl } from './generator';

// Integrity of the COMMITTED pack (the real files under src/seed/bmsl-legacy). Offline: no database, no network.
const { pack } = loadPack();
const files = (dir: string) => readdirSync(path.join(PACK_DIR, dir));
const review = JSON.parse(readFileSync(path.join(PACK_DIR, 'review/image-review.json'), 'utf8')) as {
  images: { url: string; decision: string; class: string }[];
};

describe('committed seed pack: content and inventory', () => {
  it('loads and validates (schema, checksums, media references, no unknown or approval fields)', () => {
    expect(packProblems(pack, (file) => readFileSync(path.join(PACK_DIR, file)))).toEqual([]);
  });

  it('keeps all 47 canonical legacy URLs exactly as the redirect inventory lists them, plus explicit extras', () => {
    const canonical = pack.manifest.inventory.filter((r) => r.ref.startsWith('legacy:'));
    expect(canonical).toHaveLength(47);
    expect(canonical.map((r) => r.legacyPath)).toEqual(legacyManifest.entries.map((e) => e.legacyPath));
    expect(pack.manifest.counts.canonicalLegacyRows).toBe(47);
    // Posts published after the 47-entry inventory are listed, never silently dropped, and carry no redirect.
    const extras = pack.manifest.inventory.filter((r) => r.ref.startsWith('extra:'));
    expect(extras.length).toBeGreaterThan(0);
    for (const row of extras) expect(row.needs).toContain('redirect-not-in-47-inventory');
    expect(pack.manifest.source.sitemap.notInInventory).toEqual([]);
  });

  it('seeds the 17 canonical project identities from the 18 project sources and keeps both Học viện Quốc phòng URLs', () => {
    expect(pack.projects).toHaveLength(17);
    expect(pack.projects.map((p) => p.slug)).toEqual(legacyManifest.projects.map((p) => p.slug));
    const hvqp = pack.projects.find((p) => p.slug === 'hoc-vien-quoc-phong')!;
    expect(hvqp.legacyUrls).toHaveLength(2);
    expect(pack.projects.flatMap((p) => p.legacyUrls)).toHaveLength(18);
  });

  it('puts real source-derived values into the records (not mock content)', () => {
    const ecolife = pack.projects.find((p) => p.slug === 'ecolife-tay-ho')!;
    expect(ecolife.address).toContain('Xuân La');
    expect(ecolife.scale).toContain('630 căn hộ');
    expect(ecolife.operatingSince).toBe('T6/2024');
    expect(ecolife.services).toEqual(['quan-ly-van-hanh']);
    expect(ecolife.images.length).toBeGreaterThan(0);
    const about = pack.globals.find((g) => g.slug === 'about-page')!;
    expect(JSON.stringify(about.body)).toContain('CÔNG TY CỔ PHẦN QUẢN LÝ DỊCH VỤ BẤT ĐỘNG SẢN BÌNH MINH SÔNG LÔ');
    expect(pack.articles.length).toBeGreaterThanOrEqual(15);
    const withImages = pack.articles.filter((a) => uploadKeysOf(a.body).length > 0);
    expect(withImages.length).toBeGreaterThan(0);
  });

  it('seeds exactly the four contracted service areas; none has committed legacy text (the only source is a press interview)', () => {
    expect(pack.serviceAreas.map((s) => s.slug)).toEqual(['quan-ly-van-hanh', 'bao-ve', 've-sinh', 'pccc']);
    expect(pack.serviceAreas.every((s) => s.placeholder && !s.body)).toBe(true);
  });

  it('holds back posts whose text may not enter a public repository: no text in any record, listed as blocked with the reason', () => {
    const review = JSON.parse(readFileSync(path.join(PACK_DIR, 'review/content-review.json'), 'utf8')) as {
      blocked: { ref: string; class: string; reason: string }[];
    };
    expect(review.blocked.map((b) => b.ref)).toEqual(['legacy:2', 'legacy:3', 'legacy:4', 'legacy:33']);
    const records = JSON.stringify([pack.serviceAreas, pack.projects, pack.articles, pack.globals]);
    for (const b of review.blocked) {
      const row = pack.manifest.inventory.find((r) => r.ref === b.ref)!;
      expect(row.textStatus).toBe(b.class === 'OWNER_DECISION' ? 'BLOCKED_OWNER_DECISION' : 'BLOCKED_THIRD_PARTY_TEXT');
      expect(row.target.kind).toBe('none');
      expect(row.notes.find((n) => n.kind === 'text-not-committed')?.details?.[0]).toBe(b.reason);
      // Its images are inventoried as pending as well.
      expect(pack.manifest.pendingMedia.some((p) => p.usedBy.some((u) => u.record === b.ref))).toBe(true);
    }
    for (const slug of ['duoc-tang-danh-hieu', 'xu-huong-phat-trien-nganh', 'chuc-mung-sinh-nhat-chu-tich']) {
      expect(pack.articles.some((a) => a.slug.startsWith(slug)), slug).toBe(false);
    }
    // Distinctive sentences of the republished press articles and of the leader's birthday post are absent everywhere.
    for (const sentence of ['Minh Hương (t/h)', 'miếng bánh', 'Vũ Hồng Sơn', 'sinh nhật Chủ tịch']) {
      expect(records, sentence).not.toContain(sentence);
    }
    expect(pack.serviceAreas.every((s) => s.placeholder)).toBe(true);
  });

  it('creates no ArticleCategory and no taxonomy page: categories are an unresolved owner decision', () => {
    expect(JSON.stringify(pack)).not.toContain('article-categories');
    for (const row of pack.manifest.inventory.filter((r) => r.legacyPath.startsWith('/category/'))) {
      expect(row.textStatus).toBe('TAXONOMY_NOT_SEEDED');
      expect(row.target.kind).toBe('none');
    }
  });

  it('every inventory row accounts for its images (found = committed + pending + external)', () => {
    for (const row of pack.manifest.inventory) {
      expect(row.images.committed + row.images.pending + row.images.external, row.ref).toBe(row.images.found);
    }
  });
});

describe('committed seed pack: rights, privacy and size', () => {
  it('commits only reviewed-as-COMMIT images; no pending image is stored and every file is in the manifest', () => {
    const reviewByUrl = new Map(review.images.map((e) => [normalizeImageUrl(e.url), e]));
    for (const m of pack.manifest.media) {
      for (const url of m.sourceUrls) {
        const entry = reviewByUrl.get(normalizeImageUrl(url));
        expect(entry?.decision, url).toBe('COMMIT');
        expect(COMMITTED_IMAGE_CLASSES as readonly string[]).toContain(entry?.class);
      }
    }
    const committedUrls = new Set(pack.manifest.media.flatMap((m) => m.sourceUrls.map(normalizeImageUrl)));
    for (const p of pack.manifest.pendingMedia) expect(committedUrls.has(normalizeImageUrl(p.sourceUrl)), p.sourceUrl).toBe(false);

    const onDisk = files('assets').map((f) => `assets/${f}`).sort();
    expect(onDisk).toEqual(pack.manifest.media.map((m) => m.file).sort());
    const hashesOnDisk = new Set(onDisk.map((f) => createHash('sha256').update(readFileSync(path.join(PACK_DIR, f))).digest('hex')));
    for (const p of pack.manifest.pendingMedia) if (p.sha256) expect(hashesOnDisk.has(p.sha256), p.sourceUrl).toBe(false);
  });

  it('keeps people, third-party and document images out of the repository (but listed with their reason)', () => {
    const classes = new Set(pack.manifest.pendingMedia.map((p) => p.class));
    expect([...classes].sort()).toEqual(['DOCUMENT', 'PERSON', 'THIRD_PARTY', 'THIRD_PARTY_HOST']);
    expect(pack.manifest.pendingMedia.every((p) => p.reason.length > 10)).toBe(true);
    // Other hosts are inventoried by URL only: never fetched, so no hash/size.
    for (const p of pack.manifest.pendingMedia.filter((x) => x.class === 'THIRD_PARTY_HOST')) expect(p.sha256).toBeUndefined();
    expect(pack.manifest.counts.imagesPendingUnreviewed).toBe(0);
  });

  it('contains no phone number, e-mail address or hotlink to the legacy site inside any record text', () => {
    // Visible text only (ids and hashes are digits too): every text node plus the plain-text project fields.
    const texts: string[] = [];
    const bodies = [...pack.serviceAreas.map((r) => r.body), ...pack.articles.map((r) => r.body), ...pack.globals.map((r) => r.body)];
    for (const doc of bodies) for (const n of lexicalNodes(doc)) if (n.type === 'text') texts.push(String(n.text));
    for (const a of pack.articles) texts.push(a.title, a.excerpt ?? '');
    for (const g of pack.globals) texts.push(g.title);
    for (const p of pack.projects) texts.push(p.name, p.summary ?? '', p.address ?? '', p.scale ?? '', p.operatingSince ?? '');
    for (const s of pack.serviceAreas) texts.push(s.name, s.summary);
    const visible = texts.join('\n');
    expect(visible.length).toBeGreaterThan(30_000);
    expect(visible).not.toMatch(/(?<![\d])(?:\+?84|0)(?:[\s.-]?\d){8,10}(?!\d)/);
    expect(visible).not.toMatch(/[\w.+-]+@[\w-]+(?:\.[\w-]+)+/);
    const records = JSON.stringify([pack.serviceAreas, pack.projects, pack.articles, pack.globals]);
    expect(records).not.toContain('wp-content');
    expect(records).not.toMatch(/https?:\/\/(www\.)?binhminhsonglo\.vn/);
  });

  it('stays bounded: every asset ≤ 10 MB, whole pack ≤ 25 MB, and no SVG/HTML/script file anywhere in the pack', () => {
    for (const f of files('assets')) {
      expect(statSync(path.join(PACK_DIR, 'assets', f)).size).toBeLessThanOrEqual(MAX_ASSET_BYTES);
      expect(f).toMatch(/\.(jpg|png)$/);
    }
    expect(pack.manifest.counts.committedBytes).toBeLessThan(25 * 1024 * 1024);
    const walk = (dir: string): string[] =>
      readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(dir, e.name)) : [e.name]));
    expect(walk(PACK_DIR).filter((n) => /\.(svg|html?|js|mjs|php|exe)$/i.test(n))).toEqual([]);
  });

  it('every record is a draft candidate: no status, approval or confirmation field exists anywhere in the records', () => {
    const records = JSON.stringify([pack.serviceAreas, pack.projects, pack.articles, pack.globals]);
    for (const forbidden of ['"_status"', '"published"', '"CONFIRMED"', '"APPROVED"', '"rightsStatus"', '"noindex"']) expect(records).not.toContain(forbidden);
    expect(pack.projects.every((p) => p.sourceStatus === 'LEGACY-SOURCE')).toBe(true);
  });
});

// ---- the validator itself: negative cases on a tiny synthetic pack -------------------------------------------------------
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGP4z8DwHwAFAAH/q842iQAAAABJRU5ErkJggg==', 'base64');
const sha = (b: Buffer) => createHash('sha256').update(b).digest('hex');
const body = (value: unknown): LexicalDoc => ({
  root: { type: 'root', format: '', indent: 0, version: 1, direction: 'ltr', children: [value as never] },
});
const paragraph = (text: string) => ({ type: 'paragraph', children: [{ type: 'text', text }] });

function tiny(overrides: { article?: Record<string, unknown>; media?: Record<string, unknown> } = {}): { pack: Pack; read: (f: string) => Buffer | undefined } {
  const key = `sha256:${sha(PNG)}` as const;
  const base: Pack = {
    manifest: {
      pack: 'bmsl-legacy',
      version: 1,
      source: { site: 'https://binhminhsonglo.vn', observedAt: '2026-10-06', wordpress: '6.7.1', sitemap: { urls: 0, notInInventory: [] } },
      rules: [],
      counts: {},
      inventory: Array.from({ length: 47 }, (_, i) => ({
        ref: `legacy:${i + 1}`,
        legacyPath: `/x${i}/`,
        wpType: 'post' as const,
        target: { kind: 'none' as const },
        textStatus: 'NOT_PROVEN' as const,
        images: { found: 0, committed: 0, pending: 0, external: 0 },
        needs: [],
        notes: [],
      })),
      media: [
        {
          key,
          file: 'assets/aaaaaaaaaaaa-pixel.png',
          sourceUrls: ['https://binhminhsonglo.vn/wp-content/uploads/2024/12/pixel.png'],
          mime: 'image/png',
          bytes: PNG.length,
          width: 1,
          height: 1,
          alt: 'Pixel',
          altSource: 'derived',
          class: 'GRAPHIC',
          usedBy: [],
          ...overrides.media,
        } as never,
      ],
      pendingMedia: [],
    },
    serviceAreas: [],
    projects: [],
    articles: [{ key: 'articles/a', title: 'A', slug: 'a', body: body(paragraph('Xin chào')), legacyUrl: '/a/', ...overrides.article } as never],
    globals: [],
  };
  return { pack: base, read: (f) => (f === 'assets/aaaaaaaaaaaa-pixel.png' ? PNG : undefined) };
}

describe('packProblems rejects unsafe or tampered packs', () => {
  it('accepts the tiny valid pack', () => {
    const { pack: p, read } = tiny();
    expect(packProblems(p, read)).toEqual([]);
  });

  it('rejects bytes that do not match the recorded checksum', () => {
    const { pack: p } = tiny();
    expect(packProblems(p, () => Buffer.concat([PNG, Buffer.from([0])])).join('\n')).toMatch(/does not match its key|size .* differs/);
  });

  it('rejects SVG/HTML content labelled as an image, and path traversal in a file name', () => {
    const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>1</script></svg>');
    const a = tiny({ media: { key: `sha256:${sha(svg)}`, bytes: svg.length } });
    expect(packProblems(a.pack, () => svg).join('\n')).toMatch(/not a readable JPEG\/PNG|differs/);
    const b = tiny({ media: { file: 'assets/../../../etc/passwd.png' } });
    expect(packProblems(b.pack, b.read).join('\n')).toMatch(/unsafe file path/);
  });

  it('rejects a committed image whose class is not allowed (people, third party, documents)', () => {
    for (const cls of ['PERSON', 'THIRD_PARTY', 'DOCUMENT', 'UNREVIEWED']) {
      const t = tiny({ media: { class: cls } });
      expect(packProblems(t.pack, t.read).join('\n'), cls).toMatch(/may not be committed/);
    }
  });

  it('rejects a source URL on another host', () => {
    const t = tiny({ media: { sourceUrls: ['https://evil.example/x.png'] } });
    expect(packProblems(t.pack, t.read).join('\n')).toMatch(/host not allowed/);
  });

  it('rejects any approval or status field carried by a record', () => {
    for (const field of ['_status', 'rightsStatus', 'sourceStatus', 'noindex']) {
      const t = tiny({ article: { [field]: 'published' } });
      expect(packProblems(t.pack, t.read).join('\n'), field).toContain(`unknown field "${field}"`);
    }
  });

  it('rejects an upload that points at unknown media, a raw numeric id, active content and contact data', () => {
    const upload = (value: unknown) => ({ type: 'upload', relationTo: 'media-assets', value, fields: null });
    const unknown = tiny({ article: { body: body(upload({ $mediaKey: 'sha256:nope' })) } });
    expect(packProblems(unknown.pack, unknown.read).join('\n')).toMatch(/unknown media/);
    const raw = tiny({ article: { body: body(upload(12)) } });
    expect(packProblems(raw.pack, raw.read).join('\n')).toMatch(/unknown media/);
    const script = tiny({ article: { body: body({ type: 'paragraph', children: [{ type: 'text', text: '<script>alert(1)</script>' }] }) } });
    expect(packProblems(script.pack, script.read).join('\n')).toMatch(/active content/);
    const phone = tiny({ article: { body: body(paragraph('Gọi 0965 943 250 ngay')) } });
    expect(packProblems(phone.pack, phone.read).join('\n')).toMatch(/phone number or e-mail/);
    const link = tiny({ article: { body: body({ type: 'link', fields: { url: 'javascript:alert(1)' }, children: [] }) } });
    expect(packProblems(link.pack, link.read).join('\n')).toMatch(/unsafe URL/);
  });

  it('rejects unsafe slugs and a pack that lost part of the 47-URL inventory', () => {
    const slug = tiny({ article: { slug: '../admin' } });
    expect(packProblems(slug.pack, slug.read).join('\n')).toMatch(/safe public slug/);
    const lost = tiny();
    lost.pack.manifest.inventory.pop();
    expect(packProblems(lost.pack, lost.read).join('\n')).toMatch(/47 canonical/);
  });
});
