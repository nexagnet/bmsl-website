import { describe, expect, it } from 'vitest';
import {
  ALLOWED_EVENT_NAMES,
  coverageFailures,
  eventProblems,
  eventsFromDataLayer,
  lighthouseFailures,
  measureLighthouse,
  summarizeAxe,
} from './browser-policy';
import { ANALYTICS_EVENTS } from '../../../src/lib/analytics';

describe('browser UAT policy: axe', () => {
  it('only critical and serious violations are blocking; the rest are counted, not hidden', () => {
    const summary = summarizeAxe([
      { id: 'color-contrast', impact: 'serious', nodes: [1, 2] },
      { id: 'image-alt', impact: 'critical', nodes: [1] },
      { id: 'region', impact: 'moderate', nodes: [1] },
      { id: 'tabindex', impact: 'minor', nodes: [1] },
      { id: 'mystery', impact: null, nodes: [] },
    ]);
    expect(summary.total).toBe(5);
    expect(summary.byImpact).toEqual({ serious: 1, critical: 1, moderate: 1, minor: 1, unknown: 1 });
    expect(summary.blocking).toEqual([
      { id: 'color-contrast', impact: 'serious', nodes: 2 },
      { id: 'image-alt', impact: 'critical', nodes: 1 },
    ]);
  });

  it('no violations is a clean, empty summary', () => {
    expect(summarizeAxe([])).toEqual({ total: 0, byImpact: {}, blocking: [] });
  });
});

describe('browser UAT policy: Lighthouse budgets', () => {
  const good = {
    categories: {
      accessibility: { score: 1 },
      'best-practices': { score: 1 },
      performance: { score: 0.9 },
      seo: { score: 1 },
    },
    audits: {
      'largest-contentful-paint': { numericValue: 1800 },
      'cumulative-layout-shift': { numericValue: 0 },
      'total-blocking-time': { numericValue: 50 },
      'total-byte-weight': { numericValue: 90_000 },
    },
  };

  it('measures the scores and metrics Lighthouse reports', () => {
    expect(measureLighthouse(good)).toEqual({
      accessibility: 1,
      bestPractices: 1,
      performance: 0.9,
      seo: 1,
      lcpMs: 1800,
      cls: 0,
      tbtMs: 50,
      totalByteWeight: 90_000,
    });
  });

  it('a page within budget has no failures', () => {
    expect(lighthouseFailures(measureLighthouse(good))).toEqual([]);
  });

  it('every violated budget is listed, and a missing measurement fails instead of passing', () => {
    const bad = measureLighthouse({
      categories: { accessibility: { score: 0.5 }, 'best-practices': { score: 0.7 }, performance: { score: null } },
      audits: {
        'largest-contentful-paint': { numericValue: 9000 },
        'cumulative-layout-shift': { numericValue: 0.4 },
        'total-byte-weight': { numericValue: 3_000_000 },
      },
    });
    const failures = lighthouseFailures(bad);
    expect(failures).toEqual([
      'accessibility score: 0.5 < 0.9',
      'best-practices score: 0.7 < 0.8',
      'performance score: not measured',
      'LCP (ms): 9000 > 4000',
      'CLS: 0.4 > 0.1',
      'total byte weight: 3000000 > 1500000',
    ]);
  });
});

describe('browser UAT policy: changed-area coverage', () => {
  const entry = (pct: number) => ({ lines: { pct }, statements: { pct } });

  it('passes when every listed file meets the floor', () => {
    expect(
      coverageFailures({ total: entry(50), '/repo/src/lib/a.ts': entry(100), '/repo/src/lib/b.mjs': entry(80) }, ['src/lib/a.ts', 'src/lib/b.mjs']),
    ).toEqual([]);
  });

  it('reports below-floor files and files that were not measured at all', () => {
    expect(coverageFailures({ total: entry(99), '/repo/src/lib/a.ts': entry(79.9) }, ['src/lib/a.ts', 'src/lib/missing.ts'])).toEqual([
      'src/lib/a.ts: lines 79.9% < 80%',
      'src/lib/a.ts: statements 79.9% < 80%',
      'src/lib/missing.ts: no coverage entry (file not measured)',
    ]);
  });

  it('does not let the global total stand in for a file', () => {
    expect(coverageFailures({ total: entry(100) }, ['src/lib/a.ts'])).toEqual(['src/lib/a.ts: no coverage entry (file not measured)']);
  });
});

describe('browser UAT policy: analytics events', () => {
  const origin = 'http://127.0.0.1:3000';
  const common = { page_location: `${origin}/lien-he`, page_referrer: origin };

  it('allows exactly the four contracted event names, in sync with the application', () => {
    expect([...ALLOWED_EVENT_NAMES]).toEqual([...ANALYTICS_EVENTS]);
    expect(ALLOWED_EVENT_NAMES).toHaveLength(4);
  });

  it('extracts only event entries from a serialised dataLayer', () => {
    const events = eventsFromDataLayer([
      ['js', '2026-01-01'],
      ['config', 'G-ABC123DEF4', { send_page_view: false }],
      ['event', 'page_view', common],
      ['event', 'phone_click', { link_location: 'footer', ...common }],
    ]);
    expect(events.map((e) => e.name)).toEqual(['page_view', 'phone_click']);
  });

  it('accepts a safe event and flags unsafe ones', () => {
    expect(eventProblems({ name: 'phone_click', params: { link_location: 'footer', ...common } }, origin)).toEqual([]);
    expect(eventProblems({ name: 'purchase', params: common }, origin)).toContain('unexpected event name purchase');
    expect(eventProblems({ name: 'form_submit', params: { ...common, phone: '0900000000' } }, origin)).toContain('unexpected parameter phone');
    expect(eventProblems({ name: 'page_view', params: { ...common, page_location: `${origin}/lien-he?utm_source=x` } }, origin)).toEqual([
      `unsafe page_location ${origin}/lien-he?utm_source=x`,
    ]);
    expect(eventProblems({ name: 'page_view', params: { ...common, page_referrer: 'https://other.invalid/?q=1' } }, origin)).toEqual([
      'page_referrer is not the bare origin: https://other.invalid/?q=1',
    ]);
  });
});
