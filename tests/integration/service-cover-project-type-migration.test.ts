import pg from 'pg';
import type { Payload } from 'payload';
import { getPayload } from 'payload';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { migrations } from '../../src/migrations';

// Additive migration: optional service cover and free-text project type. Existing rows must survive up/down/up.
process.env.PAYLOAD_SECRET ??= 'synthetic-integration-secret';
const NAME = '20261022_095100_service_cover_project_type';
const index = migrations.findIndex((m) => m.name === NAME);

let payload: Payload;
let pool: pg.Pool;

const columns = async (table: string) =>
  (await pool.query('select column_name from information_schema.columns where table_name = $1', [table])).rows.map(
    (r: { column_name: string }) => r.column_name,
  );

beforeAll(async () => {
  expect(index).toBe(migrations.length - 1);
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

describe('service cover / project type migration', () => {
  it('applies additively, keeps existing rows with empty new columns, and rolls back and re-applies', async () => {
    expect(await columns('service_areas')).not.toContain('cover_id');
    await pool.query(
      `insert into service_areas (name, slug, summary, "order", _status) values ('Synthetic', 'synthetic', 's', 1, 'published')`,
    );
    await pool.query(`insert into projects (name, slug, source_status, _status) values ('P', 'p', 'CONFIRMED', 'draft')`);

    await payload.db.migrate({ migrations: migrations.slice(0, index + 1) as never });
    expect(await columns('service_areas')).toContain('cover_id');
    expect(await columns('_service_areas_v')).toContain('version_cover_id');
    expect(await columns('projects')).toContain('project_type');
    expect(await columns('_projects_v')).toContain('version_project_type');
    const svc = (await pool.query('select name, cover_id from service_areas')).rows[0];
    expect(svc).toEqual({ name: 'Synthetic', cover_id: null });
    expect((await pool.query('select project_type from projects')).rows[0].project_type).toBeNull();

    await payload.db.migrateDown();
    expect(await columns('service_areas')).not.toContain('cover_id');
    expect(await columns('projects')).not.toContain('project_type');
    expect((await pool.query('select name from service_areas')).rows[0].name).toBe('Synthetic');
    expect((await pool.query('select name from projects')).rows[0].name).toBe('P');

    await payload.db.migrate({ migrations: migrations.slice(0, index + 1) as never });
    expect(await columns('service_areas')).toContain('cover_id');
  });

  it('ON DELETE SET NULL clears a deleted cover instead of removing the service', async () => {
    const media = await pool.query(
      `insert into media_assets (alt, filename, mime_type, filesize, width, height, rights_status)
       values ('m', 'c.jpg', 'image/jpeg', 1, 1, 1, 'APPROVED') returning id`,
    );
    await pool.query('update service_areas set cover_id = $1', [media.rows[0].id]);
    await pool.query('delete from media_assets where id = $1', [media.rows[0].id]);
    const row = (await pool.query('select cover_id from service_areas')).rows[0];
    expect(row.cover_id).toBeNull();
  });
});
