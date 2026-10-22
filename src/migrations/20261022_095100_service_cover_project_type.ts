import { sql, type MigrateUpArgs, type MigrateDownArgs } from '@payloadcms/db-postgres';

// Additive: optional media cover for service areas and a free-text project type. Existing rows keep NULL.
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "service_areas" ADD COLUMN "cover_id" integer;
  ALTER TABLE "_service_areas_v" ADD COLUMN "version_cover_id" integer;
  ALTER TABLE "projects" ADD COLUMN "project_type" varchar;
  ALTER TABLE "_projects_v" ADD COLUMN "version_project_type" varchar;
  ALTER TABLE "service_areas" ADD CONSTRAINT "service_areas_cover_id_media_assets_id_fk" FOREIGN KEY ("cover_id") REFERENCES "public"."media_assets"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_service_areas_v" ADD CONSTRAINT "_service_areas_v_version_cover_id_media_assets_id_fk" FOREIGN KEY ("version_cover_id") REFERENCES "public"."media_assets"("id") ON DELETE set null ON UPDATE no action;
  CREATE INDEX "service_areas_cover_idx" ON "service_areas" USING btree ("cover_id");
  CREATE INDEX "_service_areas_v_version_version_cover_idx" ON "_service_areas_v" USING btree ("version_cover_id");`)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "service_areas" DROP CONSTRAINT "service_areas_cover_id_media_assets_id_fk";
  
  ALTER TABLE "_service_areas_v" DROP CONSTRAINT "_service_areas_v_version_cover_id_media_assets_id_fk";
  
  DROP INDEX "service_areas_cover_idx";
  DROP INDEX "_service_areas_v_version_version_cover_idx";
  ALTER TABLE "service_areas" DROP COLUMN "cover_id";
  ALTER TABLE "_service_areas_v" DROP COLUMN "version_cover_id";
  ALTER TABLE "projects" DROP COLUMN "project_type";
  ALTER TABLE "_projects_v" DROP COLUMN "version_project_type";`)
}
