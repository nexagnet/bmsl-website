import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { migrations } from '../migrations';

const HERO_MIGRATION_NAME = '20261008_120000_home_page_hero';

describe('HomePage Hero Migration Registry & Isolation', () => {
  it('registers the home page hero migration in sequential order', () => {
    const heroIndex = migrations.findIndex((m) => m.name === HERO_MIGRATION_NAME);
    expect(heroIndex).toBeGreaterThan(-1);
    const hero = migrations[heroIndex];
    expect(hero?.name).toBe(HERO_MIGRATION_NAME);
    expect(typeof hero?.up).toBe('function');
    expect(typeof hero?.down).toBe('function');
  });

  it('preserves all previous migrations in the index', () => {
    const names = migrations.map((m) => m.name);
    expect(names).toContain('20261005_080314_initial');
    expect(names).toContain('20261005_120000_site_settings_analytics');
    expect(names).toContain('20261005_150000_job_confirmed_facts');
    expect(names).toContain('20261007_075550_lead_email_outbox');
    expect(names).toContain(HERO_MIGRATION_NAME);
  });

  it('ensures src/migrations contains only migration modules and snapshots, with no test files', () => {
    const migrationsDir = path.resolve(__dirname, '../migrations');
    const files = fs.readdirSync(migrationsDir);
    // Regression proof: Payload scans migrationDir at runtime. It must never encounter *.test.ts files.
    const testFiles = files.filter((f) => f.includes('.test.') || f.includes('.spec.'));
    expect(testFiles).toEqual([]);

    // Every migration TypeScript file except index.ts should have a matching .json snapshot
    const tsMigrations = files.filter((f) => f.endsWith('.ts') && f !== 'index.ts');
    for (const tsFile of tsMigrations) {
      const baseName = tsFile.replace(/\.ts$/, '');
      expect(files).toContain(`${baseName}.json`);
    }
  });
});
