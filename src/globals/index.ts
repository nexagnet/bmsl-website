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

export const HomePage: GlobalConfig = {
  slug: 'home-page',
  label: 'Trang chủ',
  access: adminSingletonAccess,
  versions: drafts,
  fields: [
    { name: 'title', type: 'text', label: 'Tiêu đề' },
    { name: 'body', type: 'richText', label: 'Nội dung' },
    {
      name: 'hero',
      type: 'group',
      label: 'Cấu hình Hero Section',
      admin: {
        description: 'Quản trị nội dung và hình ảnh của Hero section trên Trang chủ (chỉ ADMIN có quyền sửa).',
      },
      fields: [
        {
          name: 'enabled',
          type: 'checkbox',
          defaultValue: true,
          label: 'Bật Hero Section',
        },
        {
          name: 'kicker',
          type: 'text',
          label: 'Dòng Kicker / Eyebrow',
          admin: {
            placeholder: 'VẬN HÀNH BẤT ĐỘNG SẢN CHUẨN MỰC',
            description: 'Dòng tiêu đề phụ nhỏ phía trên tiêu đề chính.',
          },
        },
        {
          name: 'headline',
          type: 'text',
          label: 'Tiêu đề chính (H1)',
          admin: {
            placeholder: 'Quản lý vận hành bất động sản chuyên nghiệp & minh bạch',
            description: 'Để trống sẽ tự động dùng tiêu đề Trang chủ hoặc tên website.',
          },
        },
        {
          name: 'supportingText',
          type: 'textarea',
          label: 'Mô tả hỗ trợ',
          admin: {
            placeholder: 'Đồng hành cùng Ban Quản trị và Chủ đầu tư tối ưu hóa giá trị tài sản, kiến tạo không gian sống an toàn và bền vững.',
            description: 'Đoạn văn ngắn làm rõ giá trị dịch vụ.',
          },
        },
        {
          name: 'primaryCtaText',
          type: 'text',
          label: 'Nút hành động chính (Nhãn)',
          admin: { placeholder: 'Đặt lịch khảo sát' },
        },
        {
          name: 'primaryCtaLink',
          type: 'text',
          label: 'Nút hành động chính (Đường dẫn)',
          admin: { placeholder: '/lien-he?requestType=khao-sat' },
        },
        {
          name: 'secondaryCtaText',
          type: 'text',
          label: 'Nút hành động phụ (Nhãn)',
          admin: { placeholder: 'Xem dịch vụ' },
        },
        {
          name: 'secondaryCtaLink',
          type: 'text',
          label: 'Nút hành động phụ (Đường dẫn)',
          admin: { placeholder: '/dich-vu' },
        },
        {
          name: 'desktopImage',
          type: 'upload',
          relationTo: 'media-assets',
          label: 'Ảnh kiến trúc Desktop',
          admin: {
            description: 'Chỉ ảnh có rightsStatus=APPROVED mới hiển thị công khai. Nếu chưa duyệt sẽ dùng fallback.',
          },
        },
        {
          name: 'mobileImage',
          type: 'upload',
          relationTo: 'media-assets',
          label: 'Ảnh kiến trúc Mobile (tùy chọn)',
          admin: {
            description: 'Tùy chọn ảnh crop riêng cho màn hình di động. Cần rightsStatus=APPROVED.',
          },
        },
        {
          name: 'focalPoint',
          type: 'select',
          label: 'Điểm lấy nét ảnh (Focal Point)',
          defaultValue: 'center',
          options: [
            { label: 'Căn giữa (Center)', value: 'center' },
            { label: 'Lấy phần trên (Top)', value: 'top' },
            { label: 'Lấy phần dưới (Bottom)', value: 'bottom' },
          ],
        },
        {
          name: 'overlayPreset',
          type: 'select',
          label: 'Mức độ phủ tương phản (Overlay)',
          defaultValue: 'soft',
          options: [
            { label: 'Phủ nhẹ (Soft)', value: 'soft' },
            { label: 'Phủ đậm (Strong)', value: 'strong' },
            { label: 'Không phủ (None)', value: 'none' },
          ],
        },
        {
          name: 'layoutPreset',
          type: 'select',
          label: 'Bố cục (Layout Preset)',
          defaultValue: 'editorial',
          options: [
            { label: 'Architectural Editorial (Mặc định)', value: 'editorial' },
            { label: 'Quiet Split (Cân xứng)', value: 'split' },
          ],
        },
      ],
    },
    seoField,
  ],
};
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
