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

  it('builds the office map only from approved, in-range synthetic coordinates', () => {
    const ok = { mapLatitude: 10.5, mapLongitude: 106.5, mapApproved: true };
    const map = toSiteSettings({ ...pub, contact: ok }).map;
    expect(map?.embedSrc).toBe(
      'https://www.openstreetmap.org/export/embed.html?bbox=106.496000,10.496000,106.504000,10.504000&layer=mapnik&marker=10.500000,106.500000',
    );
    expect(map?.linkHref).toBe('https://www.openstreetmap.org/?mlat=10.500000&mlon=106.500000#map=17/10.500000/106.500000');
    for (const bad of [
      { ...ok, mapApproved: false },
      { ...ok, mapApproved: 'true' },
      { mapLatitude: 10.5, mapApproved: true },
      { ...ok, mapLatitude: 106.5, mapLongitude: 10.5 },
      { ...ok, mapLatitude: '10.5' },
      { ...ok, mapLongitude: Number.NaN },
    ]) {
      expect(toSiteSettings({ ...pub, contact: bad }).map, JSON.stringify(bad)).toBeUndefined();
    }
    expect(toSiteSettings({ _status: 'draft', contact: ok }).map).toBeUndefined();
    expect(toSiteSettings({ ...pub, contact: { address: ' Địa chỉ thử nghiệm ' } }).address).toBe('Địa chỉ thử nghiệm');
  });
});
