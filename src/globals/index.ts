import type { GlobalConfig } from 'payload';
import { isStaff } from '../access';
import { adminSingletonAccess, drafts, seoField } from '../collections/shared';

const confirmedField = {
  name: 'confirmed',
  type: 'checkbox',
  defaultValue: false,
  label: 'Đã được BMSL xác nhận',
  admin: { description: 'Chỉ tích khi BMSL đã xác nhận nội dung này. Mục chưa tích sẽ không hiển thị công khai.' },
} as const;

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
    {
      name: 'stats',
      type: 'array',
      label: 'Số liệu năng lực',
      labels: { singular: 'Số liệu', plural: 'Số liệu' },
      admin: { description: 'Tùy chọn. Để trống cho tới khi BMSL cung cấp số liệu đã duyệt kèm nguồn; không điền số liệu suy đoán.' },
      fields: [
        { name: 'label', type: 'text', required: true, label: 'Nhãn' },
        { name: 'value', type: 'text', required: true, label: 'Giá trị' },
        { name: 'source', type: 'text', label: 'Nguồn (ghi chú nội bộ)', access: { read: ({ req }) => isStaff(req.user) } },
        confirmedField,
      ],
    },
    {
      name: 'featuredProjects',
      type: 'relationship',
      relationTo: 'projects',
      hasMany: true,
      label: 'Dự án tiêu biểu',
      admin: {
        description: 'Tùy chọn, hiển thị theo thứ tự chọn. Chỉ dự án đã xuất bản và CONFIRMED mới hiện công khai; để trống sẽ dùng danh sách mặc định.',
      },
    },
    seoField,
  ],
};
// Optional structured blocks of the About page. All empty until BMSL supplies approved content (UNCONFIRMED);
// every item is public only when marked confirmed.
export const AboutPage: GlobalConfig = {
  slug: 'about-page',
  label: 'Giới thiệu',
  access: adminSingletonAccess,
  versions: drafts,
  fields: [
    { name: 'title', type: 'text', label: 'Tiêu đề' },
    { name: 'body', type: 'richText', label: 'Nội dung' },
    {
      name: 'history',
      type: 'array',
      label: 'Lịch sử hình thành',
      labels: { singular: 'Mốc', plural: 'Các mốc' },
      fields: [
        { name: 'year', type: 'text', required: true, label: 'Năm/mốc thời gian' },
        { name: 'title', type: 'text', required: true, label: 'Tiêu đề' },
        { name: 'description', type: 'textarea', label: 'Mô tả' },
        confirmedField,
      ],
    },
    {
      name: 'team',
      type: 'array',
      label: 'Đội ngũ',
      labels: { singular: 'Thành viên', plural: 'Thành viên' },
      fields: [
        { name: 'name', type: 'text', required: true, label: 'Họ tên' },
        { name: 'role', type: 'text', label: 'Chức danh' },
        {
          name: 'photo',
          type: 'upload',
          relationTo: 'media-assets',
          label: 'Ảnh',
          admin: { description: 'Chỉ hiển thị khi tệp có rightsStatus=APPROVED.' },
        },
        confirmedField,
      ],
    },
    {
      name: 'capabilities',
      type: 'array',
      label: 'Năng lực và giấy phép',
      labels: { singular: 'Mục', plural: 'Các mục' },
      fields: [
        { name: 'name', type: 'text', required: true, label: 'Tên năng lực/giấy phép' },
        { name: 'issuer', type: 'text', label: 'Đơn vị cấp' },
        { name: 'validity', type: 'text', label: 'Hiệu lực', admin: { description: 'Nhập tự do theo giấy tờ BMSL cung cấp.' } },
        confirmedField,
      ],
    },
    {
      name: 'values',
      type: 'array',
      label: 'Văn hoá và giá trị',
      labels: { singular: 'Giá trị', plural: 'Giá trị' },
      fields: [
        { name: 'title', type: 'text', required: true, label: 'Tiêu đề' },
        { name: 'description', type: 'textarea', label: 'Mô tả' },
        confirmedField,
      ],
    },
    seoField,
  ],
};

export const ProcessPage: GlobalConfig = {
  slug: 'process-page',
  label: 'Quy trình và minh bạch',
  access: adminSingletonAccess,
  versions: drafts,
  fields: [
    { name: 'title', type: 'text', label: 'Tiêu đề' },
    { name: 'body', type: 'richText', label: 'Nội dung' },
    {
      name: 'steps',
      type: 'array',
      label: 'Các bước quy trình',
      labels: { singular: 'Bước', plural: 'Các bước' },
      admin: {
        description:
          'Tùy chọn. Để trống cho tới khi BMSL cung cấp và xác nhận quy trình; không điền nội dung suy đoán. Thứ tự hiển thị theo thứ tự trong danh sách.',
      },
      fields: [
        { name: 'title', type: 'text', required: true, label: 'Tên bước' },
        { name: 'description', type: 'textarea', label: 'Mô tả' },
        { name: 'duration', type: 'text', label: 'Thời hạn', admin: { description: 'Tùy chọn, nhập tự do (ví dụ theo văn bản BMSL xác nhận).' } },
        confirmedField,
      ],
    },
    seoField,
  ],
};
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
