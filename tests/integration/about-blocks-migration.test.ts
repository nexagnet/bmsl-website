import pg from 'pg';
import type { Payload } from 'payload';
import { getPayload } from 'payload';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { migrations } from '../../src/migrations';

// Additive migration: optional About blocks. The existing process page row must survive up/down/up.
process.env.PAYLOAD_SECRET ??= 'synthetic-integration-secret';
const NAME = '20261022_102156_about_blocks';
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

describe('about blocks migration', () => {
  it('adds only new tables, keeps the page row, and survives down and up again', async () => {
    expect(await tableExists('about_page_history')).toBe(false);
    await pool.query(`insert into about_page (title, _status) values ('Synthetic about', 'published')`);

    await payload.db.migrate({ migrations: migrations.slice(0, index + 1) as never });
    expect(await tableExists('about_page_history')).toBe(true);
    expect(await tableExists('_about_page_v_version_history')).toBe(true);
    expect((await pool.query('select title from about_page')).rows[0].title).toBe('Synthetic about');

    const parent = (await pool.query('select id from about_page')).rows[0].id;
    await pool.query(`insert into about_page_history (_order, _parent_id, id, year, title) values (1, $1, 'a', '2021', 'B1')`, [parent]);

    await payload.db.migrateDown();
    expect(await tableExists('about_page_history')).toBe(false);
    expect((await pool.query('select title from about_page')).rows[0].title).toBe('Synthetic about');

    await payload.db.migrate({ migrations: migrations.slice(0, index + 1) as never });
    expect(await tableExists('about_page_history')).toBe(true);
    expect((await pool.query('select count(*)::int as n from about_page_history')).rows[0].n).toBe(0);
  });

  it('saves ordered history items through the CMS', async () => {
    await payload.updateGlobal({
      slug: 'about-page',
      data: { history: [{ year: '2021', title: 'Synthetic B1', confirmed: true }, { year: '2022', title: 'Synthetic B2' }], _status: 'published' },
      overrideAccess: true,
    });
    const read = await payload.findGlobal({ slug: 'about-page', overrideAccess: false, depth: 0 });
    expect((read.history ?? []).map((s: { title?: string | null }) => s.title)).toEqual(['Synthetic B1', 'Synthetic B2']);
  });
});
