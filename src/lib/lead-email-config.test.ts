import { describe, expect, it } from 'vitest';
import { describeLeadEmailConfig, resolveLeadEmailConfig } from './lead-email-config';
import { buildLeadMessage, classifyMailError } from './lead-notification';

const FULL = {
  LEAD_EMAIL_ENABLED: 'true',
  SMTP_HOST: 'smtp.sandbox.example',
  SMTP_PORT: '587',
  LEAD_EMAIL_FROM: 'sender@sandbox.example',
  LEAD_EMAIL_TO: 'inbox@sandbox.example',
};

describe('resolveLeadEmailConfig — OFF unless every value is explicit', () => {
  it('is OFF with an empty environment and names only the flag', () => {
    expect(resolveLeadEmailConfig({})).toEqual({ enabled: false, problems: ['LEAD_EMAIL_ENABLED'] });
  });

  it('is OFF for anything other than the literal true', () => {
    for (const value of ['1', 'yes', 'on', 'false', '']) {
      expect(resolveLeadEmailConfig({ ...FULL, LEAD_EMAIL_ENABLED: value }).enabled).toBe(false);
    }
  });

  it('has no default sender, recipient or host: each missing value is reported by NAME', () => {
    const result = resolveLeadEmailConfig({ LEAD_EMAIL_ENABLED: 'true' });
    expect(result).toEqual({ enabled: false, problems: ['SMTP_HOST', 'SMTP_PORT', 'LEAD_EMAIL_FROM', 'LEAD_EMAIL_TO'] });
  });

  it('rejects malformed addresses and ports, and a half-set credential pair', () => {
    expect(resolveLeadEmailConfig({ ...FULL, LEAD_EMAIL_TO: 'not-an-address' })).toMatchObject({ enabled: false, problems: ['LEAD_EMAIL_TO'] });
    expect(resolveLeadEmailConfig({ ...FULL, LEAD_EMAIL_TO: 'a@x.example, b@x.example' })).toMatchObject({ enabled: false });
    expect(resolveLeadEmailConfig({ ...FULL, SMTP_PORT: '99999' })).toMatchObject({ enabled: false, problems: ['SMTP_PORT'] });
    expect(resolveLeadEmailConfig({ ...FULL, SMTP_USER: 'u' })).toMatchObject({ enabled: false, problems: ['SMTP_PASS'] });
    expect(resolveLeadEmailConfig({ ...FULL, SMTP_PASS: 'p' })).toMatchObject({ enabled: false, problems: ['SMTP_USER'] });
  });

  it('never puts a value (secret, address) in the operator-facing description', () => {
    const off = describeLeadEmailConfig(resolveLeadEmailConfig({ ...FULL, LEAD_EMAIL_TO: 'bad', SMTP_PASS: 'super-secret' }));
    expect(off).toContain('OFF');
    expect(off).toContain('LEAD_EMAIL_TO');
    expect(off).not.toContain('super-secret');
    expect(off).not.toContain('sandbox.example');
    const on = describeLeadEmailConfig(resolveLeadEmailConfig({ ...FULL, SMTP_USER: 'u', SMTP_PASS: 'super-secret' }));
    expect(on).toBe('lead e-mail notification: ON');
  });

  it('requires TLS off-loopback unless implicit TLS is used; loopback may be plain (local Mailpit)', () => {
    expect(resolveLeadEmailConfig(FULL)).toMatchObject({ enabled: true, smtp: { requireTLS: true, secure: false } });
    expect(resolveLeadEmailConfig({ ...FULL, SMTP_PORT: '465', SMTP_SECURE: 'true' })).toMatchObject({ enabled: true, smtp: { requireTLS: false, secure: true } });
    expect(resolveLeadEmailConfig({ ...FULL, SMTP_HOST: '127.0.0.1' })).toMatchObject({ enabled: true, smtp: { requireTLS: false } });
  });

  it('passes credentials only when both are present', () => {
    expect(resolveLeadEmailConfig(FULL)).not.toHaveProperty('smtp.auth');
    expect(resolveLeadEmailConfig({ ...FULL, SMTP_USER: 'u', SMTP_PASS: 'p' })).toMatchObject({ smtp: { auth: { user: 'u', pass: 'p' } } });
  });
});

describe('classifyMailError', () => {
  it('keeps only a short code and never the message', () => {
    const result = classifyMailError(Object.assign(new Error('550 mailbox someone@real.example does not exist'), { code: 'EENVELOPE', responseCode: 550 }));
    expect(result).toEqual({ code: 'EENVELOPE', permanent: true });
    expect(JSON.stringify(result)).not.toContain('real.example');
    expect(classifyMailError(new Error('anything with 0912345678'))).toEqual({ code: 'SEND_FAILED', permanent: false });
    expect(classifyMailError(Object.assign(new Error('x'), { code: 'not a code!' })).code).toBe('SEND_FAILED');
  });

  it('treats connection problems, 4xx and authentication failures as transient', () => {
    expect(classifyMailError(Object.assign(new Error('x'), { code: 'ECONNREFUSED' })).permanent).toBe(false);
    expect(classifyMailError(Object.assign(new Error('x'), { code: 'EENVELOPE', responseCode: 451 })).permanent).toBe(false);
    expect(classifyMailError(Object.assign(new Error('x'), { code: 'EAUTH', responseCode: 535 })).permanent).toBe(false);
    expect(classifyMailError(Object.assign(new Error('x'), { code: 'EENVELOPE', responseCode: 554 })).permanent).toBe(true);
  });
});

describe('buildLeadMessage', () => {
  const config = resolveLeadEmailConfig(FULL);
  if (!config.enabled) throw new Error('fixture must be valid');
  const lead = { id: 7, name: 'Synthetic A\r\nBcc: x@example.test', phone: '0900000001', email: null, requestType: 'bao-gia', message: 'Synthetic body', sourcePage: '/lien-he' };

  it('keeps personal data out of the subject and gives a stable Message-ID per lead', () => {
    const message = buildLeadMessage(lead, config);
    expect(message.subject).toBe('[BMSL] Yêu cầu liên hệ mới #7 — Báo giá');
    expect(message.messageId).toBe('<bmsl-lead-7@sandbox.example>');
    expect(buildLeadMessage(lead, config).messageId).toBe(message.messageId);
  });

  it('flattens line breaks in single-line fields so they cannot start a new line of the summary', () => {
    const text = buildLeadMessage(lead, config).text;
    expect(text).toContain('Họ tên: Synthetic A Bcc: x@example.test');
    expect(text).not.toMatch(/^Bcc:/m);
  });
});
