import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { auditSource, bodyImageUrls, renderAuditReport, renderLedgerCsv, sourceFactLines } from './audit';
import type { WpPost, WpSnapshot } from './generator';
import type { LexicalDoc } from './lexical';
import type { InventoryRow, Manifest, MediaEntry, PendingMediaEntry, ProjectRecord } from './pack';

// Synthetic fixtures only: no real source text, no network, no disk.
const U = (name: string) => `https://binhminhsonglo.vn/wp-content/uploads/2024/12/${name}.jpg`;
const sha = (b: Buffer) => createHash('sha256').update(b).digest('hex');

const FULL =
  '<p><img src="http://binhminhsonglo.vn/wp-content/uploads/2024/12/full-300x200.jpg" /></p><p>Địa điểm : KĐT X, phường Y,</p><p>Hà Nội</p><p>Số căn hộ : 84 căn hộ</p><p>Chủ đầu tư : Ban quản trị B3</p><p>Năm thực hiện : 1/1/2023.</p><p>Dịch vụ cung cấp : Quản lý vận hành tòa B3</p>';
const IMAGE_ONLY = '<p><img src="https://binhminhsonglo.vn/wp-content/uploads/2024/12/a6.jpg" /></p>';
const THIRD_PARTY = '<p><img src="https://binhminhsonglo.vn/wp-content/uploads/2025/06/dantri.jpg" /></p><p>Địa điểm : Z</p>';

const post = (id: number, slug: string, title: string, html: string, featured = 0): WpPost => ({
  id,
  slug,
  status: 'publish',
  date_gmt: '2024-12-14T00:00:00',
  title: { rendered: title },
  content: { rendered: html },
  featured_media: featured,
  categories: [],
});

const fullBytes = Buffer.from('full-image-bytes');
const a6Bytes = Buffer.from('a6-image-bytes');
const media = (name: string, bytes: Buffer): MediaEntry => ({
  key: `sha256:${sha(bytes)}`,
  file: `assets/${name}.jpg`,
  sourceUrls: [U(name)],
  mime: 'image/jpeg',
  bytes: bytes.length,
  width: 1,
  height: 1,
  alt: '',
  altSource: 'derived',
  class: 'PROJECT_PHOTO',
  usedBy: [],
});

const plainChars = (html: string) =>
  html
    .replace(/<img[^>]*>/g, '')
    .replace(/<\/p>/g, ' ')
    .replace(/<[^>]+>/g, '')
    .replace(/\s+/g, ' ')
    .trim().length;

const lexDoc = (...paragraphs: string[]): LexicalDoc => ({
  root: {
    type: 'root',
    format: '',
    indent: 0,
    version: 1,
    direction: 'ltr',
    children: paragraphs.map((t) => ({
      type: 'paragraph',
      format: '',
      indent: 0,
      version: 1,
      direction: 'ltr',
      children: [{ type: 'text', text: t, format: 0, detail: 0, mode: 'normal', style: '', version: 1 }],
    })),
  },
});

// Text bodies: two articles-like sources of the SAME length with different words, a source holding a phone number, and an assembled about page.
const ART = '<p>Bài viết gốc số một</p>';
const CONTACT = '<p>Gọi +84 912 345 678 để biết thêm</p>';
const ABOUT_A = '<p>Giới thiệu công ty</p>';
const ABOUT_B = '<p>Văn phòng tại Hà Nội</p>';

function fixture() {
  const snapshot: WpSnapshot = {
    site: 'https://binhminhsonglo.vn',
    wordpress: '6.7.1',
    posts: [post(10, 'full', 'Toà full (đang vận hành)', FULL), post(11, 'a6', 'A6 (Đang vận hành)', IMAGE_ONLY), post(12, 'third', 'Toà bên thứ ba', THIRD_PARTY), post(20, 'art', 'Bài một', ART), post(21, 'contact', 'Liên hệ', CONTACT), post(22, 'about-a', 'Giới thiệu', ABOUT_A), post(23, 'about-b', 'Văn phòng', ABOUT_B)],
    pages: [],
    categories: [],
    media: [],
    sitemapUrls: ['https://binhminhsonglo.vn/full/', 'https://binhminhsonglo.vn/a6/', 'https://binhminhsonglo.vn/third/', 'https://binhminhsonglo.vn/art/', 'https://binhminhsonglo.vn/contact/', 'https://binhminhsonglo.vn/about-a/', 'https://binhminhsonglo.vn/about-b/'],
  };
  const full = media('full', fullBytes);
  const a6 = media('a6', a6Bytes);
  const pending: PendingMediaEntry = { sourceUrl: 'https://binhminhsonglo.vn/wp-content/uploads/2025/06/dantri.jpg', class: 'THIRD_PARTY', reason: 'watermark', usedBy: [], sha256: 'x' };
  const row = (ref: string, wpId: number, slug: string, key: string, title: string, bodyChars: number): InventoryRow => ({
    ref,
    legacyPath: `/${slug}/`,
    wpType: 'post',
    wpId,
    title,
    target: { kind: 'projects', key },
    textStatus: 'SEEDED_FACTS_ONLY',
    textFidelity: 'NOT_APPLICABLE',
    bodyChars,
    images: { found: 1, committed: 1, pending: 0, external: 0 },
    needs: [],
    notes: [],
  });
  const textRow = (ref: string, wpId: number, slug: string, target: InventoryRow['target'], textStatus: InventoryRow['textStatus'], bodyChars: number): InventoryRow => ({
    ref,
    legacyPath: `/${slug}/`,
    wpType: 'post',
    wpId,
    title: slug,
    target,
    textStatus,
    textFidelity: 'EXACT',
    bodyChars,
    images: { found: 0, committed: 0, pending: 0, external: 0 },
    needs: [],
    notes: [],
  });
  const manifest: Manifest = {
    pack: 'bmsl-legacy',
    version: 1,
    source: { site: snapshot.site, observedAt: '2026-10-06', wordpress: '6.7.1', sitemap: { urls: 3, notInInventory: [] } },
    rules: [],
    counts: { imageUrlsFound: 3, imageUrlsCommitted: 2, imagesCommitted: 2, imagesPendingTotal: 1 },
    inventory: [
      row('legacy:1', 10, 'full', 'projects/full', 'Toà full', plainChars(FULL)),
      row('legacy:2', 11, 'a6', 'projects/a6', 'A6', 0),
      row('legacy:3', 12, 'third', 'projects/third', 'Toà bên thứ ba', plainChars(THIRD_PARTY)),
      textRow('legacy:4', 20, 'art', { kind: 'articles', key: 'articles/art' }, 'SEEDED', plainChars(ART)),
      textRow('legacy:5', 21, 'contact', { kind: 'contact-page', key: 'globals/contact-page' }, 'SEEDED_REDACTED', plainChars(CONTACT)),
      textRow('legacy:6', 22, 'about-a', { kind: 'about-page', key: 'globals/about-page' }, 'SEEDED', plainChars(ABOUT_A)),
      textRow('legacy:7', 23, 'about-b', { kind: 'about-page', key: 'globals/about-page' }, 'MERGED_INTO_TARGET', plainChars(ABOUT_B)),
    ],
    media: [full, a6],
    pendingMedia: [pending],
  };
  const projects: ProjectRecord[] = [
    {
      key: 'projects/full',
      name: 'Toà full',
      slug: 'full',
      summary: 'Chủ đầu tư: Ban quản trị B3\nTrạng thái theo website cũ: đang vận hành (chưa xác nhận)',
      address: 'KĐT X, phường Y, Hà Nội',
      scale: '84 căn hộ',
      operatingSince: '1/1/2023',
      services: ['quan-ly-van-hanh'],
      images: [full.key],
      legacyUrls: ['/full/'],
      sourceStatus: 'LEGACY-SOURCE',
    },
    { key: 'projects/a6', name: 'A6', slug: 'a6', summary: 'Trạng thái theo website cũ: đang vận hành (chưa xác nhận)', services: [], images: [a6.key], legacyUrls: ['/a6/'], sourceStatus: 'LEGACY-SOURCE' },
    { key: 'projects/third', name: 'Toà bên thứ ba', slug: 'third', address: 'Z', services: [], images: [], legacyUrls: ['/third/'], sourceStatus: 'LEGACY-SOURCE' },
  ];
  const assets: Record<string, Buffer | undefined> = { 'assets/full.jpg': fullBytes, 'assets/a6.jpg': a6Bytes };
  const records = {
    articles: [{ key: 'articles/art', title: 'Bài một', slug: 'art', body: lexDoc('Bài viết gốc số một'), publishedAt: '2024-12-14T00:00:00.000Z', legacyUrl: '/art/' }],
    globals: [
      { key: 'globals/contact-page', slug: 'contact-page' as const, title: 'Liên hệ', body: lexDoc('Gọi [số điện thoại — chờ BMSL xác nhận] để biết thêm') },
      { key: 'globals/about-page', slug: 'about-page' as const, title: 'Giới thiệu', body: lexDoc('Giới thiệu công ty', 'Văn phòng', 'Văn phòng tại Hà Nội') },
    ],
    serviceAreas: [],
  };
  return { snapshot, manifest, projects, records, assets, readAsset: (f: string) => assets[f] };
}

describe('sourceFactLines', () => {
  it('reads every labelled line, joins a wrapped address and keeps unknown paragraphs as prose', () => {
    const { facts, prose } = sourceFactLines(`${FULL}<p>Một đoạn mô tả dài.</p>`);
    expect(facts.map((f) => [f.field, f.value])).toEqual([
      ['address', 'KĐT X, phường Y, Hà Nội'],
      ['scale', '84 căn hộ'],
      ['investor', 'Ban quản trị B3'],
      ['since', '1/1/2023'],
      ['services', 'Quản lý vận hành tòa B3'],
    ]);
    expect(prose).toEqual(['Một đoạn mô tả dài.']);
  });

  it('finds no facts and no prose in an image-only page (source absent, not a parser defect)', () => {
    expect(sourceFactLines(IMAGE_ONLY)).toEqual({ facts: [], prose: [] });
  });
});

describe('bodyImageUrls', () => {
  it('normalises http, query and the -WxH size suffix', () => {
    expect(bodyImageUrls(FULL)).toEqual([U('full')]);
  });
});

describe('auditSource', () => {
  it('passes a consistent pack and classifies the representative cases', () => {
    const a = auditSource(fixture());
    expect(a.problems).toEqual([]);
    const [full, a6, third] = a.projects;
    expect(full!.fields.filter((x) => x.field !== 'services').every((x) => x.result === 'MATCH')).toBe(true);
    expect(full!.gaps.map((g) => g.class)).toEqual(['SCHEMA_MISMATCH']);
    expect(full!.coverOk).toBe(true);
    expect(a6!.gaps.map((g) => g.class)).toContain('SOURCE_ABSENT');
    expect(a6!.fields.find((x) => x.field === 'address')?.result).toBe('SOURCE_ABSENT');
    expect(third!.images[0]).toMatchObject({ state: 'PENDING_RIGHTS', role: 'cover+body' });
    expect(third!.gaps.map((g) => g.class)).toContain('PRIVACY/RIGHTS_PENDING');
    expect(a.matrix.find((r) => r.ref === 'legacy:2')).toMatchObject({ fidelity: 'FACTS_ONLY', gap: 'SOURCE_ABSENT', bodyCheck: 'NO_BODY' });
    expect(a.counts).toMatchObject({ imageUrlsFound: 3, committedUrls: 2, committedFiles: 2, pendingRights: 1, unaccounted: 0 });
  });

  it('flags a project line that the seed does not carry (no silent loss)', () => {
    const f = fixture();
    f.projects[0]!.scale = '85 căn hộ';
    expect(auditSource(f).problems.join('\n')).toContain('scale nguồn "84 căn hộ" ≠ seed "85 căn hộ"');
  });

  it('flags source prose that no seed field carries', () => {
    const f = fixture();
    f.snapshot.posts[0]!.content.rendered += '<p>Dự án đạt giải thưởng.</p>';
    const problems = auditSource(f).problems.join('\n');
    expect(problems).toContain('projects/full: đoạn văn nguồn chưa được đưa vào seed (22 ký tự, SHA-256 ');
    expect(problems).not.toContain('đạt giải thưởng');
  });

  it('flags a source whose body changed after the seed was generated', () => {
    const f = fixture();
    f.snapshot.posts[0]!.content.rendered += '<p>Địa điểm : khác</p>';
    expect(auditSource(f).problems.join('\n')).toMatch(/legacy:1: thân bài nguồn hiện \d+ ký tự, seed ghi \d+/);
  });

  it('flags an image that is neither committed nor pending, and a committed file that was altered or is missing', () => {
    const f = fixture();
    f.snapshot.posts[1]!.content.rendered += '<img src="https://binhminhsonglo.vn/wp-content/uploads/2024/12/new.jpg" />';
    f.assets['assets/full.jpg'] = Buffer.from('tampered');
    delete f.assets['assets/a6.jpg'];
    const problems = auditSource(f).problems.join('\n');
    expect(problems).toContain('new.jpg không có trong tệp commit lẫn danh sách chờ duyệt');
    expect(problems).toContain('assets/full.jpg không khớp SHA-256');
    expect(problems).toContain('Tệp ảnh đã commit bị thiếu: assets/a6.jpg');
  });

  it('flags a published document or sitemap URL that the inventory does not list', () => {
    const f = fixture();
    f.snapshot.posts.push(post(99, 'new-post', 'Mới', '<p>Nội dung mới</p>'));
    f.snapshot.sitemapUrls.push('https://binhminhsonglo.vn/new-post/');
    const problems = auditSource(f).problems.join('\n');
    expect(problems).toContain('post #99 (/new-post/) chưa có trong kiểm kê');
    expect(problems).toContain('Sitemap có /new-post/ chưa có trong kiểm kê');
  });

  it('ledgers library-only media separately and counts a second URL of one committed file as a duplicate', () => {
    const f = fixture();
    f.manifest.media[0]!.sourceUrls.push(U('full-copy'));
    f.snapshot.posts[0]!.content.rendered += '<img src="https://binhminhsonglo.vn/wp-content/uploads/2024/12/full-copy.jpg" />';
    f.manifest.counts.imageUrlsFound = 4;
    f.manifest.counts.imageUrlsCommitted = 3;
    f.manifest.inventory[0]!.bodyChars = plainChars(f.snapshot.posts[0]!.content.rendered);
    f.snapshot.media = [{ id: 1, source_url: U('orphan'), post: 12 }];
    const a = auditSource(f);
    expect(a.problems).toEqual([]);
    expect(a.ledger.filter((l) => l.status === 'COMMITTED_DUPLICATE_URL')).toHaveLength(1);
    expect(a.libraryOnly).toEqual([{ id: 1, url: U('orphan'), parent: 12, parentSlug: 'third' }]);
    expect(renderLedgerCsv(a)).toContain('LIBRARY_ONLY');
  });

  it('compares the current source text with the committed record: unchanged text, redacted contact data and an assembled page all match', () => {
    const a = auditSource(fixture());
    expect(a.problems).toEqual([]);
    const check = (ref: string) => a.matrix.find((r) => r.ref === ref)!;
    expect(check('legacy:4')).toMatchObject({ contentCheck: 'MATCH', fidelity: 'EXACT' });
    expect(check('legacy:5')).toMatchObject({ contentCheck: 'MATCH_EXCEPT_REDACTIONS', fidelity: 'EXACT' });
    expect(check('legacy:6').contentCheck).toBe('MATCH');
    expect(check('legacy:7').contentCheck).toBe('MATCH');
    expect(check('legacy:4').seedTextSha256).toMatch(/^[0-9a-f]{12}$/);
  });

  it('fails when the source text changes to DIFFERENT text of exactly the same length (a length check alone would pass)', () => {
    const f = fixture();
    const changed = '<p>Bài viết gốc số hai</p>';
    expect(plainChars(changed)).toBe(plainChars(ART));
    f.snapshot.posts.find((p) => p.id === 20)!.content.rendered = changed;
    const a = auditSource(f);
    const row = a.matrix.find((r) => r.ref === 'legacy:4')!;
    expect(row.bodyCheck).toBe('SAME_AS_SEED');
    expect(row).toMatchObject({ contentCheck: 'DIFFERS', fidelity: 'DIFFERS' });
    expect(a.problems.join('\n')).toContain('legacy:4: văn bản nguồn hiện tại khác bản ghi seed articles/art');
  });

  it('fails when a section of the assembled about page changes without changing its length', () => {
    const f = fixture();
    f.snapshot.posts.find((p) => p.id === 23)!.content.rendered = '<p>Văn phòng tại Đà Lạt</p>';
    const a = auditSource(f);
    expect(a.matrix.find((r) => r.ref === 'legacy:7')).toMatchObject({ bodyCheck: 'SAME_AS_SEED', contentCheck: 'DIFFERS' });
    expect(a.problems.join('\n')).toContain('legacy:7: văn bản nguồn hiện tại khác');
  });

  it('fails when a changed contact number or text is hidden behind the redaction rule, without echoing it', () => {
    const f = fixture();
    f.snapshot.posts.find((p) => p.id === 21)!.content.rendered = '<p>Hãy +84 987 654 321 để biết thêm</p>';
    const a = auditSource(f);
    expect(a.matrix.find((r) => r.ref === 'legacy:5')!.contentCheck).toBe('DIFFERS');
    const report = renderAuditReport(a);
    expect(report).not.toContain('987 654 321');
    expect(report).not.toContain('Hãy');
  });

  it('renders a report that carries hashes and facts but never the source body text', () => {
    const f = fixture();
    f.snapshot.posts[0]!.content.rendered = FULL.replace('<p>Hà Nội</p>', '<p>Hà Nội</p><p>Liên hệ +84 912 345 678</p>');
    f.manifest.inventory[0]!.bodyChars = undefined;
    const report = renderAuditReport(auditSource(f));
    expect(report).toContain('Ma trận truy vết từng URL');
    expect(report).not.toContain('912 345 678');
  });
});
