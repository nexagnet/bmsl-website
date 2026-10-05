import { describe, expect, it } from 'vitest';
import { parseContactSubmission, submitContact } from './contact-submission';

// Synthetic data only.
const valid = {
  name: 'Synthetic Person',
  phone: '0900 000 000',
  requestType: 'bao-gia',
  message: 'synthetic message',
  consent: true,
  sourcePage: '/lien-he',
};

const fieldsOf = (raw: unknown) => {
  const parsed = parseContactSubmission(raw);
  return parsed.kind === 'invalid' ? parsed.fields : parsed.kind;
};

describe('parseContactSubmission', () => {
  it('accepts a valid submission and normalises optional fields', () => {
    const parsed = parseContactSubmission({ ...valid, email: '', utm: { utm_source: 'x', evil: 'y' } });
    expect(parsed.kind).toBe('valid');
    if (parsed.kind === 'valid') {
      expect(parsed.lead.email).toBeUndefined();
      expect(parsed.lead.utm).toEqual({ utm_source: 'x' });
    }
  });

  it('accepts +84 phone numbers', () => {
    expect(parseContactSubmission({ ...valid, phone: '+84 900 000 000' }).kind).toBe('valid');
  });

  it('rejects invalid name, phone, requestType, email, message and consent', () => {
    expect(fieldsOf({ ...valid, name: '  ' })).toEqual(['name']);
    expect(fieldsOf({ ...valid, phone: 'abc' })).toEqual(['phone']);
    expect(fieldsOf({ ...valid, phone: '123' })).toEqual(['phone']);
    expect(fieldsOf({ ...valid, requestType: 'other' })).toEqual(['requestType']);
    expect(fieldsOf({ ...valid, email: 'not-an-email' })).toEqual(['email']);
    expect(fieldsOf({ ...valid, message: '' })).toEqual(['message']);
    expect(fieldsOf({ ...valid, consent: false })).toEqual(['consent']);
    expect(fieldsOf({ ...valid, consent: undefined })).toEqual(['consent']);
    expect(fieldsOf(null)).toEqual(['name', 'phone', 'requestType', 'message', 'consent']);
  });

  it('flags a filled honeypot as bot, even when the rest is valid', () => {
    expect(parseContactSubmission({ ...valid, website: 'http://spam.example' }).kind).toBe('bot');
  });

  it('only a stored lead reports persisted; bots get a plain ok (so form_submit analytics cannot fire for them)', async () => {
    const created: unknown[] = [];
    const payload = { create: async (args: unknown) => (created.push(args), { id: 1 }) } as never;
    expect(await submitContact(payload, { ...valid, website: 'x' })).toEqual({ status: 200, body: { ok: true } });
    expect(created).toHaveLength(0);
    expect(await submitContact(payload, valid)).toEqual({ status: 200, body: { ok: true, persisted: true } });
    expect(created).toHaveLength(1);
    const failing = { create: async () => Promise.reject(new Error('db')) } as never;
    expect((await submitContact(failing, valid)).status).toBe(500);
  });

  it('forces sourcePage to a same-site path', () => {
    const parsed = parseContactSubmission({ ...valid, sourcePage: '//evil.example' });
    expect(parsed.kind === 'valid' && parsed.lead.sourcePage).toBe('/lien-he');
  });
});
