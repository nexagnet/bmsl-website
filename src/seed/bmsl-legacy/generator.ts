import { createHash } from 'node:crypto';
import articleCandidates from '../../migration/article-candidates.json';
import legacyManifest from '../../migration/legacy-manifest.json';
import { SERVICE_AREA_PLACEHOLDER_SUMMARY, SERVICE_AREA_SEED } from '../service-areas';
import { decodeEntities, type HNode, isElement, parseHtml, textOf } from './html';
import { sniffImage } from './image-meta';
import {
  type ConvertNote,
  type ConvertResult,
  EMAIL_PLACEHOLDER,
  htmlToLexical,
  isFilenameLikeAlt,
  type LexicalDoc,
  type LexNode,
  lexicalPlainText,
  PHONE_PLACEHOLDER,
} from './lexical';
import {
  type ArticleRecord,
  COMMITTED_IMAGE_CLASSES,
  type CommittedImageClass,
  type GlobalRecord,
  type InventoryRow,
  type Manifest,
  type MediaEntry,
  type MediaKey,
  mediaKeyOf,
  type NoteSummary,
  PACK_ID,
  PACK_VERSION,
  type Pack,
  type PendingMediaEntry,
  type ProjectRecord,
  type ServiceAreaRecord,
} from './pack';

// Pure pack builder: WordPress data in, committed seed pack out. It never touches the network or the disk: the
// caller injects the WordPress snapshot and an image fetcher (generate-cli.ts uses the real site, tests use fakes).
// Rights are decided only by review/image-review.json: an image that is not listed there stays PENDING (fail closed).

export type WpPost = {
  id: number;
  date_gmt: string;
  slug: string;
  status: string;
  title: { rendered: string };
  content: { rendered: string };
  excerpt?: { rendered: string };
  featured_media?: number;
  categories?: number[];
};
export type WpTerm = { id: number; slug: string; name: string };
export type WpMedia = { id: number; source_url: string; alt_text?: string };
export type WpSnapshot = {
  site: string;
  wordpress: string;
  posts: WpPost[];
  pages: WpPost[];
  categories: WpTerm[];
  media: WpMedia[];
  sitemapUrls: string[];
};
/** Returns the bytes of an OWN-HOST legacy image, or undefined when it cannot be fetched safely. */
export type ImageFetcher = (url: string) => Promise<Buffer | undefined>;

export type ReviewEntry = { url: string; decision: 'COMMIT' | 'PENDING'; class: string; reason: string };
export type ReviewFile = { images: ReviewEntry[] };

export type ContentBlock = { ref: string; class: 'OWNER_DECISION' | 'THIRD_PARTY_TEXT'; reason: string };
/** Posts whose TEXT must not enter the public repository; the row stays in the inventory with its reason. */
export type ContentReviewFile = { blocked: ContentBlock[] };

export type BuildInput = {
  snapshot: WpSnapshot;
  fetchImage: ImageFetcher;
  review: ReviewFile;
  contentReview: ContentReviewFile;
  observedAt: string;
};
export type BuildResult = { pack: Pack; assets: Map<string, Buffer>; report: string };

type ManifestEntry = (typeof legacyManifest.entries)[number];
type WpSource = WpPost & { wpType: 'post' | 'page' };
type RowBase = Pick<InventoryRow, 'target' | 'textStatus' | 'textFidelity' | 'bodyChars' | 'needs'>;
type Resolved = { kind: 'media'; key: MediaKey } | { kind: 'pending'; entry: PendingMediaEntry };

// ---- small helpers ---------------------------------------------------------------------------------------------------
const OWN_HOST = /(^|\.)binhminhsonglo\.vn$/;
const BLOCK_TAGS = new Set(['p', 'div', 'li', 'ul', 'ol', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'br', 'tr', 'figure', 'figcaption', 'table']);
const NO_IMAGES = { found: 0, committed: 0, pending: 0, external: 0 };

/** https, no query/hash, WordPress size suffix removed (`-300x200.jpg` -> `.jpg`): the key reviews are matched on. */
export function normalizeImageUrl(raw: string): string {
  const u = new URL(raw.trim(), 'https://binhminhsonglo.vn/');
  u.protocol = 'https:';
  u.hash = '';
  u.search = '';
  u.pathname = u.pathname.replace(/-\d+x\d+(\.\w+)$/, '$1');
  return u.toString();
}

const isOwnUpload = (url: string) => {
  const u = new URL(url);
  return OWN_HOST.test(u.hostname) && u.pathname.startsWith('/wp-content/uploads/');
};

const sha256Hex = (bytes: Buffer) => createHash('sha256').update(bytes).digest('hex');
const SPACES = new RegExp(`[\\s${String.fromCharCode(0xa0, 0x200b)}]+`, 'g');
const squash = (s: string) => s.replace(SPACES, ' ').trim();
const norm = (s: string) => squash(s.replace(/\n/g, ' '));
const cleanTitle = (html: string) => squash(decodeEntities(html.replace(/<[^>]+>/g, '')));

/** Visible text with block boundaries as newlines; scripts/styles/iframes excluded. */
export function plainTextOfHtml(html: string): string {
  const walk = (n: HNode): string => {
    if (!isElement(n)) return n.text;
    if (['script', 'style', 'iframe'].includes(n.tag)) return '';
    if (n.tag === 'br') return '\n';
    const inner = n.children.map(walk).join('');
    return BLOCK_TAGS.has(n.tag) ? `\n${inner}\n` : inner;
  };
  return parseHtml(html).map(walk).join('');
}

const stripPlaceholders = (s: string) => squash(s.split(PHONE_PLACEHOLDER).join('').split(EMAIL_PLACEHOLDER).join(''));
const stripContacts = (s: string) =>
  squash(
    s
      .replace(/(?<![\d])(?:\+?84|0)(?:[\s.-]?\d){8,10}(?!\d)/g, '')
      .replace(/[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g, '')
      .replace(/\[\/?[a-z_]+(?:\s[^\]]*)?\]/gi, ''),
  );

function fidelity(sourceHtml: string, doc: LexicalDoc): InventoryRow['textFidelity'] {
  const source = norm(plainTextOfHtml(sourceHtml));
  const seed = norm(lexicalPlainText(doc));
  if (source === seed) return 'EXACT';
  if (stripContacts(source) === stripPlaceholders(seed)) return 'EXACT_EXCEPT_REDACTIONS';
  return 'DIFFERS';
}

const summarizeNotes = (all: ConvertNote[]): NoteSummary[] => {
  const by = new Map<string, { count: number; details: Set<string> }>();
  for (const n of all) {
    const e = by.get(n.kind) ?? { count: 0, details: new Set<string>() };
    e.count += 1;
    if (n.detail) e.details.add(n.detail);
    by.set(n.kind, e);
  }
  return [...by.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([kind, e]) => ({ kind, count: e.count, ...(e.details.size ? { details: [...e.details].sort() } : {}) }));
};

const safeName = (url: string) =>
  (
    decodeURIComponent(new URL(url).pathname.split('/').pop() ?? 'image')
      .replace(/\.[a-z0-9]+$/i, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'image'
  ).slice(0, 50);

const FACT_LABELS: Record<string, 'address' | 'scale' | 'investor' | 'since' | 'services'> = {
  'địa điểm': 'address',
  'quy mô': 'scale',
  'số căn hộ': 'scale',
  'chủ đầu tư': 'investor',
  'năm thực hiện': 'since',
  'dịch vụ cung cấp': 'services',
};

export type ProjectFacts = {
  address?: string;
  scale?: string;
  investor?: string;
  since?: string;
  services: string[];
  unparsed: string[];
};

/**
 * Reads the "Label : value" paragraphs of a legacy project post. A `<br>` inside a paragraph is a space (a wrapped
 * address stays whole); paragraphs the parser does not understand are kept in `unparsed` (reported, never dropped).
 */
export function parseProjectFacts(html: string): ProjectFacts {
  const facts: ProjectFacts = { services: [], unparsed: [] };
  const paragraphs = parseHtml(html).flatMap((n) => (isElement(n) && n.tag !== 'img' ? [squash(textOf(n))] : []));
  for (const line of paragraphs) {
    if (!line) continue;
    const m = /^([^:]{3,25}?)\s*:\s*(.+)$/.exec(line);
    const kind = m ? FACT_LABELS[m[1]!.toLowerCase()] : undefined;
    if (!m || !kind) {
      facts.unparsed.push(line);
      continue;
    }
    const value = m[2]!.replace(/\.$/, '').trim();
    if (kind === 'services') {
      const lower = value.toLowerCase();
      if (/bảo vệ/.test(lower)) facts.services.push('bao-ve');
      if (/vệ sinh/.test(lower)) facts.services.push('ve-sinh');
      if (/pccc|phòng cháy/.test(lower)) facts.services.push('pccc');
      if (/quản lý|vận hành/.test(lower)) facts.services.push('quan-ly-van-hanh');
      if (!facts.services.length) facts.unparsed.push(line);
    } else facts[kind] = value;
  }
  return facts;
}

const operationStatusOf = (title: string) => {
  const m = /\((đang|đã) vận hành\)/i.exec(title);
  return m ? `${m[1]!.toLowerCase()} vận hành` : undefined;
};

const ARTICLE_SOURCE_IDS = [2, 3, 23, 24, 25, 26, 27, 29, 30, 31, 32, 33, 34, 35];
const ABOUT_SOURCE_IDS = [1, 28, 36];
const DEFAULT_ARTICLE_NEEDS = ['selection', 'content', 'category', 'image-rights', 'publication-approval'];

const text = (value: string): LexNode => ({ type: 'text', text: value, format: 0, detail: 0, mode: 'normal', style: '', version: 1 });

// ---- the builder -----------------------------------------------------------------------------------------------------
export async function buildPack(input: BuildInput): Promise<BuildResult> {
  const { snapshot, fetchImage, review, contentReview, observedAt } = input;
  const blocked = new Map(contentReview.blocked.map((b) => [b.ref, b]));
  const reviewByUrl = new Map(review.images.map((e) => [normalizeImageUrl(e.url), e]));

  // ---- index the WordPress snapshot ----------------------------------------------------------------------------------
  const bySlug = new Map<string, WpSource>();
  for (const p of snapshot.posts) bySlug.set(`post:${p.slug}`, { ...p, wpType: 'post' });
  for (const p of snapshot.pages) bySlug.set(`page:${p.slug}`, { ...p, wpType: 'page' });
  const termById = new Map(snapshot.categories.map((t) => [t.id, t]));
  const mediaById = new Map(snapshot.media.map((m) => [m.id, m]));
  const mediaAltByUrl = new Map(snapshot.media.map((m) => [normalizeImageUrl(m.source_url), m.alt_text ?? '']));
  const categorySlugs = (p: WpPost) => (p.categories ?? []).map((c) => termById.get(c)?.slug ?? String(c)).sort();

  const slugOfPath = (legacyPath: string) => decodeURIComponent(legacyPath.replace(/^\/|\/$/g, '').split('/').pop() ?? '');
  const entries: ManifestEntry[] = legacyManifest.entries;
  const entryById = new Map(entries.map((e) => [e.id, e]));
  const lookupKey = (e: ManifestEntry) => `${e.sourceType === 'page' ? 'page' : 'post'}:${e.legacyPath === '/' ? 'trang-chu' : slugOfPath(e.legacyPath)}`;
  const postForEntry = (e: ManifestEntry) => bySlug.get(lookupKey(e));
  const sourceFor = (id: number) => {
    const e = entryById.get(id);
    return e ? postForEntry(e) : undefined;
  };

  const known = new Set(entries.filter((e) => e.sourceType === 'post' || e.sourceType === 'page').map(lookupKey));
  const extras = [...bySlug.entries()]
    .filter(([k, p]) => !known.has(k) && p.status === 'publish')
    .map(([, p]) => p)
    .sort((a, b) => a.id - b.id);

  // ---- resolve every image once (download COMMIT ones, hash own-host PENDING ones, never fetch other hosts) ------------
  const urls = new Set<string>();
  const collect = (post: WpPost) => {
    const walk = (n: HNode) => {
      if (!isElement(n)) return;
      if (n.tag === 'img' && n.attrs.src) urls.add(normalizeImageUrl(n.attrs.src));
      n.children.forEach(walk);
    };
    parseHtml(post.content.rendered).forEach(walk);
    const featured = post.featured_media ? mediaById.get(post.featured_media) : undefined;
    if (featured) urls.add(normalizeImageUrl(featured.source_url));
  };
  [...entries.map(postForEntry).filter((p): p is WpSource => !!p), ...extras].forEach(collect);

  const assets = new Map<string, Buffer>();
  const mediaByKey = new Map<MediaKey, MediaEntry>();
  const resolved = new Map<string, Resolved>();
  const pending = new Map<string, PendingMediaEntry>();
  const setPending = (url: string, entry: PendingMediaEntry) => {
    pending.set(url, entry);
    resolved.set(url, { kind: 'pending', entry });
  };

  // Own-host images are fetched with a small fixed concurrency (the legacy server throttles bursts).
  const ownUrls = [...urls].filter(isOwnUpload).sort();
  const fetched = new Map<string, Buffer | undefined>();
  let nextUrl = 0;
  await Promise.all(
    Array.from({ length: Math.min(4, ownUrls.length) }, async () => {
      while (nextUrl < ownUrls.length) {
        const url = ownUrls[nextUrl++]!;
        fetched.set(url, await fetchImage(url));
      }
    }),
  );

  for (const url of [...urls].sort()) {
    const review1 =
      reviewByUrl.get(url) ??
      ({ url, decision: 'PENDING', class: 'UNREVIEWED', reason: 'Ảnh chưa được duyệt: mặc định chờ duyệt (fail closed).' } satisfies ReviewEntry);
    const base: PendingMediaEntry = { sourceUrl: url, class: review1.class, reason: review1.reason, usedBy: [] };
    if (!isOwnUpload(url)) {
      setPending(url, base);
      continue;
    }
    const bytes = fetched.get(url);
    const facts = bytes ? sniffImage(bytes) : undefined;
    if (!bytes || !facts) {
      setPending(url, { ...base, reason: `${review1.reason} (không tải được hoặc không đọc được ảnh)` });
      continue;
    }
    const sha = sha256Hex(bytes);
    const committable = review1.decision === 'COMMIT' && (COMMITTED_IMAGE_CLASSES as readonly string[]).includes(review1.class);
    if (!committable) {
      setPending(url, { ...base, sha256: sha, mime: facts.mime, bytes: bytes.length, width: facts.width, height: facts.height });
      continue;
    }
    const key = mediaKeyOf(sha);
    const existing = mediaByKey.get(key);
    if (existing) existing.sourceUrls.push(url);
    else {
      const file = `assets/${sha.slice(0, 12)}-${safeName(url)}.${facts.mime === 'image/png' ? 'png' : 'jpg'}`;
      mediaByKey.set(key, {
        key,
        file,
        sourceUrls: [url],
        mime: facts.mime,
        bytes: bytes.length,
        width: facts.width,
        height: facts.height,
        alt: '',
        altSource: 'derived',
        class: review1.class as CommittedImageClass,
        usedBy: [],
      });
      assets.set(file, bytes);
    }
    resolved.set(url, { kind: 'media', key });
  }

  // ---- conversion with usage tracking ---------------------------------------------------------------------------------
  const usage = new Map<MediaKey, { records: Set<string>; alts: string[]; titles: string[] }>();
  const noteAll = new Map<string, ConvertNote[]>();
  const imageStats = new Map<string, InventoryRow['images']>();
  const useMedia = (key: MediaKey, recordKey: string, post: WpPost, alts: string[]) => {
    const u = usage.get(key) ?? { records: new Set<string>(), alts: [], titles: [] };
    u.records.add(recordKey);
    u.titles.push(cleanTitle(post.title.rendered));
    for (const a of alts) if (a && !isFilenameLikeAlt(a)) u.alts.push(a);
    usage.set(key, u);
  };

  const convert = (post: WpPost, recordKey: string, rowKey: string, offset = 0): ConvertResult => {
    const stats = imageStats.get(rowKey) ?? { ...NO_IMAGES };
    imageStats.set(rowKey, stats);
    const result = htmlToLexical(post.content.rendered, {
      idSeed: `${recordKey}:${post.id}`,
      image: ({ src, alt }) => {
        const url = normalizeImageUrl(src);
        const r = resolved.get(url);
        stats.found += 1;
        if (r?.kind === 'media') {
          stats.committed += 1;
          useMedia(r.key, recordKey, post, [alt, mediaAltByUrl.get(url) ?? '']);
          return { kind: 'media', key: r.key };
        }
        if (isOwnUpload(url)) stats.pending += 1;
        else stats.external += 1;
        return { kind: 'pending' };
      },
    });
    for (const img of result.images) {
      const r = resolved.get(normalizeImageUrl(img.src));
      if (r?.kind === 'pending') r.entry.usedBy.push({ record: recordKey, blockIndex: img.blockIndex + offset });
    }
    noteAll.set(rowKey, [...(noteAll.get(rowKey) ?? []), ...result.notes]);
    return result;
  };

  const coverOf = (post: WpPost, recordKey: string): MediaKey | undefined => {
    const featured = post.featured_media ? mediaById.get(post.featured_media) : undefined;
    if (!featured) return undefined;
    const r = resolved.get(normalizeImageUrl(featured.source_url));
    if (r?.kind === 'media') {
      useMedia(r.key, recordKey, post, [featured.alt_text ?? '']);
      return r.key;
    }
    if (r?.kind === 'pending') r.entry.usedBy.push({ record: recordKey, blockIndex: null });
    return undefined;
  };

  // ---- inventory rows ----------------------------------------------------------------------------------------------------
  const inventory: InventoryRow[] = [];
  const rowFor = (e: ManifestEntry, rowBase: Partial<InventoryRow>): InventoryRow => {
    const post = postForEntry(e);
    return {
      ref: `legacy:${e.id}`,
      legacyPath: e.legacyPath,
      wpType: e.kind === 'category' ? 'category' : e.kind === 'author' ? 'author' : e.sourceType === 'page' ? 'page' : 'post',
      ...(post ? { wpId: post.id, title: cleanTitle(post.title.rendered), dateGmt: post.date_gmt, wpCategories: categorySlugs(post) } : {}),
      blueprintAction: e.action,
      target: { kind: 'none' },
      textStatus: 'NOT_PROVEN',
      images: { ...NO_IMAGES },
      needs: [],
      notes: [],
      ...rowBase,
    };
  };
  const finishRow = (row: InventoryRow, rowKey: string): InventoryRow => {
    const noted = noteAll.get(rowKey) ?? [];
    const redacted = noted.some((n) => n.kind.startsWith('redacted'));
    return {
      ...row,
      images: imageStats.get(rowKey) ?? row.images,
      notes: [...row.notes, ...summarizeNotes(noted)],
      needs: redacted && !row.needs.includes('official-contact-confirmation') ? [...row.needs, 'official-contact-confirmation'] : row.needs,
    };
  };

  // ---- service areas: four contracted names/slugs; only quan-ly-van-hanh has legacy text (#4, a suspected duplicate) ----
  const serviceAreas: ServiceAreaRecord[] = [];
  for (const area of SERVICE_AREA_SEED) {
    const key = `service-areas/${area.slug}`;
    const record: ServiceAreaRecord = { key, name: area.name, slug: area.slug, order: area.order, summary: SERVICE_AREA_PLACEHOLDER_SUMMARY, placeholder: true };
    const post = area.slug === 'quan-ly-van-hanh' && !blocked.has('legacy:4') ? sourceFor(4) : undefined;
    if (post) {
      const r = convert(post, key, 'legacy:4');
      const first = norm(lexicalPlainText(r.doc).split('\n').find((l) => l.trim()) ?? '');
      record.body = r.doc;
      record.summary = first.length > 280 ? `${first.slice(0, 277).replace(/\s+\S*$/, '')}…` : first || SERVICE_AREA_PLACEHOLDER_SUMMARY;
      record.placeholder = false;
    }
    serviceAreas.push(record);
  }

  // ---- projects: 17 canonical identities from the 47-entry manifest; facts are parsed, never invented -------------------
  const projects: ProjectRecord[] = [];
  for (const p of legacyManifest.projects) {
    const key = `projects/${p.slug}`;
    const projectEntries = entries.filter((e) => e.kind === 'project' && 'projectSlug' in e && e.projectSlug === p.slug).sort((a, b) => a.id - b.id);
    let facts: ProjectFacts | undefined;
    let status: string | undefined;
    const images: MediaKey[] = [];
    for (const [i, e] of projectEntries.entries()) {
      const post = postForEntry(e);
      const rowKey = `legacy:${e.id}`;
      if (!post) {
        inventory.push(rowFor(e, { target: { kind: 'projects', key }, textStatus: 'NOT_PROVEN', needs: ['source-not-found'] }));
        continue;
      }
      const r = convert(post, key, rowKey);
      const f = parseProjectFacts(post.content.rendered);
      if (!facts || (!facts.address && f.address)) facts = f;
      status ??= operationStatusOf(cleanTitle(post.title.rendered));
      for (const k of [coverOf(post, key), ...r.images.map((img) => (img.placement.kind === 'media' ? (img.placement.key as MediaKey) : undefined))]) {
        if (k && !images.includes(k)) images.push(k);
      }
      inventory.push(
        finishRow(
          rowFor(e, {
            target: { kind: 'projects', key },
            textStatus: i > 0 ? 'MERGED_INTO_TARGET' : 'SEEDED_FACTS_ONLY',
            textFidelity: 'NOT_APPLICABLE',
            bodyChars: norm(plainTextOfHtml(post.content.rendered)).length,
            needs: ['project-facts', 'image-rights', 'publication-approval'],
            notes: f.unparsed.length ? [{ kind: 'unparsed-lines', count: f.unparsed.length }] : [],
          }),
          rowKey,
        ),
      );
    }
    const summary = [
      facts?.investor ? `Chủ đầu tư: ${facts.investor}` : undefined,
      status ? `Trạng thái theo website cũ: ${status} (chưa xác nhận)` : undefined,
    ].filter((l): l is string => !!l);
    projects.push({
      key,
      name: p.name,
      slug: p.slug,
      ...(summary.length ? { summary: summary.join('\n') } : {}),
      ...(facts?.address ? { address: facts.address } : {}),
      ...(facts?.scale ? { scale: facts.scale } : {}),
      ...(facts?.since ? { operatingSince: facts.since } : {}),
      services: [...new Set(facts?.services ?? [])].sort(),
      images,
      legacyUrls: projectEntries.map((e) => e.legacyPath),
      sourceStatus: 'LEGACY-SOURCE',
    });
  }

  // ---- articles: blueprint candidates plus posts published after the 47-entry inventory was drawn up -----------------------
  const candidateNeeds = new Map(articleCandidates.candidates.map((c) => [c.manifestId, c.approvalsRequired]));
  const articles: ArticleRecord[] = [];
  const excerptOf = (post: WpPost) => {
    const t = norm(plainTextOfHtml(post.excerpt?.rendered ?? '')).replace(/\s*(\[…\]|\[&hellip;\]|…|\.\.\.)$/, '');
    if (t.length < 20) return undefined;
    return t.length > 300 ? `${t.slice(0, 297).replace(/\s+\S*$/, '')}…` : t;
  };
  const buildArticle = (post: WpPost, rowKey: string, e?: ManifestEntry): RowBase => {
    const key = `articles/${post.slug}`;
    const r = convert(post, key, rowKey);
    const cover = coverOf(post, key);
    const excerpt = excerptOf(post);
    articles.push({
      key,
      title: cleanTitle(post.title.rendered),
      slug: post.slug,
      ...(excerpt ? { excerpt } : {}),
      body: r.doc,
      ...(cover ? { cover } : {}),
      publishedAt: new Date(`${post.date_gmt}Z`).toISOString(),
      legacyUrl: e ? e.legacyPath : `/${post.slug}/`,
    });
    return {
      target: { kind: 'articles', key },
      textStatus: r.notes.some((n) => n.kind.startsWith('redacted')) ? 'SEEDED_REDACTED' : 'SEEDED',
      textFidelity: fidelity(post.content.rendered, r.doc),
      bodyChars: norm(plainTextOfHtml(post.content.rendered)).length,
      needs: [...((e && candidateNeeds.get(e.id)) || DEFAULT_ARTICLE_NEEDS)],
    };
  };
  for (const id of ARTICLE_SOURCE_IDS) {
    const e = entryById.get(id)!;
    const post = postForEntry(e);
    const rowKey = `legacy:${id}`;
    if (blocked.has(rowKey)) continue;
    inventory.push(post ? finishRow(rowFor(e, buildArticle(post, rowKey, e)), rowKey) : rowFor(e, { needs: ['source-not-found'] }));
  }
  for (const post of extras) {
    const ref = `extra:${post.id}`;
    if (blocked.has(ref)) continue;
    const common = {
      ref,
      legacyPath: `/${post.slug}/`,
      wpType: post.wpType,
      wpId: post.id,
      title: cleanTitle(post.title.rendered),
      dateGmt: post.date_gmt,
      wpCategories: categorySlugs(post),
      // Published on the legacy site after the 47-entry inventory: redirects are untouched, the mapping is an owner decision.
      blueprintAction: 'NOT_IN_47_INVENTORY',
      images: { ...NO_IMAGES },
      notes: [],
    };
    const rowBase: RowBase =
      post.wpType === 'post' ? buildArticle(post, ref) : { target: { kind: 'none' }, textStatus: 'NOT_PROVEN', needs: [] };
    inventory.push(finishRow({ ...common, ...rowBase, needs: [...rowBase.needs, 'owner-decision-mapping', 'redirect-not-in-47-inventory'] }, ref));
  }

  // ---- globals: about-page (#1 + #28 office + #36 structure) and contact-page (#38, contact data redacted) ---------------
  const globals: GlobalRecord[] = [];
  {
    const key = 'globals/about-page';
    const children: LexNode[] = [];
    let title = '';
    for (const id of ABOUT_SOURCE_IDS) {
      const e = entryById.get(id)!;
      const post = postForEntry(e);
      const rowKey = `legacy:${id}`;
      if (!post) {
        inventory.push(rowFor(e, { needs: ['source-not-found'] }));
        continue;
      }
      const postTitle = cleanTitle(post.title.rendered);
      let offset = children.length;
      if (id === 1) title = postTitle;
      else {
        // The section heading is the original post title (source text); a numeric WordPress title gets a neutral label.
        const heading = /^\d+(-\d+)?$/.test(postTitle) ? 'Văn phòng công ty' : postTitle;
        children.push({ type: 'heading', tag: 'h2', format: '', indent: 0, version: 1, direction: 'ltr', children: [text(heading)] });
        offset = children.length;
      }
      const r = convert(post, key, rowKey, offset);
      children.push(...r.doc.root.children);
      inventory.push(
        finishRow(
          rowFor(e, {
            target: { kind: 'about-page', key },
            textStatus: id === 1 ? (r.notes.some((n) => n.kind.startsWith('redacted')) ? 'SEEDED_REDACTED' : 'SEEDED') : 'MERGED_INTO_TARGET',
            textFidelity: fidelity(post.content.rendered, r.doc),
            bodyChars: norm(plainTextOfHtml(post.content.rendered)).length,
            needs: ['content-approval', 'legal-claims-confirmation', 'image-rights'],
          }),
          rowKey,
        ),
      );
    }
    globals.push({ key, slug: 'about-page', title, body: { root: { type: 'root', format: '', indent: 0, version: 1, direction: 'ltr', children } } });
  }
  {
    const key = 'globals/contact-page';
    const e = entryById.get(38)!;
    const post = postForEntry(e);
    if (post) {
      const r = convert(post, key, 'legacy:38');
      globals.push({ key, slug: 'contact-page', title: cleanTitle(post.title.rendered), body: r.doc });
      inventory.push(
        finishRow(
          rowFor(e, {
            target: { kind: 'contact-page', key },
            textStatus: 'SEEDED_REDACTED',
            textFidelity: fidelity(post.content.rendered, r.doc),
            bodyChars: norm(plainTextOfHtml(post.content.rendered)).length,
            needs: ['official-contact-confirmation'],
          }),
          'legacy:38',
        ),
      );
    }
  }

  // ---- remaining canonical entries: service #4 (merged), blocked #33, home, taxonomies, author -----------------------------
  const covered = new Set(inventory.map((r) => r.ref));
  for (const e of entries) {
    const ref = `legacy:${e.id}`;
    if (covered.has(ref)) continue;
    const post = postForEntry(e);
    const block = blocked.get(ref);
    if (e.id === 4 && post && !block) {
      const area = serviceAreas.find((s) => s.slug === 'quan-ly-van-hanh')!;
      inventory.push(
        finishRow(
          rowFor(e, {
            target: { kind: 'service-areas', key: area.key },
            textStatus: 'MERGED_INTO_TARGET',
            textFidelity: area.body ? fidelity(post.content.rendered, area.body) : 'NOT_APPLICABLE',
            bodyChars: norm(plainTextOfHtml(post.content.rendered)).length,
            needs: ['content-approval', 'duplicate-check', 'image-rights'],
          }),
          ref,
        ),
      );
    } else if (block && post) {
      // The text is NOT committed. Only inventory metadata (title, date, categories, counts) and the reason stay.
      const stats = { ...NO_IMAGES };
      const walk = (n: HNode) => {
        if (!isElement(n)) return;
        if (n.tag === 'img' && n.attrs.src) {
          const r = resolved.get(normalizeImageUrl(n.attrs.src));
          stats.found += 1;
          if (r?.kind === 'pending') {
            stats[isOwnUpload(normalizeImageUrl(n.attrs.src)) ? 'pending' : 'external'] += 1;
            r.entry.usedBy.push({ record: ref, blockIndex: null });
          }
        }
        n.children.forEach(walk);
      };
      parseHtml(post.content.rendered).forEach(walk);
      imageStats.set(ref, stats);
      inventory.push(
        finishRow(
          rowFor(e, {
            textStatus: block.class === 'OWNER_DECISION' ? 'BLOCKED_OWNER_DECISION' : 'BLOCKED_THIRD_PARTY_TEXT',
            textFidelity: 'NOT_APPLICABLE',
            bodyChars: norm(plainTextOfHtml(post.content.rendered)).length,
            needs: block.class === 'OWNER_DECISION' ? ['owner-decision-republish', 'personal-data-consent'] : ['republication-licence-or-owner-decision', 'image-rights'],
            notes: [{ kind: 'text-not-committed', count: 1, details: [block.reason] }],
          }),
          ref,
        ),
      );
    } else if (e.kind === 'category' || e.kind === 'author') {
      inventory.push(
        rowFor(e, { textStatus: 'TAXONOMY_NOT_SEEDED', textFidelity: 'NOT_APPLICABLE', needs: e.kind === 'category' ? ['category-taxonomy-approval'] : [] }),
      );
    } else if (e.legacyPath === '/') {
      inventory.push(
        rowFor(e, { textStatus: 'NO_SOURCE_BODY', textFidelity: 'NOT_APPLICABLE', needs: ['home-copy-from-owner'], notes: [{ kind: 'wordpress-page-body-empty', count: 1 }] }),
      );
    } else {
      inventory.push(rowFor(e, { needs: ['source-not-found'] }));
    }
  }
  inventory.sort((a, b) => {
    const rank = (r: InventoryRow) => (r.ref.startsWith('legacy:') ? 0 : 1);
    return rank(a) - rank(b) || Number(a.ref.split(':')[1]) - Number(b.ref.split(':')[1]);
  });

  // ---- finalize media (alt text, usage) and the pending list --------------------------------------------------------------
  const media: MediaEntry[] = [...mediaByKey.values()].sort((a, b) => a.key.localeCompare(b.key));
  for (const m of media) {
    const u = usage.get(m.key);
    m.usedBy = [...(u?.records ?? [])].sort();
    if (u?.alts[0]) {
      m.alt = u.alts[0];
      m.altSource = 'source';
    } else {
      const project = projects.find((p) => p.images.includes(m.key));
      const title = (u?.titles[0] ?? 'website cũ').slice(0, 120);
      m.alt = m.class === 'BRAND' ? 'Logo BMSL — Bình Minh Sông Lô' : project ? `Ảnh dự án ${project.name}` : `Hình ảnh trong bài “${title}”`;
      m.altSource = 'derived';
    }
  }
  const pendingMedia = [...pending.values()]
    .map((p) => ({ ...p, usedBy: [...p.usedBy].sort((a, b) => a.record.localeCompare(b.record) || (a.blockIndex ?? -1) - (b.blockIndex ?? -1)) }))
    .sort((a, b) => a.sourceUrl.localeCompare(b.sourceUrl));

  // ---- sitemap cross-check and counts ---------------------------------------------------------------------------------------
  const inventoryPaths = new Set(inventory.map((r) => r.legacyPath.replace(/\/$/, '')));
  const sitemapMissing = snapshot.sitemapUrls
    .map((u) => new URL(u).pathname.replace(/\/$/, ''))
    .filter((p) => !inventoryPaths.has(p))
    .sort();
  const pendingOf = (...classes: string[]) => pendingMedia.filter((p) => classes.includes(p.class)).length;
  const counts: Record<string, number> = {
    inventoryRows: inventory.length,
    canonicalLegacyRows: inventory.filter((r) => r.ref.startsWith('legacy:')).length,
    extraRows: inventory.filter((r) => r.ref.startsWith('extra:')).length,
    projects: projects.length,
    articles: articles.length,
    serviceAreas: serviceAreas.length,
    globals: globals.length,
    imageUrlsFound: urls.size,
    imagesCommitted: media.length,
    imageUrlsCommitted: media.reduce((n, m) => n + m.sourceUrls.length, 0),
    imagesPendingTotal: pendingMedia.length,
    imagesPendingPerson: pendingOf('PERSON'),
    imagesPendingThirdParty: pendingOf('THIRD_PARTY', 'THIRD_PARTY_HOST'),
    imagesPendingDocument: pendingOf('DOCUMENT'),
    imagesPendingUnreviewed: pendingOf('UNREVIEWED'),
    committedBytes: media.reduce((n, m) => n + m.bytes, 0),
  };

  const manifest: Manifest = {
    pack: PACK_ID,
    version: PACK_VERSION,
    source: {
      site: new URL(snapshot.site).origin,
      observedAt,
      wordpress: snapshot.wordpress,
      sitemap: { urls: snapshot.sitemapUrls.length, notInInventory: sitemapMissing },
    },
    rules: [
      'Every record is a DRAFT; projects are LEGACY-SOURCE; media rights are UNCONFIRMED; globals are unpublished drafts.',
      'Contact phone numbers and e-mail addresses are redacted from all text; they are inventoried by count only.',
      'Only images classified BRAND/GRAPHIC/OBJECT/PROJECT_PHOTO in review/image-review.json are committed; all others stay pending with their reason.',
      'Facts (scale, address, status, licences, history) come from the legacy site and are not confirmed.',
    ],
    counts,
    inventory,
    media,
    pendingMedia,
  };
  const pack: Pack = { manifest, serviceAreas, projects, articles, globals };
  return { pack, assets, report: renderReport(pack) };
}

// ---- human-readable report --------------------------------------------------------------------------------------------
const cell = (s: string) => s.replace(/\|/g, '\\|').replace(/\n/g, ' ');

export function renderReport(pack: Pack): string {
  const { manifest } = pack;
  const c = manifest.counts;
  const lines: string[] = [
    '# Báo cáo seed pack nội dung WordPress cũ (Issue #75)',
    '',
    '> Tệp này do `pnpm seed:bmsl-legacy:generate` tạo ra từ `src/seed/bmsl-legacy/manifest.json`. Không sửa tay.',
    '',
    `Nguồn: ${manifest.source.site} (WordPress ${manifest.source.wordpress}), quan sát ${manifest.source.observedAt}.`,
    '',
    '## Tổng hợp',
    '',
    `* Dòng kiểm kê: **${c.inventoryRows}** = ${c.canonicalLegacyRows} URL của bộ 47 (giữ nguyên) + ${c.extraRows} mục mới trên site cũ chưa có trong bộ 47.`,
    `* Bản ghi seed: ${c.projects} dự án (từ 18 nguồn), ${c.articles} bài viết nháp, ${c.serviceAreas} lĩnh vực dịch vụ, ${c.globals} trang (about-page, contact-page).`,
    `* Ảnh: ${c.imageUrlsFound} URL ảnh trong thân bài/ảnh bìa → **${c.imagesCommitted} tệp duy nhất được commit** (${c.imageUrlsCommitted} URL, ${(c.committedBytes! / 1e6).toFixed(1)} MB); **${c.imagesPendingTotal} URL chờ duyệt**: ${c.imagesPendingPerson} có người nhận diện được, ${c.imagesPendingThirdParty} bên thứ ba, ${c.imagesPendingDocument} tài liệu có chữ ký, ${c.imagesPendingUnreviewed} chưa duyệt.`,
    `* Sitemap: ${manifest.source.sitemap.urls} URL; URL không có trong kiểm kê: ${manifest.source.sitemap.notInInventory.length ? manifest.source.sitemap.notInInventory.map((p) => `\`${p}\``).join(', ') : 'không có'}.`,
    '',
    '## Từng URL → đích CMS',
    '',
    '| Ref | URL cũ | Tiêu đề (nguồn) | Đích CMS | Văn bản | Độ khớp | Ảnh: tìm thấy / commit / chờ / ngoài | Cần BMSL duyệt |',
    '| --- | --- | --- | --- | --- | --- | --- | --- |',
  ];
  for (const r of manifest.inventory) {
    lines.push(
      `| ${r.ref} | \`${cell(r.legacyPath)}\` | ${cell(r.title ?? '')} | ${r.target.kind}${r.target.key ? ` (\`${r.target.key}\`)` : ''} | ${r.textStatus} | ${r.textFidelity ?? ''} | ${r.images.found} / ${r.images.committed} / ${r.images.pending} / ${r.images.external} | ${cell(r.needs.join(', '))} |`,
    );
  }
  lines.push('', '## Phần bị loại hoặc chỉnh khi chuyển đổi', '');
  const noted = manifest.inventory.filter((r) => r.notes.length);
  if (!noted.length) lines.push('Không có.');
  for (const r of noted) lines.push(`* ${r.ref}: ${r.notes.map((n) => `${n.kind}×${n.count}${n.details ? ` (${n.details.join(', ')})` : ''}`).join('; ')}`);
  lines.push('', '## Ảnh chờ duyệt theo lý do', '', '| Loại | Số URL |', '| --- | --- |');
  const byClass = new Map<string, number>();
  for (const p of manifest.pendingMedia) byClass.set(p.class, (byClass.get(p.class) ?? 0) + 1);
  for (const [k, v] of [...byClass.entries()].sort()) lines.push(`| ${k} | ${v} |`);
  return `${lines.join('\n')}\n`;
}
