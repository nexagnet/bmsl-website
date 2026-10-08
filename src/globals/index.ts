import type { GlobalConfig } from 'payload';
import { adminSingletonAccess, drafts, seoField } from '../collections/shared';

// Singletons. Block structure follows wireframe 05 §3 in later work; W1B keeps a rich-text body + SEO.
// Provisional fail-closed default: only ADMIN writes these (not a BMSL business decision).
const page = (slug: string, label: string): GlobalConfig => ({
  slug,
  label,
  access: adminSingletonAccess,
  versions: drafts,
  fields: [
    { name: 'title', type: 'text', label: 'Tiêu đề' },
    { name: 'body', type: 'richText', label: 'Nội dung' },
    seoField,
  ],
});

export const HomePage = page('home-page', 'Trang chủ');
export const AboutPage = page('about-page', 'Giới thiệu');
export const ProcessPage = page('process-page', 'Quy trình và minh bạch');
export const ContactPage = page('contact-page', 'Trang liên hệ');

// Public contact details are UNCONFIRMED (CONTACT_DETAILS_REQUIRES_BMSL_CONFIRMATION):
// no defaults are provided and nothing is published until BMSL confirms.
export const SiteSettings: GlobalConfig = {
  slug: 'site-settings',
  label: 'Cài đặt website',
  access: adminSingletonAccess,
  versions: drafts,
  admin: {
    description: 'Thông tin liên hệ chính thức là UNCONFIRMED: để trống cho tới khi BMSL xác nhận.',
  },
  fields: [
    {
      name: 'contact',
      type: 'group',
      label: 'Thông tin liên hệ',
      admin: { description: 'UNCONFIRMED: không điền giá trị suy đoán; chỉ nhập khi BMSL xác nhận.' },
      fields: [
        { name: 'address', type: 'text', label: 'Địa chỉ' },
        { name: 'email', type: 'email', label: 'Email' },
        { name: 'hotline', type: 'text', label: 'Hotline' },
        { name: 'zalo', type: 'text', label: 'Zalo' },
        {
          name: 'mapLatitude',
          type: 'number',
          label: 'Vĩ độ trụ sở',
          min: 8,
          max: 24,
          admin: { description: 'Chỉ nhập tọa độ do BMSL xác nhận. Không suy đoán từ nguồn khác.' },
        },
        {
          name: 'mapLongitude',
          type: 'number',
          label: 'Kinh độ trụ sở',
          min: 102,
          max: 110,
          admin: { description: 'Chỉ nhập tọa độ do BMSL xác nhận. Không suy đoán từ nguồn khác.' },
        },
        {
          name: 'mapApproved',
          type: 'checkbox',
          defaultValue: false,
          label: 'BMSL đã duyệt hiển thị bản đồ',
          admin: {
            description: 'Mặc định tắt. Bản đồ OpenStreetMap chỉ hiển thị khi bật mục này và có đủ vĩ độ, kinh độ hợp lệ.',
          },
        },
      ],
    },
    {
      name: 'socialLinks',
      type: 'array',
      label: 'Liên kết mạng xã hội',
      labels: { singular: 'Liên kết', plural: 'Liên kết' },
      fields: [
        { name: 'label', type: 'text', required: true, label: 'Tên hiển thị' },
        { name: 'url', type: 'text', required: true, label: 'Địa chỉ liên kết (URL)' },
      ],
    },
    {
      name: 'ga4Id',
      type: 'text',
      label: 'Mã GA4',
      admin: { description: 'Mã GA4 dạng G-XXXXXXXXXX do BMSL cấp. Chỉ có hiệu lực khi bật "analyticsEnabled".' },
    },
    {
      name: 'analyticsEnabled',
      type: 'checkbox',
      defaultValue: false,
      label: 'Bật phân tích truy cập',
      admin: {
        description:
          'Mặc định tắt. Chỉ bật khi BMSL đã quyết định chính sách đồng ý cookie (OWNER-DECISION). Ngay cả khi bật, không có dữ liệu nào được gửi trước khi người dùng đồng ý.',
      },
    },
    {
      name: 'searchConsoleVerification',
      type: 'text',
      label: 'Mã xác minh Search Console',
      admin: { description: 'Giá trị content của thẻ meta google-site-verification do Google Search Console cấp.' },
    },
  ],
};
