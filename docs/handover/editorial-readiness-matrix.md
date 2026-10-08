# Ma trận sẵn sàng nội dung 8 trang (Issue #84, điều phối #81)

Trạng thái: **bản soạn, không phải nghiệm thu nội dung.** Không có nội dung BMSL thật nào được tạo, nhập hay đăng. Fixture trong test là dữ liệu thử bịa, không phải dữ kiện BMSL.
Bổ sung cho [`contract-acceptance-matrix.md`](contract-acceptance-matrix.md); không thay thế.

Nhãn mỗi trang: `CODE_PROVEN` (có test đơn vị trong repo) · `BROKEN_RENDER` (lỗi hiển thị có bằng chứng) · `MISSING_SOURCE` (thiếu nguồn từ BMSL) · `DEV_RUNTIME_PENDING` (chưa chạy trên DB/CMS/trình duyệt thật).

## 1. Ma trận 8 trang

| # | Trang / route | Model CMS | Cổng hiển thị đã có test | Nhãn |
| --- | --- | --- | --- | --- |
| 1 | `/` | `HomePage` + `ServiceArea`, `Project`, `Article` | Chỉ bản `published`; dự án cần `CONFIRMED` (`public-content.test.ts`, `editorial-readiness.test.ts`) | CODE_PROVEN (mapper) · MISSING_SOURCE (thông điệp, số liệu) · DEV_RUNTIME_PENDING |
| 2 | `/gioi-thieu` | `AboutPage` | Trang trống/nháp → trạng thái rỗng an toàn (`toPage`) | CODE_PROVEN (mapper) · MISSING_SOURCE (lịch sử, cơ cấu, pháp lý) · DEV_RUNTIME_PENDING |
| 3 | `/dich-vu`, `/dich-vu/<slug>` | `ServiceArea` (4) | Chỉ `published` | CODE_PROVEN (mapper) · MISSING_SOURCE (mô tả 4 dịch vụ) · DEV_RUNTIME_PENDING |
| 4 | `/du-an`, `/du-an/<slug>` | `Project` (≤21), `MediaAsset` (≤10 ảnh/dự án) | `CONFIRMED` + ảnh `APPROVED`; ảnh `REVOKED`/`UNCONFIRMED` bị lọc; trường trống ẩn | CODE_PROVEN (mapper) · MISSING_SOURCE (danh sách duyệt, quyền ảnh) · DEV_RUNTIME_PENDING |
| 5 | `/quy-trinh-minh-bach` | `ProcessPage`, `Document` (≤5) | Tài liệu chỉ hiện khi tệp `APPROVED` | CODE_PROVEN (mapper) · MISSING_SOURCE (quy trình, giá, tài liệu) · DEV_RUNTIME_PENDING |
| 6 | `/kien-thuc/...` | `Article`, `ArticleCategory` (5) | Bài cần danh mục `published`; 15 ứng viên WP vẫn là backlog, `selectionApproved=false` | CODE_PROVEN (mapper) · MISSING_SOURCE (5 tên danh mục, ≤10 bài) · DEV_RUNTIME_PENDING |
| 7 | `/tuyen-dung/...` | `JobPosting` (≤5) | Cần `CONFIRMED`; lương trống thì ẩn | CODE_PROVEN (mapper) · MISSING_SOURCE (vị trí, lương, hạn) · DEV_RUNTIME_PENDING |
| 8 | `/lien-he` | `ContactPage`, `ContactLead` | Sở hữu bởi PR #93 (SiteSettings/bản đồ); không sửa ở đây | DEV_RUNTIME_PENDING · MISSING_SOURCE (hotline, Zalo, địa chỉ, hộp thư) |

Sitemap: chỉ đường dẫn công khai hợp lệ, không `/admin`, `/api` (`editorial-readiness.test.ts`).
Không có nhãn `BROKEN_RENDER` nào được ghi: chưa phát hiện lỗi hiển thị có bằng chứng, nhưng cũng chưa duyệt bằng trình duyệt.

## 2. Giới hạn hợp đồng ↔ repo

- Dự án: hồ sơ nháp cũ là 17 (≤21), tất cả chưa `CONFIRMED`; không tạo thêm hồ sơ giả để đủ 21.
- Bài viết: 15 ứng viên là backlog nháp, 0 bài được chuyển; 120 bài SEO không phải nghĩa vụ ban đầu.
- 5 nhãn danh mục (pháp lý, phí, kỹ thuật, an toàn, tin công ty) cần BMSL duyệt phân loại thật.
- Tuyển dụng ≤5, tài liệu ≤5: các số này là giới hạn nghiệm thu, không phải trần CMS.

## 3. Danh sách BMSL cần cung cấp/duyệt (theo trang)

Gửi qua kênh riêng, không đưa PII hay số liên hệ thật vào Git. Mọi dòng hiện **chưa nhận**.

| Trang | Cần từ BMSL | Chủ duyệt |
| --- | --- | --- |
| Trang chủ | Thông điệp chính, số liệu công ty đã duyệt | BMSL |
| Giới thiệu | Lịch sử, năng lực, cơ cấu, cơ sở pháp lý | BMSL |
| Dịch vụ | Mô tả 4 dịch vụ | BMSL |
| Dự án | Danh sách dự án công khai và trạng thái thật, ảnh được duyệt (≤10/dự án), văn bản quyền ảnh, phản hồi BQT | BMSL |
| Quy trình & minh bạch | Quy trình, mẫu giá, mẫu báo cáo (≤5 tệp) | BMSL |
| Kiến thức | 5 tên danh mục, ≤10 bài đầu | BMSL |
| Tuyển dụng | ≤5 vị trí kèm lương/quyền lợi/hạn/địa điểm đã duyệt | BMSL |
| Liên hệ | Hotline, Zalo, địa chỉ, hộp thư nhận form (theo PR #93) | BMSL |

Không gọi hợp đồng là `CONTENT ACCEPTED` cho tới khi khách xác nhận dữ kiện và quyền ảnh.

## 4. Chưa làm trong lần này

Chạy PostgreSQL + media cô lập, luồng ADMIN/EDITOR create/draft/preview/publish/revoke, ảnh chụp trình duyệt desktop/mobile, idempotence của seed: **chưa chạy** (môi trường builder không có PostgreSQL/trình duyệt). Đây là việc `DEV_RUNTIME_PENDING` cho CI tích hợp hoặc staging cô lập.
