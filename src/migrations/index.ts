import * as migration_20261005_080314_initial from './20261005_080314_initial';
import * as migration_20261005_120000_site_settings_analytics from './20261005_120000_site_settings_analytics';

export const migrations = [
  {
    up: migration_20261005_080314_initial.up,
    down: migration_20261005_080314_initial.down,
    name: '20261005_080314_initial'
  },
  {
    up: migration_20261005_120000_site_settings_analytics.up,
    down: migration_20261005_120000_site_settings_analytics.down,
    name: '20261005_120000_site_settings_analytics'
  },
];
