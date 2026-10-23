// Server-side configuration of the ContactLead e-mail notification (Issue #82). The feature is OFF unless EVERY value
// below is explicitly provided: there is no default sender, recipient or SMTP host (BMSL has not confirmed any;
// OWNER-DECISION), and nothing is ever derived from the legacy site, the contract or the repository.
//
// Nothing here may log or return a value: a disabled result names only the MISSING/INVALID variable NAMES so an
// operator can fix the configuration without a secret ever reaching a log line.

export const LEAD_EMAIL_FLAG = 'LEAD_EMAIL_ENABLED';
export const LEAD_EMAIL_QUEUE = 'lead-mail';

export type LeadEmailConfig =
  | { enabled: false; problems: string[] }
  | {
      enabled: true;
      from: string;
      to: string;
      smtp: { host: string; port: number; secure: boolean; requireTLS: boolean; auth?: { user: string; pass: string } };
    };

const EMAIL = /^[^\s@<>,;]+@[^\s@<>,;]+\.[^\s@<>,;]+$/;
const LOOPBACK = new Set(['localhost', '127.0.0.1', '::1', '[::1]']);

type Env = Record<string, string | undefined>;

/** Loopback hosts (a developer's Mailpit) may speak plain SMTP; anything else must negotiate TLS before sending PII. */
export const isLoopbackHost = (host: string): boolean => LOOPBACK.has(host.toLowerCase());

/**
 * Values an ADMIN saved in the CMS (global `lead-email-settings`). Only meaningful while `enabled` is ticked; then each
 * non-empty value overrides the matching environment variable and an empty one falls back to it. `passwordUnreadable`
 * means a stored password exists but could not be decrypted (e.g. the encryption key changed): the feature stays OFF.
 */
export type LeadEmailCmsSettings = {
  enabled?: boolean | null;
  from?: string | null;
  to?: string | null;
  smtpHost?: string | null;
  smtpPort?: number | null;
  smtpSecure?: boolean | null;
  smtpUser?: string | null;
  smtpPassword?: string | null;
  passwordUnreadable?: boolean;
};

const text = (value: string | null | undefined) => value?.trim() || undefined;

/** Overlays the CMS values onto the environment; the result is an ordinary env map for the single validation path. */
function overlayCms(env: Env, cms: LeadEmailCmsSettings | undefined): Env {
  if (!cms?.enabled) return env;
  return {
    ...env,
    [LEAD_EMAIL_FLAG]: 'true',
    SMTP_HOST: text(cms.smtpHost) ?? env.SMTP_HOST,
    SMTP_PORT: cms.smtpPort ? String(cms.smtpPort) : env.SMTP_PORT,
    SMTP_SECURE: typeof cms.smtpSecure === 'boolean' ? String(cms.smtpSecure) : env.SMTP_SECURE,
    SMTP_USER: text(cms.smtpUser) ?? env.SMTP_USER,
    SMTP_PASS: cms.smtpPassword || env.SMTP_PASS,
    LEAD_EMAIL_FROM: text(cms.from) ?? env.LEAD_EMAIL_FROM,
    LEAD_EMAIL_TO: text(cms.to) ?? env.LEAD_EMAIL_TO,
  };
}

export function resolveLeadEmailConfig(rawEnv: Env = process.env, cms?: LeadEmailCmsSettings): LeadEmailConfig {
  const env = overlayCms(rawEnv, cms);
  if (cms?.enabled && cms.passwordUnreadable) {
    const rest = resolveLeadEmailConfig(env);
    return { enabled: false, problems: [...(rest.enabled ? [] : rest.problems.filter((p) => p !== 'SMTP_PASS' && p !== 'SMTP_USER')), 'SMTP_PASS'] };
  }
  if (env[LEAD_EMAIL_FLAG]?.trim().toLowerCase() !== 'true') return { enabled: false, problems: [LEAD_EMAIL_FLAG] };

  const problems: string[] = [];
  const host = env.SMTP_HOST?.trim() ?? '';
  const from = env.LEAD_EMAIL_FROM?.trim() ?? '';
  const to = env.LEAD_EMAIL_TO?.trim() ?? '';
  const portText = env.SMTP_PORT?.trim() ?? '';
  const port = Number(portText);
  const user = env.SMTP_USER?.trim() ?? '';
  const pass = env.SMTP_PASS ?? '';

  if (!host) problems.push('SMTP_HOST');
  if (!portText || !Number.isInteger(port) || port < 1 || port > 65535) problems.push('SMTP_PORT');
  if (!EMAIL.test(from)) problems.push('LEAD_EMAIL_FROM');
  if (!EMAIL.test(to)) problems.push('LEAD_EMAIL_TO');
  // Credentials come as a pair or not at all; a half-set pair is a configuration error, never a silent anonymous send.
  if (Boolean(user) !== Boolean(pass)) problems.push(user ? 'SMTP_PASS' : 'SMTP_USER');
  if (problems.length) return { enabled: false, problems };

  const secure = env.SMTP_SECURE?.trim().toLowerCase() === 'true';
  return {
    enabled: true,
    from,
    to,
    smtp: {
      host,
      port,
      secure,
      requireTLS: !secure && !isLoopbackHost(host),
      ...(user ? { auth: { user, pass } } : {}),
    },
  };
}

/** One operator-facing line; contains variable names only, never a value. */
export const describeLeadEmailConfig = (config: LeadEmailConfig): string =>
  config.enabled
    ? 'lead e-mail notification: ON'
    : `lead e-mail notification: OFF (configuration required: ${config.problems.join(', ')})`;
