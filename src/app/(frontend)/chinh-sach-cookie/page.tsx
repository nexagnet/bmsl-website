import type { Metadata } from 'next';
import Link from 'next/link';
import { PageHero } from '../../../components/content-ui';
import { COOKIE_POLICY_PATH } from '../../../lib/consent';

// BẢN NHÁP: nội dung pháp lý chưa được BMSL duyệt, nên trang chưa được lập chỉ mục. Không chứa thông tin liên hệ
// chưa xác nhận; người đọc được dẫn tới trang Liên hệ.
export const metadata: Metadata = {
  title: 'Chính sách cookie',
  alternates: { canonical: COOKIE_POLICY_PATH },
  robots: { index: false, follow: true },
};

export default function CookiePolicyPage() {
  return (
    <>
      <PageHero overline="QUYỀN RIÊNG TƯ" title="Chính sách cookie" />
      <section className="pg-prose">
        <div className="container">
          <div className="prose">
            <p>
              <strong>Bản nháp, đang chờ BMSL xem xét và phê duyệt.</strong> Nội dung dưới đây mô tả cách website hoạt động
              về mặt kỹ thuật và chưa phải văn bản pháp lý chính thức.
            </p>
            <h2>Cookie là gì</h2>
            <p>
              Cookie và các công nghệ lưu trữ tương tự là những tệp nhỏ được lưu trên thiết bị của bạn khi truy cập website,
              giúp website ghi nhớ lựa chọn hoặc đo lường mức độ sử dụng.
            </p>
            <h2>Chúng tôi dùng gì</h2>
            <ul>
              <li>
                <strong>Lưu lựa chọn cookie của bạn.</strong> Website lưu lựa chọn đồng ý hoặc từ chối trong bộ nhớ trình
                duyệt (khóa <code>bmsl_cookie_consent</code>) để không hỏi lại ở mỗi lần truy cập. Lựa chọn được hỏi lại sau
                khoảng 6 tháng.
              </li>
              <li>
                <strong>Cookie phân tích (Google Analytics 4).</strong> Chỉ được tải và ghi nhận sau khi bạn bấm
                &quot;Đồng ý&quot;. Khi dùng, Google Analytics đặt các cookie như <code>_ga</code> và <code>_ga_*</code> để
                thống kê lượt xem trang và một số hành động như bấm gọi hotline, bấm Zalo, gửi biểu mẫu liên hệ thành công
                hoặc tải tài liệu.
              </li>
            </ul>
            <h2>Dữ liệu được gửi đi</h2>
            <p>
              Khi bạn đồng ý, địa chỉ trang (không kèm tham số sau dấu hỏi) và tên hành động được gửi tới Google. Nội dung
              bạn nhập vào biểu mẫu liên hệ (họ tên, số điện thoại, email, lời nhắn) không được gửi tới Google Analytics.
              Website không bật tín hiệu Google (Google signals) và không bật cá nhân hóa quảng cáo.
            </p>
            <h2>Nếu bạn từ chối</h2>
            <p>
              Website không tải Google Analytics và không gửi dữ liệu phân tích nào. Các chức năng của website vẫn hoạt động
              bình thường.
            </p>
            <h2>Thay đổi hoặc rút lại lựa chọn</h2>
            <p>
              Bạn có thể mở lại lựa chọn bất cứ lúc nào bằng liên kết &quot;Cài đặt cookie&quot; ở cuối trang. Khi bạn rút
              lại đồng ý, website ngừng ghi nhận và xóa các cookie Google Analytics mà nó đặt trên tên miền này.
            </p>
            <h2>Liên hệ</h2>
            <p>
              Nếu có câu hỏi về chính sách này, vui lòng xem trang <Link href="/lien-he">Liên hệ</Link>.
            </p>
          </div>
        </div>
      </section>
    </>
  );
}
