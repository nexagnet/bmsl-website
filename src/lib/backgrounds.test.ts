import { describe, expect, it } from 'vitest';
import { backgroundProps } from './backgrounds';
import { toSectionBackground } from './public-content';
import { toSiteFooter } from './site-footer';

const media = (rights: string) => ({
  id: 7, alt: 'Nền', url: '/api/media-assets/file/nen.jpg', mimeType: 'image/jpeg', rightsStatus: rights,
});

describe('section backgrounds', () => {
  it('defaults to plain navy and ignores unknown presets', () => {
    expect(toSectionBackground(undefined)).toEqual({ preset: 'navy', image: undefined });
    expect(toSectionBackground({ preset: 'evil' }).preset).toBe('navy');
    expect(toSectionBackground({ preset: 'grid' }).preset).toBe('grid');
  });

  it('shows an uploaded image only when APPROVED', () => {
    expect(toSectionBackground({ image: media('UNCONFIRMED') }).image).toBeUndefined();
    expect(toSectionBackground({ image: media('APPROVED') }).image?.url).toBe('/api/media-assets/file/nen.jpg');
  });

  it('keeps the base class and adds a navy veil over an image', () => {
    const p = backgroundProps(toSectionBackground({ preset: 'grid', image: media('APPROVED') }), 'site-footer');
    expect(p.className).toBe('site-footer bg-grid bg-has-image');
    expect(p.style?.backgroundImage).toContain('rgba(15, 45, 99');
    expect(backgroundProps(undefined, 'band-navy')).toEqual({ className: 'band-navy bg-navy', style: undefined });
  });
});

describe('site footer view', () => {
  it('is empty unless published', () => {
    expect(toSiteFooter({ _status: 'draft', intro: { text: 'x', confirmed: true } }).intro).toBeUndefined();
  });

  it('shows intro and links only when confirmed and safe', () => {
    const v = toSiteFooter({
      _status: 'published',
      intro: { text: 'Giới thiệu', confirmed: false },
      links: [
        { label: 'A', href: '/chinh-sach', confirmed: true },
        { label: 'B', href: 'javascript:alert(1)', confirmed: true },
        { label: 'C', href: '/x', confirmed: false },
      ],
      copyright: '© BMSL 2026',
    });
    expect(v.intro).toBeUndefined();
    expect(v.links).toEqual([{ label: 'A', href: '/chinh-sach' }]);
    expect(v.copyright).toBe('© BMSL 2026');
  });
});
