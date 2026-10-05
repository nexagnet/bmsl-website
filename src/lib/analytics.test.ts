import { describe, expect, it } from 'vitest';
import {
  ANALYTICS_EVENTS,
  type AnalyticsDeps,
  createAnalytics,
  eventFromDataset,
  safePageParams,
  sanitizeEventParams,
} from './analytics';
import { postContact } from './contact-client';

const ORIGIN = 'https://bmsl.example';
// Sensitive location/referrer the visitor really has in the browser; none of it may reach the transport.
const SENSITIVE_PATH = '/lien-he?utm_source=a&phone=0901234567&email=a@b.co&name=Nguyen#frag';
const SENSITIVE_REFERRER = 'https://mail.example/inbox?token=SECRET';

function harness(path = SENSITIVE_PATH) {
  const calls: unknown[][] = [];
  const scripts: string[] = [];
  const disabled: Record<string, boolean> = {};
  const deps: AnalyticsDeps = {
    gtag: (...args) => void calls.push(args),
    loadScript: (src) => void scripts.push(src),
    setDisabled: (id, v) => void (disabled[id] = v),
    siteOrigin: () => ORIGIN,
    currentPath: () => path,
  };
  return { calls, scripts, disabled, deps };
}
const ID = 'G-ABCDEF1234';

describe('analytics disabled by default', () => {
  it.each([
    ['not enabled', { enabled: false, ga4Id: ID }],
    ['enabled but no id', { enabled: true }],
    ['enabled but invalid id', { enabled: true, ga4Id: 'G-x"><script>' }],
  ])('%s: no script, no command, even with consent and events', (_label, config) => {
    const h = harness();
    const a = createAnalytics(config, h.deps);
    a.setConsent(true);
    a.trackPageView();
    a.trackEvent('phone_click', { link_location: 'footer' });
    expect(a.isActive()).toBe(false);
    expect(h.calls).toEqual([]);
    expect(h.scripts).toEqual([]);
  });

  it('enabled + valid id but NO consent: nothing is loaded or sent', () => {
    const h = harness();
    const a = createAnalytics({ enabled: true, ga4Id: ID }, h.deps);
    a.trackPageView();
    a.trackEvent('phone_click', { link_location: 'footer' });
    expect(h.calls).toEqual([]);
    expect(h.scripts).toEqual([]);
  });
});

describe('consent gating and withdrawal', () => {
  it('loads the fixed gtag URL only after consent, with consent default denied first', () => {
    const h = harness();
    const a = createAnalytics({ enabled: true, ga4Id: ID }, h.deps);
    a.setConsent(true);
    expect(h.scripts).toEqual([`https://www.googletagmanager.com/gtag/js?id=${ID}`]);
    expect(h.calls[0]).toEqual(['consent', 'default', expect.objectContaining({ analytics_storage: 'denied', ad_storage: 'denied' })]);
    expect(h.calls.map((c) => c[0]).indexOf('config')).toBeGreaterThan(0);
    expect(a.isActive()).toBe(true);
  });

  it('withdrawal stops all later traffic and re-grant resumes without reloading the script', () => {
    const h = harness();
    const a = createAnalytics({ enabled: true, ga4Id: ID }, h.deps);
    a.setConsent(true);
    a.setConsent(false);
    const before = h.calls.length;
    expect(h.calls.at(-1)).toEqual(['consent', 'update', { analytics_storage: 'denied' }]);
    expect(h.disabled[ID]).toBe(true);
    a.trackEvent('zalo_click', { link_location: 'footer' });
    a.trackPageView();
    expect(h.calls).toHaveLength(before);
    a.setConsent(true);
    expect(h.scripts).toHaveLength(1);
    expect(h.disabled[ID]).toBe(false);
    a.trackEvent('zalo_click', { link_location: 'footer' });
    expect(h.calls.at(-1)?.[1]).toBe('zalo_click');
  });
});

describe('no PII reaches the transport (automatic and custom events)', () => {
  it('config, page_view and events carry path-only page_location and an origin-only referrer', () => {
    const h = harness();
    const a = createAnalytics({ enabled: true, ga4Id: ID }, h.deps);
    a.setConsent(true);
    a.trackPageView();
    a.trackEvent('form_submit', { request_type: 'khao-sat', name: 'Nguyen', phone: '0901234567', email: 'a@b.co', message: 'hi', url: SENSITIVE_PATH });
    a.trackEvent('document_download', { document_id: '12', file_url: SENSITIVE_REFERRER });

    const wire = JSON.stringify(h.calls);
    for (const leak of ['utm_source', '0901234567', 'a@b.co', 'Nguyen', 'SECRET', 'token', 'frag', 'inbox', '?', '#']) {
      expect(wire).not.toContain(leak);
    }
    const config = h.calls.find((c) => c[0] === 'config');
    expect(config?.[2]).toMatchObject({ send_page_view: false, page_location: `${ORIGIN}/lien-he`, page_referrer: `${ORIGIN}/` });
    const pageViews = h.calls.filter((c) => c[1] === 'page_view');
    expect(pageViews.length).toBeGreaterThan(0);
    for (const pv of pageViews) expect(pv[2]).toEqual({ page_location: `${ORIGIN}/lien-he`, page_referrer: `${ORIGIN}/` });
    expect(h.calls.find((c) => c[1] === 'form_submit')?.[2]).toEqual({
      request_type: 'khao-sat',
      page_location: `${ORIGIN}/lien-he`,
      page_referrer: `${ORIGIN}/`,
    });
    expect(h.calls.find((c) => c[1] === 'document_download')?.[2]).toMatchObject({ document_id: '12' });
  });

  it('safePageParams strips query/hash and rejects protocol-relative paths', () => {
    expect(safePageParams(ORIGIN, '/a/b?x=1#y').page_location).toBe(`${ORIGIN}/a/b`);
    expect(safePageParams(ORIGIN, '//evil.test/x').page_location).toBe(`${ORIGIN}/`);
  });

  it('only the four contract event names are accepted', () => {
    expect([...ANALYTICS_EVENTS]).toEqual(['phone_click', 'zalo_click', 'form_submit', 'document_download']);
    const h = harness();
    const a = createAnalytics({ enabled: true, ga4Id: ID }, h.deps);
    a.setConsent(true);
    const before = h.calls.length;
    for (const name of ['purchase', 'page_view', 'click', '', undefined, 5]) a.trackEvent(name);
    expect(h.calls).toHaveLength(before);
  });

  it('parameter allowlist rejects non-matching values', () => {
    expect(sanitizeEventParams('form_submit', { request_type: 'a@b.co' })).toEqual({});
    expect(sanitizeEventParams('phone_click', { link_location: 'footer', phone: '0901234567' })).toEqual({ link_location: 'footer' });
    expect(sanitizeEventParams('document_download', { document_id: '1; drop' })).toEqual({});
  });

  it('reads click targets from data attributes through the same allowlist', () => {
    expect(eventFromDataset({ analyticsEvent: 'phone_click', analyticsLocation: 'footer' })).toEqual({ name: 'phone_click', params: { link_location: 'footer' } });
    expect(eventFromDataset({ analyticsEvent: 'document_download', analyticsDocumentId: '7' })).toEqual({ name: 'document_download', params: { document_id: '7' } });
    expect(eventFromDataset({ analyticsEvent: 'purchase' })).toBeUndefined();
    expect(eventFromDataset({})).toBeUndefined();
  });
});

describe('form_submit ordering', () => {
  const payload = { name: 'Nguyen', phone: '0901234567', requestType: 'khao-sat' };
  const reply = (status: number, body: unknown) => async () => ({ ok: status >= 200 && status < 300, status, json: async () => body });

  it('fires only after the server confirms durable persistence', async () => {
    const order: string[] = [];
    const fetchFn = async () => {
      order.push('server-persisted');
      return { ok: true, status: 200, json: async () => ({ ok: true, persisted: true }) };
    };
    const out = await postContact(fetchFn, payload, () => order.push('form_submit'));
    expect(out.state).toBe('sent');
    expect(order).toEqual(['server-persisted', 'form_submit']);
  });

  it.each([
    ['invalid (400)', reply(400, { ok: false, fields: ['phone'] }), 'invalid'],
    ['honeypot (200 without persisted)', reply(200, { ok: true }), 'sent'],
    ['persist failure (500)', reply(500, { ok: false, error: 'persist_failed' }), 'error'],
    ['network failure', async () => Promise.reject(new Error('offline')), 'error'],
    ['unparsable success body', async () => ({ ok: true, status: 200, json: async () => Promise.reject(new Error('x')) }), 'sent'],
  ])('%s: no form_submit', async (_label, fetchFn, state) => {
    let fired = 0;
    const out = await postContact(fetchFn as never, payload, () => void fired++);
    expect(out.state).toBe(state);
    expect(fired).toBe(0);
  });

  it('an analytics failure never changes the visitor result', async () => {
    const out = await postContact(reply(200, { ok: true, persisted: true }), payload, () => {
      throw new Error('boom');
    });
    expect(out.state).toBe('sent');
  });

  it('end to end with the mock transport: event carries the request type only, gated by consent', async () => {
    const h = harness('/lien-he?phone=0901234567');
    const a = createAnalytics({ enabled: true, ga4Id: ID }, h.deps);
    await postContact(reply(200, { ok: true, persisted: true }), payload, () => a.trackEvent('form_submit', { request_type: 'khao-sat' }));
    expect(h.calls).toEqual([]); // no consent yet
    a.setConsent(true);
    await postContact(reply(200, { ok: true, persisted: true }), payload, () => a.trackEvent('form_submit', { request_type: 'khao-sat' }));
    expect(h.calls.at(-1)).toEqual(['event', 'form_submit', { request_type: 'khao-sat', page_location: `${ORIGIN}/lien-he`, page_referrer: `${ORIGIN}/` }]);
    expect(JSON.stringify(h.calls)).not.toMatch(/0901234567|Nguyen/);
  });
});
