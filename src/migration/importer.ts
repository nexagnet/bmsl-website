import type { Payload } from 'payload';
import { parseExternalInput } from './external-input';
import manifestJson from './legacy-manifest.json';
import type { LegacyManifest } from './legacy.mjs';

// Legacy migration importer (docs/migration). Dry-run by default; writes only with `write: true`.
// The whole input is validated and the whole batch is planned (identities and slugs reserved) before the
// first write, so dry-run and write reports agree and a bad input never leaves partial data.
// Idempotent by legacy source URL / canonical slug. Existing records are never modified, so manual
// edits, publication state and approvals survive reruns. Everything is created as a draft.

export type ImportOptions = { write?: boolean; externalInput?: unknown; manifest?: LegacyManifest };

/** Initial handover acceptance (<=10 articles). Reporting only: the CMS has no ceiling. */
export const INITIAL_HANDOVER_MAX_ARTICLES = 10;

export type ImportReport = {
  mode: 'dry-run' | 'write';
  created: { collection: 'projects' | 'articles'; slug: string; legacyUrls: string[] }[];
  skipped: { collection: 'projects' | 'articles'; slug: string; reason: string }[];
  conflicts: { collection: 'projects' | 'articles'; slug: string; reason: string }[];
  pendingApprovals: { collection: 'projects' | 'articles'; slug?: string; legacyUrl?: string; needs: string[] }[];
  rejected: { legacyUrl?: string; reason: string }[];
  /** Present only when external input was supplied. Informational; the selection stays UNCONFIRMED. */
  articleSelection?: {
    approvedInInput: number;
    importableInBatch: number;
    initialHandoverMax: number;
    withinInitialHandover: boolean;
    selectionApproved: false;
    note: string;
  };
};

type Doc = Record<string, unknown> & { id: string | number };
type Planned = { collection: 'projects' | 'articles'; data: Record<string, unknown> };

const PROJECT_NEEDS = ['project-facts', 'image-rights', 'publication-approval'];

const urlsOf = (doc: Doc, field: 'legacyUrls' | 'legacyUrl'): string[] => {
  const v = doc[field];
  if (typeof v === 'string') return [v];
  return Array.isArray(v) ? v.map((x) => (x as { url?: string }).url).filter((u): u is string => typeof u === 'string') : [];
};

async function allDocs(payload: Payload, collection: 'projects' | 'articles' | 'article-categories'): Promise<Doc[]> {
  const result = await payload.find({ collection, draft: true, pagination: false, depth: 0 });
  return result.docs as unknown as Doc[];
}

const lexicalBody = (paragraphs: string[]) => ({
  root: {
    type: 'root',
    format: '',
    indent: 0,
    version: 1,
    direction: 'ltr',
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

export async function runLegacyImport(payload: Payload, options: ImportOptions = {}): Promise<ImportReport> {
  const write = options.write === true;
  const manifest = options.manifest ?? (manifestJson as LegacyManifest);

  // 1. Validate the whole external input before any database access. A malformed document throws here.
  const input = options.externalInput !== undefined ? parseExternalInput(options.externalInput, manifest) : undefined;

  const report: ImportReport = {
    mode: write ? 'write' : 'dry-run',
    created: [],
    skipped: [],
    conflicts: [],
    pendingApprovals: [],
    rejected: [],
  };
  const plan: Planned[] = [];

  // 2. Plan. Dry-run and write share this code. Slugs are reserved across the batch (input order wins), so a
  //    later create can never hit the uniqueness constraint after earlier writes.
  // Projects: names/slugs come from the canonical inventory; no other fact is invented.
  const projects = await allDocs(payload, 'projects');
  const projectSlugs = new Set(projects.map((d) => d.slug as string));
  for (const project of manifest.projects) {
    const legacyUrls = manifest.entries
      .filter((e) => e.kind === 'project' && e.projectSlug === project.slug)
      .sort((a, b) => a.id - b.id)
      .map((e) => e.legacyPath);
    const imported = projects.find((d) => urlsOf(d, 'legacyUrls').some((u) => legacyUrls.includes(u)));
    const existing = imported ?? projects.find((d) => d.slug === project.slug);
    if (imported) {
      report.skipped.push({ collection: 'projects', slug: project.slug, reason: 'already imported (legacy source matched)' });
    } else if (projectSlugs.has(project.slug)) {
      report.conflicts.push({ collection: 'projects', slug: project.slug, reason: 'slug is used by a record with a different legacy source; left untouched' });
      continue;
    } else {
      projectSlugs.add(project.slug);
      plan.push({
        collection: 'projects',
        data: {
          name: project.name,
          slug: project.slug,
          legacyUrls: legacyUrls.map((url) => ({ url })),
          sourceStatus: 'LEGACY-SOURCE',
          _status: 'draft',
        },
      });
      report.created.push({ collection: 'projects', slug: project.slug, legacyUrls });
    }
    if (existing?._status !== 'published') {
      report.pendingApprovals.push({ collection: 'projects', slug: project.slug, needs: PROJECT_NEEDS });
    }
  }

  // Articles: only approved external input, as draft, without forcing a category.
  if (input) {
    report.rejected.push(...input.rejected);
    for (const p of input.pending) report.pendingApprovals.push({ collection: 'articles', ...p });

    const articles = await allDocs(payload, 'articles');
    const articleSlugs = new Set(articles.map((d) => d.slug as string));
    const categories = await allDocs(payload, 'article-categories');
    for (const article of input.articles) {
      const imported = articles.find((d) => urlsOf(d, 'legacyUrl').includes(article.legacyUrl));
      const category = article.categorySlug ? categories.find((c) => c.slug === article.categorySlug) : undefined;
      const needs = ['image-rights', 'publication-approval', ...(category ? [] : ['category'])];
      if (imported) {
        report.skipped.push({ collection: 'articles', slug: article.slug, reason: 'already imported (legacy source matched)' });
      } else if (articleSlugs.has(article.slug)) {
        const inBatch = report.created.some((c) => c.collection === 'articles' && c.slug === article.slug);
        report.conflicts.push({
          collection: 'articles',
          slug: article.slug,
          reason: inBatch
            ? 'slug is already reserved by an earlier legacy source in this batch; this source was not imported'
            : 'slug is used by a record with a different legacy source; left untouched',
        });
        continue;
      } else {
        articleSlugs.add(article.slug);
        plan.push({
          collection: 'articles',
          data: {
            title: article.title,
            slug: article.slug,
            legacyUrl: article.legacyUrl,
            ...(article.excerpt ? { excerpt: article.excerpt } : {}),
            ...(article.paragraphs.length ? { body: lexicalBody(article.paragraphs) } : {}),
            ...(article.publishedAt ? { publishedAt: article.publishedAt } : {}),
            ...(category ? { category: category.id } : {}),
            _status: 'draft',
          },
        });
        report.created.push({ collection: 'articles', slug: article.slug, legacyUrls: [article.legacyUrl] });
      }
      report.pendingApprovals.push({ collection: 'articles', slug: article.slug, legacyUrl: article.legacyUrl, needs });
    }

    // Informational: compares the batch with the <=10 initial handover acceptance. Not a CMS ceiling, and the
    // selection stays UNCONFIRMED. Nothing here claims an article was migrated.
    const importableInBatch =
      report.created.filter((c) => c.collection === 'articles').length +
      report.skipped.filter((s) => s.collection === 'articles').length;
    report.articleSelection = {
      approvedInInput: input.articles.length,
      importableInBatch,
      initialHandoverMax: INITIAL_HANDOVER_MAX_ARTICLES,
      withinInitialHandover: importableInBatch <= INITIAL_HANDOVER_MAX_ARTICLES,
      selectionApproved: false,
      note: 'Initial handover accepts up to 10 articles; this is not a CMS limit. The selection is UNCONFIRMED until BMSL approves it. No article is claimed as migrated.',
    };
  }

  // 3. Execute the plan (write mode only).
  if (write) {
    for (const item of plan) {
      await payload.create({ collection: item.collection, data: item.data as never, draft: true });
    }
  }
  return report;
}

export function formatReport(report: ImportReport): string {
  const lines = [
    `Legacy import (${report.mode})`,
    `  created: ${report.created.length}`,
    `  skipped: ${report.skipped.length}`,
    `  conflicts: ${report.conflicts.length}`,
    `  pending approvals: ${report.pendingApprovals.length}`,
    `  rejected input: ${report.rejected.length}`,
  ];
  const s = report.articleSelection;
  if (s) {
    lines.push(
      `  article selection (UNCONFIRMED): ${s.importableInBatch} importable of ${s.approvedInInput} approved in input; ` +
        `initial handover acceptance <= ${s.initialHandoverMax}: ${s.withinInitialHandover ? 'within' : 'EXCEEDED (not a CMS limit)'}`,
    );
  }
  for (const c of report.conflicts) lines.push(`  CONFLICT ${c.collection}/${c.slug}: ${c.reason}`);
  for (const r of report.rejected) lines.push(`  REJECTED ${r.legacyUrl ?? '(no url)'}: ${r.reason}`);
  if (report.mode === 'dry-run') lines.push('  Dry-run: nothing was written. Re-run with --write to import as draft.');
  return lines.join('\n');
}
