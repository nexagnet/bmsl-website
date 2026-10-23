import { sql, type MigrateUpArgs, type MigrateDownArgs } from '@payloadcms/db-postgres';

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_home_page_sections_section" AS ENUM('stats', 'services', 'projects', 'process', 'articles');
  CREATE TYPE "public"."enum_home_page_cta_band_preset" AS ENUM('navy', 'gradient', 'grid', 'diagonal', 'glow');
  CREATE TYPE "public"."enum__home_page_v_version_sections_section" AS ENUM('stats', 'services', 'projects', 'process', 'articles');
  CREATE TYPE "public"."enum__home_page_v_version_cta_band_preset" AS ENUM('navy', 'gradient', 'grid', 'diagonal', 'glow');
  CREATE TABLE "home_page_sections" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"section" "enum_home_page_sections_section",
  	"visible" boolean DEFAULT true
  );
  
  CREATE TABLE "_home_page_v_version_sections" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"section" "enum__home_page_v_version_sections_section",
  	"visible" boolean DEFAULT true,
  	"_uuid" varchar
  );
  
  ALTER TABLE "home_page" ADD COLUMN "projects_limit" numeric DEFAULT 6;
  ALTER TABLE "home_page" ADD COLUMN "articles_limit" numeric DEFAULT 3;
  ALTER TABLE "home_page" ADD COLUMN "cta_band_preset" "enum_home_page_cta_band_preset" DEFAULT 'navy';
  ALTER TABLE "home_page" ADD COLUMN "cta_band_image_id" integer;
  ALTER TABLE "_home_page_v" ADD COLUMN "version_projects_limit" numeric DEFAULT 6;
  ALTER TABLE "_home_page_v" ADD COLUMN "version_articles_limit" numeric DEFAULT 3;
  ALTER TABLE "_home_page_v" ADD COLUMN "version_cta_band_preset" "enum__home_page_v_version_cta_band_preset" DEFAULT 'navy';
  ALTER TABLE "_home_page_v" ADD COLUMN "version_cta_band_image_id" integer;
  ALTER TABLE "home_page_sections" ADD CONSTRAINT "home_page_sections_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."home_page"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_home_page_v_version_sections" ADD CONSTRAINT "_home_page_v_version_sections_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_home_page_v"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "home_page_sections_order_idx" ON "home_page_sections" USING btree ("_order");
  CREATE INDEX "home_page_sections_parent_id_idx" ON "home_page_sections" USING btree ("_parent_id");
  CREATE INDEX "_home_page_v_version_sections_order_idx" ON "_home_page_v_version_sections" USING btree ("_order");
  CREATE INDEX "_home_page_v_version_sections_parent_id_idx" ON "_home_page_v_version_sections" USING btree ("_parent_id");
  ALTER TABLE "home_page" ADD CONSTRAINT "home_page_cta_band_image_id_media_assets_id_fk" FOREIGN KEY ("cta_band_image_id") REFERENCES "public"."media_assets"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_home_page_v" ADD CONSTRAINT "_home_page_v_version_cta_band_image_id_media_assets_id_fk" FOREIGN KEY ("version_cta_band_image_id") REFERENCES "public"."media_assets"("id") ON DELETE set null ON UPDATE no action;
  CREATE INDEX "home_page_cta_band_cta_band_image_idx" ON "home_page" USING btree ("cta_band_image_id");
  CREATE INDEX "_home_page_v_version_cta_band_version_cta_band_image_idx" ON "_home_page_v" USING btree ("version_cta_band_image_id");`)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "home_page_sections" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_home_page_v_version_sections" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "home_page_sections" CASCADE;
  DROP TABLE "_home_page_v_version_sections" CASCADE;
  ALTER TABLE "home_page" DROP CONSTRAINT "home_page_cta_band_image_id_media_assets_id_fk";
  
  ALTER TABLE "_home_page_v" DROP CONSTRAINT "_home_page_v_version_cta_band_image_id_media_assets_id_fk";
  
  DROP INDEX "home_page_cta_band_cta_band_image_idx";
  DROP INDEX "_home_page_v_version_cta_band_version_cta_band_image_idx";
  ALTER TABLE "home_page" DROP COLUMN "projects_limit";
  ALTER TABLE "home_page" DROP COLUMN "articles_limit";
  ALTER TABLE "home_page" DROP COLUMN "cta_band_preset";
  ALTER TABLE "home_page" DROP COLUMN "cta_band_image_id";
  ALTER TABLE "_home_page_v" DROP COLUMN "version_projects_limit";
  ALTER TABLE "_home_page_v" DROP COLUMN "version_articles_limit";
  ALTER TABLE "_home_page_v" DROP COLUMN "version_cta_band_preset";
  ALTER TABLE "_home_page_v" DROP COLUMN "version_cta_band_image_id";
  DROP TYPE "public"."enum_home_page_sections_section";
  DROP TYPE "public"."enum_home_page_cta_band_preset";
  DROP TYPE "public"."enum__home_page_v_version_sections_section";
  DROP TYPE "public"."enum__home_page_v_version_cta_band_preset";`)
}
