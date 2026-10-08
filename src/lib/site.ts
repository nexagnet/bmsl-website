import { normalizeSiteUrl } from './seo';

/** Locked public IA (docs/blueprint/05 §1). Canonical paths carry no trailing slash, matching what Next serves. */
export const SITE_NAME = 'BMSL';

export const NAV_ITEMS = [
  { label: 'Trang chủ', href: '/' },
  { label: 'Giới thiệu', href: '/gioi-thieu' },
  { label: 'Dịch vụ', href: '/dich-vu' },
  { label: 'Dự án', href: '/du-an' },
  { label: 'Quy trình & Minh bạch', href: '/quy-trinh-minh-bach' },
  { label: 'Kiến thức', href: '/kien-thuc' },
  { label: 'Tuyển dụng', href: '/tuyen-dung' },
  { label: 'Liên hệ', href: '/lien-he' },
] as const;

export const SURVEY_CTA = { label: 'Đặt lịch khảo sát', href: '/lien-he?requestType=khao-sat' } as const;

/** Contract actions (Annex 01). They reuse the existing ContactLead categories: no new request type is introduced. */
export const DOSSIER_CATEGORY = 'ho-so-nang-luc';
export const DOSSIER_REQUEST_CTA = { label: 'Nhận hồ sơ năng lực', href: '/lien-he?requestType=khac&context=ho-so-nang-luc' } as const;
export const ABOUT_CTA = { label: 'Xem dự án', href: '/du-an' } as const;
export const PROJECT_VISIT_LABEL = 'Đăng ký tham quan';
export const projectVisitHref = (slug: string): string => `/lien-he?requestType=khac&project=${encodeURIComponent(slug)}`;
export const ZALO_APPLY_LABEL = 'Nộp hồ sơ qua Zalo';

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
