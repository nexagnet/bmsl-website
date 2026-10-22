import pg from 'pg';
import type { Payload } from 'payload';
import { getPayload } from 'payload';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { migrations } from '../../src/migrations';

// Additive migration: optional process steps. The existing process page row must survive up/down/up.
process.env.PAYLOAD_SECRET ??= 'synthetic-integration-secret';
const NAME = '20261022_101846_process_steps';
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

describe('process steps migration', () => {
  it('adds only new tables, keeps the page row, and survives down and up again', async () => {
    expect(await tableExists('process_page_steps')).toBe(false);
    await pool.query(`insert into process_page (title, _status) values ('Synthetic process', 'published')`);

    await payload.db.migrate({ migrations: migrations.slice(0, index + 1) as never });
    expect(await tableExists('process_page_steps')).toBe(true);
    expect(await tableExists('_process_page_v_version_steps')).toBe(true);
    expect((await pool.query('select title from process_page')).rows[0].title).toBe('Synthetic process');

    const parent = (await pool.query('select id from process_page')).rows[0].id;
    await pool.query(`insert into process_page_steps (_order, _parent_id, id, title) values (1, $1, 'a', 'B1')`, [parent]);

    await payload.db.migrateDown();
    expect(await tableExists('process_page_steps')).toBe(false);
    expect((await pool.query('select title from process_page')).rows[0].title).toBe('Synthetic process');

    await payload.db.migrate({ migrations: migrations.slice(0, index + 1) as never });
    expect(await tableExists('process_page_steps')).toBe(true);
    expect((await pool.query('select count(*)::int as n from process_page_steps')).rows[0].n).toBe(0);
  });

  it('saves ordered steps through the CMS', async () => {
    // The current config includes later additive columns (for example the confirmation flag): apply every migration.
    await payload.db.migrate();
    await payload.updateGlobal({
      slug: 'process-page',
      data: { steps: [{ title: 'Synthetic B1' }, { title: 'Synthetic B2', duration: 'x' }], _status: 'published' },
      overrideAccess: true,
    });
    const read = await payload.findGlobal({ slug: 'process-page', overrideAccess: false, depth: 0 });
    expect((read.steps ?? []).map((s: { title?: string | null }) => s.title)).toEqual(['Synthetic B1', 'Synthetic B2']);
  });
});
