import { sql, type MigrateUpArgs, type MigrateDownArgs } from '@payloadcms/db-postgres';

// Additive: optional ordered process steps for the process page (new child tables only). Existing rows are untouched.

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TABLE "process_page_steps" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"title" varchar,
  	"description" varchar,
  	"duration" varchar
  );
  
  CREATE TABLE "_process_page_v_version_steps" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"title" varchar,
  	"description" varchar,
  	"duration" varchar,
  	"_uuid" varchar
  );
  
  ALTER TABLE "process_page_steps" ADD CONSTRAINT "process_page_steps_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."process_page"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_process_page_v_version_steps" ADD CONSTRAINT "_process_page_v_version_steps_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_process_page_v"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "process_page_steps_order_idx" ON "process_page_steps" USING btree ("_order");
  CREATE INDEX "process_page_steps_parent_id_idx" ON "process_page_steps" USING btree ("_parent_id");
  CREATE INDEX "_process_page_v_version_steps_order_idx" ON "_process_page_v_version_steps" USING btree ("_order");
  CREATE INDEX "_process_page_v_version_steps_parent_id_idx" ON "_process_page_v_version_steps" USING btree ("_parent_id");`)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   DROP TABLE "process_page_steps" CASCADE;
  DROP TABLE "_process_page_v_version_steps" CASCADE;`)
}
