import { readFileSync } from 'node:fs';
import path from 'node:path';
import type { Payload } from 'payload';
import { hasRichText } from '../../lib/public-content';
import { MEDIA_KEY_FIELD, type LexicalDoc } from './lexical';
import {
  type ArticleRecord,
  type GlobalRecord,
  type Manifest,
  type MediaEntry,
  type MediaKey,
  PACK_FILES,
  PACK_ID,
  PACK_VERSION,
  type Pack,
  packProblems,
  type ProjectRecord,
  type ServiceAreaRecord,
  uploadKeysOf,
} from './pack';

// OFFLINE seed loader. It reads only the committed pack (manifest, records, image bytes) and writes DRAFT content to
// a Payload database: no network, no WordPress. An existing record (same slug or same legacy URL) is NEVER modified,
// so human edits survive reruns; a rerun on a seeded database creates nothing. Rights stay UNCONFIRMED, projects stay
// LEGACY-SOURCE, nothing is published. The explicit environment guards live in run.ts (assertImportAllowed).

export const PACK_DIR = path.resolve(import.meta.dirname);

export type LoadedPack = { pack: Pack; dir: string };

const readJson = (file: string): unknown => JSON.parse(readFileSync(file, 'utf8')) as unknown;
const recordsOf = <T>(file: string): T[] => ((readJson(file) as { records?: T[] }).records ?? []) as T[];

/** Reads and validates the committed pack. Throws one error listing every integrity problem (nothing is written). */
export function loadPack(dir: string = PACK_DIR): LoadedPack {
  let pack: Pack;
  try {
    pack = {
      manifest: readJson(path.join(dir, PACK_FILES.manifest)) as Manifest,
      serviceAreas: recordsOf<ServiceAreaRecord>(path.join(dir, PACK_FILES.serviceAreas)),
      projects: recordsOf<ProjectRecord>(path.join(dir, PACK_FILES.projects)),
      articles: recordsOf<ArticleRecord>(path.join(dir, PACK_FILES.articles)),
      globals: recordsOf<GlobalRecord>(path.join(dir, PACK_FILES.globals)),
    };
  } catch {
    throw new Error('Seed pack could not be read (missing or malformed JSON)');
  }
  const problems = packProblems(pack, (file) => {
    try {
      return readFileSync(path.join(dir, file));
    } catch {
      return undefined;
    }
  });
  if (problems.length) throw new Error(`Seed pack is invalid:\n- ${problems.join('\n- ')}`);
  return { pack, dir };
}

export type SeedItem = { collection: string; key: string; slug?: string; reason?: string };
export type SeedReport = {
  mode: 'dry-run' | 'write';
  pack: { id: string; version: number; observedAt: string; source: string };
  created: SeedItem[];
  skipped: SeedItem[];
  conflicts: SeedItem[];
  media: { created: number; existing: number };
  /** Source images that were NOT imported (people, third party, documents): counts only, details are in the manifest. */
  pendingImages: { total: number; byClass: Record<string, number> };
  /** Source documents held back entirely (owner decision) and URLs not seeded as records. */
  notSeeded: { ref: string; reason: string }[];
};

type Doc = Record<string, unknown> & { id: number | string };
type Plan = {
  serviceAreas: ServiceAreaRecord[];
  projects: ProjectRecord[];
  articles: ArticleRecord[];
  globals: GlobalRecord[];
};

const urlsOf = (doc: Doc, field: 'legacyUrls' | 'legacyUrl'): string[] => {
  const v = doc[field];
  if (typeof v === 'string') return [v];
  return Array.isArray(v) ? v.map((x) => (x as { url?: string }).url).filter((u): u is string => typeof u === 'string') : [];
};

const mediaSource = (m: MediaEntry) => `${PACK_ID}@${PACK_VERSION} | ${m.key} | ${m.sourceUrls.join(' ')}`;

/** Deep copy of a body with every media KEY replaced by the real media-assets id. */
export function resolveBody(doc: LexicalDoc, ids: Map<string, number | string>): LexicalDoc {
  const walk = (node: unknown): unknown => {
    if (Array.isArray(node)) return node.map(walk);
    if (typeof node !== 'object' || node === null) return node;
    const n = node as Record<string, unknown>;
    if (n.type === 'upload' && typeof n.value === 'object' && n.value !== null) {
      const key = (n.value as Record<string, unknown>)[MEDIA_KEY_FIELD];
      const id = ids.get(String(key));
      if (id === undefined) throw new Error('A body references media that was not loaded');
      return { ...n, value: id };
    }
    return Object.fromEntries(Object.entries(n).map(([k, v]) => [k, walk(v)]));
  };
  return walk(doc) as LexicalDoc;
}

export async function runSeed(payload: Payload, loaded: LoadedPack, options: { write: boolean }): Promise<SeedReport> {
  const { pack, dir } = loaded;
  const write = options.write;
  const manifest = pack.manifest;
  const report: SeedReport = {
    mode: write ? 'write' : 'dry-run',
    pack: { id: manifest.pack, version: manifest.version, observedAt: manifest.source.observedAt, source: manifest.source.site },
    created: [],
    skipped: [],
    conflicts: [],
    media: { created: 0, existing: 0 },
    pendingImages: { total: manifest.pendingMedia.length, byClass: {} },
    notSeeded: manifest.inventory
      .filter((r) => ['BLOCKED_OWNER_DECISION', 'BLOCKED_THIRD_PARTY_TEXT', 'NO_SOURCE_BODY', 'TAXONOMY_NOT_SEEDED'].includes(r.textStatus))
      .map((r) => ({ ref: r.ref, reason: r.textStatus })),
  };
  for (const p of manifest.pendingMedia) report.pendingImages.byClass[p.class] = (report.pendingImages.byClass[p.class] ?? 0) + 1;

  const findAll = async (collection: 'service-areas' | 'projects' | 'articles') =>
    (await payload.find({ collection, draft: true, pagination: false, depth: 0, overrideAccess: true })).docs as unknown as Doc[];

  // ---- plan (reads only) --------------------------------------------------------------------------------------------
  const plan: Plan = { serviceAreas: [], projects: [], articles: [], globals: [] };
  const item = (collection: string, r: { key: string; slug?: string }, reason?: string): SeedItem => ({
    collection,
    key: r.key,
    ...(r.slug ? { slug: r.slug } : {}),
    ...(reason ? { reason } : {}),
  });

  const existingAreas = await findAll('service-areas');
  const areaSlugs = new Set(existingAreas.map((d) => String(d.slug)));
  for (const r of pack.serviceAreas) {
    if (areaSlugs.has(r.slug)) report.skipped.push(item('service-areas', r, 'a record with this slug already exists; left untouched'));
    else {
      plan.serviceAreas.push(r);
      report.created.push(item('service-areas', r));
    }
  }

  const existingProjects = await findAll('projects');
  const taken = new Set(existingProjects.map((d) => String(d.slug)));
  for (const r of pack.projects) {
    const bySource = existingProjects.find((d) => urlsOf(d, 'legacyUrls').some((u) => r.legacyUrls.includes(u)));
    if (bySource) report.skipped.push(item('projects', r, 'already present (legacy source matched); left untouched'));
    else if (taken.has(r.slug)) report.conflicts.push(item('projects', r, 'slug is used by a record with a different legacy source; left untouched'));
    else {
      taken.add(r.slug);
      plan.projects.push(r);
      report.created.push(item('projects', r));
    }
  }

  const existingArticles = await findAll('articles');
  const articleSlugs = new Set(existingArticles.map((d) => String(d.slug)));
  for (const r of pack.articles) {
    const bySource = existingArticles.find((d) => urlsOf(d, 'legacyUrl').includes(r.legacyUrl));
    if (bySource) report.skipped.push(item('articles', r, 'already present (legacy source matched); left untouched'));
    else if (articleSlugs.has(r.slug)) report.conflicts.push(item('articles', r, 'slug is used by a record with a different legacy source; left untouched'));
    else {
      articleSlugs.add(r.slug);
      plan.articles.push(r);
      report.created.push(item('articles', r));
    }
  }

  for (const r of pack.globals) {
    const current = (await payload.findGlobal({ slug: r.slug, draft: true, depth: 0, overrideAccess: true })) as unknown as Record<string, unknown>;
    const hasContent = (typeof current.title === 'string' && current.title.trim() !== '') || hasRichText(current.body);
    if (hasContent) report.skipped.push(item('globals', r, 'the page already has content; left untouched'));
    else {
      plan.globals.push(r);
      report.created.push(item('globals', r));
    }
  }

  // ---- media needed by what will be created ----------------------------------------------------------------------------
  const needed = new Set<MediaKey>();
  for (const r of plan.serviceAreas) uploadKeysOf(r.body).forEach((k) => needed.add(k as MediaKey));
  for (const r of plan.articles) {
    uploadKeysOf(r.body).forEach((k) => needed.add(k as MediaKey));
    if (r.cover) needed.add(r.cover);
  }
  for (const r of plan.globals) uploadKeysOf(r.body).forEach((k) => needed.add(k as MediaKey));
  for (const r of plan.projects) r.images.forEach((k) => needed.add(k));

  const mediaByKey = new Map(manifest.media.map((m) => [m.key, m]));
  const ids = new Map<string, number | string>();
  for (const key of [...needed].sort()) {
    const entry = mediaByKey.get(key)!;
    const found = await payload.find({
      collection: 'media-assets',
      where: { source: { contains: key } },
      limit: 1,
      depth: 0,
      overrideAccess: true,
    });
    if (found.docs[0]) {
      ids.set(key, (found.docs[0] as unknown as Doc).id);
      report.media.existing += 1;
    } else if (write) {
      const created = await payload.create({
        collection: 'media-assets',
        // Rights are never escalated by the seed: UNCONFIRMED until BMSL approves the file.
        data: { alt: entry.alt, rightsStatus: 'UNCONFIRMED', source: mediaSource(entry) } as never,
        filePath: path.join(dir, entry.file),
        overrideAccess: true,
      });
      ids.set(key, (created as unknown as Doc).id);
      report.media.created += 1;
    } else {
      report.media.created += 1;
    }
  }
  if (!write) return report;

  // ---- write (explicit operator action; drafts only) --------------------------------------------------------------------
  const areaIds = new Map<string, number | string>();
  for (const d of existingAreas) areaIds.set(String(d.slug), d.id);
  for (const r of plan.serviceAreas) {
    const doc = await payload.create({
      collection: 'service-areas',
      data: {
        name: r.name,
        slug: r.slug,
        order: r.order,
        summary: r.summary,
        ...(r.body ? { body: resolveBody(r.body, ids) } : {}),
        _status: 'draft',
      } as never,
      draft: true,
      overrideAccess: true,
    });
    areaIds.set(r.slug, (doc as unknown as Doc).id);
  }
  for (const r of plan.projects) {
    await payload.create({
      collection: 'projects',
      data: {
        name: r.name,
        slug: r.slug,
        ...(r.summary ? { summary: r.summary } : {}),
        ...(r.address ? { address: r.address } : {}),
        ...(r.scale ? { scale: r.scale } : {}),
        ...(r.operatingSince ? { operatingSince: r.operatingSince } : {}),
        services: r.services.map((s) => areaIds.get(s)).filter((v): v is number | string => v !== undefined),
        images: r.images.map((k) => ids.get(k)).filter((v): v is number | string => v !== undefined),
        legacyUrls: r.legacyUrls.map((url) => ({ url })),
        sourceStatus: 'LEGACY-SOURCE',
        _status: 'draft',
      } as never,
      draft: true,
      overrideAccess: true,
    });
  }
  for (const r of plan.articles) {
    await payload.create({
      collection: 'articles',
      data: {
        title: r.title,
        slug: r.slug,
        ...(r.excerpt ? { excerpt: r.excerpt } : {}),
        body: resolveBody(r.body, ids),
        ...(r.cover ? { cover: ids.get(r.cover) } : {}),
        ...(r.publishedAt ? { publishedAt: r.publishedAt } : {}),
        legacyUrl: r.legacyUrl,
        _status: 'draft',
      } as never,
      draft: true,
      overrideAccess: true,
    });
  }
  for (const r of plan.globals) {
    await payload.updateGlobal({
      slug: r.slug,
      data: { title: r.title, body: resolveBody(r.body, ids), _status: 'draft' } as never,
      draft: true,
      overrideAccess: true,
    });
  }
  return report;
}

export function formatSeedReport(report: SeedReport): string {
  const by = (items: SeedItem[]) => {
    const counts: Record<string, number> = {};
    for (const i of items) counts[i.collection] = (counts[i.collection] ?? 0) + 1;
    return Object.entries(counts)
      .sort()
      .map(([k, v]) => `${k}=${v}`)
      .join(' ');
  };
  const lines = [
    `Seed ${report.pack.id}@${report.pack.version} (${report.mode}) — source ${report.pack.source}, observed ${report.pack.observedAt}`,
    `  created: ${report.created.length}${report.created.length ? ` (${by(report.created)})` : ''}`,
    `  skipped (already present): ${report.skipped.length}${report.skipped.length ? ` (${by(report.skipped)})` : ''}`,
    `  conflicts: ${report.conflicts.length}`,
    `  media: ${report.media.created} ${report.mode === 'write' ? 'created' : 'would be created'}, ${report.media.existing} already present`,
    `  pending images not imported: ${report.pendingImages.total} (${Object.entries(report.pendingImages.byClass)
      .sort()
      .map(([k, v]) => `${k}=${v}`)
      .join(' ')})`,
    `  sources not seeded as records: ${report.notSeeded.length}`,
  ];
  for (const c of report.conflicts) lines.push(`  CONFLICT ${c.collection}/${c.slug ?? c.key}: ${c.reason}`);
  if (report.mode === 'dry-run') lines.push('  Dry-run: nothing was written. Re-run with --write on an isolated local/staging database to seed drafts.');
  return lines.join('\n');
}
