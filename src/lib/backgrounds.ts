import type { PublicImage } from './public-content';

// Decorative section backgrounds. The presets are drawn in CSS only (navy/gold, no photo, no third-party asset), so they
// carry no rights question; an uploaded image is admitted only as APPROVED media (see toPublicImage).

export const BACKGROUND_PRESETS = [
  { value: 'navy', label: 'Navy phẳng (mặc định)' },
  { value: 'gradient', label: 'Navy chuyển sắc' },
  { value: 'grid', label: 'Lưới kiến trúc' },
  { value: 'diagonal', label: 'Đường chéo vàng mảnh' },
  { value: 'glow', label: 'Ánh vàng góc phải' },
] as const;

export type BackgroundPreset = (typeof BACKGROUND_PRESETS)[number]['value'];

export type SectionBackground = { preset: BackgroundPreset; image?: PublicImage };

/** Class and inline style for a dark section; the image (when approved) sits under a navy veil so text stays readable. */
export function backgroundProps(bg: SectionBackground | undefined, base: string) {
  const b = bg ?? { preset: 'navy' as const };
  return {
    className: `${base} bg-${b.preset}${'image' in b && b.image ? ' bg-has-image' : ''}`,
    style: 'image' in b && b.image
      ? { backgroundImage: `linear-gradient(rgba(15, 45, 99, 0.86), rgba(15, 45, 99, 0.9)), url("${b.image.url}")` }
      : undefined,
  };
}
