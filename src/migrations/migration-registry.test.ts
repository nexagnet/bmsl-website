import { describe, expect, it } from 'vitest';
import { migrations } from './index';

const MIGRATION_NAME = '20261008_120000_home_page_hero';

describe('HomePage Hero Migration Registry', () => {
  it('registers the home page hero migration as the latest migration in sequential order', () => {
    const latest = migrations.at(-1);
    expect(latest?.name).toBe(MIGRATION_NAME);
    expect(typeof latest?.up).toBe('function');
    expect(typeof latest?.down).toBe('function');
  });

  it('preserves all previous migrations in the index', () => {
    const names = migrations.map((m) => m.name);
    expect(names).toContain('20261005_080314_initial');
    expect(names).toContain('20261005_120000_site_settings_analytics');
    expect(names).toContain('20261005_150000_job_confirmed_facts');
    expect(names).toContain('20261007_075550_lead_email_outbox');
    expect(names).toContain(MIGRATION_NAME);
  });
});
