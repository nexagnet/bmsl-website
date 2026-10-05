import { describe, expect, it } from 'vitest';
import { isValidGa4Id, isValidVerificationToken, toPublicSiteSettings } from './site-settings';

const pub = { _status: 'published' };

describe('toPublicSiteSettings', () => {
  it('is empty for missing, null and draft settings', () => {
    expect(toPublicSiteSettings(null)).toEqual({});
    expect(toPublicSiteSettings(undefined)).toEqual({});
    expect(toPublicSiteSettings({ _status: 'draft', ga4Id: 'G-ABCD1234', analyticsEnabled: true })).toEqual({});
  });

  it('keeps analytics OFF unless the explicit switch is on AND the id is valid', () => {
    expect(toPublicSiteSettings({ ...pub, ga4Id: 'G-ABCD1234' })).toEqual({});
    expect(toPublicSiteSettings({ ...pub, ga4Id: 'G-ABCD1234', analyticsEnabled: false })).toEqual({});
    expect(toPublicSiteSettings({ ...pub, analyticsEnabled: true })).toEqual({});
    expect(toPublicSiteSettings({ ...pub, ga4Id: 'G-ABCD1234', analyticsEnabled: true }).ga4Id).toBe('G-ABCD1234');
    for (const bad of ['UA-1234-1', 'g-abcd1234', 'G-', 'G-AB', 'G-ABCD1234"><script>', 'G-ABCD 1234', 'GTM-ABCD123']) {
      expect(toPublicSiteSettings({ ...pub, ga4Id: bad, analyticsEnabled: true }).ga4Id, bad).toBeUndefined();
    }
  });

  it('validates the Search Console token charset', () => {
    const ok = 'abcDEF123_-abcDEF123_-abcDEF123';
    expect(toPublicSiteSettings({ ...pub, searchConsoleVerification: ok }).searchConsoleVerification).toBe(ok);
    for (const bad of ['short', 'a"><script>alert(1)</script>aaaaaaaa', `${ok} extra`, 'x'.repeat(101)]) {
      expect(toPublicSiteSettings({ ...pub, searchConsoleVerification: bad }).searchConsoleVerification).toBeUndefined();
    }
    expect(isValidVerificationToken(undefined)).toBe(false);
    expect(isValidGa4Id(undefined)).toBe(false);
  });

  it('exposes hotline/Zalo only when published and well-formed (never invented)', () => {
    expect(toPublicSiteSettings(pub)).toEqual({});
    const s = toPublicSiteSettings({ ...pub, contact: { hotline: '0900 000 000', zalo: '0900000000' } });
    expect(s.hotline).toEqual({ display: '0900 000 000', href: 'tel:0900000000' });
    expect(s.zalo?.href).toBe('https://zalo.me/0900000000');
    const bad = toPublicSiteSettings({ ...pub, contact: { hotline: 'javascript:alert(1)', zalo: 'https://evil.test' } });
    expect(bad).toEqual({});
  });
});
