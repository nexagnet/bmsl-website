import * as migration_20261005_080314_initial from './20261005_080314_initial';
import * as migration_20261005_120000_site_settings_analytics from './20261005_120000_site_settings_analytics';
import * as migration_20261005_150000_job_confirmed_facts from './20261005_150000_job_confirmed_facts';
import * as migration_20261007_075550_lead_email_outbox from './20261007_075550_lead_email_outbox';
import * as migration_20261008_120000_home_page_hero from './20261008_120000_home_page_hero';
import * as migration_20261009_120000_request_type_tham_quan from './20261009_120000_request_type_tham_quan';
import * as migration_20261022_095100_service_cover_project_type from './20261022_095100_service_cover_project_type';
import * as migration_20261022_101846_process_steps from './20261022_101846_process_steps';
import * as migration_20261022_102156_about_blocks from './20261022_102156_about_blocks';
import * as migration_20261022_104053_home_blocks_step_confirmed from './20261022_104053_home_blocks_step_confirmed';
import * as migration_20261023_024353_lead_email_settings from './20261023_024353_lead_email_settings';

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
    up: migration_20261009_120000_request_type_tham_quan.up,
    down: migration_20261009_120000_request_type_tham_quan.down,
    name: '20261009_120000_request_type_tham_quan',
  },
  {
    up: migration_20261022_095100_service_cover_project_type.up,
    down: migration_20261022_095100_service_cover_project_type.down,
    name: '20261022_095100_service_cover_project_type',
  },
  {
    up: migration_20261022_101846_process_steps.up,
    down: migration_20261022_101846_process_steps.down,
    name: '20261022_101846_process_steps',
  },
  {
    up: migration_20261022_102156_about_blocks.up,
    down: migration_20261022_102156_about_blocks.down,
    name: '20261022_102156_about_blocks',
  },
  {
    up: migration_20261022_104053_home_blocks_step_confirmed.up,
    down: migration_20261022_104053_home_blocks_step_confirmed.down,
    name: '20261022_104053_home_blocks_step_confirmed',
  },
  {
    up: migration_20261023_024353_lead_email_settings.up,
    down: migration_20261023_024353_lead_email_settings.down,
    name: '20261023_024353_lead_email_settings',
  },
];
