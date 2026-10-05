// Pure decision rules of the W5B4 browser UAT (no browser, no database): what counts as a blocking accessibility
// failure, which performance budgets Lighthouse must meet, what the changed-area coverage floor is and how a gtag
// dataLayer is turned back into analytics events. Unit-tested in browser-policy.test.ts so the thresholds are
// reviewable and reproducible without launching a browser. Nothing here is a customer or BMSL business rule.

export const ENGINES = ['chromium', 'firefox', 'webkit'] as const;
export type Engine = (typeof ENGINES)[number];

/** Phone and tablet use the native-disclosure menu, desktop (>= 64rem = 1024px) the inline navigation. */
export const SIZES = [
  { name: 'phone', width: 390, height: 844 },
  { name: 'tablet', width: 820, height: 1180 },
  { name: 'desktop', width: 1366, height: 900 },
] as const;
export type SizeName = (typeof SIZES)[number]['name'];

// ---------------------------------------------------------------------------------------------------------------
// axe-core
// ---------------------------------------------------------------------------------------------------------------

export const AXE_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'] as const;
/** Violations of these impacts fail the run; moderate/minor ones are measured and reported, never hidden. */
export const AXE_BLOCKING_IMPACTS = ['critical', 'serious'] as const;

export type AxeViolationLike = { id: string; impact?: string | null; nodes: unknown[] };

export type AxeSummary = {
  total: number;
  byImpact: Record<string, number>;
  blocking: { id: string; impact: string; nodes: number }[];
};

export function summarizeAxe(violations: AxeViolationLike[]): AxeSummary {
  const byImpact: Record<string, number> = {};
  const blocking: AxeSummary['blocking'] = [];
  for (const v of violations) {
    const impact = v.impact ?? 'unknown';
    byImpact[impact] = (byImpact[impact] ?? 0) + 1;
    if ((AXE_BLOCKING_IMPACTS as readonly string[]).includes(impact)) {
      blocking.push({ id: v.id, impact, nodes: v.nodes.length });
    }
  }
  return { total: violations.length, byImpact, blocking };
}

// ---------------------------------------------------------------------------------------------------------------
// Lighthouse
// ---------------------------------------------------------------------------------------------------------------

/**
 * Budgets for the public pages under Lighthouse's simulated throttling (mobile: slow 4G + 4x CPU; desktop: broadband).
 * They are acceptance floors chosen for a text-first SSR site, not a promise of a grade: actual scores are always
 * reported next to them. Raising a floor is a deliberate change reviewed here.
 */
export const LIGHTHOUSE_BUDGET = {
  accessibilityScore: 0.9,
  bestPracticesScore: 0.8,
  performanceScore: 0.5,
  lcpMs: 4000,
  cls: 0.1,
  totalByteWeight: 1_500_000,
} as const;

export type LighthouseLike = {
  categories: Record<string, { score: number | null } | undefined>;
  audits: Record<string, { numericValue?: number | undefined } | undefined>;
};

export type LighthouseMeasurement = {
  accessibility: number | null;
  bestPractices: number | null;
  performance: number | null;
  seo: number | null;
  lcpMs: number | null;
  cls: number | null;
  tbtMs: number | null;
  totalByteWeight: number | null;
};

export function measureLighthouse(lhr: LighthouseLike): LighthouseMeasurement {
  const score = (id: string) => lhr.categories[id]?.score ?? null;
  const value = (id: string) => lhr.audits[id]?.numericValue ?? null;
  return {
    accessibility: score('accessibility'),
    bestPractices: score('best-practices'),
    performance: score('performance'),
    seo: score('seo'),
    lcpMs: value('largest-contentful-paint'),
    cls: value('cumulative-layout-shift'),
    tbtMs: value('total-blocking-time'),
    totalByteWeight: value('total-byte-weight'),
  };
}

/** Returns one human-readable line per violated budget; a missing measurement is a failure, never a pass. */
export function lighthouseFailures(m: LighthouseMeasurement, budget = LIGHTHOUSE_BUDGET): string[] {
  const out: string[] = [];
  const atLeast = (label: string, actual: number | null, floor: number) => {
    if (actual === null) out.push(`${label}: not measured`);
    else if (actual < floor) out.push(`${label}: ${actual} < ${floor}`);
  };
  const atMost = (label: string, actual: number | null, ceiling: number) => {
    if (actual === null) out.push(`${label}: not measured`);
    else if (actual > ceiling) out.push(`${label}: ${actual} > ${ceiling}`);
  };
  atLeast('accessibility score', m.accessibility, budget.accessibilityScore);
  atLeast('best-practices score', m.bestPractices, budget.bestPracticesScore);
  atLeast('performance score', m.performance, budget.performanceScore);
  atMost('LCP (ms)', m.lcpMs, budget.lcpMs);
  atMost('CLS', m.cls, budget.cls);
  atMost('total byte weight', m.totalByteWeight, budget.totalByteWeight);
  return out;
}

// ---------------------------------------------------------------------------------------------------------------
// Changed-area coverage
// ---------------------------------------------------------------------------------------------------------------

/** Meaningful floor for the application modules the browser UAT exercises (statements and lines, per file). */
export const COVERAGE_FLOOR_PERCENT = 80;

/**
 * The modules whose behaviour the browser UAT drives end to end. Coverage is measured on the unit suite for exactly
 * these files; it is neither global coverage nor a claim about the browser tests' own source.
 */
export const COVERAGE_FILES = [
  'src/lib/analytics.ts',
  'src/lib/contact-submission.ts',
  'src/lib/contact-endpoint.ts',
  'src/lib/request-type.ts',
  'src/lib/request-guard.ts',
  'src/lib/security-headers.mjs',
  'src/lib/site-settings.ts',
] as const;

type CoverageEntry = { lines: { pct: number }; statements: { pct: number } };

/** `summary` is vitest's json-summary: absolute file paths (plus `total`) mapped to percentages. */
export function coverageFailures(
  summary: Record<string, CoverageEntry>,
  files: readonly string[] = COVERAGE_FILES,
  floor = COVERAGE_FLOOR_PERCENT,
): string[] {
  const out: string[] = [];
  for (const file of files) {
    const key = Object.keys(summary).find((k) => k !== 'total' && k.replaceAll('\\', '/').endsWith(`/${file}`));
    const entry = key ? summary[key] : undefined;
    if (!entry) {
      out.push(`${file}: no coverage entry (file not measured)`);
      continue;
    }
    if (entry.lines.pct < floor) out.push(`${file}: lines ${entry.lines.pct}% < ${floor}%`);
    if (entry.statements.pct < floor) out.push(`${file}: statements ${entry.statements.pct}% < ${floor}%`);
  }
  return out;
}

// ---------------------------------------------------------------------------------------------------------------
// Analytics (gtag dataLayer)
// ---------------------------------------------------------------------------------------------------------------

export const ALLOWED_EVENT_NAMES = ['phone_click', 'zalo_click', 'form_submit', 'document_download'] as const;
/** Business-event parameters the site may send, plus the two sanitised page parameters added to every event. */
export const ALLOWED_EVENT_PARAMS = ['link_location', 'request_type', 'document_id', 'page_location', 'page_referrer'] as const;

export type DataLayerEvent = { name: string; params: Record<string, unknown> };

/** gtag pushes its `arguments` object; the page serialises each entry to an array first. */
export function eventsFromDataLayer(entries: unknown[][]): DataLayerEvent[] {
  const out: DataLayerEvent[] = [];
  for (const entry of entries) {
    if (entry[0] !== 'event' || typeof entry[1] !== 'string') continue;
    const params = typeof entry[2] === 'object' && entry[2] !== null ? (entry[2] as Record<string, unknown>) : {};
    out.push({ name: entry[1], params });
  }
  return out;
}

/** Problems with one event: unknown name, unknown parameter, query/fragment in a URL, non-origin referrer. */
export function eventProblems(event: DataLayerEvent, origin: string): string[] {
  const problems: string[] = [];
  const businessEvent = (ALLOWED_EVENT_NAMES as readonly string[]).includes(event.name);
  if (!businessEvent && event.name !== 'page_view') problems.push(`unexpected event name ${event.name}`);
  for (const [key, value] of Object.entries(event.params)) {
    if (!(ALLOWED_EVENT_PARAMS as readonly string[]).includes(key)) problems.push(`unexpected parameter ${key}`);
    if (typeof value !== 'string') problems.push(`non-string parameter ${key}`);
  }
  const location = event.params.page_location;
  if (typeof location !== 'string' || !location.startsWith(origin) || /[?#]/.test(location)) {
    problems.push(`unsafe page_location ${String(location)}`);
  }
  if (event.params.page_referrer !== origin) problems.push(`page_referrer is not the bare origin: ${String(event.params.page_referrer)}`);
  return problems;
}
