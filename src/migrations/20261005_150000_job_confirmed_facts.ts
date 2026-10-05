import { sql, type MigrateUpArgs, type MigrateDownArgs } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_job_postings_source_status" AS ENUM('LEGACY-SOURCE', 'CONFIRMED');
  CREATE TYPE "public"."enum__job_postings_v_version_source_status" AS ENUM('LEGACY-SOURCE', 'CONFIRMED');
  ALTER TABLE "job_postings" ADD COLUMN "date_posted" timestamp(3) with time zone;
  ALTER TABLE "job_postings" ADD COLUMN "job_location_street_address" varchar;
  ALTER TABLE "job_postings" ADD COLUMN "job_location_address_locality" varchar;
  ALTER TABLE "job_postings" ADD COLUMN "job_location_address_region" varchar;
  ALTER TABLE "job_postings" ADD COLUMN "job_location_postal_code" varchar;
  ALTER TABLE "job_postings" ADD COLUMN "job_location_address_country" varchar;
  ALTER TABLE "job_postings" ADD COLUMN "source_status" "enum_job_postings_source_status" DEFAULT 'LEGACY-SOURCE';
  ALTER TABLE "_job_postings_v" ADD COLUMN "version_date_posted" timestamp(3) with time zone;
  ALTER TABLE "_job_postings_v" ADD COLUMN "version_job_location_street_address" varchar;
  ALTER TABLE "_job_postings_v" ADD COLUMN "version_job_location_address_locality" varchar;
  ALTER TABLE "_job_postings_v" ADD COLUMN "version_job_location_address_region" varchar;
  ALTER TABLE "_job_postings_v" ADD COLUMN "version_job_location_postal_code" varchar;
  ALTER TABLE "_job_postings_v" ADD COLUMN "version_job_location_address_country" varchar;
  ALTER TABLE "_job_postings_v" ADD COLUMN "version_source_status" "enum__job_postings_v_version_source_status" DEFAULT 'LEGACY-SOURCE';`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "job_postings" DROP COLUMN "date_posted";
  ALTER TABLE "job_postings" DROP COLUMN "job_location_street_address";
  ALTER TABLE "job_postings" DROP COLUMN "job_location_address_locality";
  ALTER TABLE "job_postings" DROP COLUMN "job_location_address_region";
  ALTER TABLE "job_postings" DROP COLUMN "job_location_postal_code";
  ALTER TABLE "job_postings" DROP COLUMN "job_location_address_country";
  ALTER TABLE "job_postings" DROP COLUMN "source_status";
  ALTER TABLE "_job_postings_v" DROP COLUMN "version_date_posted";
  ALTER TABLE "_job_postings_v" DROP COLUMN "version_job_location_street_address";
  ALTER TABLE "_job_postings_v" DROP COLUMN "version_job_location_address_locality";
  ALTER TABLE "_job_postings_v" DROP COLUMN "version_job_location_address_region";
  ALTER TABLE "_job_postings_v" DROP COLUMN "version_job_location_postal_code";
  ALTER TABLE "_job_postings_v" DROP COLUMN "version_job_location_address_country";
  ALTER TABLE "_job_postings_v" DROP COLUMN "version_source_status";
  DROP TYPE "public"."enum_job_postings_source_status";
  DROP TYPE "public"."enum__job_postings_v_version_source_status";`)
}
