import { normalizeSiteUrl } from './seo';

/** Locked public IA (docs/blueprint/05 §1). Canonical paths carry no trailing slash, matching what Next serves. */
export const SITE_NAME = 'BMSL';

export const NAV_ITEMS = [
  { label: 'Trang chủ', href: '/' },
  { label: 'Giới thiệu', href: '/gioi-thieu' },
  { label: 'Dịch vụ', href: '/dich-vu' },
  { label: 'Dự án', href: '/du-an' },
  { label: 'Quy trình & Minh bạch', href: '/quy-trinh-minh-bach' },
  { label: 'Tin tức', href: '/kien-thuc' },
  { label: 'Tuyển dụng', href: '/tuyen-dung' },
  { label: 'Liên hệ', href: '/lien-he' },
] as const;

export const SURVEY_CTA = { label: 'Đặt lịch khảo sát', href: '/lien-he?requestType=khao-sat' } as const;

/** Per-page CTAs from docs/handover/contract-acceptance-matrix.md §1 (Dịch vụ, Dự án). The visit CTA opens the form with the `tham-quan` request type. */
export const SERVICE_CTA = { label: 'Đăng ký khảo sát', href: '/lien-he?requestType=khao-sat' } as const;
export const PROJECT_CTA = { label: 'Đăng ký tham quan', href: '/lien-he?requestType=tham-quan' } as const;

/** Contract CTA for the home page (acceptance matrix §1). No capability-profile file exists yet, so it opens the lead form. */
export const HOME_PROFILE_CTA = { label: 'Nhận hồ sơ năng lực', href: '/lien-he?requestType=khac' } as const;

/** Fixed public routes that exist regardless of CMS content. */
export const STATIC_PUBLIC_PATHS: string[] = NAV_ITEMS.map((i) => i.href);

/**
 * Path segment that stands in for the category of a published article without a publicly published category:
 * /kien-thuc/bai-viet/<slug>. It is a technical namespace, not a category: no category record is created, and it
 * is never used for an article that has a published category (that one stays at /kien-thuc/<category>/<slug>).
 */
export const UNCATEGORIZED_SEGMENT = 'bai-viet';

export const paths = {
  service: (slug: string) => `/dich-vu/${slug}`,
  project: (slug: string) => `/du-an/${slug}`,
  category: (slug: string) => `/kien-thuc/${slug}`,
  article: (categorySlug: string | undefined, slug: string) =>
    `/kien-thuc/${categorySlug ?? UNCATEGORIZED_SEGMENT}/${slug}`,
  job: (slug: string) => `/tuyen-dung/${slug}`,
};

/** Validated origin; localhost only when SITE_URL is unset. An invalid value throws instead of being repaired. */
export const getSiteUrl = (env: Record<string, string | undefined> = process.env): string =>
  normalizeSiteUrl(env.SITE_URL?.trim() || 'http://localhost:3000');
