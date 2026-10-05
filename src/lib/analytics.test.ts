import { describe, expect, it } from 'vitest';
import { REQUEST_TYPES } from '../collections/ContactLeads';
import {
  allowlistParams,
  ANALYTICS_EVENTS,
  ANALYTICS_REQUEST_TYPES,
  cleanPageLocation,
  createAnalytics,
} from './analytics';
import { submitContact } from './contact-submission';

const ORIGIN = 'https://bmsl.example';
const ID = 'G-ABCD1234';

function harness() {
  const calls: unknown[][] = [];
  const scripts: string[] = [];
  const disabled: boolean[] = [];
  const a = createAnalytics({
    ga4Id: ID,
    origin: ORIGIN,
    transport: (...args) => calls.push(args),
    loadScript: (id) => scripts.push(id),
    setDisabled: (_id, d) => disabled.push(d),
  });
  return { a, calls, scripts, disabled, events: () => calls.filter((c) => c[0] === 'event') };
}

describe('analytics core (injected transport)', () => {
  it('keeps the allowlisted request types in sync with the contact form', () => {
    expect([...ANALYTICS_REQUEST_TYPES]).toEqual([...REQUEST_TYPES]);
  });

  it('is silent by default: no script, no transport call, events dropped without consent', () => {
    const { a, calls, scripts } = harness();
    expect(a.track('phone_click', { link_location: 'footer' })).toBe(false);
    a.pageView('/du-an');
    expect(calls).toEqual([]);
    expect(scripts).toEqual([]);
  });

  it('loads the script and configures GA4 only after consent, with page_view automation disabled', () => {
    const { a, calls, scripts } = harness();
    a.setConsent(true, '/du-an/p');
    expect(scripts).toEqual([ID]);
    const config = calls.find((c) => c[0] === 'config');
    expect(config?.[1]).toBe(ID);
    expect(config?.[2]).toMatchObject({
      send_page_view: false,
      allow_google_signals: false,
      allow_ad_personalization_signals: false,
      page_location: `${ORIGIN}/du-an/p`,
      page_referrer: ORIGIN,
    });
  });

  it('emits exactly the four event names; anything else is rejected', () => {
    expect([...ANALYTICS_EVENTS]).toEqual(['phone_click', 'zalo_click', 'form_submit', 'document_download']);
    const { a, events } = harness();
    a.setConsent(true);
    const before = events().length;
    for (const name of ANALYTICS_EVENTS) expect(a.track(name, {})).toBe(true);
    for (const name of ['purchase', 'page_view', 'click', '', undefined, 42]) expect(a.track(name, {})).toBe(false);
    expect(events().slice(before).map((e) => e[1])).toEqual([...ANALYTICS_EVENTS]);
  });

  it('withdrawal stops subsequent traffic; re-granting resumes without reloading the script', () => {
    const { a, calls, scripts, disabled } = harness();
    a.setConsent(true);
    a.setConsent(false);
    const n = calls.length;
    expect(a.track('phone_click', { link_location: 'footer' })).toBe(false);
    a.pageView('/x');
    expect(calls.length).toBe(n);
    expect(disabled.at(-1)).toBe(true);
    a.setConsent(true);
    expect(scripts).toEqual([ID]);
    expect(a.track('zalo_click', { link_location: 'footer' })).toBe(true);
  });

  it('strips query strings, UTM, fragments and the real referrer from every payload', () => {
    expect(cleanPageLocation(ORIGIN, '/lien-he?name=Nguyen&phone=0900000000&utm_source=x#frag')).toBe(`${ORIGIN}/lien-he`);
    const { a, calls } = harness();
    a.setConsent(true, '/lien-he?email=a@b.c&utm_campaign=secret');
    a.track('phone_click', { link_location: 'footer' }, '/lien-he?phone=0900000000');
    a.pageView('/du-an?q=private#x');
    const wire = JSON.stringify(calls);
    for (const leak of ['email', 'a@b.c', 'utm_', 'secret', '0900000000', 'phone=', 'q=private', '#x', 'referrer.example']) {
      expect(wire, leak).not.toContain(leak);
    }
    for (const c of calls.filter((x) => x[0] === 'event')) {
      const params = c[2] as Record<string, string>;
      expect(params.page_referrer).toBe(ORIGIN);
      expect(new URL(params.page_location).search).toBe('');
      expect(new URL(params.page_location).hash).toBe('');
    }
  });

  it('allowlists parameters: no name, phone, email, message or arbitrary URL', () => {
    expect(
      allowlistParams({
        name: 'Nguyen Van A',
        phone: '0900000000',
        email: 'a@b.c',
        message: 'hello',
        page_location: 'https://evil.test/?x=1',
        link_url: 'https://evil.test',
        link_location: 'footer',
        request_type: 'bao-gia',
        document_id: '12',
      }),
    ).toEqual({ link_location: 'footer', request_type: 'bao-gia', document_id: '12' });
    expect(allowlistParams({ link_location: 'a b', request_type: 'other', document_id: 'abc' })).toEqual({});
    expect(allowlistParams({ document_id: 'Tai lieu 0900000000' })).toEqual({});
    expect(allowlistParams(null)).toEqual({});
    const { a, calls } = harness();
    a.setConsent(true);
    a.track('form_submit', { request_type: 'khac', name: 'N', phone: '0900000000', message: 'm', email: 'e@x.y' });
    const last = calls.at(-1) as unknown[];
    expect(Object.keys(last[2] as object).sort()).toEqual(['page_location', 'page_referrer', 'request_type']);
  });
});

describe('form_submit only follows durable persistence', () => {
  const valid = {
    name: 'Synthetic Person',
    phone: '0900 000 000',
    requestType: 'khao-sat',
    message: 'synthetic',
    consent: true,
    sourcePage: '/lien-he',
  };
  const fake = (create: () => Promise<unknown>) => ({ create }) as never;

  it('flags persisted only after the write succeeds; invalid, honeypot and failed writes carry no flag', async () => {
    const order: string[] = [];
    const ok = await submitContact(
      fake(async () => {
        order.push('persist');
        return { id: 1 };
      }),
      valid,
      async () => {
        order.push('notify');
      },
    );
    expect(ok).toEqual({ status: 200, body: { ok: true, persisted: true } });
    expect(order).toEqual(['persist', 'notify']);

    const invalid = await submitContact(fake(async () => ({ id: 1 })), { ...valid, phone: 'x' });
    expect(invalid.status).toBe(400);
    expect(JSON.stringify(invalid.body)).not.toContain('persisted');

    let writes = 0;
    const bot = await submitContact(fake(async () => (writes++, { id: 1 })), { ...valid, website: 'spam' });
    expect(bot).toEqual({ status: 200, body: { ok: true } });
    expect(writes).toBe(0);

    const failed = await submitContact(fake(async () => Promise.reject(new Error('db down'))), valid);
    expect(failed.status).toBe(500);
    expect(JSON.stringify(failed.body)).not.toContain('persisted');
  });
});
