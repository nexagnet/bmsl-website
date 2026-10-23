import { nodemailerAdapter } from '@payloadcms/email-nodemailer';
import type { EmailAdapter } from 'payload';
import { loadLeadEmailConfig } from './lead-email-settings';

// The mail transport is resolved on EVERY send from the effective configuration (CMS settings over environment), so an
// ADMIN's change in the CMS takes effect without a redeploy. The adapter is always installed but refuses to send while
// the feature is OFF: there is never a default sender or an Ethereal fallback account.
type Inner = Awaited<ReturnType<typeof nodemailerAdapter>>;

export const leadEmailAdapter: EmailAdapter = ({ payload }) => {
  let cached: { key: string; adapter: ReturnType<Inner> } | undefined;
  return {
    name: 'bmsl-lead-email',
    defaultFromAddress: 'unconfigured@bmsl.invalid',
    defaultFromName: 'BMSL Website',
    sendEmail: async (message) => {
      const config = await loadLeadEmailConfig(payload);
      if (!config.enabled) throw Object.assign(new Error('lead_mail_disabled'), { code: 'EMAIL_DISABLED' });
      const key = JSON.stringify(config);
      if (cached?.key !== key) {
        const inner = await nodemailerAdapter({
          defaultFromAddress: config.from,
          defaultFromName: 'BMSL Website',
          // The first real delivery is the verification; a startup probe would only add noise and a failure mode.
          skipVerify: true,
          transportOptions: { ...config.smtp, connectionTimeout: 10_000, greetingTimeout: 10_000, socketTimeout: 20_000 },
        });
        cached = { key, adapter: inner({ payload }) };
      }
      return cached.adapter.sendEmail(message);
    },
  };
};
