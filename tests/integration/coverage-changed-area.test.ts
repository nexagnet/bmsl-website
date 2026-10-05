import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { COVERAGE_FILES, COVERAGE_FLOOR_PERCENT, coverageFailures } from './support/browser-policy';
import { runInGroup } from './support/db-lifecycle';

// W5B4 changed-area coverage. The application modules that the browser UAT drives end to end (contact submission and
// endpoint, request-type prefill, analytics, request guard, security headers, site settings) are measured with the
// V8 provider while the real unit suite runs, and each must reach COVERAGE_FLOOR_PERCENT lines and statements. This is
// the executed report for those files only: it is NOT global coverage and it says nothing about code it does not list.
// The unit run needs no database and no secret, so it gets a clean, minimal environment.

const REPO_ROOT = path.resolve(import.meta.dirname, '../..');

describe('W5B4 changed-area coverage (unit suite, V8, measured)', () => {
  it(`every browser-UAT-driven module reaches ${COVERAGE_FLOOR_PERCENT}% lines and statements`, async () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'bmsl-w5b4-coverage-'));
    try {
      const output = await runInGroup(
        'pnpm',
        [
          'exec',
          'vitest',
          'run',
          '--config',
          'vitest.config.ts',
          '--coverage.enabled=true',
          '--coverage.provider=v8',
          '--coverage.reporter=json-summary',
          '--coverage.reporter=text-summary',
          `--coverage.reportsDirectory=${dir}`,
          ...COVERAGE_FILES.map((f) => `--coverage.include=${f}`),
        ],
        {
          cwd: REPO_ROOT,
          env: { PATH: process.env.PATH, HOME: process.env.HOME, CI: '1', NODE_ENV: 'test' },
          timeoutMs: 300_000,
        },
      );
      const summary = JSON.parse(readFileSync(path.join(dir, 'coverage-summary.json'), 'utf8')) as Parameters<typeof coverageFailures>[0];
      // eslint-disable-next-line no-control-regex -- strips ANSI colour codes from the nested run's summary
      const plain = output.replace(/\u001b\[[0-9;]*m/g, '');
      const tests = /Tests\s+(\d+) passed/.exec(plain)?.[1];
      const lines = COVERAGE_FILES.map((f) => {
        const key = Object.keys(summary).find((k) => k.endsWith(`/${f}`));
        const e = key ? summary[key] : undefined;
        return `${f}: lines ${e?.lines.pct}% statements ${e?.statements.pct}%`;
      });
      const report = [`W5B4 changed-area coverage (floor ${COVERAGE_FLOOR_PERCENT}%, unit suite ${tests ?? '?'} tests passed):`, ...lines].join('\n');
      console.log(report);
      mkdirSync(path.join(REPO_ROOT, 'test-results/w5b4'), { recursive: true });
      writeFileSync(path.join(REPO_ROOT, 'test-results/w5b4/changed-area-coverage.txt'), `${report}\n`);
      if (process.env.GITHUB_STEP_SUMMARY) {
        writeFileSync(process.env.GITHUB_STEP_SUMMARY, `### W5B4 changed-area coverage\n\n\`\`\`\n${report}\n\`\`\`\n`, { flag: 'a' });
      }
      expect(tests, 'the nested unit run must report passing tests').toBeDefined();
      expect(coverageFailures(summary)).toEqual([]);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  }, 360_000);
});
