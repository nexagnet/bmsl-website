import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { postgresAdapter } from '@payloadcms/db-postgres';
import { nodemailerAdapter } from '@payloadcms/email-nodemailer';
import { lexicalEditor } from '@payloadcms/richtext-lexical';
import { vi } from '@payloadcms/translations/languages/vi';
import { buildConfig } from 'payload';
import { adminOnly, isAdmin, nobody } from './access';
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
import { describeLeadEmailConfig, LEAD_EMAIL_QUEUE, resolveLeadEmailConfig } from './lib/lead-email-config';
import { reconcileLeadNotifications, runLeadNotificationQueue } from './lib/lead-notification';
import { migrations } from './migrations';
import { sendLeadNotificationTask } from './queues/lead-notification-task';

const dirname = path.dirname(fileURLToPath(import.meta.url));
const { databaseUrl, payloadSecret } = resolvePayloadEnv();
// Contact-lead e-mail (Issue #82) is OFF unless every sender/recipient/SMTP value is explicitly configured. When OFF no
// email adapter exists at all (the adapter's own fallback would create an Ethereal test account), no cron runs, and
// leads are stored with notification state `not_configured`.
const leadEmail = resolveLeadEmailConfig();
const RECONCILE_EVERY_MS = 5 * 60_000;

export default buildConfig({
  // `avatar: 'default'` is Payload's local icon: the admin never looks up a hashed e-mail address at Gravatar, so the
  // narrow CSP needs no external img-src and no staff address leaves the deployment.
  admin: { user: Users.slug, avatar: 'default' },
  // Admin UI language only (not data localization): Vietnamese for every account, whatever the browser prefers.
  i18n: { supportedLanguages: { vi }, fallbackLanguage: 'vi' },
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
  email: leadEmail.enabled
    ? nodemailerAdapter({
        defaultFromAddress: leadEmail.from,
        defaultFromName: 'BMSL Website',
        // The first real delivery is the verification; a startup probe would only add noise and a failure mode.
        skipVerify: true,
        transportOptions: { ...leadEmail.smtp, connectionTimeout: 10_000, greetingTimeout: 10_000, socketTimeout: 20_000 },
      })
    : undefined,
  jobs: {
    tasks: [sendLeadNotificationTask],
    deleteJobOnComplete: true,
    // The queue is internal plumbing: only ADMIN staff can see, run, queue or cancel jobs over HTTP.
    access: { run: ({ req }) => isAdmin(req.user), queue: ({ req }) => isAdmin(req.user), cancel: ({ req }) => isAdmin(req.user) },
    jobsCollectionOverrides: ({ defaultJobsCollection }) => ({
      ...defaultJobsCollection,
      access: { read: adminOnly, create: nobody, update: adminOnly, delete: adminOnly },
    }),
    // Native in-process trigger for the single-instance Node server; harmless when OFF because nothing is queued.
    autoRun: leadEmail.enabled ? [{ cron: '* * * * *', queue: LEAD_EMAIL_QUEUE, limit: 5, silent: true, disableScheduling: true }] : [],
  },
  onInit: async (payload) => {
    payload.logger.info(describeLeadEmailConfig(leadEmail));
    if (!leadEmail.enabled) return;
    // Restart recovery: re-queue anything unfinished (stranded/lost jobs), then keep reconciling on a timer.
    const sweep = async (quietSeconds: number) => {
      try {
        await reconcileLeadNotifications(payload, { quietSeconds });
        await runLeadNotificationQueue(payload);
      } catch (error) {
        payload.logger.error(`lead notification reconcile failed: ${error instanceof Error ? error.name : 'unknown'}`);
      }
    };
    await sweep(0);
    setInterval(() => void sweep(600), RECONCILE_EVERY_MS).unref();
  },
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
