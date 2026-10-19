import Link from 'next/link';
import type { HeroView } from '../lib/public-content';
import { SITE_NAME, SURVEY_CTA } from '../lib/site';

export interface HeroSectionProps {
  hero?: HeroView;
  defaultTitle?: string;
  defaultBodyText?: string;
}

function Arrow() {
  return (
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
  );
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
        </div>

        <div className="hero-editorial-aside">
          {supportingText ? <p className="hero-editorial-description">{supportingText}</p> : null}

          <div className="hero-editorial-actions">
            <Link className="button button-primary hero-btn-primary" href={primaryCta.href}>
              <span>{primaryCta.label}</span>
              <Arrow />
            </Link>

            {secondaryCta ? (
              <Link className="button button-secondary hero-btn-secondary" href={secondaryCta.href}>
                <span>{secondaryCta.label}</span>
                <Arrow />
              </Link>
            ) : null}
          </div>
        </div>

        {desktopImage ? (
          <div className="hero-editorial-media">
            <div className={`hero-media-wrapper focal-${focalPoint} overlay-${overlayPreset}`}>
              <picture>
                {mobileImage && mobileImage.url !== desktopImage.url ? (
                  <source media="(max-width: 48rem)" srcSet={mobileImage.url} />
                ) : null}
                {/* LCP candidate: eager + high priority; intrinsic size reserved to prevent CLS */}
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
            </div>
          </div>
        ) : null}
      </div>
      <div className="hero-architectural-rule" aria-hidden="true" />
    </section>
  );
}
