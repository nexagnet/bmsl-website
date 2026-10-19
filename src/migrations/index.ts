import * as migration_20261005_080314_initial from './20261005_080314_initial';
import * as migration_20261005_120000_site_settings_analytics from './20261005_120000_site_settings_analytics';
import * as migration_20261005_150000_job_confirmed_facts from './20261005_150000_job_confirmed_facts';
import * as migration_20261007_075550_lead_email_outbox from './20261007_075550_lead_email_outbox';
import * as migration_20261008_120000_home_page_hero from './20261008_120000_home_page_hero';
import * as migration_20261019_120000_site_settings_office_map from './20261019_120000_site_settings_office_map';

export const migrations = [
  {
    up: migration_20261005_080314_initial.up,
    down: migration_20261005_080314_initial.down,
    name: '20261005_080314_initial',
  },
  {
    up: migration_20261005_120000_site_settings_analytics.up,
    down: migration_20261005_120000_site_settings_analytics.down,
    name: '20261005_120000_site_settings_analytics',
  },
  {
    up: migration_20261005_150000_job_confirmed_facts.up,
    down: migration_20261005_150000_job_confirmed_facts.down,
    name: '20261005_150000_job_confirmed_facts',
  },
  {
    up: migration_20261007_075550_lead_email_outbox.up,
    down: migration_20261007_075550_lead_email_outbox.down,
    name: '20261007_075550_lead_email_outbox',
  },
  {
    up: migration_20261008_120000_home_page_hero.up,
    down: migration_20261008_120000_home_page_hero.down,
    name: '20261008_120000_home_page_hero',
  },
  {
    up: migration_20261019_120000_site_settings_office_map.up,
    down: migration_20261019_120000_site_settings_office_map.down,
    name: '20261019_120000_site_settings_office_map',
  },
];
