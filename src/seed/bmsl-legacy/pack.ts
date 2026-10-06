import { createHash } from 'node:crypto';
import { isPublicSlug } from '../../lib/seo';
import { uploadProblem } from '../../lib/upload-policy';
import { sniffImage } from './image-meta';
import { MEDIA_KEY_FIELD, type LexNode, type LexicalDoc } from './lexical';

// Shape and integrity rules of the committed seed pack (`src/seed/bmsl-legacy/`). The pack is data: normalized
// records, a provenance manifest and the authorized image bytes. The generator writes it, the loader reads it,
// the tests re-check it. Nothing here talks to a database, WordPress or the network.

export const PACK_ID = 'bmsl-legacy';
export const PACK_VERSION = 1;
export const MAX_ASSET_BYTES = 10 * 1024 * 1024;

/** Image classes that may be committed; everything else stays pending (see review/image-review.json). */
export const COMMITTED_IMAGE_CLASSES = ['BRAND', 'GRAPHIC', 'OBJECT', 'PROJECT_PHOTO'] as const;
export type CommittedImageClass = (typeof COMMITTED_IMAGE_CLASSES)[number];

export type MediaKey = `sha256:${string}`;
export const mediaKeyOf = (sha256: string): MediaKey => `sha256:${sha256}`;

export type MediaEntry = {
  key: MediaKey;
  /** Path relative to the pack directory, always `assets/<name>`. */
  file: string;
  sourceUrls: string[];
  mime: 'image/jpeg' | 'image/png';
  bytes: number;
  width: number;
  height: number;
  alt: string;
  /** `source` = alt text written on the legacy site; `derived` = generated from the record title (not source text). */
  altSource: 'source' | 'derived';
  class: CommittedImageClass;
  usedBy: string[];
};

export type PendingMediaEntry = {
  sourceUrl: string;
  /** Hash of the bytes the legacy site served at review time (own-host files only; external hosts are never fetched). */
  sha256?: string;
  mime?: string;
  bytes?: number;
  width?: number;
  height?: number;
  class: string;
  reason: string;
  usedBy: { record: string; blockIndex: number | null }[];
};

export type NoteSummary = { kind: string; count: number; details?: string[] };

export type InventoryRow = {
  /** `legacy:<n>` = one of the 47 canonical inventory entries, `extra:<wp id>` = found on the site afterwards. */
  ref: string;
  legacyPath: string;
  wpType: 'post' | 'page' | 'category' | 'author';
  wpId?: number;
  title?: string;
  dateGmt?: string;
  wpCategories?: string[];
  blueprintAction?: string;
  target: { kind: 'projects' | 'articles' | 'about-page' | 'contact-page' | 'service-areas' | 'none'; key?: string };
  textStatus:
    | 'SEEDED'
    | 'SEEDED_REDACTED'
    | 'SEEDED_FACTS_ONLY'
    | 'MERGED_INTO_TARGET'
    | 'BLOCKED_OWNER_DECISION'
    | 'BLOCKED_THIRD_PARTY_TEXT'
    | 'NO_SOURCE_BODY'
    | 'TAXONOMY_NOT_SEEDED'
    | 'NOT_PROVEN';
  textFidelity?: 'EXACT' | 'EXACT_EXCEPT_REDACTIONS' | 'DIFFERS' | 'NOT_APPLICABLE';
  bodyChars?: number;
  images: { found: number; committed: number; pending: number; external: number };
  needs: string[];
  notes: NoteSummary[];
};

export type Manifest = {
  pack: typeof PACK_ID;
  version: typeof PACK_VERSION;
  source: { site: string; observedAt: string; wordpress: string; sitemap: { urls: number; notInInventory: string[] } };
  rules: string[];
  counts: Record<string, number>;
  inventory: InventoryRow[];
  media: MediaEntry[];
  pendingMedia: PendingMediaEntry[];
  /** Reviewed-as-COMMIT images that no seeded record references: not committed. */
  unused?: { sourceUrl: string; reason: string }[];
};

export type ServiceAreaRecord = {
  key: string;
  name: string;
  slug: string;
  order: number;
  summary: string;
  body?: LexicalDoc;
  /** True when the legacy site has no text for this area: the summary is the shared UNCONFIRMED placeholder. */
  placeholder: boolean;
};

export type ProjectRecord = {
  key: string;
  name: string;
  slug: string;
  summary?: string;
  address?: string;
  scale?: string;
  operatingSince?: string;
  /** Service-area slugs. */
  services: string[];
  /** Media keys; the first one is the cover photo of the legacy post. */
  images: MediaKey[];
  legacyUrls: string[];
  sourceStatus: 'LEGACY-SOURCE';
};

export type ArticleRecord = {
  key: string;
  title: string;
  slug: string;
  excerpt?: string;
  body: LexicalDoc;
  cover?: MediaKey;
  publishedAt?: string;
  legacyUrl: string;
};

export type GlobalRecord = {
  key: string;
  slug: 'about-page' | 'contact-page';
  title: string;
  body: LexicalDoc;
};

export type Pack = {
  manifest: Manifest;
  serviceAreas: ServiceAreaRecord[];
  projects: ProjectRecord[];
  articles: ArticleRecord[];
  globals: GlobalRecord[];
};

export const PACK_FILES = {
  manifest: 'manifest.json',
  serviceAreas: 'records/service-areas.json',
  projects: 'records/projects.json',
  articles: 'records/articles.json',
  globals: 'records/globals.json',
} as const;

const ALLOWED_KEYS = {
  serviceArea: ['key', 'name', 'slug', 'order', 'summary', 'body', 'placeholder'],
  project: ['key', 'name', 'slug', 'summary', 'address', 'scale', 'operatingSince', 'services', 'images', 'legacyUrls', 'sourceStatus'],
  article: ['key', 'title', 'slug', 'excerpt', 'body', 'cover', 'publishedAt', 'legacyUrl'],
  global: ['key', 'slug', 'title', 'body'],
} as const;

const SAFE_ASSET = /^assets\/[a-z0-9][a-z0-9._-]{0,100}\.(jpg|png)$/;
const PHONE = /(?<![\d])(?:\+?84|0)(?:[\s.-]?\d){8,10}(?!\d)/;
const EMAIL = /[\w.+-]+@[\w-]+(?:\.[\w-]+)+/;

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

/** Every node of a Lexical document, depth first. */
export function* lexicalNodes(doc: unknown): Generator<LexNode> {
  const visit = function* (n: unknown): Generator<LexNode> {
    if (!isRecord(n)) return;
    yield n;
    if (Array.isArray(n.children)) for (const child of n.children) yield* visit(child);
  };
  if (isRecord(doc) && isRecord(doc.root)) yield* visit(doc.root);
}

/** Media keys used by `upload` nodes of a document, in document order. */
export const uploadKeysOf = (doc: unknown): string[] => {
  const keys: string[] = [];
  for (const n of lexicalNodes(doc)) if (n.type === 'upload' && isRecord(n.value)) keys.push(String(n.value[MEDIA_KEY_FIELD]));
  return keys;
};

const sha256Hex = (bytes: Buffer) => createHash('sha256').update(bytes).digest('hex');

export type AssetReader = (file: string) => Buffer | undefined;

/**
 * Integrity problems of a pack (empty = valid). Strict on purpose: unknown keys are refused so a record can never
 * carry `_status`, `sourceStatus: CONFIRMED`, `rightsStatus: APPROVED` or any other approval into the CMS.
 */
export function packProblems(pack: Pack, readAsset: AssetReader): string[] {
  const problems: string[] = [];
  const add = (message: string) => problems.length < 200 && problems.push(message);
  const { manifest } = pack;

  if (manifest.pack !== PACK_ID || manifest.version !== PACK_VERSION) add(`manifest pack/version must be ${PACK_ID}@${PACK_VERSION}`);

  // ---- media ----------------------------------------------------------------------------------------------------
  const media = new Map<string, MediaEntry>();
  for (const m of manifest.media) {
    if (media.has(m.key)) add(`duplicate media key ${m.key}`);
    media.set(m.key, m);
    if (!(COMMITTED_IMAGE_CLASSES as readonly string[]).includes(m.class)) add(`media ${m.key}: class ${m.class} may not be committed`);
    if (!SAFE_ASSET.test(m.file) || m.file.includes('..')) {
      add(`media ${m.key}: unsafe file path ${m.file}`);
      continue;
    }
    const bytes = readAsset(m.file);
    if (!bytes) {
      add(`media ${m.key}: file ${m.file} is missing`);
      continue;
    }
    if (bytes.length > MAX_ASSET_BYTES) add(`media ${m.key}: larger than ${MAX_ASSET_BYTES} bytes`);
    if (bytes.length !== m.bytes) add(`media ${m.key}: size ${bytes.length} differs from manifest ${m.bytes}`);
    if (m.key !== mediaKeyOf(sha256Hex(bytes))) add(`media ${m.key}: SHA-256 of ${m.file} does not match its key`);
    const facts = sniffImage(bytes);
    if (!facts) add(`media ${m.key}: ${m.file} is not a readable JPEG/PNG`);
    else if (facts.mime !== m.mime || facts.width !== m.width || facts.height !== m.height) add(`media ${m.key}: type/size differs from the bytes`);
    const problem = uploadProblem(m.file.split('/').pop(), m.mime, bytes);
    if (problem) add(`media ${m.key}: ${problem}`);
    if (!m.alt.trim()) add(`media ${m.key}: alt text is empty`);
    for (const url of m.sourceUrls) {
      try {
        const u = new URL(url);
        if (u.protocol !== 'https:' || !/^(www\.)?binhminhsonglo\.vn$/.test(u.hostname)) add(`media ${m.key}: source URL host not allowed (${u.hostname})`);
      } catch {
        add(`media ${m.key}: invalid source URL`);
      }
    }
  }
  for (const p of manifest.pendingMedia) if ('file' in p) add(`pending media ${p.sourceUrl} must not carry a file`);

  // ---- records ----------------------------------------------------------------------------------------------------
  const keys = new Set<string>();
  const slugs = { serviceAreas: new Set<string>(), projects: new Set<string>(), articles: new Set<string>() };
  const checkKeys = (record: object, allowed: readonly string[], label: string) => {
    for (const k of Object.keys(record)) if (!allowed.includes(k)) add(`${label}: unknown field "${k}"`);
  };
  const checkBody = (doc: LexicalDoc | undefined, label: string) => {
    if (!doc) return;
    const text: string[] = [];
    for (const n of lexicalNodes(doc)) {
      if (n.type === 'text') text.push(String(n.text));
      if (n.type === 'upload') {
        if (n.relationTo !== 'media-assets') add(`${label}: upload node must relate to media-assets`);
        const v = n.value;
        const key = isRecord(v) ? v[MEDIA_KEY_FIELD] : undefined;
        if (typeof key !== 'string' || !media.has(key)) add(`${label}: upload node references unknown media (${String(key)})`);
      }
      if (n.type === 'link') {
        const url = isRecord(n.fields) ? String(n.fields.url ?? '') : '';
        if (!/^https?:\/\//i.test(url)) add(`${label}: link with unsafe URL`);
      }
      if (!['root', 'paragraph', 'heading', 'list', 'listitem', 'text', 'linebreak', 'link', 'upload'].includes(String(n.type))) {
        add(`${label}: node type ${String(n.type)} is not allowed`);
      }
    }
    const joined = text.join('\n');
    if (PHONE.test(joined) || EMAIL.test(joined)) add(`${label}: contains a phone number or e-mail address`);
    if (/<\s*(script|iframe|style)\b|javascript:/i.test(JSON.stringify(doc))) add(`${label}: contains active content`);
  };
  const checkIdentity = (kind: 'serviceAreas' | 'projects' | 'articles', record: { key: string; slug: string }, label: string) => {
    if (keys.has(record.key)) add(`${label}: duplicate key`);
    keys.add(record.key);
    if (!isPublicSlug(record.slug)) add(`${label}: slug is not a safe public slug`);
    if (slugs[kind].has(record.slug)) add(`${label}: duplicate slug`);
    slugs[kind].add(record.slug);
  };

  for (const r of pack.serviceAreas) {
    checkKeys(r, ALLOWED_KEYS.serviceArea, `service-area ${r.slug}`);
    checkIdentity('serviceAreas', r, `service-area ${r.slug}`);
    checkBody(r.body, `service-area ${r.slug}`);
  }
  for (const r of pack.projects) {
    const label = `project ${r.slug}`;
    checkKeys(r, ALLOWED_KEYS.project, label);
    checkIdentity('projects', r, label);
    if (r.sourceStatus !== 'LEGACY-SOURCE') add(`${label}: sourceStatus must be LEGACY-SOURCE`);
    for (const s of r.services) if (!slugs.serviceAreas.has(s)) add(`${label}: unknown service area ${s}`);
    for (const k of r.images) if (!media.has(k)) add(`${label}: unknown image ${k}`);
    if (!r.legacyUrls.length) add(`${label}: no legacy URL`);
    const facts = [r.summary, r.address, r.scale, r.operatingSince].filter(Boolean).join('\n');
    if (PHONE.test(facts) || EMAIL.test(facts)) add(`${label}: contains a phone number or e-mail address`);
  }
  for (const r of pack.articles) {
    const label = `article ${r.slug}`;
    checkKeys(r, ALLOWED_KEYS.article, label);
    checkIdentity('articles', r, label);
    checkBody(r.body, label);
    if (r.cover && !media.has(r.cover)) add(`${label}: unknown cover ${r.cover}`);
    if (r.publishedAt && Number.isNaN(Date.parse(r.publishedAt))) add(`${label}: invalid publishedAt`);
  }
  for (const r of pack.globals) {
    checkKeys(r, ALLOWED_KEYS.global, `global ${r.slug}`);
    if (keys.has(r.key)) add(`global ${r.slug}: duplicate key`);
    keys.add(r.key);
    checkBody(r.body, `global ${r.slug}`);
  }

  // ---- inventory ---------------------------------------------------------------------------------------------------
  const legacy = manifest.inventory.filter((row) => row.ref.startsWith('legacy:'));
  if (legacy.length !== 47) add(`inventory must keep all 47 canonical legacy entries (found ${legacy.length})`);
  const refs = new Set<string>();
  for (const row of manifest.inventory) {
    if (refs.has(row.ref)) add(`inventory: duplicate ${row.ref}`);
    refs.add(row.ref);
    if (row.target.key && !keys.has(row.target.key)) add(`inventory ${row.ref}: target ${row.target.key} does not exist`);
  }
  return problems;
}
