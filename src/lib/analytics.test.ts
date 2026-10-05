import type { Payload } from 'payload';
import { describe, expect, it } from 'vitest';
import { REQUEST_TYPES } from '../collections/ContactLeads';
import {
  allowlistParams,
  ANALYTICS_EVENTS,
  ANALYTICS_REQUEST_TYPES,
  type AnalyticsTransport,
  createAnalytics,
  formSubmitParams,
  sanitizePageLocation,
} from './analytics';
import { submitContact } from './contact-submission';

const ORIGIN = 'https://bmsl.example';
const ID = 'G-ABC123DEF4';

type Call = { kind: 'load' | 'config' | 'event' | 'disable'; args: unknown[] };

function harness(initialPath = '/') {
  const calls: Call[] = [];
  let path = initialPath;
  const transport: AnalyticsTransport = {
    load: (...args) => calls.push({ kind: 'load', args }),
    config: (...args) => calls.push({ kind: 'config', args }),
    event: (...args) => calls.push({ kind: 'event', args }),
    disable: (...args) => calls.push({ kind: 'disable', args }),
  };
  const ctl = createAnalytics({ measurementId: ID, origin: ORIGIN, transport, getPathname: () => path });
  return {
    ctl,
    calls,
    events: () => calls.filter((c) => c.kind === 'event'),
    go: (p: string) => {
      path = p;
    },
  };
}

describe('analytics is off by default and consent-gated', () => {
  it('sends nothing, loads nothing and ignores events before consent', () => {
    const h = harness();
    h.ctl.pageView('/');
    for (const name of ANALYTICS_EVENTS) h.ctl.track(name, { link_location: 'footer' });
    expect(h.calls).toEqual([]);
  });

  it('loads exactly once after consent and sends a sanitized page_view', () => {
    const h = harness('/du-an/p');
    h.ctl.setConsent(true);
    h.ctl.setConsent(true);
    expect(h.calls.filter((c) => c.kind === 'load')).toHaveLength(1);
    expect(h.calls.find((c) => c.kind === 'config')?.args[1]).toMatchObject({
      send_page_view: false,
      allow_google_signals: false,
      allow_ad_personalization_signals: false,
    });
    expect(h.events()).toEqual([
      { kind: 'event', args: ['page_view', { page_location: `${ORIGIN}/du-an/p`, page_referrer: ORIGIN }] },
    ]);
  });

  it('stops all subsequent traffic after consent is withdrawn', () => {
    const h = harness();
    h.ctl.setConsent(true);
    const before = h.calls.length;
    h.ctl.setConsent(false);
    expect(h.calls.at(-1)).toEqual({ kind: 'disable', args: [ID] });
    const afterWithdraw = h.calls.length;
    h.ctl.track('phone_click', { link_location: 'footer' });
    h.ctl.pageView('/x');
    expect(h.calls).toHaveLength(afterWithdraw);
    expect(afterWithdraw).toBe(before + 1);
  });

  it('resumes only on a fresh grant', () => {
    const h = harness();
    h.ctl.setConsent(true);
    h.ctl.setConsent(false);
    h.ctl.setConsent(true);
    h.ctl.track('zalo_click', { link_location: 'footer' });
    expect(h.events().at(-1)?.args[0]).toBe('zalo_click');
  });
});

describe('events and payload allowlist', () => {
  it('exposes exactly the four contracted event names', () => {
    expect([...ANALYTICS_EVENTS]).toEqual(['phone_click', 'zalo_click', 'form_submit', 'document_download']);
  });

  it('keeps request types identical to the CMS enum', () => {
    expect([...ANALYTICS_REQUEST_TYPES]).toEqual([...REQUEST_TYPES]);
  });

  it('rejects unknown event names', () => {
    const h = harness();
    h.ctl.setConsent(true);
    const before = h.events().length;
    for (const name of ['page_view', 'purchase', 'PHONE_CLICK', '', undefined, 5]) h.ctl.track(name, {});
    expect(h.events()).toHaveLength(before);
  });

  it('drops every parameter that is not allowlisted or has an unsafe shape (no lead PII, no URLs)', () => {
    const dirty = {
      name: 'Nguyen Van A',
      phone: '0900000000',
      email: 'a@example.test',
      message: 'hello',
      url: 'https://evil.example/?phone=0900000000',
      utm_source: 'x',
      link_location: 'https://evil.example',
      request_type: 'a@example.test',
      document_id: '../../etc/passwd',
    };
    expect(allowlistParams(dirty)).toEqual({});
    expect(allowlistParams({ ...dirty, link_location: 'footer', request_type: 'bao-gia', document_id: '42' })).toEqual({
      link_location: 'footer',
      request_type: 'bao-gia',
      document_id: '42',
    });
    expect(allowlistParams(null)).toEqual({});
  });

  it('transmits only allowlisted params plus sanitized automatic fields', () => {
    const h = harness('/lien-he');
    h.ctl.setConsent(true);
    h.ctl.track('form_submit', { request_type: 'khao-sat', name: 'Nguyen Van A', phone: '0900000000', message: 'x' });
    const last = h.events().at(-1)?.args as [string, Record<string, string>];
    expect(last[0]).toBe('form_submit');
    expect(last[1]).toEqual({ request_type: 'khao-sat', page_location: `${ORIGIN}/lien-he`, page_referrer: ORIGIN });
    expect(JSON.stringify(h.calls)).not.toMatch(/Nguyen|0900000000|message/);
  });
});

describe('automatic GA4 fields never carry query strings, UTM, referrers or fragments', () => {
  it('sanitizes page_location', () => {
    expect(sanitizePageLocation(ORIGIN, '/lien-he')).toBe(`${ORIGIN}/lien-he`);
    // pathname never contains ?/#, but a hostile or malformed value is collapsed to the root rather than sent.
    for (const hostile of ['/lien-he?phone=0900000000', '/x#a@b.c', '//evil.example', '/a b', 'x', '/%0d%0a']) {
      expect(sanitizePageLocation(ORIGIN, hostile), hostile).toBe(`${ORIGIN}/`);
    }
  });

  it('pins page_referrer to the site origin on config, page_view and every event', () => {
    const h = harness('/lien-he?utm_source=newsletter&email=a@example.test');
    h.ctl.setConsent(true);
    h.go('/kien-thuc/c?x=1');
    h.ctl.track('document_download', { document_id: '7' });
    for (const call of h.calls.filter((c) => c.kind === 'config' || c.kind === 'event')) {
      const params = call.args[call.args.length - 1] as Record<string, unknown>;
      expect(params.page_referrer, call.kind).toBe(ORIGIN);
      expect(String(params.page_location)).not.toMatch(/[?#]|utm_|@|newsletter|email/);
    }
    expect(JSON.stringify(h.calls)).not.toMatch(/utm_|a@example|newsletter/);
  });
});

describe('form_submit ordering: only after durable persistence', () => {
  const valid = {
    name: 'Synthetic Person',
    phone: '0900 000 000',
    requestType: 'bao-gia',
    message: 'synthetic message',
    consent: true,
    sourcePage: '/lien-he',
  };
  const fakePayload = (create: () => Promise<unknown>) => ({ create }) as unknown as Payload;

  it('server marks persisted only after the write resolved', async () => {
    const order: string[] = [];
    const payload = fakePayload(async () => {
      order.push('write');
      return { id: 1 };
    });
    const result = await submitContact(payload, valid, async () => {
      order.push('notify');
    });
    order.push('response');
    expect(order).toEqual(['write', 'notify', 'response']);
    expect(result).toEqual({ status: 200, body: { ok: true, persisted: true } });
  });

  it('no persisted flag for invalid, honeypot or failed writes', async () => {
    const ok = fakePayload(async () => ({ id: 1 }));
    const failing = fakePayload(async () => {
      throw new Error('db down');
    });
    const invalid = await submitContact(ok, { ...valid, phone: 'x' });
    const bot = await submitContact(ok, { ...valid, website: 'http://spam.example' });
    const failed = await submitContact(failing, valid);
    for (const r of [invalid, bot, failed]) expect(JSON.stringify(r.body)).not.toContain('persisted');
    expect(bot).toEqual({ status: 200, body: { ok: true } });
    expect(failed.status).toBe(500);
  });

  it('browser emits form_submit only for a 200 with persisted:true', () => {
    expect(formSubmitParams(200, { ok: true, persisted: true }, 'bao-gia')).toEqual({ request_type: 'bao-gia' });
    expect(formSubmitParams(200, { ok: true }, 'bao-gia')).toBeUndefined();
    expect(formSubmitParams(200, null, 'bao-gia')).toBeUndefined();
    expect(formSubmitParams(400, { ok: false, fields: ['name'] }, 'bao-gia')).toBeUndefined();
    expect(formSubmitParams(500, { ok: false, persisted: true }, 'bao-gia')).toBeUndefined();
    expect(formSubmitParams(200, { ok: true, persisted: true }, 'a@example.test')).toEqual({});
  });
});
