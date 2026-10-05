export type LegacyEntry = {
  id: number;
  legacyPath: string;
  sourceType: string;
  action: string;
  kind: string;
  projectSlug?: string;
  disposition: string;
  proposedTarget: string;
  activeTarget: string;
  targetState: string;
  fallbackReason?: string;
  publishedEvidence?: string;
  approvalStatus: string;
};

export type LegacyManifest = {
  version: number;
  source: string;
  notes: string[];
  projects: { slug: string; name: string }[];
  entries: LegacyEntry[];
};

export type RedirectRule = { id?: number; source: string; destination: string; statusCode: number };
export type NextRedirect = { source: string; destination: string; statusCode: number };

export const SOURCE_TYPES: string[];
export const ACTIONS: string[];
export const KINDS: string[];
export const APPROVAL_STATUSES: string[];
export const TARGET_STATES: string[];
export const FALLBACK_REASONS: string[];

export function loadLegacyManifest(): LegacyManifest;
export function normalizeSameSitePath(input: string): string;
export function buildRedirectRules(manifest: LegacyManifest): RedirectRule[];
export function toNextRedirects(rules: RedirectRule[]): NextRedirect[];
export function validateRedirectRules(rules: RedirectRule[]): string[];
export function validateManifest(manifest: LegacyManifest, options: { publicRoutes: readonly string[] }): string[];
