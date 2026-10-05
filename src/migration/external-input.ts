import articleCandidates from './article-candidates.json';
import { type LegacyManifest, normalizeSameSitePath } from './legacy.mjs';

// External article input: validated data supplied outside this repository (never raw legacy dumps).
// Only plain text is accepted. Media, HTML, contact data and any unknown key are rejected so nothing
// unapproved can be imported, downloaded or uploaded by accident.

export type ExternalArticle = {
  legacyUrl: string;
  slug: string;
  title: string;
  excerpt?: string;
  paragraphs: string[];
  publishedAt?: string;
  categorySlug?: string;
};

export type ParsedExternalInput = {
  articles: ExternalArticle[];
  pending: { legacyUrl: string; needs: string[] }[];
  rejected: { legacyUrl?: string; reason: string }[];
};

// Blueprint 04 lists some service/About sources as optional separate articles. Only those explicitly known
// candidate ids may be imported as articles; their redirect disposition (service/About) is unchanged and
// nothing here approves a selection.
const CANDIDATE_NON_ARTICLE_KINDS = new Set(['service', 'about']);
const CANDIDATE_IDS = new Set(articleCandidates.candidates.map((c) => c.manifestId));
const ROOT_KEYS = new Set(['articles']);

const ALLOWED_KEYS = new Set(['legacyUrl', 'title', 'slug', 'excerpt', 'paragraphs', 'publishedAt', 'categorySlug', 'approval']);
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const nonEmpty = (v: unknown): v is string => typeof v === 'string' && v.trim() !== '';

export function parseExternalInput(raw: unknown, manifest: LegacyManifest): ParsedExternalInput {
  if (!isRecord(raw) || !Array.isArray(raw.articles)) throw new Error('External input must be an object with an "articles" array');
  const unknownRoot = Object.keys(raw).filter((k) => !ROOT_KEYS.has(k));
  if (unknownRoot.length > 0) {
    throw new Error(`External input has ${unknownRoot.length} unaccepted root key(s); only "articles" is allowed`);
  }
  const result: ParsedExternalInput = { articles: [], pending: [], rejected: [] };
  const seen = new Set<string>();

  for (const item of raw.articles) {
    const reject = (reason: string, legacyUrl?: string) => result.rejected.push({ legacyUrl, reason });
    if (!isRecord(item)) {
      reject('article entry must be an object');
      continue;
    }
    const rawUrl = typeof item.legacyUrl === 'string' ? item.legacyUrl : undefined;
    let legacyPath: string;
    try {
      legacyPath = normalizeSameSitePath(rawUrl ?? '');
    } catch {
      // Never echo the raw value: the input is private and may carry unexpected data.
      reject('legacyUrl is not a safe same-site path');
      continue;
    }
    const entry = manifest.entries.find((e) => normalizeSameSitePath(e.legacyPath) === legacyPath);
    const importable =
      entry !== undefined &&
      (entry.kind === 'article' || (CANDIDATE_NON_ARTICLE_KINDS.has(entry.kind) && CANDIDATE_IDS.has(entry.id)));
    if (!entry || !importable) {
      reject('legacyUrl is not an article source or known article candidate in the 47-URL inventory', entry?.legacyPath);
      continue;
    }
    const legacyUrl = entry.legacyPath;
    if (seen.has(legacyUrl)) {
      reject('duplicate legacyUrl', legacyUrl);
      continue;
    }
    seen.add(legacyUrl);

    const unknown = Object.keys(item).filter((k) => !ALLOWED_KEYS.has(k));
    if (unknown.length > 0) {
      reject(`keys not accepted (media, HTML and extra data are never imported): ${unknown.map((k) => (/^[A-Za-z0-9_]{1,40}$/.test(k) ? k : '<invalid-key>')).join(', ')}`, legacyUrl);
      continue;
    }
    if (!nonEmpty(item.title)) {
      reject('title is required', legacyUrl);
      continue;
    }
    const slug = item.slug === undefined ? legacyPath.slice(1) : item.slug;
    if (typeof slug !== 'string' || !SLUG.test(slug)) {
      reject('slug must be lowercase letters, digits and hyphens', legacyUrl);
      continue;
    }
    if (item.paragraphs !== undefined && !(Array.isArray(item.paragraphs) && item.paragraphs.every(nonEmpty))) {
      reject('paragraphs must be an array of non-empty plain-text strings', legacyUrl);
      continue;
    }
    if (item.excerpt !== undefined && !nonEmpty(item.excerpt)) {
      reject('excerpt must be a non-empty string', legacyUrl);
      continue;
    }
    if (item.publishedAt !== undefined && (typeof item.publishedAt !== 'string' || Number.isNaN(Date.parse(item.publishedAt)))) {
      reject('publishedAt must be a valid date string', legacyUrl);
      continue;
    }
    if (item.categorySlug !== undefined && !(typeof item.categorySlug === 'string' && SLUG.test(item.categorySlug))) {
      reject('categorySlug must be a slug', legacyUrl);
      continue;
    }

    const approval = item.approval;
    const approved =
      isRecord(approval) && approval.contentApproved === true && nonEmpty(approval.approvedBy) && nonEmpty(approval.approvedAt);
    if (!approved) {
      result.pending.push({ legacyUrl, needs: ['content-approval', 'category', 'image-rights'] });
      continue;
    }
    result.articles.push({
      legacyUrl,
      slug,
      title: item.title.trim(),
      excerpt: item.excerpt as string | undefined,
      paragraphs: (item.paragraphs as string[] | undefined) ?? [],
      publishedAt: item.publishedAt as string | undefined,
      categorySlug: item.categorySlug as string | undefined,
    });
  }
  return result;
}
