import type { GlobalConfig } from 'payload';
import { adminSingletonAccess, drafts, seoField } from '../collections/shared';

// Singletons. Block structure follows wireframe 05 §3 in later work; W1B keeps a rich-text body + SEO.
// Provisional fail-closed default: only ADMIN writes these (not a BMSL business decision).
const page = (slug: string): GlobalConfig => ({
  slug,
  access: adminSingletonAccess,
  versions: drafts,
  fields: [{ name: 'title', type: 'text' }, { name: 'body', type: 'richText' }, seoField],
});

export const HomePage = page('home-page');
export const AboutPage = page('about-page');
export const ProcessPage = page('process-page');
export const ContactPage = page('contact-page');

// Public contact details are UNCONFIRMED (CONTACT_DETAILS_REQUIRES_BMSL_CONFIRMATION):
// no defaults are provided and nothing is published until BMSL confirms.
export const SiteSettings: GlobalConfig = {
  slug: 'site-settings',
  access: adminSingletonAccess,
  versions: drafts,
  admin: {
    description: 'Thông tin liên hệ chính thức là UNCONFIRMED: để trống cho tới khi BMSL xác nhận.',
  },
  fields: [
    {
      name: 'contact',
      type: 'group',
      admin: { description: 'UNCONFIRMED: không điền giá trị suy đoán; chỉ nhập khi BMSL xác nhận.' },
      fields: [
        { name: 'address', type: 'text' },
        { name: 'email', type: 'email' },
        { name: 'hotline', type: 'text' },
        { name: 'zalo', type: 'text' },
      ],
    },
    {
      name: 'socialLinks',
      type: 'array',
      fields: [
        { name: 'label', type: 'text', required: true },
        { name: 'url', type: 'text', required: true },
      ],
    },
    {
      name: 'ga4Id',
      type: 'text',
      admin: { description: 'UNCONFIRMED: chỉ nhập ID GA4 thật (G-XXXXXXXXXX) do BMSL cấp. Giá trị sai định dạng bị bỏ qua.' },
    },
    {
      name: 'analyticsEnabled',
      type: 'checkbox',
      defaultValue: false,
      admin: {
        description:
          'Mặc định tắt. Chỉ bật sau khi BMSL quyết định chính sách cookie/đồng ý (OWNER-DECISION). Ngay cả khi bật, không có lưu lượng nào được gửi trước khi người dùng đồng ý phân tích.',
      },
    },
    {
      name: 'searchConsoleVerification',
      type: 'text',
      admin: { description: 'Chỉ giá trị content của thẻ meta google-site-verification do Search Console cấp. Không điền suy đoán.' },
    },
  ],
};
