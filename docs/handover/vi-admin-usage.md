# Giao diện quản trị tiếng Việt (`/admin`)

Giao diện quản trị Payload CMS mặc định hiển thị **tiếng Việt** cho mọi tài khoản, kể cả khi trình duyệt ưu tiên tiếng Anh. Đây chỉ là ngôn ngữ **giao diện quản trị**; nội dung website, slug, giá trị lưu trong cơ sở dữ liệu và quyền truy cập **không đổi**. Tài liệu không chứa tài khoản hay mật khẩu.

Tài liệu này bổ sung cho `huong-dan-cms.md`, trong đó một số tên mục tiếng Anh cũ nay có tên tiếng Việt như dưới đây.

## Tên mục trên thanh bên

| Trước đây | Nay |
| --- | --- |
| Users | Tài khoản |
| Media Assets | Thư viện ảnh và tệp |
| Service Areas | Lĩnh vực dịch vụ |
| Article Categories | Chuyên mục bài viết |
| Projects | Dự án |
| Articles | Bài viết |
| Job Postings | Tin tuyển dụng |
| Documents | Tài liệu |
| Redirects | Chuyển hướng URL |
| Contact Leads | Yêu cầu liên hệ |
| Home Page | Trang chủ |
| About Page | Giới thiệu |
| Process Page | Quy trình và minh bạch |
| Contact Page | Trang liên hệ |
| Site Settings | Cài đặt website |

Các nút và thông báo hệ thống (lưu nháp, xuất bản, huỷ, phiên bản, báo lỗi…) do bản dịch `vi` chính thức của Payload cung cấp; cách diễn đạt có thể khác chút so với tên tiếng Anh trong `huong-dan-cms.md` (Save Draft ≈ lưu bản nháp, Publish ≈ xuất bản).

## Nhãn lựa chọn và giá trị máy

Chỉ **nhãn hiển thị** được dịch; giá trị lưu trữ giữ nguyên.

| Trường | Nhãn hiển thị | Giá trị lưu |
| --- | --- | --- |
| Vai trò (tài khoản) | Quản trị viên / Biên tập viên | `ADMIN` / `EDITOR` |
| Trạng thái xác nhận nguồn (dự án, tin tuyển dụng) | Nguồn cũ – chưa xác nhận / Đã xác nhận | `LEGACY-SOURCE` / `CONFIRMED` |
| Quyền sử dụng tệp (thư viện ảnh và tệp) | Chưa xác nhận quyền sử dụng / Đã duyệt quyền sử dụng | `UNCONFIRMED` / `APPROVED` |
| Loại yêu cầu (yêu cầu liên hệ) | Khảo sát / Báo giá / Khác | `khao-sat` / `bao-gia` / `khac` |
| Trạng thái xử lý (yêu cầu liên hệ) | Mới / Đã xử lý | `new` / `handled` |

Các quy tắc cũ vẫn áp dụng: chỉ chọn **Đã xác nhận** khi BMSL đã duyệt; chỉ chọn **Đã duyệt quyền sử dụng** khi có quyền dùng tệp; dự án/tin tuyển dụng chưa xác nhận không thể xuất bản.

## Thao tác thường dùng

* **Bảng điều khiển:** sau khi đăng nhập, chọn mục ở thanh bên.
* **Nháp / xuất bản:** nội dung mới là bản nháp; chỉ khi xuất bản mới hiện công khai.
* **Dự án, bài viết, tin tuyển dụng, tài liệu:** thanh bên → mục tương ứng → tạo mới. Slug có nhãn "Đường dẫn (slug)", chỉ gồm chữ thường a–z, số và dấu gạch ngang.
* **Thư viện ảnh và tệp:** tải tệp, nhập "Mô tả ảnh (alt)"; "Quyền sử dụng tệp" mặc định chưa xác nhận nên tệp chưa hiện công khai.
* **Yêu cầu liên hệ (form liên hệ):** chỉ quản trị viên xem được; đổi "Trạng thái xử lý" sang "Đã xử lý" khi xong.
* **SEO:** các nhãn Tiêu đề SEO, Mô tả SEO, Ảnh chia sẻ, Không lập chỉ mục.

## Giới hạn đã biết

* Chuỗi nào bản dịch `vi` chính thức chưa có sẽ hiện theo bản dịch này hoặc tiếng Anh nội bộ của Payload; không dùng hack giao diện.
* Tên nhóm thanh bên mặc định "Collections"/"Globals" do Payload quyết định (bản dịch chính thức), chưa đổi thành "Danh mục quản lý"/"Trang và cấu hình".
* Ảnh chụp trước/sau và kiểm thử trên trình duyệt (desktop 1440, mobile 390) chưa thực hiện: cần UAT của con người trên môi trường cô lập.
