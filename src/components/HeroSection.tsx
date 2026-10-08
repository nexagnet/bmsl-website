import Link from 'next/link';
import type { HeroView } from '../lib/public-content';
import { SITE_NAME, SURVEY_CTA } from '../lib/site';

export interface HeroSectionProps {
  hero?: HeroView;
  defaultTitle?: string;
  defaultBodyText?: string;
}

export function HeroSection({ hero, defaultTitle, defaultBodyText }: HeroSectionProps) {
  // Allow CMS admin to disable the Hero section if required
  if (hero && hero.enabled === false) {
    return null;
  }

  const kicker = hero?.kicker || 'QUẢN LÝ VẬN HÀNH BẤT ĐỘNG SẢN CHUYÊN NGHIỆP';
  const headline = hero?.headline || defaultTitle || SITE_NAME;
  const supportingText =
    hero?.supportingText ||
    defaultBodyText ||
    'Đồng hành cùng Ban Quản trị và Chủ đầu tư kiến tạo không gian sống an toàn, minh bạch và tiêu chuẩn vận hành bền vững.';
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

          <div className="hero-editorial-credentials" aria-label="Tiêu chuẩn năng lực BMSL">
            <span className="credential-item">
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <polyline points="20 6 9 17 4 12" />
              </svg>
              Minh bạch quy trình
            </span>
            <span className="credential-divider" aria-hidden="true">
              ·
            </span>
            <span className="credential-item">
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <polyline points="20 6 9 17 4 12" />
              </svg>
              An toàn PCCC chuẩn mực
            </span>
            <span className="credential-divider" aria-hidden="true">
              ·
            </span>
            <span className="credential-item">
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <polyline points="20 6 9 17 4 12" />
              </svg>
              Đồng hành cùng BQT
            </span>
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
                  alt={desktopImage.alt || 'Ảnh công trình kiến trúc do BMSL quản lý vận hành'}
                  {...(desktopImage.width && desktopImage.height
                    ? { width: desktopImage.width, height: desktopImage.height }
                    : {})}
                  fetchPriority="high"
                  decoding="async"
                  className="hero-media-img"
                  sizes="(min-width: 64rem) 46vw, 100vw"
                />
              </picture>
              <div className="hero-media-overlay" aria-hidden="true" />
              <div className="hero-media-frame-corner top-left" aria-hidden="true" />
              <div className="hero-media-frame-corner bottom-right" aria-hidden="true" />
              <div className="hero-media-caption">
                <span className="caption-tag">BMSL FACILITY</span>
                <span className="caption-text">Chuẩn mực trong từng chi tiết vận hành</span>
              </div>
            </div>
          ) : (
            <div className="hero-fallback-matrix" aria-label="4 lĩnh vực dịch vụ cốt lõi">
              <div className="matrix-header">
                <span className="matrix-title">LĨNH VỰC VẬN HÀNH CỐT LÕI</span>
                <span className="matrix-badge">BMSL · STANDARD</span>
              </div>
              <div className="matrix-grid">
                <div className="matrix-item">
                  <span className="matrix-num">01</span>
                  <h3 className="matrix-item-title">Quản lý vận hành</h3>
                  <p className="matrix-item-desc">
                    Điều hành tổng thể tòa nhà, tối ưu chi phí và quản lý dịch vụ cư dân chuẩn mực.
                  </p>
                </div>
                <div className="matrix-item">
                  <span className="matrix-num">02</span>
                  <h3 className="matrix-item-title">An ninh & Bảo vệ</h3>
                  <p className="matrix-item-desc">
                    Lực lượng chuyên nghiệp, kiểm soát an ninh 24/7 và phản ứng nhanh sự cố.
                  </p>
                </div>
                <div className="matrix-item">
                  <span className="matrix-num">03</span>
                  <h3 className="matrix-item-title">Vệ sinh môi trường</h3>
                  <p className="matrix-item-desc">
                    Quy trình vệ sinh công nghiệp khép kín, giữ gìn cảnh quan sạch đẹp, văn minh.
                  </p>
                </div>
                <div className="matrix-item">
                  <span className="matrix-num">04</span>
                  <h3 className="matrix-item-title">Kỹ thuật & PCCC</h3>
                  <p className="matrix-item-desc">
                    Bảo trì hệ thống cơ điện (M&E), diễn tập và duy trì an toàn phòng cháy chữa cháy.
                  </p>
                </div>
              </div>
              <div className="matrix-footer">
                <span className="matrix-note">Cam kết thực hiện theo quy trình và tiêu chuẩn hợp đồng</span>
              </div>
            </div>
          )}
        </div>
      </div>
      <div className="hero-architectural-rule" aria-hidden="true" />
    </section>
  );
}
