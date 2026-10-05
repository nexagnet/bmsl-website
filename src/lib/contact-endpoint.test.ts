import type { Payload } from 'payload';
import { describe, expect, it, vi } from 'vitest';
import { handleContactPost, MAX_BODY_BYTES } from './contact-endpoint';

// Synthetic data only.
const valid = {
  name: 'Synthetic Person',
  phone: '0900 000 000',
  requestType: 'bao-gia',
  message: 'synthetic message',
  consent: true,
};

const post = (body: BodyInit | null, headers: Record<string, string> = {}) =>
  new Request('http://site.test/lien-he/gui', {
    method: 'POST',
    headers: { 'content-type': 'application/json', host: 'site.test', ...headers },
    body,
  });

const okPayload = (create = vi.fn(async () => ({ id: 1 }))) => ({ payload: { create } as unknown as Payload, create });

describe('handleContactPost', () => {
  it('persists a valid same-site JSON submission', async () => {
    const { payload, create } = okPayload();
    const res = await handleContactPost(post(JSON.stringify(valid)), { getPayload: async () => payload, allow: () => true });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, persisted: true });
    expect(create).toHaveBeenCalledTimes(1);
  });

  it('rejects non-JSON content types and cross-site origins before parsing', async () => {
    const deps = { getPayload: vi.fn(), allow: () => true };
    expect((await handleContactPost(post('a=b', { 'content-type': 'text/plain' }), deps)).status).toBe(415);
    expect((await handleContactPost(post(JSON.stringify(valid), { origin: 'https://evil.test' }), deps)).status).toBe(403);
    expect(deps.getPayload).not.toHaveBeenCalled();
  });

  it('answers malformed, non-object and oversized bodies with fixed safe shapes', async () => {
    const deps = { getPayload: vi.fn(), allow: () => true };
    expect((await handleContactPost(post('{not json'), deps)).status).toBe(400);
    expect((await handleContactPost(post('[1,2]'), deps)).status).toBe(400);
    expect((await handleContactPost(post('null'), deps)).status).toBe(400);
    const big = await handleContactPost(post(JSON.stringify({ ...valid, message: 'x'.repeat(MAX_BODY_BYTES) })), deps);
    expect(big.status).toBe(413);
    expect(deps.getPayload).not.toHaveBeenCalled();
  });

  it('honeypot returns success shape without persisting', async () => {
    const { payload, create } = okPayload();
    const res = await handleContactPost(post(JSON.stringify({ ...valid, website: 'http://spam.test' })), {
      getPayload: async () => payload,
      allow: () => true,
    });
    expect(await res.json()).toEqual({ ok: true });
    expect(create).not.toHaveBeenCalled();
  });

  it('returns 400 with field names for invalid input and no-consent', async () => {
    const { payload, create } = okPayload();
    const res = await handleContactPost(post(JSON.stringify({ ...valid, consent: false })), {
      getPayload: async () => payload,
      allow: () => true,
    });
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ ok: false, fields: ['consent'] });
    expect(create).not.toHaveBeenCalled();
  });

  it('fails closed with 429 when the limiter refuses, before touching the backend', async () => {
    const getPayload = vi.fn();
    const res = await handleContactPost(post(JSON.stringify(valid)), { getPayload, allow: () => false });
    expect(res.status).toBe(429);
    expect(res.headers.get('retry-after')).toBe('60');
    expect(getPayload).not.toHaveBeenCalled();
  });

  it('returns a safe 503 when backend initialisation fails, without leaking the error or PII', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const res = await handleContactPost(post(JSON.stringify(valid)), {
      getPayload: async () => {
        throw new Error('connect ECONNREFUSED postgres://user:secret@db/x');
      },
      allow: () => true,
    });
    expect(res.status).toBe(503);
    const text = await res.text();
    expect(text).toBe('{"ok":false,"error":"unavailable"}');
    expect(JSON.stringify(spy.mock.calls)).not.toMatch(/secret|Synthetic Person|0900/);
    spy.mockRestore();
  });

  it('returns a safe 500 when the durable write fails and never logs lead content', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { payload } = okPayload(
      vi.fn(async () => {
        throw new Error('insert failed for Synthetic Person 0900 000 000');
      }),
    );
    const res = await handleContactPost(post(JSON.stringify(valid)), { getPayload: async () => payload, allow: () => true });
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ ok: false, error: 'persist_failed' });
    expect(JSON.stringify(spy.mock.calls)).not.toMatch(/Synthetic Person|0900/);
    spy.mockRestore();
  });
});
