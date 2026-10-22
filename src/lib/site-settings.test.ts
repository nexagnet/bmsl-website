import { describe, expect, it } from 'vitest';
import { parseGa4Id, parseVerificationToken, toSiteSettings } from './site-settings';

const pub = { _status: 'published' };

describe('GA4 id and verification token validation', () => {
  it('accepts G- ids and rejects everything else', () => {
    expect(parseGa4Id('G-ABC123DEF4')).toBe('G-ABC123DEF4');
    for (const bad of ['', 'UA-123-1', 'G-', 'g-abc123def4', 'G-ABC"><script>', 'G-ABC 123', 'GTM-ABCDEFG', null, 5]) {
      expect(parseGa4Id(bad), String(bad)).toBeUndefined();
    }
  });

  it('accepts URL-safe verification tokens only', () => {
    expect(parseVerificationToken('abcDEF123_-abcDEF123_-abc')).toBeDefined();
    for (const bad of ['short', 'a"b'.repeat(10), 'x'.repeat(101), '<meta>'.repeat(5), '']) {
      expect(parseVerificationToken(bad), bad).toBeUndefined();
    }
  });
});

describe('published SiteSettings view', () => {
  it('is empty for drafts or missing documents', () => {
    expect(toSiteSettings({ _status: 'draft', analyticsEnabled: true, ga4Id: 'G-ABC123DEF4' })).toEqual({});
    expect(toSiteSettings(null)).toEqual({});
    expect(toSiteSettings({ analyticsEnabled: true, ga4Id: 'G-ABC123DEF4' })).toEqual({});
  });

  it('enables analytics only with the explicit switch AND a valid id', () => {
    expect(toSiteSettings({ ...pub, ga4Id: 'G-ABC123DEF4' }).analytics).toBeUndefined();
    expect(toSiteSettings({ ...pub, ga4Id: 'G-ABC123DEF4', analyticsEnabled: false }).analytics).toBeUndefined();
    expect(toSiteSettings({ ...pub, analyticsEnabled: true }).analytics).toBeUndefined();
    expect(toSiteSettings({ ...pub, analyticsEnabled: true, ga4Id: 'bad' }).analytics).toBeUndefined();
    expect(toSiteSettings({ ...pub, analyticsEnabled: 'true', ga4Id: 'G-ABC123DEF4' }).analytics).toBeUndefined();
    expect(toSiteSettings({ ...pub, analyticsEnabled: true, ga4Id: 'G-ABC123DEF4' }).analytics).toEqual({
      measurementId: 'G-ABC123DEF4',
    });
  });

  it('exposes hotline/Zalo only when they are valid Vietnamese numbers; nothing is invented', () => {
    const s = toSiteSettings({ ...pub, contact: { hotline: '0900 000 000', zalo: '+84900000000' } });
    expect(s.hotline).toEqual({ label: '0900 000 000', href: 'tel:0900000000' });
    expect(s.zalo).toEqual({ href: 'https://zalo.me/84900000000' });
    expect(toSiteSettings({ ...pub }).hotline).toBeUndefined();
    expect(toSiteSettings({ ...pub, contact: { hotline: 'javascript:alert(1)', zalo: 'https://evil.example' } })).toEqual({});
  });

  it('exposes email and a map link only from valid published values', () => {
    const s = toSiteSettings({ ...pub, contact: { email: 'lienhe@example.com', address: '1 Đường A, Quận B' } });
    expect(s.email).toEqual({ address: 'lienhe@example.com', href: 'mailto:lienhe@example.com' });
    expect(s.address?.text).toBe('1 Đường A, Quận B');
    expect(s.address?.mapHref).toBe('https://www.google.com/maps/search/?api=1&query=1%20%C4%90%C6%B0%E1%BB%9Dng%20A%2C%20Qu%E1%BA%ADn%20B');
    expect(toSiteSettings({ ...pub }).email).toBeUndefined();
    expect(toSiteSettings({ ...pub }).address).toBeUndefined();
    for (const bad of ['not-an-email', 'a@b.c?bcc=x@y.z', 'a b@c.d', 'javascript:alert(1)'])
      expect(toSiteSettings({ ...pub, contact: { email: bad } }).email, bad).toBeUndefined();
    expect(toSiteSettings({ _status: 'draft', contact: { email: 'a@b.co', address: 'x' } })).toEqual({});
  });
});
