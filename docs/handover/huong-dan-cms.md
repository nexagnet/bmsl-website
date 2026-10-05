# Hướng dẫn sử dụng CMS — dành cho ADMIN và EDITOR của BMSL

Tài liệu này là **tài liệu đã chuẩn bị**. Việc đào tạo thực tế **chưa diễn ra** và chưa có biên bản xác nhận (xem §11 và `uat-handover-matrix.md`).
Tài liệu không chứa mật khẩu, tài khoản thật hay thông tin BMSL chưa được xác nhận; mọi ví dụ là giả lập. Màn hình quản trị: `/admin` của website.

## 1. Vai trò

| Vai trò | Được làm | Không được làm |
| --- | --- | --- |
| **ADMIN** | Mọi thứ: người dùng, nội dung, media, chuyển hướng, cài đặt website, lead liên hệ, 4 trang giới thiệu/quy trình/liên hệ/trang chủ, lĩnh vực dịch vụ, chuyên mục | — |
| **EDITOR** | Dự án, bài viết, tin tuyển dụng, tài liệu, media (tạo/sửa/xoá); đọc **hồ sơ của chính mình** | Quản lý người dùng; xem lead; sửa cài đặt website, chuyển hướng, trang cố định (home/about/process/contact), chuyên mục, lĩnh vực dịch vụ |

Đây là mặc định an toàn của hệ thống; EDITOR có được xem lead hay không là **quyết định chưa chốt của BMSL**. Khách truy cập chỉ đọc nội dung **đã xuất bản**.

## 2. Đăng nhập, mật khẩu, chuyển giao tài khoản

* Đăng nhập tại `/admin` bằng email + mật khẩu do bạn đặt. **Không có mật khẩu mặc định**; không dùng chung tài khoản; không gửi mật khẩu qua email/chat thường.
* Đăng nhập sai 5 lần sẽ bị khoá 10 phút. Phiên đăng nhập hết hạn sau 2 giờ; đăng nhập lại khi được yêu cầu.
* ADMIN tạo tài khoản EDITOR trong **Users → Create New**, chọn vai trò, đặt mật khẩu riêng và chuyển cho người dùng qua kênh an toàn; người dùng nên đổi mật khẩu.
* Quên mật khẩu: nhờ ADMIN đặt lại trong **Users** (email tự động chưa được cấu hình).
* Chuyển giao ADMIN cao nhất: người vận hành tạo tài khoản đầu tiên bằng quy trình bảo mật (`docs/runbooks/van-hanh.md` §4); BMSL đổi mật khẩu ngay lần đầu, tạo một ADMIN dự phòng thứ hai
  và cất thông tin ở nơi an toàn. Việc chuyển giao thật **chưa diễn ra**.

## 3. Nguyên tắc cốt lõi: bản nháp, xác nhận, quyền dùng ảnh

1. **Mọi nội dung mới bắt đầu là bản nháp (Draft).** Chỉ khi nhấn **Publish** nội dung mới hiện ra công khai. Lưu nháp không làm hiện nội dung.
2. **Không đăng thông tin chưa được BMSL xác nhận.** Địa chỉ, email, hotline, Zalo, quy mô/trạng thái dự án, giấy phép/năng lực pháp lý, số liệu, lương/quyền lợi tuyển dụng, phản hồi BQT, ảnh: để trống hoặc giữ nháp
   cho tới khi có xác nhận bằng văn bản. Không tự suy đoán hoặc chép từ website cũ rồi coi như đúng.
3. **Cổng xác nhận (`sourceStatus`)** — dự án và tin tuyển dụng có trường `sourceStatus`: `LEGACY-SOURCE` (lấy từ web cũ, chưa xác nhận, mặc định) hoặc `CONFIRMED`.
   Hệ thống **từ chối Publish** nếu chưa `CONFIRMED`; đừng chọn `CONFIRMED` chỉ để vượt qua cảnh báo.
4. **Cổng BQT:** phản hồi của Ban quản trị chỉ hiện công khai khi tích **"Đã được nguồn duyệt"** và BQT/chủ đầu tư đã đồng ý bằng văn bản.
5. **Quyền sử dụng media (`rightsStatus`):** mọi tệp tải lên mặc định `UNCONFIRMED` (không hiển thị công khai). Chỉ đặt `APPROVED` khi BMSL xác nhận có quyền dùng tệp (và, với ảnh có người, đã có đồng ý).
   Đổi lại về `UNCONFIRMED` là gỡ tệp khỏi công chúng ngay.
6. Nếu một dự án/tin tuyển dụng **đã đăng** nhưng chưa `CONFIRMED` (dữ liệu cũ) thì không lưu lại được: trước hết chuyển về Draft (Unpublish), sửa, rồi chỉ Publish lại sau khi nguồn đã xác nhận.

## 4. Đăng bản nháp thành nội dung công khai (quy trình chung)

1. Vào mục cần thiết ở thanh bên → **Create New** (hoặc mở bản ghi có sẵn).
2. Điền các trường bắt buộc (có dấu `*`). **Slug** chỉ gồm chữ thường a–z, số và dấu gạch ngang đơn (ví dụ `bao-ve-toa-nha`); slug sai sẽ bị từ chối.
3. **Save Draft**. Dùng **Versions** nếu cần xem hoặc khôi phục phiên bản cũ.
4. Kiểm tra: nội dung có dữ kiện chưa xác nhận không? Ảnh đã `APPROVED` chưa? `sourceStatus` đúng chưa?
5. **Publish**. Mở trang công khai tương ứng để kiểm tra. Muốn gỡ: **Unpublish** (quay về nháp).

## 5. Từng mục nội dung

| Mục | Dùng để | Lưu ý |
| --- | --- | --- |
| **Dự án (Projects)** | Hồ sơ dự án (tối đa ban đầu 21 hồ sơ, tối đa 10 ảnh mỗi dự án — là giới hạn bàn giao, không phải số dự án thật) | 17 hồ sơ nhập từ web cũ là **nháp, `LEGACY-SOURCE`**. Chỉ Publish khi `CONFIRMED`. Địa chỉ/quy mô/thời gian vận hành chỉ nhập khi có nguồn. Ảnh chọn từ Media đã `APPROVED`. Phản hồi BQT theo cổng ở §3 |
| **Bài viết (Articles)** | Kiến thức & tin tức (10 bài đầu đã duyệt) | Danh sách 10 bài đầu **chưa được BMSL chốt**. Gắn chuyên mục, ảnh bìa (`APPROVED`), ngày đăng. Số liệu/tên riêng/cam kết cần nguồn được duyệt |
| **Chuyên mục (Article Categories)** | Đúng **5** chuyên mục | **Tên chưa được xác nhận**: chỉ nhập khi BMSL cung cấp. Chỉ ADMIN sửa |
| **Tin tuyển dụng (Job Postings)** | Tuyển dụng (tối đa 5 ban đầu) | Chưa có dữ liệu thật. Lương, quyền lợi, hạn nộp, ngày đăng, địa điểm: `UNCONFIRMED`. Chỉ Publish khi `sourceStatus=CONFIRMED`. Dữ liệu có cấu trúc cho Google chỉ phát ra khi có đủ ngày đăng + địa điểm (mã quốc gia 2 chữ in hoa, ví dụ `VN` do BMSL xác nhận) |
| **Tài liệu (Documents)** | Tệp tải về ở trang Quy trình & minh bạch (tối đa 5 ban đầu) | Tệp là media: chỉ hiển thị khi `rightsStatus=APPROVED`. Tài liệu giá/minh bạch chưa có tệp đã duyệt |
| **Media** | Ảnh (PNG/JPEG/GIF/WebP/AVIF) và PDF, tối đa 10 MB | Tên tệp, loại tệp và nội dung phải khớp; SVG/HTML/script bị từ chối. Điền `alt` (mô tả ảnh). Trường `source` là ghi chú nội bộ về chủ sở hữu, không công khai. Kiểm tra này **không** phải quét virus |
| **Lĩnh vực dịch vụ (Service Areas)** | Đúng 4 lĩnh vực: quản lý vận hành, bảo vệ, vệ sinh, PCCC | Chỉ ADMIN. Không thêm giấy phép/cam kết/số liệu khi BMSL chưa duyệt |
| **Chuyển hướng (Redirects)** | Bảng ghi chuyển hướng 301 (`from`, `to`) | Chỉ ADMIN. **Lưu ý: hiện website chưa đọc bảng này lúc chạy.** 47 URL của web cũ được phục vụ bằng luật cố định trong mã (`next.config.mjs`, đã kiểm thử), nên bản ghi thêm ở đây **chưa có hiệu lực** cho tới khi có thay đổi mã riêng. Không dựa vào nó để chuyển hướng |
| **Trang cố định (Globals)** | Trang chủ, Giới thiệu, Quy trình, Liên hệ | Chỉ ADMIN. Có bản nháp riêng và bản đã xuất bản; công chúng chỉ thấy bản đã xuất bản |
| **Cài đặt website (Site Settings)** | Liên hệ chính thức, mạng xã hội, GA4, Search Console | Chỉ ADMIN. **Liên hệ là `UNCONFIRMED`: để trống tới khi BMSL xác nhận.** Hotline/Zalo sai định dạng sẽ bị ẩn chứ không tự sửa. Chỉ bật `analyticsEnabled` khi BMSL đã quyết định chính sách cookie; ngay cả khi bật, không có dữ liệu nào gửi đi trước khi khách đồng ý |
| **Lead liên hệ (Contact Leads)** | Yêu cầu từ form Liên hệ (khảo sát, báo giá, khác) | Chỉ ADMIN xem/sửa; không ai xoá được qua giao diện. Chứa dữ liệu cá nhân: không xuất ra tệp công khai, không gửi qua kênh không an toàn. Trạng thái `new` → `handled` sau khi xử lý |

## 6. Lead liên hệ và các giới hạn "đóng khi lỗi" (fail-closed)

* Khi khách gửi form hợp lệ, lead được **lưu vào CSDL trước**, rồi trang mới báo thành công. Nếu lưu lỗi, khách nhận thông báo lỗi và **không** có dòng nào được tạo.
* Không đồng ý điều khoản, thiếu tên/điện thoại/nội dung, hoặc bot (trường ẩn honeypot) → không lưu.
* Giới hạn: nội dung tối đa 16 KiB; tối đa 30 lượt gửi / 10 phút cho cả website (cấu hình được); yêu cầu phải cùng website (kiểm tra Origin); khi hệ thống không chắc chắn, nó **từ chối** thay vì cho qua.
* Hiện **chưa có thông báo tự động** (email/Zalo) khi có lead: ADMIN cần mở **Contact Leads** thường xuyên. Quy tắc lưu trữ/xoá lead và việc EDITOR có xem được hay không là quyết định BMSL chưa chốt.

## 7. Việc thường gặp và cách xử lý

| Tình huống | Làm gì |
| --- | --- |
| Không Publish được dự án/tin tuyển dụng | Kiểm tra `sourceStatus`; nếu chưa có xác nhận bằng văn bản của BMSL thì giữ nháp |
| Ảnh không hiện công khai | Kiểm tra `rightsStatus=APPROVED` và ảnh đã được chọn trong bản ghi **đã Publish** |
| Tải ảnh bị từ chối | Dùng đúng PNG/JPEG/GIF/WebP/AVIF/PDF ≤ 10 MB; tên tệp có phần mở rộng đúng; không đổi đuôi tệp |
| Slug bị từ chối | Chỉ chữ thường a–z, số, dấu `-` đơn |
| Bị khoá đăng nhập | Chờ 10 phút hoặc nhờ ADMIN |
| Phát hiện nội dung sai đã công khai | **Unpublish** ngay, sửa ở bản nháp, kiểm tra nguồn rồi mới Publish |

## 8. Danh sách kiểm tra trước khi Publish bất kỳ nội dung nào

- [ ] Mọi dữ kiện về BMSL/dự án/tuyển dụng có nguồn được BMSL xác nhận (không suy đoán, không chép nguyên từ web cũ)
- [ ] `sourceStatus = CONFIRMED` (dự án, tuyển dụng) chỉ khi đã có xác nhận
- [ ] Ảnh/tệp `rightsStatus = APPROVED` và người trong ảnh đã đồng ý
- [ ] Phản hồi BQT chỉ hiện khi có "Đã được nguồn duyệt"
- [ ] Slug, tiêu đề, mô tả SEO hợp lệ; `noindex` đúng ý
- [ ] Đã xem trang công khai sau khi Publish và kiểm tra trên điện thoại

## 9. Chương trình đào tạo đề xuất (≤ 2 giờ)

| Thời lượng | Nội dung | Thực hành |
| --- | --- | --- |
| 10' | Mục tiêu, vai trò ADMIN/EDITOR, nguyên tắc "chưa xác nhận thì không đăng" | — |
| 15' | Đăng nhập, mật khẩu, tạo/chuyển giao tài khoản (ADMIN) | ADMIN tạo một EDITOR thử trên môi trường staging |
| 20' | Bản nháp → Publish → Unpublish; Versions | Tạo bài nháp, xuất bản, gỡ |
| 20' | Cổng xác nhận, BQT, quyền dùng media | Thử Publish dự án `LEGACY-SOURCE` (bị từ chối), tải ảnh `UNCONFIRMED` → `APPROVED` |
| 20' | Dự án, bài viết, chuyên mục, tuyển dụng, tài liệu | Mỗi người tạo một bản ghi nháp |
| 15' | Cài đặt website, chuyển hướng, trang cố định (ADMIN) | Xem trước, không điền dữ kiện chưa xác nhận |
| 10' | Lead liên hệ: xem, xử lý, giới hạn, dữ liệu cá nhân | Gửi lead thử trên staging và xử lý |
| 10' | Sự cố, sao lưu/khôi phục (tổng quan), liên hệ hỗ trợ | Hỏi đáp |
| **120'** | **Tổng** (không vượt 2 giờ) | |

## 10. Danh sách kiểm tra đào tạo (điền khi đào tạo thật diễn ra)

| Mục | Ai thực hiện | Đã làm (ngày, người ký) |
| --- | --- | --- |
| ADMIN đăng nhập, đổi mật khẩu, tạo EDITOR | ADMIN BMSL | _chưa_ |
| EDITOR đăng nhập và tạo bản nháp | EDITOR BMSL | _chưa_ |
| Publish/Unpublish một bản ghi trên staging | ADMIN + EDITOR | _chưa_ |
| Hiểu cổng `sourceStatus`, BQT, `rightsStatus` | ADMIN + EDITOR | _chưa_ |
| Xử lý một lead thử | ADMIN | _chưa_ |
| Biết cách xoay mật khẩu và liên hệ khi sự cố | ADMIN | _chưa_ |
| Người tham dự ký **biên bản đã nhận đào tạo** | Người đào tạo + BMSL | _chưa_ |

## 11. Tài liệu sẵn sàng ≠ đào tạo đã giao

Có tài liệu này và chương trình ở §9 nghĩa là **vật liệu đã sẵn sàng**. Nó **không** chứng minh buổi đào tạo đã diễn ra, người dùng đã hiểu hay BMSL đã xác nhận đã nhận đào tạo.
Bảng §10 để trống cho tới khi có bằng chứng thật; mục "training acknowledgement" trong ma trận bàn giao vẫn là `NOT_PROVEN`.
