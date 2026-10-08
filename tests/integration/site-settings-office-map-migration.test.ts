import pg from 'pg';
import type { Payload } from 'payload';
import { getPayload } from 'payload';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { migrations } from '../../src/migrations';

// Issue #83 (R2) — the office-map migration is ADDITIVE and keeps an existing SiteSettings row unchanged
// (disposable DB only). Steps: build the schema WITHOUT the new migration, insert a synthetic SiteSettings row and
// version, apply the migration, prove every preexisting value survived and the new fields are null/false, roll back
// and apply again. Same harness shape as lead-email-migration.test.ts. All values are synthetic.

process.env.PAYLOAD_SECRET ??= 'synthetic-integration-secret';
const NEW = '20261007_120000_site_settings_office_map';
const NEW_COLUMNS = ['contact_map_latitude', 'contact_map_longitude', 'contact_map_approved'];
const NEW_VERSION_COLUMNS = ['version_contact_map_latitude', 'version_contact_map_longitude', 'version_contact_map_approved'];

let payload: Payload;
let pool: pg.Pool;
const columns = async (table: string) =>
  (await pool.query('select column_name from information_schema.columns where table_name = $1', [table])).rows.map((r: { column_name: string }) => r.column_name);

const PRE = {
  contact_email: 'synthetic@bmsl-sandbox.example',
  contact_hotline: '0900 000 000',
  contact_zalo: '0900000001',
  ga4_id: 'G-ABC123DEF4',
  analytics_enabled: true,
  search_console_verification: 'synthetic-gsc-token',
};
const preSelect = Object.keys(PRE).join(', ');
const versionSelect = Object.keys(PRE).map((c) => `version_${c}`).join(', ');

beforeAll(async () => {
  pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
  await pool.query('drop schema if exists public cascade; create schema public;');
  const { default: config } = await import('../../src/payload.config');
  payload = await getPayload({ config });
  expect(migrations.at(-1)?.name).toBe(NEW);
  await payload.db.migrate({ migrations: migrations.slice(0, -1) as never });
});

afterAll(async () => {
  await payload?.destroy();
  await pool?.end();
});

describe('site settings office-map migration', () => {
  it('starts from a schema with a populated SiteSettings row and no map columns', async () => {
    const cols = await columns('site_settings');
    for (const c of NEW_COLUMNS) expect(cols).not.toContain(c);
    for (const c of NEW_VERSION_COLUMNS) expect(await columns('_site_settings_v')).not.toContain(c);
    expect(cols).toEqual(expect.arrayContaining(Object.keys(PRE)));

    const keys = Object.keys(PRE);
    await pool.query(
      `insert into site_settings (${keys.join(', ')}) values (${keys.map((_, i) => `$${i + 1}`).join(', ')})`,
      Object.values(PRE),
    );
    await pool.query(
      `insert into _site_settings_v (${keys.map((k) => `version_${k}`).join(', ')}) values (${keys.map((_, i) => `$${i + 1}`).join(', ')})`,
      Object.values(PRE),
    );
  });

  it('applies additively: preexisting values are unchanged and the new fields are null/false', async () => {
    await payload.db.migrate();
    expect((await pool.query('select 1 from payload_migrations where name = $1', [NEW])).rowCount).toBe(1);
    expect(await columns('site_settings')).toEqual(expect.arrayContaining(NEW_COLUMNS));
    expect(await columns('_site_settings_v')).toEqual(expect.arrayContaining(NEW_VERSION_COLUMNS));

    const live = await pool.query(`select ${preSelect}, contact_map_latitude, contact_map_longitude, contact_map_approved from site_settings`);
    expect(live.rowCount).toBe(1);
    expect(live.rows[0]).toEqual({ ...PRE, contact_map_latitude: null, contact_map_longitude: null, contact_map_approved: false });

    const ver = await pool.query(
      `select ${versionSelect}, version_contact_map_latitude, version_contact_map_longitude, version_contact_map_approved from _site_settings_v`,
    );
    expect(ver.rowCount).toBe(1);
    expect(ver.rows[0]).toEqual({
      ...Object.fromEntries(Object.entries(PRE).map(([k, v]) => [`version_${k}`, v])),
      version_contact_map_latitude: null,
      version_contact_map_longitude: null,
      version_contact_map_approved: false,
    });
  });

  it('rolls back cleanly (preexisting values kept) and can be applied again', async () => {
    await payload.db.migrateDown();
    for (const c of NEW_COLUMNS) expect(await columns('site_settings')).not.toContain(c);
    expect((await pool.query(`select ${preSelect} from site_settings`)).rows).toEqual([PRE]);

    await payload.db.migrate();
    expect(await columns('site_settings')).toEqual(expect.arrayContaining(NEW_COLUMNS));
    expect((await pool.query(`select ${preSelect} from site_settings`)).rows).toEqual([PRE]);
  });
});
