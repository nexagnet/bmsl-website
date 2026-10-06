import { describe, expect, it } from 'vitest';
import legacyManifest from '../../migration/legacy-manifest.json';
import { buildPack, type ContentReviewFile, normalizeImageUrl, parseProjectFacts, plainTextOfHtml, type ReviewFile, type WpPost, type WpSnapshot } from './generator';
import { packProblems, uploadKeysOf } from './pack';

// SYNTHETIC WordPress data only (no real legacy content, no network). These tests pin the generator's rules:
// completeness of the 47-entry inventory, fail-closed image rights, no fetch of other hosts, redaction, blocking.
const UP = 'https://binhminhsonglo.vn/wp-content/uploads/2024/12';

/** Bytes that are a real PNG/JPEG container as far as the generator (and the upload policy) can tell. */
const png = (width: number) => {
  const b = Buffer.alloc(33);
  Buffer.from('89504e470d0a1a0a', 'hex').copy(b, 0);
  b.writeUInt32BE(13, 8);
  b.write('IHDR', 12, 'latin1');
  b.writeUInt32BE(width, 16);
  b.writeUInt32BE(1, 20);
  return b;
};
const jpeg = (width: number) =>
  Buffer.concat([
    Buffer.from('ffd8ffe000104a46494600010100000100010000', 'hex'),
    Buffer.from([0xff, 0xc0, 0x00, 0x0b, 0x08, 0x00, 0x01, (width >> 8) & 0xff, width & 0xff, 0x01, 0x01, 0x11, 0x00]),
    Buffer.from('ffd9', 'hex'),
  ]);

const slugOf = (legacyPath: string) => decodeURIComponent(legacyPath.replace(/^\/|\/$/g, '').split('/').pop() ?? '');

type World = { snapshot: WpSnapshot; files: Map<string, Buffer>; review: ReviewFile; contentReview: ContentReviewFile };

function world(extra: (w: World) => void = () => undefined): World {
  const posts: WpPost[] = [];
  const pages: WpPost[] = [];
  const files = new Map<string, Buffer>();
  const review: ReviewFile = { images: [] };
  const add = (url: string, bytes: Buffer, decision: 'COMMIT' | 'PENDING', cls: string) => {
    files.set(normalizeImageUrl(url), bytes);
    review.images.push({ url, decision, class: cls, reason: `synthetic ${cls}` });
  };
  for (const e of legacyManifest.entries) {
    if (e.sourceType !== 'post' && e.sourceType !== 'page') continue;
    const id = 1000 + e.id;
    const slug = e.legacyPath === '/' ? 'trang-chu' : slugOf(e.legacyPath);
    let html: string;
    if (e.legacyPath === '/') html = '';
    else if (e.kind === 'project') {
      add(`${UP}/proj-${e.id}.png`, png(100 + e.id), 'COMMIT', 'PROJECT_PHOTO');
      html = `<p><img src="${UP}/proj-${e.id}.png" alt="Z6128654384679 abc"></p><p>Địa điểm : Đường số ${e.id}</p><p>Quy mô : ${e.id} căn hộ</p><p>Chủ đầu tư : BQT ${e.id}</p><p>Năm thực hiện : 2020</p><p>Dịch vụ cung cấp : Quản lý vận hành</p>`;
    } else if (e.kind === 'contact') html = '<p>M: 0965 943 250</p><p>E: a@example.test</p><p>Địa chỉ: Số 1</p>';
    else {
      add(`${UP}/g-${e.id}.png`, png(300 + e.id), 'COMMIT', 'GRAPHIC');
      add(`${UP}/who-${e.id}.jpg`, jpeg(400 + e.id), 'PENDING', 'PERSON');
      html = `<p>Nội dung bài ${e.id}</p><p><img src="${UP}/g-${e.id}.png" alt="Bảng số ${e.id}"></p><p>Giữa bài</p><p><img src="${UP}/who-${e.id}.jpg"></p>`;
    }
    const post: WpPost = {
      id,
      date_gmt: '2024-12-14T09:24:02',
      slug,
      status: 'publish',
      title: { rendered: e.kind === 'project' ? `Dự án ${e.id} (đang vận hành)` : `Bài ${e.id}` },
      content: { rendered: html },
      excerpt: { rendered: '' },
      categories: [],
    };
    (e.sourceType === 'page' ? pages : posts).push(post);
  }
  const w: World = {
    snapshot: { site: 'https://binhminhsonglo.vn', wordpress: '6.7.1', posts, pages, categories: [], media: [], sitemapUrls: [] },
    files,
    review,
    contentReview: { blocked: [] },
  };
  extra(w);
  return w;
}

async function build(w: World) {
  const fetched: string[] = [];
  const result = await buildPack({
    snapshot: w.snapshot,
    review: w.review,
    contentReview: w.contentReview,
    observedAt: '2026-10-06',
    fetchImage: async (url) => {
      fetched.push(url);
      return w.files.get(normalizeImageUrl(url));
    },
  });
  return { ...result, fetched };
}

describe('buildPack (synthetic WordPress)', () => {
  it('produces a valid pack that covers all 47 canonical entries and keeps their paths in order', async () => {
    const { pack, assets } = await build(world());
    expect(packProblems(pack, (f) => assets.get(f))).toEqual([]);
    const canonical = pack.manifest.inventory.filter((r) => r.ref.startsWith('legacy:'));
    expect(canonical.map((r) => r.legacyPath)).toEqual(legacyManifest.entries.map((e) => e.legacyPath));
    expect(pack.projects).toHaveLength(17);
    // 18 sources -> 17 profiles: the second Học viện Quốc phòng source is merged, not dropped.
    expect(pack.manifest.inventory.filter((r) => r.textStatus === 'MERGED_INTO_TARGET' && r.target.key === 'projects/hoc-vien-quoc-phong')).toHaveLength(1);
    expect(pack.projects.find((p) => p.slug === 'hoc-vien-quoc-phong')!.legacyUrls).toHaveLength(2);
  });

  it('is deterministic: two runs give byte-identical records, manifest and report', async () => {
    const a = await build(world());
    const b = await build(world());
    expect(JSON.stringify(a.pack)).toBe(JSON.stringify(b.pack));
    expect(a.report).toBe(b.report);
    expect([...a.assets.keys()]).toEqual([...b.assets.keys()]);
  });

  it('commits only COMMIT-reviewed images and keeps person images out of the assets while recording hash and position', async () => {
    const { pack, assets } = await build(world());
    expect(pack.manifest.media.length).toBeGreaterThan(0);
    expect(pack.manifest.media.every((m) => ['GRAPHIC', 'PROJECT_PHOTO'].includes(m.class))).toBe(true);
    const persons = pack.manifest.pendingMedia.filter((p) => p.class === 'PERSON');
    expect(persons.length).toBeGreaterThan(0);
    for (const p of persons) {
      expect(p.sha256).toMatch(/^[0-9a-f]{64}$/);
      expect(p.usedBy.length).toBeGreaterThan(0);
      expect(p.usedBy[0]!.blockIndex).not.toBeNull();
    }
    expect(assets.size).toBe(pack.manifest.media.length);
    // The committed image sits in the article body at its original position (second block), the person image does not.
    const article = pack.articles.find((a) => uploadKeysOf(a.body).length > 0)!;
    expect(article.body.root.children.map((n) => n.type)).toEqual(['paragraph', 'upload', 'paragraph']);
  });

  it('fails closed: an image that is not in the review file stays pending (UNREVIEWED), even on the legacy host', async () => {
    const w = world(({ snapshot, files }) => {
      files.set(normalizeImageUrl(`${UP}/new.png`), png(777));
      snapshot.posts[0]!.content.rendered += `<p><img src="${UP}/new.png"></p>`;
    });
    const { pack } = await build(w);
    const entry = pack.manifest.pendingMedia.find((p) => p.sourceUrl.endsWith('/new.png'))!;
    expect(entry.class).toBe('UNREVIEWED');
    expect(pack.manifest.media.some((m) => m.sourceUrls.some((u) => u.endsWith('/new.png')))).toBe(false);
  });

  it('never fetches another host: external images are inventoried by URL only', async () => {
    const w = world(({ snapshot, review }) => {
      snapshot.posts[0]!.content.rendered += '<p><img src="https://news.example/photo.jpg"></p>';
      review.images.push({ url: 'https://news.example/photo.jpg', decision: 'PENDING', class: 'THIRD_PARTY_HOST', reason: 'other host' });
    });
    const { pack, fetched } = await build(w);
    expect(fetched.every((u) => new URL(u).hostname === 'binhminhsonglo.vn')).toBe(true);
    const entry = pack.manifest.pendingMedia.find((p) => p.sourceUrl === 'https://news.example/photo.jpg')!;
    expect(entry.sha256).toBeUndefined();
    expect(entry.class).toBe('THIRD_PARTY_HOST');
  });

  it('refuses an image even when reviewed COMMIT if it is not under /wp-content/uploads on the legacy host', async () => {
    const w = world(({ snapshot, review }) => {
      snapshot.posts[0]!.content.rendered += '<p><img src="https://binhminhsonglo.vn/private/secret.png"></p>';
      review.images.push({ url: 'https://binhminhsonglo.vn/private/secret.png', decision: 'COMMIT', class: 'GRAPHIC', reason: 'x' });
    });
    const { pack, fetched } = await build(w);
    expect(fetched.some((u) => u.includes('/private/'))).toBe(false);
    expect(pack.manifest.media.some((m) => m.sourceUrls.some((u) => u.includes('/private/')))).toBe(false);
  });

  it('keeps an image pending (with the reason) when it cannot be fetched or is not a real JPEG/PNG', async () => {
    const w = world(({ files }) => {
      files.set(normalizeImageUrl(`${UP}/g-2.png`), Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>1</script></svg>'));
      files.delete(normalizeImageUrl(`${UP}/g-3.png`));
    });
    const { pack } = await build(w);
    for (const name of ['g-2.png', 'g-3.png']) {
      const p = pack.manifest.pendingMedia.find((x) => x.sourceUrl.endsWith(name))!;
      expect(p.reason).toMatch(/không tải được hoặc không đọc được ảnh/);
      expect(pack.manifest.media.some((m) => m.sourceUrls.some((u) => u.endsWith(name)))).toBe(false);
    }
  });

  it('redacts contact data in the contact page and flags the row for official confirmation', async () => {
    const { pack } = await build(world());
    const contact = pack.globals.find((g) => g.slug === 'contact-page')!;
    const text = JSON.stringify(contact.body);
    expect(text).not.toMatch(/0965|example\.test/);
    expect(text).toContain('chờ BMSL xác nhận');
    const row = pack.manifest.inventory.find((r) => r.ref === 'legacy:38')!;
    expect(row.textStatus).toBe('SEEDED_REDACTED');
    expect(row.needs).toContain('official-contact-confirmation');
    expect(row.notes.map((n) => n.kind)).toEqual(expect.arrayContaining(['redacted-phone', 'redacted-email']));
  });

  it('blocks the text of a post listed in the content review, but keeps it in the inventory with its reason', async () => {
    const w = world();
    w.contentReview.blocked.push({ ref: 'legacy:23', class: 'THIRD_PARTY_TEXT', reason: 'republished article' });
    const { pack } = await build(w);
    expect(pack.articles.some((a) => a.legacyUrl === legacyManifest.entries.find((e) => e.id === 23)!.legacyPath)).toBe(false);
    expect(JSON.stringify(pack)).not.toContain('Nội dung bài 23');
    const row = pack.manifest.inventory.find((r) => r.ref === 'legacy:23')!;
    expect(row.textStatus).toBe('BLOCKED_THIRD_PARTY_TEXT');
    expect(row.notes).toContainEqual({ kind: 'text-not-committed', count: 1, details: ['republished article'] });
    expect(row.images.found).toBe(2);
    expect(pack.manifest.pendingMedia.some((p) => p.usedBy.some((u) => u.record === 'legacy:23'))).toBe(true);
  });

  it('lists a post published after the 47-entry inventory as an extra row without touching the canonical count', async () => {
    const w = world(({ snapshot }) => {
      snapshot.posts.push({ id: 9999, date_gmt: '2026-10-06T01:00:00', slug: 'bai-moi', status: 'publish', title: { rendered: 'Bài mới' }, content: { rendered: '<p>Mới</p>' }, categories: [] });
    });
    const { pack } = await build(w);
    expect(pack.manifest.counts.canonicalLegacyRows).toBe(47);
    const extra = pack.manifest.inventory.find((r) => r.ref === 'extra:9999')!;
    expect(extra.needs).toEqual(expect.arrayContaining(['owner-decision-mapping', 'redirect-not-in-47-inventory']));
    expect(pack.articles.some((a) => a.slug === 'bai-moi')).toBe(true);
  });

  it('seeds project facts from the "Label : value" lines and sets only what the source states', async () => {
    const { pack } = await build(world());
    const p = pack.projects.find((x) => x.slug === 'ecolife-tay-ho')!;
    expect(p.address).toMatch(/^Đường số \d+$/);
    expect(p.scale).toMatch(/căn hộ$/);
    expect(p.operatingSince).toBe('2020');
    expect(p.summary).toContain('Trạng thái theo website cũ: đang vận hành (chưa xác nhận)');
    expect(p.services).toEqual(['quan-ly-van-hanh']);
    expect(p.sourceStatus).toBe('LEGACY-SOURCE');
    expect(p.images).toHaveLength(1);
  });

  it('derives alt text only when the source has none, and marks it as derived', async () => {
    const { pack } = await build(world());
    const proj = pack.manifest.media.find((m) => m.class === 'PROJECT_PHOTO')!;
    expect(proj.altSource).toBe('derived');
    expect(proj.alt).toMatch(/^Ảnh dự án /);
    const graphic = pack.manifest.media.find((m) => m.class === 'GRAPHIC')!;
    expect(graphic.altSource).toBe('source');
    expect(graphic.alt).toMatch(/^Bảng số \d+$/);
  });

  it('renders a per-URL report that contains every canonical entry', async () => {
    const { report } = await build(world());
    for (const e of legacyManifest.entries) expect(report).toContain(`\`${e.legacyPath}\``);
    expect(report).toContain('legacy:33');
  });
});

describe('source parsing helpers', () => {
  it('parses labelled lines, maps several services and reports lines it does not understand', () => {
    const facts = parseProjectFacts(
      '<p>Địa điểm  : A, B<br />C</p><p>Số căn hộ : 92 căn hộ</p><p>Chủ đầu tư : BQT 1B</p><p>Năm thực hiện : T4/2024</p><p>Dịch vụ cung cấp : bảo vệ và vệ sinh cho tòa nhà</p><p>Ghi chú lạ</p>',
    );
    expect(facts).toEqual({
      address: 'A, B C',
      scale: '92 căn hộ',
      investor: 'BQT 1B',
      since: 'T4/2024',
      services: ['bao-ve', 've-sinh'],
      unparsed: ['Ghi chú lạ'],
    });
  });

  it('extracts visible text with block boundaries and without scripts, styles or iframes', () => {
    expect(plainTextOfHtml('<p>A</p><script>x()</script><p>B<br>C</p><iframe src="u"></iframe>').replace(/\s+/g, ' ').trim()).toBe('A B C');
  });

  it('normalizes image URLs: https, no query/hash, WordPress size suffix removed', () => {
    expect(normalizeImageUrl('http://binhminhsonglo.vn/wp-content/uploads/2024/12/a-300x200.jpg?x=1#y')).toBe(`${UP}/a.jpg`);
  });
});
