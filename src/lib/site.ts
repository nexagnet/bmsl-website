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

/** Fixed public routes that exist regardless of CMS content. */
export const STATIC_PUBLIC_PATHS: string[] = NAV_ITEMS.map((i) => i.href);

export const paths = {
  service: (slug: string) => `/dich-vu/${slug}`,
  project: (slug: string) => `/du-an/${slug}`,
  category: (slug: string) => `/kien-thuc/${slug}`,
  article: (categorySlug: string, slug: string) => `/kien-thuc/${categorySlug}/${slug}`,
  job: (slug: string) => `/tuyen-dung/${slug}`,
};

export const getSiteUrl = (env: Record<string, string | undefined> = process.env): string =>
  (env.SITE_URL?.trim() || 'http://localhost:3000').replace(/\/+$/, '');
