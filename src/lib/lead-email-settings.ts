import type { Payload } from 'payload';
import { type LeadEmailCmsSettings, type LeadEmailConfig, resolveLeadEmailConfig } from './lead-email-config';
import { decryptSecret } from './secret-box';

export const LEAD_EMAIL_SETTINGS_SLUG = 'lead-email-settings';

type Env = Record<string, string | undefined>;

/** Key material for the stored SMTP password: a dedicated variable when set, otherwise the Payload secret. */
export const secretKeyMaterial = (payload: Pick<Payload, 'secret'>, env: Env = process.env): string =>
  env.LEAD_SMTP_ENCRYPTION_KEY?.trim() || payload.secret;

/**
 * Effective lead e-mail configuration: the CMS settings (when an ADMIN ticked "enabled") over the environment
 * variables. A missing table (migration not yet applied) or any read failure falls back to the environment alone, so
 * the previous behaviour is never worse than before.
 */
export async function loadLeadEmailConfig(payload: Payload, env: Env = process.env): Promise<LeadEmailConfig> {
  let cms: LeadEmailCmsSettings | undefined;
  try {
    const doc = (await payload.findGlobal({ slug: LEAD_EMAIL_SETTINGS_SLUG as never, overrideAccess: true, depth: 0 })) as unknown as {
      enabled?: boolean | null;
      from?: string | null;
      to?: string | null;
      smtpHost?: string | null;
      smtpPort?: number | null;
      smtpSecure?: boolean | null;
      smtpUser?: string | null;
      smtpPasswordEncrypted?: string | null;
    };
    cms = { enabled: doc.enabled, from: doc.from, to: doc.to, smtpHost: doc.smtpHost, smtpPort: doc.smtpPort, smtpSecure: doc.smtpSecure, smtpUser: doc.smtpUser };
    if (doc.smtpPasswordEncrypted) {
      try {
        cms.smtpPassword = decryptSecret(doc.smtpPasswordEncrypted, secretKeyMaterial(payload, env));
      } catch {
        cms.passwordUnreadable = true;
      }
    }
  } catch {
    cms = undefined;
  }
  return resolveLeadEmailConfig(env, cms);
}
