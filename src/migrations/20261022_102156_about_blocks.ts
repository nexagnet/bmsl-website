import { sql, type MigrateUpArgs, type MigrateDownArgs } from '@payloadcms/db-postgres';

// Additive: optional About page blocks (history, team, capabilities, values) as new child tables only.

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TABLE "about_page_history" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"year" varchar,
  	"title" varchar,
  	"description" varchar,
  	"confirmed" boolean DEFAULT false
  );
  
  CREATE TABLE "about_page_team" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"name" varchar,
  	"role" varchar,
  	"photo_id" integer,
  	"confirmed" boolean DEFAULT false
  );
  
  CREATE TABLE "about_page_capabilities" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"name" varchar,
  	"issuer" varchar,
  	"validity" varchar,
  	"confirmed" boolean DEFAULT false
  );
  
  CREATE TABLE "about_page_values" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"title" varchar,
  	"description" varchar,
  	"confirmed" boolean DEFAULT false
  );
  
  CREATE TABLE "_about_page_v_version_history" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"year" varchar,
  	"title" varchar,
  	"description" varchar,
  	"confirmed" boolean DEFAULT false,
  	"_uuid" varchar
  );
  
  CREATE TABLE "_about_page_v_version_team" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"name" varchar,
  	"role" varchar,
  	"photo_id" integer,
  	"confirmed" boolean DEFAULT false,
  	"_uuid" varchar
  );
  
  CREATE TABLE "_about_page_v_version_capabilities" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"name" varchar,
  	"issuer" varchar,
  	"validity" varchar,
  	"confirmed" boolean DEFAULT false,
  	"_uuid" varchar
  );
  
  CREATE TABLE "_about_page_v_version_values" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"title" varchar,
  	"description" varchar,
  	"confirmed" boolean DEFAULT false,
  	"_uuid" varchar
  );
  
  ALTER TABLE "about_page_history" ADD CONSTRAINT "about_page_history_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."about_page"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "about_page_team" ADD CONSTRAINT "about_page_team_photo_id_media_assets_id_fk" FOREIGN KEY ("photo_id") REFERENCES "public"."media_assets"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "about_page_team" ADD CONSTRAINT "about_page_team_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."about_page"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "about_page_capabilities" ADD CONSTRAINT "about_page_capabilities_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."about_page"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "about_page_values" ADD CONSTRAINT "about_page_values_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."about_page"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_about_page_v_version_history" ADD CONSTRAINT "_about_page_v_version_history_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_about_page_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_about_page_v_version_team" ADD CONSTRAINT "_about_page_v_version_team_photo_id_media_assets_id_fk" FOREIGN KEY ("photo_id") REFERENCES "public"."media_assets"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_about_page_v_version_team" ADD CONSTRAINT "_about_page_v_version_team_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_about_page_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_about_page_v_version_capabilities" ADD CONSTRAINT "_about_page_v_version_capabilities_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_about_page_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_about_page_v_version_values" ADD CONSTRAINT "_about_page_v_version_values_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_about_page_v"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "about_page_history_order_idx" ON "about_page_history" USING btree ("_order");
  CREATE INDEX "about_page_history_parent_id_idx" ON "about_page_history" USING btree ("_parent_id");
  CREATE INDEX "about_page_team_order_idx" ON "about_page_team" USING btree ("_order");
  CREATE INDEX "about_page_team_parent_id_idx" ON "about_page_team" USING btree ("_parent_id");
  CREATE INDEX "about_page_team_photo_idx" ON "about_page_team" USING btree ("photo_id");
  CREATE INDEX "about_page_capabilities_order_idx" ON "about_page_capabilities" USING btree ("_order");
  CREATE INDEX "about_page_capabilities_parent_id_idx" ON "about_page_capabilities" USING btree ("_parent_id");
  CREATE INDEX "about_page_values_order_idx" ON "about_page_values" USING btree ("_order");
  CREATE INDEX "about_page_values_parent_id_idx" ON "about_page_values" USING btree ("_parent_id");
  CREATE INDEX "_about_page_v_version_history_order_idx" ON "_about_page_v_version_history" USING btree ("_order");
  CREATE INDEX "_about_page_v_version_history_parent_id_idx" ON "_about_page_v_version_history" USING btree ("_parent_id");
  CREATE INDEX "_about_page_v_version_team_order_idx" ON "_about_page_v_version_team" USING btree ("_order");
  CREATE INDEX "_about_page_v_version_team_parent_id_idx" ON "_about_page_v_version_team" USING btree ("_parent_id");
  CREATE INDEX "_about_page_v_version_team_photo_idx" ON "_about_page_v_version_team" USING btree ("photo_id");
  CREATE INDEX "_about_page_v_version_capabilities_order_idx" ON "_about_page_v_version_capabilities" USING btree ("_order");
  CREATE INDEX "_about_page_v_version_capabilities_parent_id_idx" ON "_about_page_v_version_capabilities" USING btree ("_parent_id");
  CREATE INDEX "_about_page_v_version_values_order_idx" ON "_about_page_v_version_values" USING btree ("_order");
  CREATE INDEX "_about_page_v_version_values_parent_id_idx" ON "_about_page_v_version_values" USING btree ("_parent_id");`)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   DROP TABLE "about_page_history" CASCADE;
  DROP TABLE "about_page_team" CASCADE;
  DROP TABLE "about_page_capabilities" CASCADE;
  DROP TABLE "about_page_values" CASCADE;
  DROP TABLE "_about_page_v_version_history" CASCADE;
  DROP TABLE "_about_page_v_version_team" CASCADE;
  DROP TABLE "_about_page_v_version_capabilities" CASCADE;
  DROP TABLE "_about_page_v_version_values" CASCADE;`)
}
