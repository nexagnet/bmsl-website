import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { postgresAdapter } from '@payloadcms/db-postgres';
import { lexicalEditor } from '@payloadcms/richtext-lexical';
import { vi } from '@payloadcms/translations/languages/vi';
import { buildConfig } from 'payload';
import {
  ArticleCategories,
  Articles,
  Documents,
  JobPostings,
  Projects,
  ServiceAreas,
} from './collections/content';
import { ContactLeads } from './collections/ContactLeads';
import { MediaAssets } from './collections/MediaAssets';
import { Redirects } from './collections/Redirects';
import { Users } from './collections/Users';
import { AboutPage, ContactPage, HomePage, ProcessPage, SiteSettings } from './globals';
import { resolvePayloadEnv } from './lib/env';
import { viAdminTranslations } from './i18n/vi-admin-overrides';
import { migrations } from './migrations';

const dirname = path.dirname(fileURLToPath(import.meta.url));
const { databaseUrl, payloadSecret } = resolvePayloadEnv();

export default buildConfig({
  // `avatar: 'default'` is Payload's local icon: the admin never looks up a hashed e-mail address at Gravatar, so the
  // narrow CSP needs no external img-src and no staff address leaves the deployment.
  admin: { user: Users.slug, avatar: 'default' },
  // Admin UI language only (not data localization): Vietnamese for every account, whatever the browser prefers.
  i18n: {
    supportedLanguages: { vi },
    fallbackLanguage: 'vi',
    // Selective overrides on top of the official catalog (src/i18n/vi-admin-overrides.ts).
    translations: { vi: viAdminTranslations },
  },
  collections: [
    Users,
    MediaAssets,
    ServiceAreas,
    ArticleCategories,
    Projects,
    Articles,
    JobPostings,
    Documents,
    Redirects,
    ContactLeads,
  ],
  globals: [HomePage, AboutPage, ProcessPage, ContactPage, SiteSettings],
  // No GraphQL API or playground: the public site reads through the local API and there is no approved GraphQL
  // consumer, so the endpoint stays absent (no src/app/(payload)/api/graphql route) and generation is disabled.
  graphQL: { disable: true },
  // Hard request-level cap on uploaded files (HTTP 413 beyond it), enforced while the body streams in.
  upload: { abortOnLimit: true, limits: { fileSize: 10_000_000 } },
  editor: lexicalEditor(),
  secret: payloadSecret,
  db: postgresAdapter({
    // connectionTimeoutMillis bounds waiting for a pooled connection (pg default: wait forever), so a saturated pool
    // fails a request instead of queuing it indefinitely (also bounds the /healthz probe's acquisition).
    pool: { connectionString: databaseUrl, connectionTimeoutMillis: 5000 },
    // The dedicated BMSL database is pre-provisioned by the operator. Payload's default (false) would issue
    // CREATE DATABASE through the maintenance database when the target is missing; fail closed instead.
    disableCreateDatabase: true,
    // Schema changes ship as committed migrations (src/migrations); never auto-push.
    push: false,
    migrationDir: path.resolve(dirname, 'migrations'),
    prodMigrations: migrations,
  }),
  typescript: { outputFile: path.resolve(dirname, 'payload-types.ts') },
});
