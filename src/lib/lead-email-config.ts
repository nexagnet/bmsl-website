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

export function resolveLeadEmailConfig(env: Env = process.env): LeadEmailConfig {
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
