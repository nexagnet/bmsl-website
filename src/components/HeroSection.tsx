import Link from 'next/link';
import type { HeroView } from '../lib/public-content';
import { SITE_NAME, SURVEY_CTA } from '../lib/site';

export interface HeroSectionProps {
  hero?: HeroView;
  defaultTitle?: string;
  defaultBodyText?: string;
}

export function HeroSection({ hero, defaultTitle, defaultBodyText }: HeroSectionProps) {
  // If CMS admin disabled the Hero section, preserve semantic H1 for page heading hierarchy
  if (hero && hero.enabled === false) {
    return <h1 className="sr-only">{defaultTitle || SITE_NAME}</h1>;
  }

  const kicker = hero?.kicker;
  const headline = hero?.headline || defaultTitle || SITE_NAME;
  const supportingText = hero?.supportingText || defaultBodyText;
  const primaryCta = hero?.primaryCta || { label: SURVEY_CTA.label, href: SURVEY_CTA.href };
  const secondaryCta = hero?.secondaryCta || { label: 'Xem dịch vụ', href: '/dich-vu' };
  const desktopImage = hero?.desktopImage;
  const mobileImage = hero?.mobileImage || desktopImage;
  const focalPoint = hero?.focalPoint || 'center';
  const overlayPreset = hero?.overlayPreset || 'soft';
  const layoutPreset = hero?.layoutPreset || 'editorial';

  return (
    <section
      className={`hero-editorial ${layoutPreset === 'split' ? 'preset-split' : 'preset-editorial'} ${
        desktopImage ? 'has-media' : 'text-first'
      }`}
      aria-label="Giới thiệu thương hiệu BMSL"
    >
      <div className="container hero-editorial-inner">
        <div className="hero-editorial-content">
          {kicker ? (
            <div className="hero-editorial-kicker">
              <span className="kicker-line" aria-hidden="true" />
              <span className="kicker-text">{kicker}</span>
            </div>
          ) : null}

          <h1 className="hero-editorial-headline">{headline}</h1>

          {supportingText ? (
            <p className="hero-editorial-description">{supportingText}</p>
          ) : null}

          <div className="hero-editorial-actions">
            <Link className="button button-primary hero-btn-primary" href={primaryCta.href}>
              <span>{primaryCta.label}</span>
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <line x1="5" y1="12" x2="19" y2="12" />
                <polyline points="12 5 19 12 12 19" />
              </svg>
            </Link>

            {secondaryCta ? (
              <Link className="button button-secondary hero-btn-secondary" href={secondaryCta.href}>
                <span>{secondaryCta.label}</span>
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <line x1="5" y1="12" x2="19" y2="12" />
                  <polyline points="12 5 19 12 12 19" />
                </svg>
              </Link>
            ) : null}
          </div>
        </div>

        <div className="hero-editorial-media">
          {desktopImage ? (
            <div className={`hero-media-wrapper focal-${focalPoint} overlay-${overlayPreset}`}>
              <picture>
                {mobileImage && mobileImage.url !== desktopImage.url ? (
                  <source media="(max-width: 48rem)" srcSet={mobileImage.url} />
                ) : null}
                <img
                  src={desktopImage.url}
                  alt={desktopImage.alt || 'Hình ảnh kiến trúc công trình'}
                  {...(desktopImage.width && desktopImage.height
                    ? { width: desktopImage.width, height: desktopImage.height }
                    : {})}
                  fetchPriority="high"
                  decoding="async"
                  className="hero-media-img"
                />
              </picture>
              <div className="hero-media-overlay" aria-hidden="true" />
              <div className="hero-media-frame-corner top-left" aria-hidden="true" />
              <div className="hero-media-frame-corner bottom-right" aria-hidden="true" />
            </div>
          ) : (
            <div className="hero-fallback-matrix" aria-label="Lĩnh vực dịch vụ vận hành">
              <div className="matrix-header">
                <span className="matrix-title">LĨNH VỰC DỊCH VỤ</span>
                <span className="matrix-badge">BMSL</span>
              </div>
              <div className="matrix-grid">
                <Link href="/dich-vu/quan-ly-van-hanh" className="matrix-item">
                  <span className="matrix-num">01</span>
                  <h3 className="matrix-item-title">Quản lý vận hành</h3>
                  <span className="matrix-item-link" aria-hidden="true">
                    Chi tiết &rarr;
                  </span>
                </Link>
                <Link href="/dich-vu/bao-ve" className="matrix-item">
                  <span className="matrix-num">02</span>
                  <h3 className="matrix-item-title">Bảo vệ</h3>
                  <span className="matrix-item-link" aria-hidden="true">
                    Chi tiết &rarr;
                  </span>
                </Link>
                <Link href="/dich-vu/ve-sinh" className="matrix-item">
                  <span className="matrix-num">03</span>
                  <h3 className="matrix-item-title">Vệ sinh</h3>
                  <span className="matrix-item-link" aria-hidden="true">
                    Chi tiết &rarr;
                  </span>
                </Link>
                <Link href="/dich-vu/pccc" className="matrix-item">
                  <span className="matrix-num">04</span>
                  <h3 className="matrix-item-title">PCCC</h3>
                  <span className="matrix-item-link" aria-hidden="true">
                    Chi tiết &rarr;
                  </span>
                </Link>
              </div>
              <div className="matrix-footer">
                <Link href="/dich-vu" className="matrix-footer-link">
                  Xem tất cả dịch vụ &rarr;
                </Link>
              </div>
            </div>
          )}
        </div>
      </div>
      <div className="hero-architectural-rule" aria-hidden="true" />
    </section>
  );
}
