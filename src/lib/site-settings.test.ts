import { describe, expect, it } from 'vitest';
import { parseGa4Id, parseHotline, parseZalo, toSiteSettings } from './site-settings';

const published = { _status: 'published' };

describe('toSiteSettings', () => {
  it('treats absent or draft settings as analytics-off with no contact links', () => {
    for (const doc of [null, undefined, {}, { _status: 'draft', ga4Id: 'G-ABCDEF1234', analyticsEnabled: true }]) {
      const s = toSiteSettings(doc);
      expect(s.analyticsEnabled).toBe(false);
      expect(s.ga4Id).toBeUndefined();
      expect(s.hotline).toBeUndefined();
    }
  });

  it('needs the explicit switch AND a valid id', () => {
    expect(toSiteSettings({ ...published, ga4Id: 'G-ABCDEF1234' }).analyticsEnabled).toBe(false);
    expect(toSiteSettings({ ...published, analyticsEnabled: true }).analyticsEnabled).toBe(false);
    expect(toSiteSettings({ ...published, analyticsEnabled: true, ga4Id: 'UA-1234' }).analyticsEnabled).toBe(false);
    expect(toSiteSettings({ ...published, analyticsEnabled: true, ga4Id: 'G-ABCDEF1234"><script>' }).analyticsEnabled).toBe(false);
    expect(toSiteSettings({ ...published, analyticsEnabled: 'true', ga4Id: 'G-ABCDEF1234' }).analyticsEnabled).toBe(false);
    expect(toSiteSettings({ ...published, analyticsEnabled: true, ga4Id: ' g-abcdef1234 ' })).toMatchObject({ analyticsEnabled: true, ga4Id: 'G-ABCDEF1234' });
  });

  it('exposes only validated contact links and https social URLs', () => {
    const s = toSiteSettings({
      ...published,
      contact: { hotline: '0901 234 567', zalo: 'javascript:alert(1)' },
      socialLinks: [{ url: 'https://facebook.com/x' }, { url: 'http://insecure.example' }, { url: 'javascript:x' }],
    });
    expect(s.hotline).toEqual({ label: '0901 234 567', href: 'tel:0901234567' });
    expect(s.zalo).toBeUndefined();
    expect(s.socialUrls).toEqual(['https://facebook.com/x']);
  });
});

describe('format validators', () => {
  it('GA4 id', () => {
    expect(parseGa4Id('G-ABC123XYZ9')).toBe('G-ABC123XYZ9');
    for (const bad of ['G-', 'ABC', 'G-abc<', 'G-ABCDEFGHIJKLM', 5, undefined]) expect(parseGa4Id(bad)).toBeUndefined();
  });

  it('hotline and zalo build safe links from digits only', () => {
    expect(parseHotline('+84 901 234 567')?.href).toBe('tel:+84901234567');
    expect(parseZalo('0901234567')?.href).toBe('https://zalo.me/0901234567');
    for (const bad of ['', 'abc', '123', 'tel:1; rm', 'https://evil.test']) {
      expect(parseHotline(bad)).toBeUndefined();
      expect(parseZalo(bad)).toBeUndefined();
    }
  });
});
