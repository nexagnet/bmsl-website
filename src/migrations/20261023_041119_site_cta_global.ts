import { sql, type MigrateUpArgs, type MigrateDownArgs } from '@payloadcms/db-postgres';

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_site_cta_background_preset" AS ENUM('navy', 'gradient', 'grid', 'diagonal', 'glow');
  CREATE TYPE "public"."enum_site_cta_status" AS ENUM('draft', 'published');
  CREATE TYPE "public"."enum__site_cta_v_version_background_preset" AS ENUM('navy', 'gradient', 'grid', 'diagonal', 'glow');
  CREATE TYPE "public"."enum__site_cta_v_version_status" AS ENUM('draft', 'published');
  CREATE TABLE "site_cta" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"background_preset" "enum_site_cta_background_preset" DEFAULT 'navy',
  	"background_image_id" integer,
  	"_status" "enum_site_cta_status" DEFAULT 'draft',
  	"updated_at" timestamp(3) with time zone,
  	"created_at" timestamp(3) with time zone
  );
  
  CREATE TABLE "_site_cta_v" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"version_background_preset" "enum__site_cta_v_version_background_preset" DEFAULT 'navy',
  	"version_background_image_id" integer,
  	"version__status" "enum__site_cta_v_version_status" DEFAULT 'draft',
  	"version_updated_at" timestamp(3) with time zone,
  	"version_created_at" timestamp(3) with time zone,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"latest" boolean
  );
  
  INSERT INTO "site_cta" ("background_preset", "background_image_id", "_status", "updated_at", "created_at")
  SELECT "cta_band_preset"::text::"enum_site_cta_background_preset", "cta_band_image_id", 'published', now(), now() FROM "home_page"
  WHERE "_status" = 'published' AND ("cta_band_preset" IS DISTINCT FROM 'navy' OR "cta_band_image_id" IS NOT NULL) LIMIT 1;
  ALTER TABLE "home_page" DROP CONSTRAINT "home_page_cta_band_image_id_media_assets_id_fk";
  
  ALTER TABLE "_home_page_v" DROP CONSTRAINT "_home_page_v_version_cta_band_image_id_media_assets_id_fk";
  
  DROP INDEX "home_page_cta_band_cta_band_image_idx";
  DROP INDEX "_home_page_v_version_cta_band_version_cta_band_image_idx";
  ALTER TABLE "site_cta" ADD CONSTRAINT "site_cta_background_image_id_media_assets_id_fk" FOREIGN KEY ("background_image_id") REFERENCES "public"."media_assets"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_site_cta_v" ADD CONSTRAINT "_site_cta_v_version_background_image_id_media_assets_id_fk" FOREIGN KEY ("version_background_image_id") REFERENCES "public"."media_assets"("id") ON DELETE set null ON UPDATE no action;
  CREATE INDEX "site_cta_background_background_image_idx" ON "site_cta" USING btree ("background_image_id");
  CREATE INDEX "site_cta__status_idx" ON "site_cta" USING btree ("_status");
  CREATE INDEX "_site_cta_v_version_background_version_background_image_idx" ON "_site_cta_v" USING btree ("version_background_image_id");
  CREATE INDEX "_site_cta_v_version_version__status_idx" ON "_site_cta_v" USING btree ("version__status");
  CREATE INDEX "_site_cta_v_created_at_idx" ON "_site_cta_v" USING btree ("created_at");
  CREATE INDEX "_site_cta_v_updated_at_idx" ON "_site_cta_v" USING btree ("updated_at");
  CREATE INDEX "_site_cta_v_latest_idx" ON "_site_cta_v" USING btree ("latest");
  ALTER TABLE "home_page" DROP COLUMN "cta_band_preset";
  ALTER TABLE "home_page" DROP COLUMN "cta_band_image_id";
  ALTER TABLE "_home_page_v" DROP COLUMN "version_cta_band_preset";
  ALTER TABLE "_home_page_v" DROP COLUMN "version_cta_band_image_id";
  DROP TYPE "public"."enum_home_page_cta_band_preset";
  DROP TYPE "public"."enum__home_page_v_version_cta_band_preset";`)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_home_page_cta_band_preset" AS ENUM('navy', 'gradient', 'grid', 'diagonal', 'glow');
  CREATE TYPE "public"."enum__home_page_v_version_cta_band_preset" AS ENUM('navy', 'gradient', 'grid', 'diagonal', 'glow');
  ALTER TABLE "site_cta" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_site_cta_v" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "site_cta" CASCADE;
  DROP TABLE "_site_cta_v" CASCADE;
  ALTER TABLE "home_page" ADD COLUMN "cta_band_preset" "enum_home_page_cta_band_preset" DEFAULT 'navy';
  ALTER TABLE "home_page" ADD COLUMN "cta_band_image_id" integer;
  ALTER TABLE "_home_page_v" ADD COLUMN "version_cta_band_preset" "enum__home_page_v_version_cta_band_preset" DEFAULT 'navy';
  ALTER TABLE "_home_page_v" ADD COLUMN "version_cta_band_image_id" integer;
  ALTER TABLE "home_page" ADD CONSTRAINT "home_page_cta_band_image_id_media_assets_id_fk" FOREIGN KEY ("cta_band_image_id") REFERENCES "public"."media_assets"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_home_page_v" ADD CONSTRAINT "_home_page_v_version_cta_band_image_id_media_assets_id_fk" FOREIGN KEY ("version_cta_band_image_id") REFERENCES "public"."media_assets"("id") ON DELETE set null ON UPDATE no action;
  CREATE INDEX "home_page_cta_band_cta_band_image_idx" ON "home_page" USING btree ("cta_band_image_id");
  CREATE INDEX "_home_page_v_version_cta_band_version_cta_band_image_idx" ON "_home_page_v" USING btree ("version_cta_band_image_id");
  DROP TYPE "public"."enum_site_cta_background_preset";
  DROP TYPE "public"."enum_site_cta_status";
  DROP TYPE "public"."enum__site_cta_v_version_background_preset";
  DROP TYPE "public"."enum__site_cta_v_version_status";`)
}
