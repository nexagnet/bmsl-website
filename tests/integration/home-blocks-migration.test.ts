import pg from 'pg';
import type { Payload } from 'payload';
import { getPayload } from 'payload';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { migrations } from '../../src/migrations';

// Additive migration: optional home blocks and step confirmation. The existing process page row must survive up/down/up.
process.env.PAYLOAD_SECRET ??= 'synthetic-integration-secret';
const NAME = '20261022_104053_home_blocks_step_confirmed';
const index = migrations.findIndex((m) => m.name === NAME);

let payload: Payload;
let pool: pg.Pool;

const tableExists = async (name: string) =>
  ((await pool.query('select 1 from information_schema.tables where table_name = $1', [name])).rowCount ?? 0) > 0;

beforeAll(async () => {
  expect(index).toBeGreaterThan(-1);
  pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
  await pool.query('drop schema if exists public cascade; create schema public;');
  const { default: config } = await import('../../src/payload.config');
  payload = await getPayload({ config });
  await payload.db.migrate({ migrations: migrations.slice(0, index) as never });
});

afterAll(async () => {
  await payload?.destroy();
  await pool?.end();
});

describe('home blocks migration', () => {
  it('adds only new tables, keeps the page row, and survives down and up again', async () => {
    expect(await tableExists('home_page_stats')).toBe(false);
    await pool.query(`insert into home_page (title, _status) values ('Synthetic home', 'published')`);

    await payload.db.migrate({ migrations: migrations.slice(0, index + 1) as never });
    expect(await tableExists('home_page_stats')).toBe(true);
    expect(await tableExists('_home_page_v_version_stats')).toBe(true);
    expect((await pool.query('select title from home_page')).rows[0].title).toBe('Synthetic home');

    const parent = (await pool.query('select id from home_page')).rows[0].id;
    await pool.query(`insert into home_page_stats (_order, _parent_id, id, label, value) values (1, $1, 'a', 'L', 'V')`, [parent]);

    await payload.db.migrateDown();
    expect(await tableExists('home_page_stats')).toBe(false);
    expect((await pool.query('select title from home_page')).rows[0].title).toBe('Synthetic home');

    await payload.db.migrate({ migrations: migrations.slice(0, index + 1) as never });
    expect(await tableExists('home_page_stats')).toBe(true);
    expect((await pool.query('select count(*)::int as n from home_page_stats')).rows[0].n).toBe(0);
  });

  it('saves ordered stats through the CMS', async () => {
    // The CMS reads every current column, so bring the schema fully up to date first (later additive migrations).
    await payload.db.migrate({ migrations: migrations as never });
    await payload.updateGlobal({
      slug: 'home-page',
      data: { stats: [{ label: 'Synthetic L1', value: '1', confirmed: true }, { label: 'Synthetic L2', value: '2' }], _status: 'published' },
      overrideAccess: true,
    });
    const read = await payload.findGlobal({ slug: 'home-page', overrideAccess: false, depth: 0 });
    expect((read.stats ?? []).map((s: { label?: string | null }) => s.label)).toEqual(['Synthetic L1', 'Synthetic L2']);
  });
});

describe('process step confirmation flag', () => {
  it('is added with default false to existing step rows', async () => {
    const cols = (
      await pool.query(`select column_name from information_schema.columns where table_name = 'process_page_steps'`)
    ).rows.map((r: { column_name: string }) => r.column_name);
    expect(cols).toContain('confirmed');
  });
});
