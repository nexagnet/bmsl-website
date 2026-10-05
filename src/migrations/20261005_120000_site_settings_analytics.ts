import { sql, type MigrateUpArgs, type MigrateDownArgs } from '@payloadcms/db-postgres'

// W5A: opt-in analytics switch (default OFF) and Search Console verification token on SiteSettings.
export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "site_settings" ADD COLUMN "analytics_enabled" boolean DEFAULT false;
  ALTER TABLE "site_settings" ADD COLUMN "search_console_verification" varchar;
  ALTER TABLE "_site_settings_v" ADD COLUMN "version_analytics_enabled" boolean DEFAULT false;
  ALTER TABLE "_site_settings_v" ADD COLUMN "version_search_console_verification" varchar;`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "site_settings" DROP COLUMN "analytics_enabled";
  ALTER TABLE "site_settings" DROP COLUMN "search_console_verification";
  ALTER TABLE "_site_settings_v" DROP COLUMN "version_analytics_enabled";
  ALTER TABLE "_site_settings_v" DROP COLUMN "version_search_console_verification";`)
}
