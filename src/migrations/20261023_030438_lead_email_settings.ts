// Additive: one new table for the ADMIN-only lead e-mail settings global (nothing is dropped or altered).
import { sql, type MigrateUpArgs, type MigrateDownArgs } from '@payloadcms/db-postgres';

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TABLE "lead_email_settings" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"enabled" boolean DEFAULT false,
  	"to" varchar,
  	"from" varchar,
  	"smtp_host" varchar,
  	"smtp_port" numeric,
  	"smtp_secure" boolean DEFAULT false,
  	"smtp_user" varchar,
  	"smtp_password_configured" boolean,
  	"smtp_password_encrypted" varchar,
  	"updated_at" timestamp(3) with time zone,
  	"created_at" timestamp(3) with time zone
  );
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   DROP TABLE "lead_email_settings" CASCADE;`)
}
