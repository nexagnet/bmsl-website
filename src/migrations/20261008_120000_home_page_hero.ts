import { sql, type MigrateUpArgs, type MigrateDownArgs } from '@payloadcms/db-postgres';

// Additive migration for HomePage hero section (Issue #102 & Issue #106)
// Preserves existing title, body, and SEO fields for home_page and _home_page_v.
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
  CREATE TYPE "public"."enum_home_page_hero_focal_point" AS ENUM('center', 'top', 'bottom');
  CREATE TYPE "public"."enum__home_page_v_version_hero_focal_point" AS ENUM('center', 'top', 'bottom');
  CREATE TYPE "public"."enum_home_page_hero_overlay_preset" AS ENUM('soft', 'strong', 'none');
  CREATE TYPE "public"."enum__home_page_v_version_hero_overlay_preset" AS ENUM('soft', 'strong', 'none');
  CREATE TYPE "public"."enum_home_page_hero_layout_preset" AS ENUM('editorial', 'split');
  CREATE TYPE "public"."enum__home_page_v_version_hero_layout_preset" AS ENUM('editorial', 'split');

  ALTER TABLE "home_page" ADD COLUMN "hero_enabled" boolean DEFAULT true;
  ALTER TABLE "home_page" ADD COLUMN "hero_kicker" varchar;
  ALTER TABLE "home_page" ADD COLUMN "hero_headline" varchar;
  ALTER TABLE "home_page" ADD COLUMN "hero_supporting_text" varchar;
  ALTER TABLE "home_page" ADD COLUMN "hero_primary_cta_text" varchar;
  ALTER TABLE "home_page" ADD COLUMN "hero_primary_cta_link" varchar;
  ALTER TABLE "home_page" ADD COLUMN "hero_secondary_cta_text" varchar;
  ALTER TABLE "home_page" ADD COLUMN "hero_secondary_cta_link" varchar;
  ALTER TABLE "home_page" ADD COLUMN "hero_desktop_image_id" integer;
  ALTER TABLE "home_page" ADD COLUMN "hero_mobile_image_id" integer;
  ALTER TABLE "home_page" ADD COLUMN "hero_focal_point" "enum_home_page_hero_focal_point" DEFAULT 'center';
  ALTER TABLE "home_page" ADD COLUMN "hero_overlay_preset" "enum_home_page_hero_overlay_preset" DEFAULT 'soft';
  ALTER TABLE "home_page" ADD COLUMN "hero_layout_preset" "enum_home_page_hero_layout_preset" DEFAULT 'editorial';

  ALTER TABLE "_home_page_v" ADD COLUMN "version_hero_enabled" boolean DEFAULT true;
  ALTER TABLE "_home_page_v" ADD COLUMN "version_hero_kicker" varchar;
  ALTER TABLE "_home_page_v" ADD COLUMN "version_hero_headline" varchar;
  ALTER TABLE "_home_page_v" ADD COLUMN "version_hero_supporting_text" varchar;
  ALTER TABLE "_home_page_v" ADD COLUMN "version_hero_primary_cta_text" varchar;
  ALTER TABLE "_home_page_v" ADD COLUMN "version_hero_primary_cta_link" varchar;
  ALTER TABLE "_home_page_v" ADD COLUMN "version_hero_secondary_cta_text" varchar;
  ALTER TABLE "_home_page_v" ADD COLUMN "version_hero_secondary_cta_link" varchar;
  ALTER TABLE "_home_page_v" ADD COLUMN "version_hero_desktop_image_id" integer;
  ALTER TABLE "_home_page_v" ADD COLUMN "version_hero_mobile_image_id" integer;
  ALTER TABLE "_home_page_v" ADD COLUMN "version_hero_focal_point" "enum__home_page_v_version_hero_focal_point" DEFAULT 'center';
  ALTER TABLE "_home_page_v" ADD COLUMN "version_hero_overlay_preset" "enum__home_page_v_version_hero_overlay_preset" DEFAULT 'soft';
  ALTER TABLE "_home_page_v" ADD COLUMN "version_hero_layout_preset" "enum__home_page_v_version_hero_layout_preset" DEFAULT 'editorial';

  ALTER TABLE "home_page" ADD CONSTRAINT "home_page_hero_desktop_image_id_media_assets_id_fk" FOREIGN KEY ("hero_desktop_image_id") REFERENCES "public"."media_assets"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "home_page" ADD CONSTRAINT "home_page_hero_mobile_image_id_media_assets_id_fk" FOREIGN KEY ("hero_mobile_image_id") REFERENCES "public"."media_assets"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_home_page_v" ADD CONSTRAINT "_home_page_v_version_hero_desktop_image_id_media_assets_id_fk" FOREIGN KEY ("version_hero_desktop_image_id") REFERENCES "public"."media_assets"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_home_page_v" ADD CONSTRAINT "_home_page_v_version_hero_mobile_image_id_media_assets_id_fk" FOREIGN KEY ("version_hero_mobile_image_id") REFERENCES "public"."media_assets"("id") ON DELETE set null ON UPDATE no action;

  CREATE INDEX "home_page_hero_desktop_image_idx" ON "home_page" USING btree ("hero_desktop_image_id");
  CREATE INDEX "home_page_hero_mobile_image_idx" ON "home_page" USING btree ("hero_mobile_image_id");
  CREATE INDEX "_home_page_v_version_hero_desktop_image_idx" ON "_home_page_v" USING btree ("version_hero_desktop_image_id");
  CREATE INDEX "_home_page_v_version_hero_mobile_image_idx" ON "_home_page_v" USING btree ("version_hero_mobile_image_id");`);
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
  ALTER TABLE "home_page" DROP CONSTRAINT "home_page_hero_desktop_image_id_media_assets_id_fk";
  ALTER TABLE "home_page" DROP CONSTRAINT "home_page_hero_mobile_image_id_media_assets_id_fk";
  ALTER TABLE "_home_page_v" DROP CONSTRAINT "_home_page_v_version_hero_desktop_image_id_media_assets_id_fk";
  ALTER TABLE "_home_page_v" DROP CONSTRAINT "_home_page_v_version_hero_mobile_image_id_media_assets_id_fk";

  DROP INDEX IF EXISTS "home_page_hero_desktop_image_idx";
  DROP INDEX IF EXISTS "home_page_hero_mobile_image_idx";
  DROP INDEX IF EXISTS "_home_page_v_version_hero_desktop_image_idx";
  DROP INDEX IF EXISTS "_home_page_v_version_hero_mobile_image_idx";

  ALTER TABLE "home_page" DROP COLUMN "hero_enabled";
  ALTER TABLE "home_page" DROP COLUMN "hero_kicker";
  ALTER TABLE "home_page" DROP COLUMN "hero_headline";
  ALTER TABLE "home_page" DROP COLUMN "hero_supporting_text";
  ALTER TABLE "home_page" DROP COLUMN "hero_primary_cta_text";
  ALTER TABLE "home_page" DROP COLUMN "hero_primary_cta_link";
  ALTER TABLE "home_page" DROP COLUMN "hero_secondary_cta_text";
  ALTER TABLE "home_page" DROP COLUMN "hero_secondary_cta_link";
  ALTER TABLE "home_page" DROP COLUMN "hero_desktop_image_id";
  ALTER TABLE "home_page" DROP COLUMN "hero_mobile_image_id";
  ALTER TABLE "home_page" DROP COLUMN "hero_focal_point";
  ALTER TABLE "home_page" DROP COLUMN "hero_overlay_preset";
  ALTER TABLE "home_page" DROP COLUMN "hero_layout_preset";

  ALTER TABLE "_home_page_v" DROP COLUMN "version_hero_enabled";
  ALTER TABLE "_home_page_v" DROP COLUMN "version_hero_kicker";
  ALTER TABLE "_home_page_v" DROP COLUMN "version_hero_headline";
  ALTER TABLE "_home_page_v" DROP COLUMN "version_hero_supporting_text";
  ALTER TABLE "_home_page_v" DROP COLUMN "version_hero_primary_cta_text";
  ALTER TABLE "_home_page_v" DROP COLUMN "version_hero_primary_cta_link";
  ALTER TABLE "_home_page_v" DROP COLUMN "version_hero_secondary_cta_text";
  ALTER TABLE "_home_page_v" DROP COLUMN "version_hero_secondary_cta_link";
  ALTER TABLE "_home_page_v" DROP COLUMN "version_hero_desktop_image_id";
  ALTER TABLE "_home_page_v" DROP COLUMN "version_hero_mobile_image_id";
  ALTER TABLE "_home_page_v" DROP COLUMN "version_hero_focal_point";
  ALTER TABLE "_home_page_v" DROP COLUMN "version_hero_overlay_preset";
  ALTER TABLE "_home_page_v" DROP COLUMN "version_hero_layout_preset";

  DROP TYPE IF EXISTS "public"."enum_home_page_hero_focal_point";
  DROP TYPE IF EXISTS "public"."enum__home_page_v_version_hero_focal_point";
  DROP TYPE IF EXISTS "public"."enum_home_page_hero_overlay_preset";
  DROP TYPE IF EXISTS "public"."enum__home_page_v_version_hero_overlay_preset";
  DROP TYPE IF EXISTS "public"."enum_home_page_hero_layout_preset";
  DROP TYPE IF EXISTS "public"."enum__home_page_v_version_hero_layout_preset";`);
}
