import { readFileSync } from 'node:fs';
import path from 'node:path';

// Pure legacy-migration logic shared by next.config.mjs (runtime redirects), the importer and tests.
// Plain ESM on purpose: next.config.mjs cannot import TypeScript. Types live in legacy.d.mts.

const PRIVATE_FIRST_SEGMENTS = new Set(['admin', 'api']);
const SEGMENT = /^[A-Za-z0-9_-]+$/;

export const SOURCE_TYPES = ['post', 'page', 'taxonomy', 'author'];
export const ACTIONS = ['KEEP', 'REWRITE', 'MERGE', 'DROP', 'OWNER-DECISION'];
export const KINDS = ['home', 'about', 'service', 'project', 'article', 'contact', 'category', 'author'];
export const APPROVAL_STATUSES = ['PROPOSAL', 'OWNER-DECISION', 'APPROVED'];
export const TARGET_STATES = ['identity', 'active', 'fallback', 'published'];
export const FALLBACK_REASONS = ['detail-not-published', 'category-not-approved'];

export function loadLegacyManifest() {
  return JSON.parse(readFileSync(path.join(import.meta.dirname, 'legacy-manifest.json'), 'utf8'));
}

/**
 * Same-site path, no trailing slash (except "/"). Throws on anything that could leave the site or
 * reach private routes: schemes, protocol-relative, backslashes, control chars, query/fragment,
 * encoded or dot segments, empty segments, /admin and /api.
 */
export function normalizeSameSitePath(input) {
  if (typeof input !== 'string' || input === '') throw new Error('path must be a non-empty string');
  if (!input.startsWith('/')) throw new Error(`path must start with "/": ${JSON.stringify(input)}`);
  if (input.startsWith('//')) throw new Error(`protocol-relative path is not allowed: ${JSON.stringify(input)}`);
  if (input === '/') return '/';
  const trimmed = input.endsWith('/') ? input.slice(0, -1) : input;
  const segments = trimmed.slice(1).split('/');
  for (const segment of segments) {
    if (!SEGMENT.test(segment)) throw new Error(`unsafe path segment ${JSON.stringify(segment)} in ${JSON.stringify(input)}`);
  }
  if (PRIVATE_FIRST_SEGMENTS.has(segments[0].toLowerCase())) throw new Error(`private path is not allowed: ${input}`);
  return trimmed;
}

const tryNormalize = (value) => {
  try {
    return normalizeSameSitePath(value);
  } catch {
    return value;
  }
};

/** One direct 301 per redirect entry. The homepage identity entry never becomes a rule. */
export function buildRedirectRules(manifest) {
  return manifest.entries
    .filter((e) => e.disposition === 'redirect')
    .map((e) => ({
      id: e.id,
      source: tryNormalize(e.legacyPath),
      destination: tryNormalize(e.activeTarget),
      statusCode: 301,
    }));
}

/** Rules in the shape Next.js expects. statusCode 301 (not `permanent`, which would emit 308). */
export function toNextRedirects(rules) {
  return rules.map(({ source, destination, statusCode }) => ({ source, destination, statusCode }));
}

/** Returns a list of problems; empty means the rules are safe. */
export function validateRedirectRules(rules) {
  const problems = [];
  const bySource = new Map();
  for (const rule of rules) {
    let source;
    try {
      source = normalizeSameSitePath(rule.source);
      if (source === '/') throw new Error('the homepage must stay an identity 200, not a redirect source');
    } catch (error) {
      problems.push(`invalid source ${JSON.stringify(rule.source)}: ${error.message}`);
      continue;
    }
    if (bySource.has(source)) problems.push(`duplicate source ${source}`);
    bySource.set(source, rule);
    if (rule.statusCode !== 301) problems.push(`${source}: statusCode must be 301`);
    try {
      const destination = normalizeSameSitePath(rule.destination);
      if (destination !== rule.destination) throw new Error('destination must be in canonical no-trailing-slash form');
      if (destination === source) problems.push(`${source}: self redirect (loop)`);
    } catch (error) {
      problems.push(`${source}: invalid destination ${JSON.stringify(rule.destination)}: ${error.message}`);
    }
  }
  for (const [source, rule] of bySource) {
    const next = bySource.get(rule.destination);
    if (!next || rule.destination === source) continue;
    problems.push(
      next.destination === source
        ? `${source}: redirect cycle with ${rule.destination}`
        : `${source}: redirect chain ${source} -> ${rule.destination} -> ${next.destination}`,
    );
  }
  return problems;
}

/** Structural and safety validation of the 47-entry manifest. `publicRoutes` = existing public routes. */
export function validateManifest(manifest, { publicRoutes }) {
  const problems = [];
  const entries = Array.isArray(manifest?.entries) ? manifest.entries : [];
  if (entries.length !== 47) problems.push(`expected 47 entries, found ${entries.length}`);
  const ids = new Set();
  const paths = new Set();
  const projectSlugs = new Set((manifest?.projects ?? []).map((p) => p.slug));
  if (projectSlugs.size !== (manifest?.projects ?? []).length) problems.push('duplicate project slug');
  const usedProjectSlugs = new Set();

  for (const e of entries) {
    const tag = `#${e?.id}`;
    if (!Number.isInteger(e.id) || e.id < 1 || e.id > 47 || ids.has(e.id)) problems.push(`${tag}: id must be unique 1..47`);
    ids.add(e.id);
    let legacyPath;
    try {
      legacyPath = normalizeSameSitePath(e.legacyPath);
    } catch (error) {
      problems.push(`${tag}: invalid legacyPath: ${error.message}`);
      continue;
    }
    if (paths.has(legacyPath)) problems.push(`${tag}: duplicate legacyPath ${e.legacyPath}`);
    paths.add(legacyPath);
    if (!SOURCE_TYPES.includes(e.sourceType)) problems.push(`${tag}: invalid sourceType`);
    if (!ACTIONS.includes(e.action)) problems.push(`${tag}: invalid action`);
    if (!KINDS.includes(e.kind)) problems.push(`${tag}: invalid kind`);
    if (!APPROVAL_STATUSES.includes(e.approvalStatus)) problems.push(`${tag}: invalid approvalStatus`);
    if (!TARGET_STATES.includes(e.targetState)) problems.push(`${tag}: invalid targetState`);

    const isRoot = legacyPath === '/';
    if (isRoot !== (e.disposition === 'identity')) {
      problems.push(`${tag}: only "/" may be an identity entry and it must be one (never a self-redirect)`);
    }
    if (e.disposition !== 'identity' && e.disposition !== 'redirect') problems.push(`${tag}: invalid disposition`);

    let active;
    let proposed;
    try {
      active = normalizeSameSitePath(e.activeTarget);
      proposed = normalizeSameSitePath(e.proposedTarget);
    } catch (error) {
      problems.push(`${tag}: invalid target: ${error.message}`);
      continue;
    }
    if (active !== e.activeTarget || proposed !== e.proposedTarget) problems.push(`${tag}: targets must be no-trailing-slash`);
    if (e.targetState === 'identity' && !(isRoot && active === '/')) problems.push(`${tag}: identity state is only for "/"`);
    if (e.targetState === 'fallback') {
      if (!FALLBACK_REASONS.includes(e.fallbackReason)) problems.push(`${tag}: fallback needs a fallbackReason`);
      if (active === proposed) problems.push(`${tag}: fallback must differ from the proposed target`);
    }
    if (e.targetState === 'active' && active !== proposed) problems.push(`${tag}: active state requires activeTarget == proposedTarget`);
    if (e.targetState === 'published') {
      if (active !== proposed) problems.push(`${tag}: published state requires activeTarget == proposedTarget`);
      if (typeof e.publishedEvidence !== 'string' || e.publishedEvidence.trim() === '') {
        problems.push(`${tag}: published target needs publishedEvidence`);
      }
    } else if (!publicRoutes.includes(active)) {
      problems.push(`${tag}: ${active} is not an existing public route (dead-end risk); use a fallback or mark published with evidence`);
    }
    if (e.kind === 'project') {
      if (!projectSlugs.has(e.projectSlug)) problems.push(`${tag}: unknown projectSlug`);
      usedProjectSlugs.add(e.projectSlug);
    }
  }
  for (const slug of projectSlugs) if (!usedProjectSlugs.has(slug)) problems.push(`project ${slug} has no legacy source`);
  return problems;
}
