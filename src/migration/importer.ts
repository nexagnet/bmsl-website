import type { Payload } from 'payload';
import { parseExternalInput } from './external-input';
import manifestJson from './legacy-manifest.json';
import type { LegacyManifest } from './legacy.mjs';

// Legacy migration importer (docs/migration). Dry-run by default; writes only with `write: true`.
// Idempotent by legacy source URL / canonical slug. Existing records are never modified, so manual
// edits, publication state and approvals survive reruns. Everything is created as a draft.

export type ImportOptions = { write?: boolean; externalInput?: unknown; manifest?: LegacyManifest };

export type ImportReport = {
  mode: 'dry-run' | 'write';
  created: { collection: 'projects' | 'articles'; slug: string; legacyUrls: string[] }[];
  skipped: { collection: 'projects' | 'articles'; slug: string; reason: string }[];
  conflicts: { collection: 'projects' | 'articles'; slug: string; reason: string }[];
  pendingApprovals: { collection: 'projects' | 'articles'; slug?: string; legacyUrl?: string; needs: string[] }[];
  rejected: { legacyUrl?: string; reason: string }[];
};

type Doc = Record<string, unknown> & { id: string | number };

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
  const report: ImportReport = {
    mode: write ? 'write' : 'dry-run',
    created: [],
    skipped: [],
    conflicts: [],
    pendingApprovals: [],
    rejected: [],
  };

  // Projects: names/slugs come from the canonical inventory; no other fact is invented.
  const projects = await allDocs(payload, 'projects');
  for (const project of manifest.projects) {
    const legacyUrls = manifest.entries
      .filter((e) => e.kind === 'project' && e.projectSlug === project.slug)
      .sort((a, b) => a.id - b.id)
      .map((e) => e.legacyPath);
    const imported = projects.find((d) => urlsOf(d, 'legacyUrls').some((u) => legacyUrls.includes(u)));
    const sameSlug = projects.find((d) => d.slug === project.slug);
    const existing = imported ?? sameSlug;
    if (imported) {
      report.skipped.push({ collection: 'projects', slug: project.slug, reason: 'already imported (legacy source matched)' });
    } else if (sameSlug) {
      report.conflicts.push({ collection: 'projects', slug: project.slug, reason: 'slug is used by a record with a different legacy source; left untouched' });
      continue;
    } else {
      if (write) {
        await payload.create({
          collection: 'projects',
          data: {
            name: project.name,
            slug: project.slug,
            legacyUrls: legacyUrls.map((url) => ({ url })),
            sourceStatus: 'LEGACY-SOURCE',
            _status: 'draft',
          },
          draft: true,
        });
      }
      report.created.push({ collection: 'projects', slug: project.slug, legacyUrls });
    }
    if (existing?._status !== 'published') {
      report.pendingApprovals.push({ collection: 'projects', slug: project.slug, needs: PROJECT_NEEDS });
    }
  }

  // Articles: only approved external input, as draft, without forcing a category.
  if (options.externalInput !== undefined) {
    const input = parseExternalInput(options.externalInput, manifest);
    report.rejected.push(...input.rejected);
    for (const p of input.pending) report.pendingApprovals.push({ collection: 'articles', ...p });

    const articles = await allDocs(payload, 'articles');
    const categories = await allDocs(payload, 'article-categories');
    for (const article of input.articles) {
      const imported = articles.find((d) => urlsOf(d, 'legacyUrl').includes(article.legacyUrl));
      const sameSlug = articles.find((d) => d.slug === article.slug);
      const category = article.categorySlug ? categories.find((c) => c.slug === article.categorySlug) : undefined;
      const needs = ['image-rights', 'publication-approval', ...(category ? [] : ['category'])];
      if (imported) {
        report.skipped.push({ collection: 'articles', slug: article.slug, reason: 'already imported (legacy source matched)' });
      } else if (sameSlug) {
        report.conflicts.push({ collection: 'articles', slug: article.slug, reason: 'slug is used by a record with a different legacy source; left untouched' });
        continue;
      } else {
        if (write) {
          await payload.create({
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
            draft: true,
          });
        }
        report.created.push({ collection: 'articles', slug: article.slug, legacyUrls: [article.legacyUrl] });
      }
      report.pendingApprovals.push({ collection: 'articles', slug: article.slug, legacyUrl: article.legacyUrl, needs });
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
  for (const c of report.conflicts) lines.push(`  CONFLICT ${c.collection}/${c.slug}: ${c.reason}`);
  for (const r of report.rejected) lines.push(`  REJECTED ${r.legacyUrl ?? '(no url)'}: ${r.reason}`);
  if (report.mode === 'dry-run') lines.push('  Dry-run: nothing was written. Re-run with --write to import as draft.');
  return lines.join('\n');
}
