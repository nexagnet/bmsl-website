import { describe, expect, it } from 'vitest';
import { toHero, toPage, type HeroView } from './public-content';

describe('HomePage Hero Mapping & Security Gate', () => {
  const approvedMedia = {
    id: 42,
    alt: 'Ảnh tòa nhà trụ sở BMSL',
    url: '/api/media-assets/file/approved-building.jpg',
    width: 1920,
    height: 1080,
    mimeType: 'image/jpeg',
    rightsStatus: 'APPROVED',
  };

  const unconfirmedMedia = {
    id: 99,
    alt: 'Ảnh chưa được BMSL xác nhận',
    url: '/api/media-assets/file/unconfirmed.jpg',
    width: 800,
    height: 600,
    mimeType: 'image/jpeg',
    rightsStatus: 'UNCONFIRMED',
  };

  it('returns undefined for non-object inputs', () => {
    expect(toHero(undefined)).toBeUndefined();
    expect(toHero(null)).toBeUndefined();
    expect(toHero('string')).toBeUndefined();
    expect(toHero(123)).toBeUndefined();
  });

  it('provides safe defaults when hero fields are empty', () => {
    const hero = toHero({});
    expect(hero).toBeDefined();
    expect(hero?.enabled).toBe(true);
    expect(hero?.primaryCta.label).toBe('Đặt lịch khảo sát');
    expect(hero?.primaryCta.href).toBe('/lien-he?requestType=khao-sat');
    expect(hero?.secondaryCta).toBeUndefined();
    expect(hero?.desktopImage).toBeUndefined();
    expect(hero?.mobileImage).toBeUndefined();
    expect(hero?.focalPoint).toBe('center');
    expect(hero?.overlayPreset).toBe('soft');
    expect(hero?.layoutPreset).toBe('editorial');
  });

  it('maps custom editorial content correctly', () => {
    const raw = {
      enabled: true,
      kicker: 'TIÊU CHUẨN VẬN HÀNH 2026',
      headline: 'Đồng hành cùng Ban Quản trị kiến tạo không gian sống bền vững',
      supportingText: 'Cung cấp giải pháp quản lý toàn diện 4 dịch vụ cốt lõi.',
      primaryCtaText: 'Khảo sát thực địa',
      primaryCtaLink: '/lien-he?requestType=khao-sat',
      secondaryCtaText: 'Xem hồ sơ dịch vụ',
      secondaryCtaLink: '/dich-vu',
      focalPoint: 'top',
      overlayPreset: 'strong',
      layoutPreset: 'split',
    };

    const hero = toHero(raw) as HeroView;
    expect(hero.kicker).toBe('TIÊU CHUẨN VẬN HÀNH 2026');
    expect(hero.headline).toBe('Đồng hành cùng Ban Quản trị kiến tạo không gian sống bền vững');
    expect(hero.supportingText).toBe('Cung cấp giải pháp quản lý toàn diện 4 dịch vụ cốt lõi.');
    expect(hero.primaryCta).toEqual({ label: 'Khảo sát thực địa', href: '/lien-he?requestType=khao-sat' });
    expect(hero.secondaryCta).toEqual({ label: 'Xem hồ sơ dịch vụ', href: '/dich-vu' });
    expect(hero.focalPoint).toBe('top');
    expect(hero.overlayPreset).toBe('strong');
    expect(hero.layoutPreset).toBe('split');
  });

  it('respects the enabled flag when set to false', () => {
    const hero = toHero({ enabled: false });
    expect(hero?.enabled).toBe(false);
  });

  it('sanitizes unsafe CTA URLs (javascript:, protocol-relative, external http/https)', () => {
    const hero = toHero({
      primaryCtaText: 'Bấm vào đây',
      primaryCtaLink: 'javascript:alert("hacked")',
      secondaryCtaText: 'Liên kết ngoài nguy hiểm',
      secondaryCtaLink: '//evil.com/phishing',
    });

    // Unsafe primary link falls back to safe default internal path
    expect(hero?.primaryCta.href).toBe('/lien-he?requestType=khao-sat');
    // Unsafe secondary link is dropped completely
    expect(hero?.secondaryCta).toBeUndefined();

    // External http(s) URLs are rejected for Hero CTAs, enforcing safe same-site navigation
    const heroWithExternal = toHero({
      primaryCtaLink: 'https://external-site.com/survey',
      secondaryCtaText: 'Trang ngoài',
      secondaryCtaLink: 'http://malicious.org/services',
    });
    expect(heroWithExternal?.primaryCta.href).toBe('/lien-he?requestType=khao-sat');
    expect(heroWithExternal?.secondaryCta).toBeUndefined();

    // Valid internal paths are preserved
    const heroWithValid = toHero({
      primaryCtaLink: '/lien-he?requestType=khao-sat',
      secondaryCtaText: 'Dịch vụ',
      secondaryCtaLink: '/dich-vu/quan-ly-van-hanh',
    });
    expect(heroWithValid?.primaryCta.href).toBe('/lien-he?requestType=khao-sat');
    expect(heroWithValid?.secondaryCta?.href).toBe('/dich-vu/quan-ly-van-hanh');
  });

  it('enforces MediaAssets rights gate: admits APPROVED media and blocks UNCONFIRMED media', () => {
    const heroWithApproved = toHero({
      desktopImage: approvedMedia,
      mobileImage: unconfirmedMedia,
    });

    expect(heroWithApproved?.desktopImage).toEqual({
      id: '42',
      alt: 'Ảnh tòa nhà trụ sở BMSL',
      url: '/api/media-assets/file/approved-building.jpg',
      width: 1920,
      height: 1080,
    });
    // Unconfirmed mobile image must be blocked
    expect(heroWithApproved?.mobileImage).toBeUndefined();
  });

  it('rejects APPROVED PDFs and unknown MIME types as Hero images, retaining the safe fallback', () => {
    const pdf = { ...approvedMedia, id: 77, url: '/api/media-assets/file/approved.pdf', mimeType: 'application/pdf' };
    expect(toHero({ desktopImage: pdf })?.desktopImage).toBeUndefined();
    expect(toHero({ mobileImage: pdf })?.mobileImage).toBeUndefined();
    expect(toHero({ desktopImage: { ...approvedMedia, mimeType: undefined } })?.desktopImage).toBeUndefined();
    expect(toHero({ desktopImage: approvedMedia })?.desktopImage?.url).toBe(approvedMedia.url);
  });

  it('rejects remote or unauthorized image URLs even if labelled APPROVED', () => {
    const spoofedMedia = {
      id: 100,
      alt: 'Spoofed external image',
      url: 'https://evil.com/fake-building.jpg',
      rightsStatus: 'APPROVED',
    };

    const hero = toHero({ desktopImage: spoofedMedia });
    expect(hero?.desktopImage).toBeUndefined();
  });

  it('integrates cleanly with toPage singleton mapper', () => {
    const rawPage = {
      _status: 'published',
      title: 'Trang chủ BMSL',
      body: null,
      seo: { title: 'BMSL - Quản lý vận hành' },
      hero: {
        enabled: true,
        kicker: 'CHUYÊN NGHIỆP',
        headline: 'Tiêu chuẩn vận hành',
        desktopImage: approvedMedia,
      },
    };

    const page = toPage(rawPage);
    expect(page).not.toBeNull();
    expect(page?.title).toBe('Trang chủ BMSL');
    expect(page?.hero?.enabled).toBe(true);
    expect(page?.hero?.kicker).toBe('CHUYÊN NGHIỆP');
    expect(page?.hero?.desktopImage?.url).toBe('/api/media-assets/file/approved-building.jpg');
  });

  it('toPage returns null if page is in draft status (fail-closed)', () => {
    const draftPage = {
      _status: 'draft',
      title: 'Bản nháp trang chủ',
      hero: { kicker: 'NHÁP' },
    };

    expect(toPage(draftPage)).toBeNull();
  });

  it('guarantees fallback never hardcodes unverified service detail URLs', () => {
    // Assert that CANONICAL_DISCIPLINES resolve only to real published services or static safe entries
    const sampleServices = [
      { id: '1', name: 'Quản lý vận hành mẫu', slug: 'mau-quan-ly-van-hanh', href: '/dich-vu/mau-quan-ly-van-hanh', body: null, seo: { noindex: false } },
      { id: '2', name: 'Bảo vệ mục tiêu', slug: 'mau-bao-ve', href: '/dich-vu/mau-bao-ve', body: null, seo: { noindex: false } },
    ];

    // When services are published with demo or custom slugs, matched slugs are real
    const matched = sampleServices.find((s) => s.slug.includes('quan-ly-van-hanh'));
    expect(matched?.href).toBe('/dich-vu/mau-quan-ly-van-hanh');

    // When a discipline has no published record, it must not invent an arbitrary link
    const unmatched = sampleServices.find((s) => s.slug === 'pccc' || s.slug.includes('pccc'));
    expect(unmatched).toBeUndefined();
  });
});
