import { sql, type MigrateUpArgs, type MigrateDownArgs } from '@payloadcms/db-postgres';

// Adds the "tham quan" (site visit) request type for the project CTA. Additive: existing leads keep their value.
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
  ALTER TYPE "public"."enum_contact_leads_request_type" ADD VALUE IF NOT EXISTS 'tham-quan' BEFORE 'khac';`);
}

// PostgreSQL cannot drop an enum value in place: rebuild the type, mapping any visit lead to "khac" so no row is lost.
export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
  ALTER TABLE "contact_leads" ALTER COLUMN "request_type" TYPE varchar;
  UPDATE "contact_leads" SET "request_type" = 'khac' WHERE "request_type" = 'tham-quan';
  DROP TYPE "public"."enum_contact_leads_request_type";
  CREATE TYPE "public"."enum_contact_leads_request_type" AS ENUM('khao-sat', 'bao-gia', 'khac');
  ALTER TABLE "contact_leads" ALTER COLUMN "request_type" TYPE "public"."enum_contact_leads_request_type" USING "request_type"::"public"."enum_contact_leads_request_type";`);
}
