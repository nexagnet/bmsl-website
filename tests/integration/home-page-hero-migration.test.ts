import pg from 'pg';
import type { Payload } from 'payload';
import { getPayload } from 'payload';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { migrations } from '../../src/migrations';

// Issue #102 & Issue #106 — HomePage hero migration contract verification.
// Verifies that the migration is additive, preserves existing homepage data,
// supports rollback without data loss on pre-existing columns, and enforces nullable media FKs.

process.env.PAYLOAD_SECRET ??= 'synthetic-integration-secret';
const HERO_MIGRATION = '20261008_120000_home_page_hero';
const heroIndex = migrations.findIndex((m) => m.name === HERO_MIGRATION);

let payload: Payload;
let pool: pg.Pool;

const columns = async (table: string) =>
  (await pool.query('select column_name from information_schema.columns where table_name = $1', [table])).rows.map(
    (r: { column_name: string }) => r.column_name,
  );

beforeAll(async () => {
  expect(heroIndex).toBeGreaterThan(-1);
  pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
  await pool.query('drop schema if exists public cascade; create schema public;');
  const { default: config } = await import('../../src/payload.config');
  payload = await getPayload({ config });
  // Migrate up to before the hero migration
  await payload.db.migrate({ migrations: migrations.slice(0, heroIndex) as never });
});

afterAll(async () => {
  await payload?.destroy();
  await pool?.end();
});

describe('HomePage Hero Migration (Disposable DB)', () => {
  it('starts from a schema where home_page exists without hero columns', async () => {
    const hpCols = await columns('home_page');
    expect(hpCols).toContain('title');
    expect(hpCols).toContain('body');
    expect(hpCols).not.toContain('hero_enabled');
    expect(hpCols).not.toContain('hero_desktop_image_id');

    // Insert synthetic existing home_page document
    await pool.query(
      `insert into home_page (title, body, _status)
       values ($1, $2, 'published')`,
      ['BMSL - Ban Quản Lý Tòa Nhà', JSON.stringify({ root: { children: [] } })],
    );
  });

  it('applies additively: existing home_page record is preserved and new hero columns are present', async () => {
    await payload.db.migrate({ migrations: migrations.slice(0, heroIndex + 1) as never });

    expect((await pool.query('select 1 from payload_migrations where name = $1', [HERO_MIGRATION])).rowCount).toBe(1);

    const hpCols = await columns('home_page');
    expect(hpCols).toContain('hero_enabled');
    expect(hpCols).toContain('hero_headline');
    expect(hpCols).toContain('hero_kicker');
    expect(hpCols).toContain('hero_supporting_text');
    expect(hpCols).toContain('hero_primary_cta_text');
    expect(hpCols).toContain('hero_primary_cta_link');
    expect(hpCols).toContain('hero_secondary_cta_text');
    expect(hpCols).toContain('hero_secondary_cta_link');
    expect(hpCols).toContain('hero_desktop_image_id');
    expect(hpCols).toContain('hero_mobile_image_id');
    expect(hpCols).toContain('hero_focal_point');
    expect(hpCols).toContain('hero_overlay_preset');
    expect(hpCols).toContain('hero_layout_preset');

    const hpvCols = await columns('_home_page_v');
    expect(hpvCols).toContain('version_hero_enabled');
    expect(hpvCols).toContain('version_hero_headline');
    expect(hpvCols).toContain('version_hero_desktop_image_id');

    // Verify existing record is retained and untouched
    const rows = (await pool.query('select id, title, hero_enabled, hero_layout_preset from home_page')).rows;
    expect(rows.length).toBe(1);
    expect(rows[0].title).toBe('BMSL - Ban Quản Lý Tòa Nhà');
    expect(rows[0].hero_enabled).toBe(true);
    expect(rows[0].hero_layout_preset).toBe('editorial');
  });

  it('supports nullable media foreign keys with ON DELETE SET NULL', async () => {
    // Insert a test media asset
    const mediaRes = await pool.query(
      `insert into media_assets (alt, filename, mime_type, filesize, width, height, rights_status)
       values ('Test Building', 'test-hero.jpg', 'image/jpeg', 1024, 1920, 1080, 'APPROVED')
       returning id`,
    );
    const mediaId = mediaRes.rows[0].id;

    // Link hero to media asset
    await pool.query(`update home_page set hero_desktop_image_id = $1`, [mediaId]);
    const linked = (await pool.query('select hero_desktop_image_id from home_page')).rows[0];
    expect(linked.hero_desktop_image_id).toBe(mediaId);

    // Delete media asset -> verify ON DELETE SET NULL sets hero_desktop_image_id to null
    await pool.query(`delete from media_assets where id = $1`, [mediaId]);
    const afterDelete = (await pool.query('select hero_desktop_image_id from home_page')).rows[0];
    expect(afterDelete.hero_desktop_image_id).toBeNull();
  });

  it('rolls back cleanly: drops hero columns while preserving core home_page data, and can be reapplied', async () => {
    await payload.db.migrateDown();

    const hpCols = await columns('home_page');
    expect(hpCols).not.toContain('hero_enabled');
    expect(hpCols).not.toContain('hero_desktop_image_id');
    expect(hpCols).toContain('title');

    // Existing data retained
    const rows = (await pool.query('select id, title from home_page')).rows;
    expect(rows.length).toBe(1);
    expect(rows[0].title).toBe('BMSL - Ban Quản Lý Tòa Nhà');

    // Reapply migration
    await payload.db.migrate({ migrations: migrations.slice(0, heroIndex + 1) as never });
    const hpColsReapplied = await columns('home_page');
    expect(hpColsReapplied).toContain('hero_enabled');
    expect(hpColsReapplied).toContain('hero_desktop_image_id');
  });
});
