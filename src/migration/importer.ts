import type { Payload } from 'payload';
import { parseExternalInput } from './external-input';
import manifestJson from './legacy-manifest.json';
import type { LegacyManifest } from './legacy.mjs';

// Legacy migration importer (docs/migration). Dry-run by default; writes only with `write: true`.
// Idempotent by legacy source URL / canonical slug. Existing records are never modified, so manual
// edits, publication state and approvals survive reruns. Everything is created as a draft.
// The whole batch is validated and planned (identities and slugs reserved) before the first write, so
// dry-run and write reports agree and a predictable conflict never surfaces as a DB error mid-batch.

export type ImportOptions = { write?: boolean; externalInput?: unknown; manifest?: LegacyManifest };

/** Initial handover acceptance (blueprint 04): at most 10 articles. A reporting threshold, never a CMS limit. */
export const INITIAL_ARTICLE_HANDOVER_MAX = 10;

export type ImportReport = {
  mode: 'dry-run' | 'write';
  created: { collection: 'projects' | 'articles'; slug: string; legacyUrls: string[] }[];
  skipped: { collection: 'projects' | 'articles'; slug: string; reason: string }[];
  conflicts: { collection: 'projects' | 'articles'; slug: string; reason: string }[];
  pendingApprovals: { collection: 'projects' | 'articles'; slug?: string; legacyUrl?: string; needs: string[] }[];
  rejected: { legacyUrl?: string; reason: string }[];
  /** Selection stays UNCONFIRMED; this only compares the approved input batch with the handover acceptance. */
  articleSelection: {
    initialHandoverMax: number;
    approvedInBatch: number;
    withinInitialHandover: boolean;
    selectionApproved: false;
    note: string;
  };
};

type Doc = Record<string, unknown> & { id: string | number };
type Collection = 'projects' | 'articles';

const PROJECT_NEEDS = ['project-facts', 'image-rights', 'publication-approval'];

const urlsOf = (doc: Doc, field: 'legacyUrls' | 'legacyUrl'): string[] => {
  const v = doc[field];
  if (typeof v === 'string') return [v];
  return Array.isArray(v) ? v.map((x) => (x as { url?: string }).url).filter((u): u is string => typeof u === 'string') : [];
};

async function allDocs(payload: Payload, collection: Collection | 'article-categories'): Promise<Doc[]> {
  const result = await payload.find({ collection, draft: true, pagination: false, depth: 0 });
  return result.docs as unknown as Doc[];
}

const lexicalBody = (paragraphs: string[]) => ({
  root: {
    type: 'root',
    format: '' as const,
    indent: 0,
    version: 1,
    direction: 'ltr' as const,
    children: paragraphs.map((text) => ({
      type: 'paragraph',
      format: '',
      indent: 0,
      version: 1,
      direction: 'ltr',
      textFormat: 0,
      children: [{ type: 'text', text, format: 0, detail: 0, mode: 'normal', style: '', version: 1 }],
    })),
  },
});

type PlannedCreate =
  | { collection: 'projects'; slug: string; name: string; legacyUrls: string[] }
  | {
      collection: 'articles';
      slug: string;
      title: string;
      legacyUrl: string;
      excerpt?: string;
      paragraphs: string[];
      publishedAt?: string;
      categoryId?: string | number;
    };

/** Slugs and legacy identities already taken, by existing records and by earlier items of this batch. */
class Reservations {
  private readonly slugs = new Map<string, 'existing' | 'batch'>();
  constructor(existing: Doc[]) {
    for (const d of existing) if (typeof d.slug === 'string') this.slugs.set(d.slug, 'existing');
  }
  holder(slug: string) {
    return this.slugs.get(slug);
  }
  reserve(slug: string) {
    this.slugs.set(slug, 'batch');
  }
}

const conflictReason = (holder: 'existing' | 'batch') =>
  holder === 'batch'
    ? 'slug is already reserved by another source in this batch (first source in input order wins); this source is left out'
    : 'slug is used by a record with a different legacy source; left untouched';

export async function runLegacyImport(payload: Payload, options: ImportOptions = {}): Promise<ImportReport> {
  const write = options.write === true;
  const manifest = options.manifest ?? (manifestJson as LegacyManifest);
  // 1. Validate all external input before touching the database at all.
  const input = options.externalInput === undefined ? undefined : parseExternalInput(options.externalInput, manifest);

  const report: ImportReport = {
    mode: write ? 'write' : 'dry-run',
    created: [],
    skipped: [],
    conflicts: [],
    pendingApprovals: [],
    rejected: [],
    articleSelection: {
      initialHandoverMax: INITIAL_ARTICLE_HANDOVER_MAX,
      approvedInBatch: input?.articles.length ?? 0,
      withinInitialHandover: (input?.articles.length ?? 0) <= INITIAL_ARTICLE_HANDOVER_MAX,
      selectionApproved: false,
      note: `Compared with the initial handover acceptance of at most ${INITIAL_ARTICLE_HANDOVER_MAX} articles; the CMS has no ceiling. Article selection is UNCONFIRMED until BMSL approves it and no article is counted as migrated.`,
    },
  };
  const plan: PlannedCreate[] = [];

  // 2. Plan projects: names/slugs come from the canonical inventory; no other fact is invented.
  const projects = await allDocs(payload, 'projects');
  const projectSlugs = new Reservations(projects);
  for (const project of manifest.projects) {
    const legacyUrls = manifest.entries
      .filter((e) => e.kind === 'project' && e.projectSlug === project.slug)
      .sort((a, b) => a.id - b.id)
      .map((e) => e.legacyPath);
    const imported = projects.find((d) => urlsOf(d, 'legacyUrls').some((u) => legacyUrls.includes(u)));
    const holder = projectSlugs.holder(project.slug);
    if (imported) {
      report.skipped.push({ collection: 'projects', slug: project.slug, reason: 'already imported (legacy source matched)' });
    } else if (holder) {
      report.conflicts.push({ collection: 'projects', slug: project.slug, reason: conflictReason(holder) });
      continue;
    } else {
      projectSlugs.reserve(project.slug);
      plan.push({ collection: 'projects', slug: project.slug, name: project.name, legacyUrls });
      report.created.push({ collection: 'projects', slug: project.slug, legacyUrls });
    }
    if (imported?._status !== 'published') {
      report.pendingApprovals.push({ collection: 'projects', slug: project.slug, needs: PROJECT_NEEDS });
    }
  }

  // 3. Plan articles: only approved external input, as draft, without forcing a category.
  if (input) {
    report.rejected.push(...input.rejected);
    for (const p of input.pending) report.pendingApprovals.push({ collection: 'articles', ...p });

    const articles = await allDocs(payload, 'articles');
    const categories = await allDocs(payload, 'article-categories');
    const articleSlugs = new Reservations(articles);
    for (const article of input.articles) {
      const imported = articles.find((d) => urlsOf(d, 'legacyUrl').includes(article.legacyUrl));
      const holder = articleSlugs.holder(article.slug);
      const category = article.categorySlug ? categories.find((c) => c.slug === article.categorySlug) : undefined;
      const needs = ['image-rights', 'publication-approval', ...(category ? [] : ['category'])];
      if (imported) {
        report.skipped.push({ collection: 'articles', slug: article.slug, reason: 'already imported (legacy source matched)' });
      } else if (holder) {
        report.conflicts.push({ collection: 'articles', slug: article.slug, reason: conflictReason(holder) });
        continue;
      } else {
        articleSlugs.reserve(article.slug);
        plan.push({
          collection: 'articles',
          slug: article.slug,
          title: article.title,
          legacyUrl: article.legacyUrl,
          excerpt: article.excerpt,
          paragraphs: article.paragraphs,
          publishedAt: article.publishedAt,
          categoryId: category?.id,
        });
        report.created.push({ collection: 'articles', slug: article.slug, legacyUrls: [article.legacyUrl] });
      }
      report.pendingApprovals.push({ collection: 'articles', slug: article.slug, legacyUrl: article.legacyUrl, needs });
    }
  }

  // 4. Execute the plan. Only conflict-free creates remain, so no uniqueness error is expected.
  if (write) {
    for (const item of plan) {
      if (item.collection === 'projects') {
        await payload.create({
          collection: 'projects',
          data: {
            name: item.name,
            slug: item.slug,
            legacyUrls: item.legacyUrls.map((url) => ({ url })),
            sourceStatus: 'LEGACY-SOURCE',
            _status: 'draft',
          },
          draft: true,
        });
      } else {
        await payload.create({
          collection: 'articles',
          data: {
            title: item.title,
            slug: item.slug,
            legacyUrl: item.legacyUrl,
            ...(item.excerpt ? { excerpt: item.excerpt } : {}),
            ...(item.paragraphs.length ? { body: lexicalBody(item.paragraphs) } : {}),
            ...(item.publishedAt ? { publishedAt: item.publishedAt } : {}),
            ...(item.categoryId !== undefined ? { category: item.categoryId as number } : {}),
            _status: 'draft',
          },
          draft: true,
        });
      }
    }
  }
  return report;
}

export function formatReport(report: ImportReport): string {
  const sel = report.articleSelection;
  const lines = [
    `Legacy import (${report.mode})`,
    `  created: ${report.created.length}`,
    `  skipped: ${report.skipped.length}`,
    `  conflicts: ${report.conflicts.length}`,
    `  pending approvals: ${report.pendingApprovals.length}`,
    `  rejected input: ${report.rejected.length}`,
    `  article selection: ${sel.approvedInBatch} approved in batch vs initial handover max ${sel.initialHandoverMax} (${sel.withinInitialHandover ? 'within' : 'over'}; selection UNCONFIRMED, none counted as migrated)`,
  ];
  for (const c of report.conflicts) lines.push(`  CONFLICT ${c.collection}/${c.slug}: ${c.reason}`);
  for (const r of report.rejected) lines.push(`  REJECTED ${r.legacyUrl ?? '(no url)'}: ${r.reason}`);
  if (report.mode === 'dry-run') lines.push('  Dry-run: nothing was written. Re-run with --write to import as draft.');
  return lines.join('\n');
}
