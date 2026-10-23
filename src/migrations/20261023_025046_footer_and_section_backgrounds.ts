import { sql, type MigrateUpArgs, type MigrateDownArgs } from '@payloadcms/db-postgres';

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_home_page_process_band_preset" AS ENUM('navy', 'gradient', 'grid', 'diagonal', 'glow');
  CREATE TYPE "public"."enum__home_page_v_version_process_band_preset" AS ENUM('navy', 'gradient', 'grid', 'diagonal', 'glow');
  CREATE TYPE "public"."enum_site_footer_background_preset" AS ENUM('navy', 'gradient', 'grid', 'diagonal', 'glow');
  CREATE TYPE "public"."enum_site_footer_status" AS ENUM('draft', 'published');
  CREATE TYPE "public"."enum__site_footer_v_version_background_preset" AS ENUM('navy', 'gradient', 'grid', 'diagonal', 'glow');
  CREATE TYPE "public"."enum__site_footer_v_version_status" AS ENUM('draft', 'published');
  CREATE TABLE "site_footer_links" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"label" varchar,
  	"href" varchar,
  	"confirmed" boolean DEFAULT false
  );
  
  CREATE TABLE "site_footer" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"background_preset" "enum_site_footer_background_preset" DEFAULT 'navy',
  	"background_image_id" integer,
  	"intro_text" varchar,
  	"intro_confirmed" boolean DEFAULT false,
  	"copyright" varchar,
  	"_status" "enum_site_footer_status" DEFAULT 'draft',
  	"updated_at" timestamp(3) with time zone,
  	"created_at" timestamp(3) with time zone
  );
  
  CREATE TABLE "_site_footer_v_version_links" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"label" varchar,
  	"href" varchar,
  	"confirmed" boolean DEFAULT false,
  	"_uuid" varchar
  );
  
  CREATE TABLE "_site_footer_v" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"version_background_preset" "enum__site_footer_v_version_background_preset" DEFAULT 'navy',
  	"version_background_image_id" integer,
  	"version_intro_text" varchar,
  	"version_intro_confirmed" boolean DEFAULT false,
  	"version_copyright" varchar,
  	"version__status" "enum__site_footer_v_version_status" DEFAULT 'draft',
  	"version_updated_at" timestamp(3) with time zone,
  	"version_created_at" timestamp(3) with time zone,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"latest" boolean
  );
  
  ALTER TABLE "home_page" ADD COLUMN "process_band_preset" "enum_home_page_process_band_preset" DEFAULT 'navy';
  ALTER TABLE "home_page" ADD COLUMN "process_band_image_id" integer;
  ALTER TABLE "_home_page_v" ADD COLUMN "version_process_band_preset" "enum__home_page_v_version_process_band_preset" DEFAULT 'navy';
  ALTER TABLE "_home_page_v" ADD COLUMN "version_process_band_image_id" integer;
  ALTER TABLE "site_footer_links" ADD CONSTRAINT "site_footer_links_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."site_footer"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "site_footer" ADD CONSTRAINT "site_footer_background_image_id_media_assets_id_fk" FOREIGN KEY ("background_image_id") REFERENCES "public"."media_assets"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_site_footer_v_version_links" ADD CONSTRAINT "_site_footer_v_version_links_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_site_footer_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_site_footer_v" ADD CONSTRAINT "_site_footer_v_version_background_image_id_media_assets_id_fk" FOREIGN KEY ("version_background_image_id") REFERENCES "public"."media_assets"("id") ON DELETE set null ON UPDATE no action;
  CREATE INDEX "site_footer_links_order_idx" ON "site_footer_links" USING btree ("_order");
  CREATE INDEX "site_footer_links_parent_id_idx" ON "site_footer_links" USING btree ("_parent_id");
  CREATE INDEX "site_footer_background_background_image_idx" ON "site_footer" USING btree ("background_image_id");
  CREATE INDEX "site_footer__status_idx" ON "site_footer" USING btree ("_status");
  CREATE INDEX "_site_footer_v_version_links_order_idx" ON "_site_footer_v_version_links" USING btree ("_order");
  CREATE INDEX "_site_footer_v_version_links_parent_id_idx" ON "_site_footer_v_version_links" USING btree ("_parent_id");
  CREATE INDEX "_site_footer_v_version_background_version_background_ima_idx" ON "_site_footer_v" USING btree ("version_background_image_id");
  CREATE INDEX "_site_footer_v_version_version__status_idx" ON "_site_footer_v" USING btree ("version__status");
  CREATE INDEX "_site_footer_v_created_at_idx" ON "_site_footer_v" USING btree ("created_at");
  CREATE INDEX "_site_footer_v_updated_at_idx" ON "_site_footer_v" USING btree ("updated_at");
  CREATE INDEX "_site_footer_v_latest_idx" ON "_site_footer_v" USING btree ("latest");
  ALTER TABLE "home_page" ADD CONSTRAINT "home_page_process_band_image_id_media_assets_id_fk" FOREIGN KEY ("process_band_image_id") REFERENCES "public"."media_assets"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_home_page_v" ADD CONSTRAINT "_home_page_v_version_process_band_image_id_media_assets_id_fk" FOREIGN KEY ("version_process_band_image_id") REFERENCES "public"."media_assets"("id") ON DELETE set null ON UPDATE no action;
  CREATE INDEX "home_page_process_band_process_band_image_idx" ON "home_page" USING btree ("process_band_image_id");
  CREATE INDEX "_home_page_v_version_process_band_version_process_band_i_idx" ON "_home_page_v" USING btree ("version_process_band_image_id");`)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "site_footer_links" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "site_footer" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_site_footer_v_version_links" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_site_footer_v" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "site_footer_links" CASCADE;
  DROP TABLE "site_footer" CASCADE;
  DROP TABLE "_site_footer_v_version_links" CASCADE;
  DROP TABLE "_site_footer_v" CASCADE;
  ALTER TABLE "home_page" DROP CONSTRAINT "home_page_process_band_image_id_media_assets_id_fk";
  
  ALTER TABLE "_home_page_v" DROP CONSTRAINT "_home_page_v_version_process_band_image_id_media_assets_id_fk";
  
  DROP INDEX "home_page_process_band_process_band_image_idx";
  DROP INDEX "_home_page_v_version_process_band_version_process_band_i_idx";
  ALTER TABLE "home_page" DROP COLUMN "process_band_preset";
  ALTER TABLE "home_page" DROP COLUMN "process_band_image_id";
  ALTER TABLE "_home_page_v" DROP COLUMN "version_process_band_preset";
  ALTER TABLE "_home_page_v" DROP COLUMN "version_process_band_image_id";
  DROP TYPE "public"."enum_home_page_process_band_preset";
  DROP TYPE "public"."enum__home_page_v_version_process_band_preset";
  DROP TYPE "public"."enum_site_footer_background_preset";
  DROP TYPE "public"."enum_site_footer_status";
  DROP TYPE "public"."enum__site_footer_v_version_background_preset";
  DROP TYPE "public"."enum__site_footer_v_version_status";`)
}
