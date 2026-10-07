import { sql, type MigrateUpArgs, type MigrateDownArgs } from '@payloadcms/db-postgres'

// Additive only: nullable columns and a default-false flag, so existing SiteSettings rows and versions are preserved.
export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "site_settings" ADD COLUMN "contact_map_latitude" numeric;
  ALTER TABLE "site_settings" ADD COLUMN "contact_map_longitude" numeric;
  ALTER TABLE "site_settings" ADD COLUMN "contact_map_approved" boolean DEFAULT false;
  ALTER TABLE "_site_settings_v" ADD COLUMN "version_contact_map_latitude" numeric;
  ALTER TABLE "_site_settings_v" ADD COLUMN "version_contact_map_longitude" numeric;
  ALTER TABLE "_site_settings_v" ADD COLUMN "version_contact_map_approved" boolean DEFAULT false;`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "site_settings" DROP COLUMN "contact_map_latitude";
  ALTER TABLE "site_settings" DROP COLUMN "contact_map_longitude";
  ALTER TABLE "site_settings" DROP COLUMN "contact_map_approved";
  ALTER TABLE "_site_settings_v" DROP COLUMN "version_contact_map_latitude";
  ALTER TABLE "_site_settings_v" DROP COLUMN "version_contact_map_longitude";
  ALTER TABLE "_site_settings_v" DROP COLUMN "version_contact_map_approved";`)
}
