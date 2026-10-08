import { createHash } from 'node:crypto';
import { fidelity, normalizeImageUrl, parseProjectFacts, plainTextOfHtml, type WpPost, type WpSnapshot } from './generator';
import { type HNode, isElement, parseHtml, textOf } from './html';
import { type LexicalDoc, lexicalPlainText } from './lexical';
import type { ArticleRecord, GlobalRecord, InventoryRow, Manifest, MediaEntry, ProjectRecord, ServiceAreaRecord } from './pack';

// Source-fidelity audit (Issue #80): compares what the legacy WordPress site serves now with what the committed seed pack
// holds. Pure: the caller injects the WordPress snapshot and a reader for the committed asset files; nothing here touches the
// network, the disk or a database. It reports; it never repairs, and it never decides rights (that stays in review/*.json).

export type FidelityClass = 'EXACT' | 'FACTS_ONLY' | 'MISSING' | 'BLOCKED' | 'DIFFERS';
export type GapClass = 'DATA_MISSING' | 'SOURCE_ABSENT' | 'SCHEMA_MISMATCH' | 'PRIVACY/RIGHTS_PENDING' | 'EXISTING_BUT_DRAFT';

const OWN_HOST = /(^|\.)binhminhsonglo\.vn$/;
const SPACES = new RegExp(`[\\s${String.fromCharCode(0xa0, 0x200b)}]+`, 'g');
const squash = (s: string) => s.replace(SPACES, ' ').trim();
const sha256 = (data: string | Buffer) => createHash('sha256').update(data).digest('hex');
const isOwnUpload = (url: string) => {
  const u = new URL(url);
  return OWN_HOST.test(u.hostname) && u.pathname.startsWith('/wp-content/uploads/');
};
const titleOf = (post: WpPost) => squash(post.title.rendered.replace(/<[^>]+>/g, ''));
const bodyText = (post: WpPost) => squash(plainTextOfHtml(post.content.rendered).replace(/\n/g, ' '));

export type SourceDoc = WpPost & { wpType: 'post' | 'page' };

/** Every `<img src>` of an HTML body, normalised the way the generator keys images, in document order. */
export function bodyImageUrls(html: string): string[] {
  const out: string[] = [];
  const walk = (n: HNode) => {
    if (!isElement(n)) return;
    if (n.tag === 'img' && n.attrs.src) out.push(normalizeImageUrl(n.attrs.src));
    n.children.forEach(walk);
  };
  parseHtml(html).forEach(walk);
  return out;
}

type FactField = 'address' | 'scale' | 'investor' | 'since' | 'services';
const FIELD_OF_LABEL: Record<string, FactField> = {
  'địa điểm': 'address',
  'quy mô': 'scale',
  'số căn hộ': 'scale',
  'chủ đầu tư': 'investor',
  'năm thực hiện': 'since',
  'dịch vụ cung cấp': 'services',
};

export type SourceFactLine = { label: string; field: FactField; value: string };

/**
 * Reads a legacy project body on its own (independently of parseProjectFacts): the "Label : value" paragraphs, plus every other
 * non-image paragraph as `prose`. A value that ends with a comma continues in the next unlabelled paragraph.
 */
export function sourceFactLines(html: string): { facts: SourceFactLine[]; prose: string[] } {
  const facts: SourceFactLine[] = [];
  const prose: string[] = [];
  const blocks = parseHtml(html).flatMap((n) => (isElement(n) && n.tag !== 'img' ? [squash(textOf(n))] : []));
  for (const line of blocks) {
    if (!line) continue;
    const m = /^([^:]{3,25}?)\s*:\s*(.+)$/.exec(line);
    const field = m ? FIELD_OF_LABEL[m[1]!.toLowerCase()] : undefined;
    const last = facts.at(-1);
    if (m && field) facts.push({ label: m[1]!, field, value: m[2]!.trim() });
    else if (last && last.field !== 'services' && last.value.endsWith(',')) last.value = `${last.value} ${line}`;
    else prose.push(line);
  }
  for (const f of facts) f.value = f.value.replace(/\.$/, '').trim();
  return { facts, prose };
}

export type ProjectFieldCheck = {
  field: FactField | 'status';
  source?: string;
  seed?: string;
  result: 'MATCH' | 'MISMATCH' | 'SOURCE_ABSENT' | 'WORDING_NORMALIZED';
};
export type ProjectImageCheck = { url: string; role: 'cover+body' | 'cover' | 'body'; state: 'COMMITTED_IN_RECORD' | 'PENDING_RIGHTS' | 'NOT_IN_RECORD'; detail: string };
export type ProjectAudit = {
  key: string;
  name: string;
  sources: { ref: string; wpId: number; legacyPath: string; bodyChars: number; bodySha256: string; imagesInBody: number }[];
  fields: ProjectFieldCheck[];
  proseLines: string[];
  images: ProjectImageCheck[];
  coverOk: boolean;
  gaps: { class: GapClass; detail: string }[];
};

export type MatrixRow = {
  ref: string;
  legacyPath: string;
  wpType: InventoryRow['wpType'];
  wpId?: number;
  title: string;
  dateGmt?: string;
  categories: string[];
  sourceBodyChars?: number;
  sourceBodySha256?: string;
  seedBodyChars?: number;
  /** `DRIFT` = the legacy body now differs from the one the seed was generated from. */
  bodyCheck: 'SAME_AS_SEED' | 'DRIFT' | 'NO_BODY' | 'NOT_A_DOCUMENT';
  /**
   * Current source text compared with the COMMITTED record body (not with the manifest's old verdict): `MATCH_EXCEPT_REDACTIONS`
   * = equal once the phone/email placeholders are accounted for. `NOT_COMPARED` = no committed text for this row (blocked, facts-only, taxonomy).
   */
  contentCheck: 'MATCH' | 'MATCH_EXCEPT_REDACTIONS' | 'DIFFERS' | 'NOT_COMPARED';
  /** SHA-256 (12) of the normalised text of the committed record body; the text itself is never reported. */
  seedTextSha256?: string;
  imagesInSource?: number;
  imagesInSeedRow: number;
  target: string;
  textStatus: InventoryRow['textStatus'];
  fidelity: FidelityClass;
  gap: GapClass;
  reason: string;
};

export type LedgerStatus = 'COMMITTED' | 'COMMITTED_DUPLICATE_URL' | 'APPROVED_NOT_USED' | 'PENDING_RIGHTS' | 'EXTERNAL_HOST_NOT_FETCHED' | 'UNFETCHABLE' | 'UNACCOUNTED';
export type LedgerRow = { url: string; status: LedgerStatus; class: string; reason: string; file?: string; sha256?: string; usedBy: string[] };
export type LibraryOnlyRow = { id: number; url: string; parent?: number; parentSlug?: string };

export type AuditResult = {
  site: string;
  observedAt: string;
  wordpress: string;
  totals: { posts: number; pages: number; categories: number; sitemapUrls: number; mediaListed: number; mediaReported?: number };
  matrix: MatrixRow[];
  projects: ProjectAudit[];
  ledger: LedgerRow[];
  libraryOnly: LibraryOnlyRow[];
  reconciliation: { group: string; rows: number }[];
  counts: Record<string, number>;
  /** Hard inconsistencies between the legacy site and the seed pack: any entry here fails the audit. */
  problems: string[];
};

export type AuditInput = {
  snapshot: WpSnapshot;
  manifest: Manifest;
  projects: ProjectRecord[];
  /** The committed records whose bodies are compared with the current source text. */
  records: { articles: ArticleRecord[]; globals: GlobalRecord[]; serviceAreas: ServiceAreaRecord[] };
  readAsset: (file: string) => Buffer | undefined;
  mediaReported?: number;
};

const pathOf = (url: string) => decodeURIComponent(new URL(url).pathname);

function classify(row: InventoryRow, source: SourceDoc | undefined, contentCheck: MatrixRow['contentCheck']): Pick<MatrixRow, 'fidelity' | 'gap' | 'reason'> {
  if (contentCheck === 'DIFFERS') {
    return { fidelity: 'DIFFERS', gap: 'DATA_MISSING', reason: 'Văn bản nguồn hiện tại KHÁC bản ghi seed đã commit (kể cả khi cùng độ dài): nguồn đã đổi sau khi tạo seed, cần tạo lại pack và duyệt.' };
  }
  switch (row.textStatus) {
    case 'SEEDED':
    case 'SEEDED_REDACTED':
      return {
        fidelity: 'EXACT',
        gap: 'EXISTING_BUT_DRAFT',
        reason: row.textStatus === 'SEEDED_REDACTED' ? 'Văn bản khớp nguồn, trừ SĐT/email được thay bằng placeholder; bản ghi là bản nháp.' : 'Văn bản khớp nguồn; bản ghi là bản nháp.',
      };
    case 'MERGED_INTO_TARGET':
      return row.target.kind === 'projects'
        ? { fidelity: 'FACTS_ONLY', gap: 'EXISTING_BUT_DRAFT', reason: 'Nguồn trùng lặp của cùng một dự án, gộp vào bản ghi dự án (cùng dữ kiện).' }
        : { fidelity: 'EXACT', gap: 'EXISTING_BUT_DRAFT', reason: `Gộp vào ${row.target.key}; văn bản khớp nguồn.` };
    case 'SEEDED_FACTS_ONLY': {
      const noFacts = source !== undefined && sourceFactLines(source.content.rendered).facts.length === 0;
      return noFacts
        ? { fidelity: 'FACTS_ONLY', gap: 'SOURCE_ABSENT', reason: 'Trang nguồn chỉ có ảnh, không có dòng dữ kiện nào (địa điểm/quy mô/…): thiếu ở nguồn, không phải lỗi parser.' }
        : { fidelity: 'FACTS_ONLY', gap: 'EXISTING_BUT_DRAFT', reason: 'Trang nguồn chỉ gồm các dòng dữ kiện + 1 ảnh; mọi dòng đã vào trường có cấu trúc, không có đoạn văn dài nào bị bỏ.' };
    }
    case 'BLOCKED_THIRD_PARTY_TEXT':
      return { fidelity: 'BLOCKED', gap: 'PRIVACY/RIGHTS_PENDING', reason: 'Bài báo đăng lại của bên thứ ba: văn bản không được commit vào Git công khai.' };
    case 'BLOCKED_OWNER_DECISION':
      return { fidelity: 'BLOCKED', gap: 'PRIVACY/RIGHTS_PENDING', reason: 'Thông tin cá nhân của lãnh đạo: chờ quyết định của owner/BMSL.' };
    case 'NO_SOURCE_BODY':
      return { fidelity: 'MISSING', gap: 'SOURCE_ABSENT', reason: 'Trang nguồn có thân bài rỗng.' };
    case 'TAXONOMY_NOT_SEEDED':
      return { fidelity: 'MISSING', gap: 'SOURCE_ABSENT', reason: 'Trang lưu trữ do WordPress sinh ra, không có thân bài riêng; phân loại chờ BMSL duyệt.' };
    default:
      return { fidelity: 'MISSING', gap: 'DATA_MISSING', reason: 'Không tìm thấy nguồn tương ứng trong snapshot.' };
  }
}

export function auditSource(input: AuditInput): AuditResult {
  const { snapshot, manifest, projects, records, readAsset } = input;
  const problems: string[] = [];
  const docs: SourceDoc[] = [
    ...snapshot.posts.map((p) => ({ ...p, wpType: 'post' as const })),
    ...snapshot.pages.map((p) => ({ ...p, wpType: 'page' as const })),
  ].filter((p) => p.status === 'publish');
  const docById = new Map(docs.map((d) => [d.id, d]));
  const termSlug = new Map(snapshot.categories.map((c) => [c.id, c.slug]));
  const mediaById = new Map(snapshot.media.map((m) => [m.id, m]));

  // ---- 1. per-URL matrix ----------------------------------------------------------------------------------------------
  const committedBody = (row: InventoryRow): { doc: LexicalDoc; mode: 'whole' | 'within' } | undefined => {
    const key = row.target.key;
    if (!key) return undefined;
    const rec = key.startsWith('articles/')
      ? records.articles.find((a) => a.key === key)
      : key.startsWith('globals/')
        ? records.globals.find((g) => g.key === key)
        : records.serviceAreas.find((a) => a.key === key);
    // The about-page is assembled from several sources, so each one must appear inside it; every other body is one source.
    return rec?.body ? { doc: rec.body, mode: row.target.kind === 'about-page' ? 'within' : 'whole' } : undefined;
  };
  const matrix: MatrixRow[] = manifest.inventory.map((row) => {
    const source = row.wpId !== undefined ? docById.get(row.wpId) : undefined;
    const text = source ? bodyText(source) : undefined;
    const bodyCheck: MatrixRow['bodyCheck'] = !source
      ? 'NOT_A_DOCUMENT'
      : !text
        ? 'NO_BODY'
        : row.bodyChars === undefined || row.bodyChars === text.length
          ? 'SAME_AS_SEED'
          : 'DRIFT';
    if (row.wpId !== undefined && !source) problems.push(`${row.ref}: wpId ${row.wpId} không còn trong snapshot nguồn`);
    if (bodyCheck === 'DRIFT') problems.push(`${row.ref}: thân bài nguồn hiện ${text!.length} ký tự, seed ghi ${row.bodyChars} (nguồn đã đổi sau khi tạo seed?)`);
    // Reuse the generator's own comparison (same normalisation and redaction rules) against the committed record body.
    const committed = source ? committedBody(row) : undefined;
    const verdict = committed && source ? fidelity(source.content.rendered, committed.doc, committed.mode) : undefined;
    const contentCheck: MatrixRow['contentCheck'] = verdict === 'EXACT' ? 'MATCH' : verdict === 'EXACT_EXCEPT_REDACTIONS' ? 'MATCH_EXCEPT_REDACTIONS' : verdict === 'DIFFERS' ? 'DIFFERS' : 'NOT_COMPARED';
    if (contentCheck === 'DIFFERS') problems.push(`${row.ref}: văn bản nguồn hiện tại khác bản ghi seed ${row.target.key} (thân bài nguồn ${text!.length} ký tự, SHA-256 ${sha256(text!).slice(0, 12)})`);
    return {
      ref: row.ref,
      legacyPath: row.legacyPath,
      wpType: row.wpType,
      wpId: row.wpId,
      title: source ? titleOf(source) : (row.title ?? ''),
      dateGmt: source?.date_gmt,
      categories: source ? (source.categories ?? []).map((c) => termSlug.get(c) ?? String(c)).sort() : (row.wpCategories ?? []),
      sourceBodyChars: text?.length,
      sourceBodySha256: text !== undefined ? sha256(text) : undefined,
      seedBodyChars: row.bodyChars,
      bodyCheck,
      contentCheck,
      seedTextSha256: committed ? sha256(squash(lexicalPlainText(committed.doc))).slice(0, 12) : undefined,
      imagesInSource: source ? new Set(bodyImageUrls(source.content.rendered)).size : undefined,
      imagesInSeedRow: row.images.found,
      target: row.target.key ?? row.target.kind,
      textStatus: row.textStatus,
      ...classify(row, source, contentCheck),
    };
  });

  // Documents the site publishes that the inventory does not list at all.
  const inventoried = new Set(manifest.inventory.map((r) => r.wpId).filter((id): id is number => id !== undefined));
  for (const d of docs) if (!inventoried.has(d.id)) problems.push(`Nguồn có ${d.wpType} #${d.id} (/${d.slug}/) chưa có trong kiểm kê`);
  const inventoryPaths = new Set(manifest.inventory.map((r) => r.legacyPath));
  for (const url of snapshot.sitemapUrls) {
    const p = pathOf(url);
    if (!inventoryPaths.has(p)) problems.push(`Sitemap có ${p} chưa có trong kiểm kê`);
  }

  // ---- 2. every project: source facts vs seed record ------------------------------------------------------------------
  const mediaByKey = new Map<string, MediaEntry>(manifest.media.map((m) => [m.key, m]));
  const pendingByUrl = new Map(manifest.pendingMedia.map((p) => [p.sourceUrl, p]));
  const projectAudits: ProjectAudit[] = projects.map((rec) => {
    const rows = manifest.inventory.filter((r) => r.target.kind === 'projects' && r.target.key === rec.key).sort((a, b) => (a.wpId ?? 0) - (b.wpId ?? 0));
    const fields: ProjectFieldCheck[] = [];
    const gaps: ProjectAudit['gaps'] = [];
    const proseLines: string[] = [];
    const sources: ProjectAudit['sources'] = [];
    const images: ProjectImageCheck[] = [];
    const recordUrls = new Set(rec.images.flatMap((k) => mediaByKey.get(k)?.sourceUrls ?? []));
    let coverOk = true;
    for (const [i, row] of rows.entries()) {
      const doc = row.wpId !== undefined ? docById.get(row.wpId) : undefined;
      if (!doc) {
        problems.push(`${rec.key}: nguồn ${row.ref} không có trong snapshot`);
        continue;
      }
      const html = doc.content.rendered;
      const text = bodyText(doc);
      const bodyImgs = bodyImageUrls(html);
      sources.push({ ref: row.ref, wpId: doc.id, legacyPath: row.legacyPath, bodyChars: text.length, bodySha256: sha256(text), imagesInBody: new Set(bodyImgs).size });
      const { facts, prose } = sourceFactLines(html);
      proseLines.push(...prose);
      for (const p of prose) {
        // Never echo source text into the report (it can hold phone numbers or names): length and hash identify the paragraph.
        const id = `${p.length} ký tự, SHA-256 ${sha256(p).slice(0, 12)}`;
        gaps.push({ class: 'DATA_MISSING', detail: `Đoạn nguồn không thuộc dòng dữ kiện nào và không có trong seed (${id})` });
        problems.push(`${rec.key}: đoạn văn nguồn chưa được đưa vào seed (${id})`);
      }
      if (i === 0) {
        const compare = (field: ProjectFieldCheck['field'], value: string | undefined, seed: string | undefined) => {
          const result: ProjectFieldCheck['result'] = value === undefined ? 'SOURCE_ABSENT' : seed === value ? 'MATCH' : 'MISMATCH';
          if (result === 'MISMATCH') problems.push(`${rec.key}: ${field} nguồn "${value}" ≠ seed "${seed}"`);
          fields.push({ field, source: value, seed, result });
        };
        const fact = (f: FactField) => facts.find((x) => x.field === f)?.value;
        compare('address', fact('address'), rec.address);
        compare('scale', fact('scale'), rec.scale);
        compare('investor', fact('investor'), /^Chủ đầu tư: (.+)$/m.exec(rec.summary ?? '')?.[1]);
        compare('since', fact('since'), rec.operatingSince);
        const rawServices = fact('services');
        const parsed = parseProjectFacts(html).services;
        const same = parsed.length === rec.services.length && parsed.every((s) => rec.services.includes(s));
        if (!same) problems.push(`${rec.key}: dịch vụ nguồn [${parsed.join(', ')}] ≠ seed [${rec.services.join(', ')}]`);
        // The seed stores service AREAS (a relationship), not the free text: the original wording is not kept.
        fields.push({ field: 'services', source: rawServices, seed: rec.services.join(', '), result: rawServices === undefined ? 'SOURCE_ABSENT' : same ? 'WORDING_NORMALIZED' : 'MISMATCH' });
        const status = /\((đang|đã) vận hành\)/i.exec(titleOf(doc));
        compare('status', status ? `${status[1]!.toLowerCase()} vận hành` : undefined, /Trạng thái theo website cũ: (.+?) \(chưa xác nhận\)/.exec(rec.summary ?? '')?.[1]);
      }
      // Every distinct image of the source page (body + cover) must be committed in the record or pending with a reason.
      const featured = doc.featured_media ? mediaById.get(doc.featured_media) : undefined;
      const cover = featured ? normalizeImageUrl(featured.source_url) : bodyImgs[0];
      for (const url of new Set([...(cover ? [cover] : []), ...bodyImgs])) {
        const role: ProjectImageCheck['role'] = url === cover && bodyImgs.includes(url) ? 'cover+body' : url === cover ? 'cover' : 'body';
        const pending = pendingByUrl.get(url);
        const state: ProjectImageCheck['state'] = recordUrls.has(url) ? 'COMMITTED_IN_RECORD' : pending ? 'PENDING_RIGHTS' : 'NOT_IN_RECORD';
        if (state === 'NOT_IN_RECORD') problems.push(`${rec.key}: ảnh nguồn ${url} không có trong bản ghi cũng không nằm trong danh sách chờ duyệt`);
        images.push({ url, role, state, detail: pending ? `${pending.class}: ${pending.reason}` : state === 'COMMITTED_IN_RECORD' ? 'đã commit' : '' });
        if (i === 0 && url === cover) {
          coverOk = state === 'COMMITTED_IN_RECORD' ? mediaByKey.get(rec.images[0] ?? '')?.sourceUrls.includes(url) === true : state === 'PENDING_RIGHTS' && rec.images.length === 0;
        }
      }
    }
    if (!coverOk) problems.push(`${rec.key}: ảnh bìa trong seed không phải ảnh bìa của trang nguồn`);
    if (fields.length && fields.every((f) => f.field === 'status' || f.result === 'SOURCE_ABSENT')) {
      gaps.push({ class: 'SOURCE_ABSENT', detail: 'Trang nguồn không có địa điểm/quy mô/chủ đầu tư/năm/dịch vụ: chỉ có ảnh. Không suy diễn.' });
    }
    for (const img of images) if (img.state === 'PENDING_RIGHTS') gaps.push({ class: 'PRIVACY/RIGHTS_PENDING', detail: `Ảnh ${img.url}: ${img.detail}` });
    if (fields.some((f) => f.field === 'services' && f.result === 'WORDING_NORMALIZED')) {
      gaps.push({ class: 'SCHEMA_MISMATCH', detail: 'Dòng "Dịch vụ cung cấp" gốc được chuẩn hoá thành khu vực dịch vụ; câu chữ gốc không được giữ (mô hình hiện tại là quan hệ, không có trường văn bản).' });
    }
    return { key: rec.key, name: rec.name, sources, fields, proseLines, images, coverOk, gaps };
  });

  // ---- 3. photo ledger: every image URL the site's pages use, plus library-only media ---------------------------------
  const usedBy = new Map<string, Set<string>>();
  const use = (url: string, who: string) => usedBy.set(url, (usedBy.get(url) ?? new Set()).add(who));
  for (const d of docs) {
    for (const u of bodyImageUrls(d.content.rendered)) use(u, `${d.wpType}:${d.slug}`);
    const f = d.featured_media ? mediaById.get(d.featured_media) : undefined;
    if (f) use(normalizeImageUrl(f.source_url), `${d.wpType}:${d.slug}`);
  }
  const keyOfUrl = new Map<string, string>();
  for (const m of manifest.media) for (const u of m.sourceUrls) keyOfUrl.set(u, m.key);
  const unusedByUrl = new Map((manifest.unused ?? []).map((u) => [u.sourceUrl, u]));
  const seenKey = new Set<string>();
  const ledger: LedgerRow[] = [...usedBy.keys()].sort().map((url) => {
    const who = [...(usedBy.get(url) ?? [])].sort();
    const key = keyOfUrl.get(url);
    const pending = pendingByUrl.get(url);
    if (key) {
      const m = mediaByKey.get(key)!;
      const dup = seenKey.has(key);
      seenKey.add(key);
      return { url, status: dup ? 'COMMITTED_DUPLICATE_URL' : 'COMMITTED', class: m.class, reason: dup ? 'URL khác của cùng một tệp đã commit (cùng SHA-256)' : 'được phép commit', file: m.file, sha256: key.slice('sha256:'.length), usedBy: who };
    }
    if (pending) {
      const own = isOwnUpload(url);
      const status: LedgerStatus = !own ? 'EXTERNAL_HOST_NOT_FETCHED' : pending.sha256 === undefined ? 'UNFETCHABLE' : 'PENDING_RIGHTS';
      return { url, status, class: pending.class, reason: pending.reason, sha256: pending.sha256, usedBy: who };
    }
    const unusedEntry = unusedByUrl.get(url);
    if (unusedEntry) return { url, status: 'APPROVED_NOT_USED', class: '', reason: unusedEntry.reason, usedBy: who };
    problems.push(`Ảnh ${url} không có trong tệp commit lẫn danh sách chờ duyệt`);
    return { url, status: 'UNACCOUNTED', class: '', reason: 'không có trong manifest', usedBy: who };
  });

  // Re-hash every committed file: the audit does not trust the manifest alone.
  for (const m of manifest.media) {
    const bytes = readAsset(m.file);
    if (!bytes) problems.push(`Tệp ảnh đã commit bị thiếu: ${m.file}`);
    else if (`sha256:${sha256(bytes)}` !== m.key || bytes.length !== m.bytes) problems.push(`Tệp ảnh ${m.file} không khớp SHA-256/kích thước trong manifest`);
  }

  const parentSlug = new Map([...snapshot.posts, ...snapshot.pages].map((d) => [d.id, d.slug]));
  const used = new Set(usedBy.keys());
  const libraryOnly: LibraryOnlyRow[] = snapshot.media
    .map((m) => ({ id: m.id, url: normalizeImageUrl(m.source_url), parent: m.post || undefined }))
    .filter((m) => !used.has(m.url))
    .map((m) => ({ ...m, parentSlug: m.parent !== undefined ? parentSlug.get(m.parent) : undefined }));

  // ---- 4. reconciliation -----------------------------------------------------------------------------------------------
  const groups = new Map<string, number>();
  for (const r of matrix) {
    const group = `${r.target === 'none' ? 'không seed' : r.target.split('/')[0]} · ${r.textStatus}`;
    groups.set(group, (groups.get(group) ?? 0) + 1);
  }
  const count = (s: LedgerStatus) => ledger.filter((l) => l.status === s).length;
  const counts = {
    sourceDocuments: docs.length,
    inventoryRows: matrix.length,
    imageUrlsFound: ledger.length,
    committedUrls: count('COMMITTED') + count('COMMITTED_DUPLICATE_URL'),
    committedFiles: manifest.media.length,
    pendingRights: count('PENDING_RIGHTS'),
    externalHost: count('EXTERNAL_HOST_NOT_FETCHED'),
    unfetchable: count('UNFETCHABLE'),
    approvedNotUsed: count('APPROVED_NOT_USED'),
    unaccounted: count('UNACCOUNTED'),
    libraryOnly: libraryOnly.length,
  };
  const pendingTotal = counts.pendingRights + counts.externalHost + counts.unfetchable;
  for (const [what, got, want] of [
    ['URL ảnh tìm thấy', counts.imageUrlsFound, manifest.counts.imageUrlsFound],
    ['URL ảnh đã commit', counts.committedUrls, manifest.counts.imageUrlsCommitted],
    ['tệp ảnh đã commit', counts.committedFiles, manifest.counts.imagesCommitted],
    ['URL ảnh chờ duyệt', pendingTotal, manifest.counts.imagesPendingTotal],
  ] as const) {
    if (got !== want) problems.push(`${what}: audit đếm ${got}, manifest ghi ${want}`);
  }

  return {
    site: snapshot.site,
    observedAt: manifest.source.observedAt,
    wordpress: snapshot.wordpress,
    totals: {
      posts: snapshot.posts.length,
      pages: snapshot.pages.length,
      categories: snapshot.categories.length,
      sitemapUrls: snapshot.sitemapUrls.length,
      mediaListed: snapshot.media.length,
      mediaReported: input.mediaReported,
    },
    matrix,
    projects: projectAudits,
    ledger,
    libraryOnly,
    reconciliation: [...groups.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([group, rows]) => ({ group, rows })),
    counts,
    problems,
  };
}

// ---- rendering --------------------------------------------------------------------------------------------------------
const cell = (s: string | number | undefined) => String(s ?? '').replace(/\|/g, '\\|').replace(/\n/g, ' ');

export function renderAuditReport(a: AuditResult): string {
  const L: string[] = [];
  L.push('# Báo cáo đối chiếu nguồn WordPress ↔ seed Git (Issue #80)', '');
  L.push('> Tệp này do `pnpm seed:bmsl-legacy:audit` tạo ra (chỉ đọc, có mạng). Không sửa tay. Không chứa thân bài nguồn, chỉ có độ dài/SHA-256 và các dữ kiện dự án đã nằm sẵn trong seed.', '');
  L.push(`Nguồn: ${a.site} (WordPress ${a.wordpress}), seed quan sát ${a.observedAt}.`, '');
  L.push(
    `**Kết quả: ${a.problems.length === 0 ? 'không có sai lệch giữa nguồn và seed' : `${a.problems.length} sai lệch cần xử lý`}.** Điều này KHÔNG có nghĩa 100% nội dung đã sẵn sàng công khai: xem các nhóm chặn bên dưới.`,
    '',
  );
  if (a.problems.length) L.push(...a.problems.map((p) => `* ${p}`), '');

  const t = a.totals;
  L.push('## 1. Đối soát số lượng', '');
  L.push(
    `* REST công khai: ${t.posts} bài + ${t.pages} trang + ${t.categories} chuyên mục; sitemap ${t.sitemapUrls} URL; thư viện media liệt kê ${t.mediaListed}${t.mediaReported !== undefined ? ` (máy chủ báo ${t.mediaReported}: chênh ${t.mediaReported - t.mediaListed} tệp, thuộc bài không công khai, không đọc được khi ẩn danh)` : ''}.`,
  );
  L.push(`* Kiểm kê seed ${a.counts.inventoryRows} dòng; ${a.counts.sourceDocuments} tài liệu (bài + trang) công khai, tất cả phải có trong kiểm kê (thiếu thì liệt kê ở danh sách sai lệch).`);
  L.push('* Số bản ghi seed ít hơn số bài WordPress KHÔNG phải là mất nội dung: dự án (18 nguồn → 17 bản ghi), bài gộp vào trang giới thiệu, bài bị chặn, trang chủ rỗng, chuyên mục/tác giả chỉ là trang lưu trữ.', '');
  L.push('| Nhóm (đích · trạng thái) | Số dòng |', '| --- | --- |', ...a.reconciliation.map((r) => `| ${cell(r.group)} | ${r.rows} |`), '');

  L.push('## 2. Ma trận truy vết từng URL', '');
  L.push('Độ khớp: EXACT = văn bản seed khớp nguồn (trừ SĐT/email); FACTS_ONLY = trang dự án chỉ có dòng dữ kiện; MISSING = không có văn bản để seed (lý do ghi rõ); BLOCKED = có ở nguồn nhưng không được commit; DIFFERS = văn bản nguồn hiện tại khác bản ghi đã commit.', '');
  L.push('"Văn bản so với bản ghi đã commit" so văn bản nguồn hiện tại với đúng bản ghi trong Git (cùng quy tắc chuẩn hoá và che SĐT/email với generator), không chỉ so độ dài. Dòng không có văn bản được commit (bị chặn, dự án chỉ có dữ kiện, trang lưu trữ) chỉ so được độ dài (NOT_COMPARED); dự án được so từng trường ở mục 3.', '');
  L.push(
    '| Ref | URL cũ | Loại/ID | Tiêu đề | Ngày | Chuyên mục | Thân bài nguồn (ký tự · SHA-256 12) | Độ dài so với seed | Văn bản so với bản ghi đã commit | Ảnh nguồn / dòng seed | Đích | Độ khớp | Phân loại | Lý do |',
    '| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |',
  );
  for (const r of a.matrix) {
    const body = r.sourceBodyChars !== undefined ? `${r.sourceBodyChars} · ${r.sourceBodySha256!.slice(0, 12)}` : '';
    L.push(
      `| ${r.ref} | \`${cell(r.legacyPath)}\` | ${r.wpType}${r.wpId !== undefined ? ` #${r.wpId}` : ''} | ${cell(r.title)} | ${r.dateGmt?.slice(0, 10) ?? ''} | ${cell(r.categories.join(', '))} | ${body} | ${r.bodyCheck} | ${r.contentCheck} | ${r.imagesInSource ?? ''} / ${r.imagesInSeedRow} | ${cell(r.target)} | ${r.fidelity} | ${r.gap} | ${cell(r.reason)} |`,
    );
  }
  L.push('');

  L.push('## 3. Từng dự án: nguồn so với bản ghi seed', '');
  L.push(
    'Mỗi trang dự án nguồn chỉ gồm 1 ảnh và tối đa 5 dòng "Nhãn : giá trị"; không có đoạn mô tả dài (cột "Đoạn văn ngoài dòng dữ kiện" bằng 0 cho cả 17 dự án). Vì vậy không có căn cứ để thêm trường `body` vào `Projects`: không cần schema hay migration.',
    '',
  );
  for (const p of a.projects) {
    L.push(`### ${p.name} (\`${p.key}\`)`, '');
    L.push(`Nguồn: ${p.sources.map((s) => `${s.ref} (#${s.wpId}, ${s.bodyChars} ký tự, ${s.imagesInBody} ảnh)`).join('; ')}. Đoạn văn ngoài dòng dữ kiện: **${p.proseLines.length}**. Ảnh bìa đúng nguồn: **${p.coverOk ? 'có' : 'KHÔNG'}**.`, '');
    L.push('| Trường | Nguồn | Seed | Kết quả |', '| --- | --- | --- | --- |', ...p.fields.map((f) => `| ${f.field} | ${cell(f.source) || '—'} | ${cell(f.seed) || '—'} | ${f.result} |`), '');
    L.push('| Ảnh nguồn | Vai trò | Trạng thái | Chi tiết |', '| --- | --- | --- | --- |', ...p.images.map((i) => `| \`${cell(i.url)}\` | ${i.role} | ${i.state} | ${cell(i.detail)} |`), '');
    if (p.gaps.length) L.push(...p.gaps.map((g) => `* **${g.class}** — ${g.detail}`), '');
  }

  const c = a.counts;
  L.push('## 4. Sổ ảnh', '');
  L.push(
    `* ${c.imageUrlsFound} URL ảnh được các trang công khai dùng (thân bài + ảnh bìa) → ${c.committedUrls} URL đã commit (${c.committedFiles} tệp duy nhất; SHA-256 được băm lại từ tệp trong repo), ${c.approvedNotUsed} đã duyệt nhưng không bản ghi seed nào dùng (không commit), ${c.pendingRights} chờ duyệt quyền, ${c.externalHost} ở website bên thứ ba (không tải), ${c.unfetchable} không tải được, ${c.unaccounted} chưa được giải thích.`,
  );
  L.push(`* ${c.libraryOnly} tệp có trong thư viện media nhưng KHÔNG hiển thị ở trang công khai nào (\`LIBRARY_ONLY\`): chưa duyệt quyền nên không nằm trong Git.`);
  L.push('* Sổ đầy đủ từng URL (trạng thái, lý do, SHA-256, nơi dùng) nằm ở `docs/migration/w80-image-ledger.csv`.', '');
  const byClass = new Map<string, number>();
  for (const l of a.ledger) byClass.set(`${l.status} · ${l.class}`, (byClass.get(`${l.status} · ${l.class}`) ?? 0) + 1);
  L.push('| Trạng thái · loại | URL |', '| --- | --- |', ...[...byClass.entries()].sort(([x], [y]) => x.localeCompare(y)).map(([k, v]) => `| ${cell(k)} | ${v} |`), '');
  return `${L.join('\n')}\n`;
}

export function renderLedgerCsv(a: AuditResult): string {
  const q = (s: string | undefined) => `"${(s ?? '').replace(/"/g, '""')}"`;
  const libraryReason = 'có trong thư viện media nhưng không hiển thị ở trang công khai nào; chưa duyệt quyền, không commit';
  const rows = [
    ['url', 'status', 'class', 'sha256', 'committedFile', 'usedBy', 'reason'].join(','),
    ...a.ledger.map((l) => [q(l.url), l.status, l.class, l.sha256 ?? '', q(l.file), q(l.usedBy.join(' ')), q(l.reason)].join(',')),
    ...a.libraryOnly.map((m) => [q(m.url), 'LIBRARY_ONLY', '', '', '', q(m.parentSlug ? `attachment of ${m.parentSlug}` : m.parent ? `attachment of #${m.parent}` : 'unattached'), q(libraryReason)].join(',')),
  ];
  return `${rows.join('\n')}\n`;
}
