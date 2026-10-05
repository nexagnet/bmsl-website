import * as migration_20261005_080314_initial from './20261005_080314_initial';

export const migrations = [
  {
    up: migration_20261005_080314_initial.up,
    down: migration_20261005_080314_initial.down,
    name: '20261005_080314_initial'
  },
];
