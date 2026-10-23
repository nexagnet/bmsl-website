import { sql, type MigrateUpArgs, type MigrateDownArgs } from '@payloadcms/db-postgres';

// Additive: optional employment type, headcount and experience on job postings. Existing rows keep NULL.
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_job_postings_employment_type" AS ENUM('FULL_TIME', 'PART_TIME', 'CONTRACTOR', 'INTERN');
  CREATE TYPE "public"."enum__job_postings_v_version_employment_type" AS ENUM('FULL_TIME', 'PART_TIME', 'CONTRACTOR', 'INTERN');
  ALTER TABLE "job_postings" ADD COLUMN "employment_type" "enum_job_postings_employment_type";
  ALTER TABLE "job_postings" ADD COLUMN "headcount" numeric;
  ALTER TABLE "job_postings" ADD COLUMN "experience" varchar;
  ALTER TABLE "_job_postings_v" ADD COLUMN "version_employment_type" "enum__job_postings_v_version_employment_type";
  ALTER TABLE "_job_postings_v" ADD COLUMN "version_headcount" numeric;
  ALTER TABLE "_job_postings_v" ADD COLUMN "version_experience" varchar;`)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "job_postings" DROP COLUMN "employment_type";
  ALTER TABLE "job_postings" DROP COLUMN "headcount";
  ALTER TABLE "job_postings" DROP COLUMN "experience";
  ALTER TABLE "_job_postings_v" DROP COLUMN "version_employment_type";
  ALTER TABLE "_job_postings_v" DROP COLUMN "version_headcount";
  ALTER TABLE "_job_postings_v" DROP COLUMN "version_experience";
  DROP TYPE "public"."enum_job_postings_employment_type";
  DROP TYPE "public"."enum__job_postings_v_version_employment_type";`)
}
