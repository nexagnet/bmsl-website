# Ma trận nghiệm thu hợp đồng ↔ repo, và gói đầu vào cho BMSL (Issue #86, hiệu chỉnh theo Issue #96, điều phối #81)

Hiệu chỉnh lần 2 (PR #99, review điều phối viên): sửa chủ sở hữu trang liên hệ (#83/PR #93), thêm `FRONTEND_GAP` cho CTA, phân biệt `SOURCE_PRESENT_PENDING_CONFIRMATION` với chưa có nguồn, ghi khoảng trống banner CMS, bổ sung cơ chế Lighthouse cho T-07, cập nhật PR #98/#100. Giữ nguyên quy tắc không nhúng SHA, lịch sử, số lượng CMS trên DEV `UNKNOWN`; không đổi điều khoản pháp lý hay docx gốc.

Hiệu chỉnh lần 3 (2026-10-19, điều phối #81): thêm quan sát GitHub trực tiếp và quan sát runtime DEV ẩn danh (chi tiết, số đo và phương pháp: [`editorial-ux-audit-2026-10-19.md`](editorial-ux-audit-2026-10-19.md)); §0, §3 (T-03), §4 (C-03, C-08) và §5 được cập nhật. Vẫn không có hàng nào đạt `CUSTOMER_APPROVAL`.

Trạng thái: **bản soạn để chủ và BMSL xem xét. Không phải nghiệm thu.** CI xanh ≠ BMSL nghiệm thu. Tài liệu này không tạo bằng chứng, chữ ký hay biên bản nào.
Bổ sung cho [`uat-handover-matrix.md`](uat-handover-matrix.md) (mốc CI/SHA lịch sử, cutover) — không thay thế.

Lịch sử: bản đầu (Issue #86, 2026-10-07) nói rõ Builder không đọc được hợp đồng và không truy vấn được GitHub. Bản hiệu chỉnh này (Issue #96, 2026-10-08) thay phần đó bằng yêu cầu hợp đồng đã được **điều phối viên** đọc độc lập, nhưng vẫn giữ các hàng chờ và `NOT_PROVEN`; không hàng nào được đánh dấu hoàn tất chỉ vì đã được ánh xạ.

## 0. Nguồn và giới hạn (đọc trước)

| Nguồn | Tình trạng |
| --- | --- |
| Hợp đồng đính kèm `HD_Thiet_ke_Website_NetViet.docx` | **Điều phối viên đã đọc** ngày 2026-10-08 và gửi bản yêu cầu đã lược (sanitized) trong Issue #96. Builder **không truy cập bản gốc riêng tư** và không dán nguyên văn hợp đồng vào repo. Mọi hàng "hợp đồng" bên dưới là bản lược; người ký phải đối chiếu lại với văn bản gốc |
| Hợp đồng đã ký hay chưa; chữ ký, thanh toán, hạn chót | **Không khẳng định** từ tài liệu này. Cửa sổ khách xem xét/phê duyệt trong hợp đồng **không** có nghĩa là đã được nghiệm thu. Không diễn giải pháp lý |
| Issue/PR #78, #81, #83, #84, #79, #93; SHA `main`; CI của `main` | Bản 2026-10-08: Builder không gọi được `gh`; các giá trị ở §5 (bảng lịch sử) là quan sát của điều phối viên. **Bản 2026-10-19**: Builder đã đọc trực tiếp Issue/PR/CI bằng `gh` (tài khoản đã đăng nhập, chỉ đọc) và ghi kết quả ở §5 (bảng 2026-10-19). Người xem vẫn cần kiểm lại trước khi dựa vào, vì trạng thái GitHub thay đổi |
| `main` tại quan sát của điều phối viên (2026-10-08) | `5131e599d24328655b977fa7092d0b228e4efd18`; đã lỗi thời |
| `main` tại quan sát 2026-10-19 | `87e6498aa902ce687aa0380f6f5728f41be9169d` (`git rev-parse origin/main` sau `git fetch`) |
| Chạy mã / môi trường | Bản 2026-10-19 chỉ đọc ẩn danh (GET) vào website DEV và chạy Lighthouse/đo LCP/CLS trong trình duyệt; không gửi form, không ghi CMS, không đụng Northflank/secret (docs-only, R0) |

Quy ước "đã chứng minh" — tách thành các lớp, không trộn:

| Lớp | Nghĩa | Ký hiệu |
| --- | --- | --- |
| CODE/CI | Có mã/test trong repo và CI xanh của **đúng SHA**. Chứng minh cơ chế, **không** chứng minh cấu hình môi trường hay email đã giao | `CODE/CI` |
| DEV_RUNTIME | Quan sát mới trên môi trường Northflank DEV hiện tại, ghi SHA + thời điểm | `DEV_RUNTIME` |
| MISSING_SOURCE | Thiếu tài liệu/dữ kiện nguồn từ BMSL | `MISSING_SOURCE` |
| CUSTOMER_APPROVAL | BMSL duyệt nội dung/nghiệm thu bằng văn bản | `CUSTOMER_APPROVAL` |
| FUTURE_PROD/HANDOVER | Production thật, domain chính thức, bàn giao, đào tạo | `FUTURE` |

Từ 2026-10-19, một số **quan sát** đạt `DEV_RUNTIME` (ghi riêng ở §5 và trong `editorial-ux-audit-2026-10-19.md`): route 200, hành vi #105, canonical/sitemap sai host, thiếu CTA/liên hệ. Quan sát đó **không** gắn được vào SHA triển khai bất biến (không đọc được từ phiên này). Không hàng nào đạt `CUSTOMER_APPROVAL`.

Tên môi trường: môi trường Northflank hiện tại là **DEV** (chủ sở hữu nêu trong #78: được phép nhập bản nháp vào Northflank DEV hiện có, **không phải production**). Mọi chỗ cũ gọi môi trường này là "production" nên hiểu là DEV; production thật là bước `FUTURE` riêng cần chủ phê duyệt.

## 1. Yêu cầu hợp đồng đã lược — 8 trang, CTA

| Trang | Nội dung theo hợp đồng (bản lược) | CTA | Chủ sở hữu Issue |
| --- | --- | --- | --- |
| Trang chủ | Thông điệp, số liệu năng lực, giấy phép, dự án tiêu biểu | Nhận hồ sơ năng lực | #84 → PR #98 (một phần); `FRONTEND_GAP` (CTA, xem dưới bảng); nội dung thật: `MISSING_SOURCE` |
| Giới thiệu | Lịch sử 5 năm, đội ngũ, năng lực pháp lý, văn hoá | Xem dự án | #84 → PR #98; `FRONTEND_GAP` (CTA); nội dung thật: `MISSING_SOURCE` |
| Dịch vụ | Vận hành, an ninh, vệ sinh, PCCC; phạm vi/quy trình/cam kết | Đăng ký khảo sát | #84; nội dung thật: `MISSING_SOURCE` |
| Dự án | Vị trí, quy mô, ảnh thật, ngày vận hành, phản hồi BQT | Đăng ký tham quan | #75/PR #77 (lịch sử), #78 (nhập DEV), #84 → PR #98; `FRONTEND_GAP` (CTA) |
| Quy trình & Minh bạch | Tiếp nhận 30 ngày, báo cáo thu chi mẫu, khung giá QĐ33 | Tải báo cáo mẫu | #84; tài liệu: `MISSING_SOURCE` |
| Kiến thức/tin tức | 5 chuyên mục: pháp lý, phí, kỹ thuật, an toàn, tin công ty | Tư vấn | #78, #84. "120 bài SEO" là **chiến lược năng lực/nội dung**, không phải nghĩa vụ đầu vào ban đầu |
| Tuyển dụng | Vị trí, lương, quyền lợi, video nhân viên nếu được cung cấp | Nộp hồ sơ qua Zalo | #84 → PR #98; `FRONTEND_GAP` (CTA); nội dung: `MISSING_SOURCE` |
| Liên hệ | Form, hotline, Zalo, bản đồ trụ sở | Gửi yêu cầu | **#83/PR #93 (chủ sở hữu chính: form/liên hệ/bản đồ, xem §5)**, #82 (cơ chế SMTP/outbox, đã đóng), #84 → PR #98 |

`FRONTEND_GAP`: theo bình luận điều phối viên trên #98, các CTA đầu tiên của trang chủ, giới thiệu, dự án, tuyển dụng (và hồ sơ năng lực) là **khoảng trống frontend thực tế trên `main`**, không chỉ thiếu tài liệu. Nội dung thật vẫn `MISSING_SOURCE`; hai việc tách biệt. Ngày 2026-10-19, khoảng trống này được quan sát trực tiếp trên DEV: trang chủ chỉ có "Đặt lịch khảo sát"/"Xem dịch vụ"; Giới thiệu và chi tiết Dự án/Tuyển dụng không có CTA hợp đồng (`DEV_RUNTIME`, không có SHA bất biến). PR #98 là bản cũ không thể merge trên `main` hiện tại (xung đột `page.tsx`); xem `editorial-ux-audit-2026-10-19.md` §7 về cách tách.

Hiệu chỉnh so với bản #86: các hạng mục hợp đồng (tên 8 trang, 5 chuyên mục, CTA) là **yêu cầu hợp đồng đã biết**, không còn là "quyết định đặt tên mới". Phần cần quyết định của BMSL chỉ là nội dung cụ thể trong từng mục.

## 2. Giới hạn đầu vào ban đầu (trần, không phải số tối thiểu)

| Hạng mục | Trần theo hợp đồng (bản lược) | Ghi chú |
| --- | --- | --- |
| Hồ sơ dự án | ≤ 21 | ≤ 10 ảnh/dự án |
| Chuyên mục | 5 | pháp lý / phí / kỹ thuật / an toàn / tin công ty |
| Bài viết khách cung cấp | ≤ 10 | |
| Tuyển dụng | ≤ 5 | |
| Tài liệu tải về | ≤ 5 | |

Đây là **trần**. Không được bịa số lượng tối thiểu; không tính "đủ" nếu BMSL chưa cung cấp. Phân biệt bốn trạng thái dữ liệu, không gộp:

| Trạng thái | Nghĩa |
| --- | --- |
| Nguồn (source) | Tài liệu BMSL cung cấp / nguồn cũ `LEGACY-SOURCE` |
| Lưu trữ (archived) | Đã chép vào repo/DB để tham chiếu, chưa công khai |
| Nháp (draft) | Đã nhập vào CMS, đang ẩn/chưa duyệt |
| Đã xuất bản (published) | Đã duyệt và công khai |

Nhập toàn bộ lưu trữ cũ vào DEV là **việc phát triển bổ sung do chủ yêu cầu** (#78, bản nháp trên Northflank DEV hiện có, không production), tách khỏi **lựa chọn xuất bản ban đầu** nằm trong các trần trên. Số lượng đã nhập thực tế trên DEV: `UNKNOWN` (cần đếm có xác thực).

## 3. Yêu cầu kỹ thuật và bàn giao (bản lược) ↔ bằng chứng

Cột "Lớp" cho biết lớp bằng chứng tối đa **hiện có**; mọi thứ ngoài `CODE/CI` là chưa chứng minh.

| CASE | Yêu cầu | Tệp/test trong repo (`CODE/CI`, tham chiếu tên) | Chưa chứng minh | Issue |
| --- | --- | --- | --- | --- |
| T-01 | Thiết kế tuỳ biến, responsive, tiếng Việt | `docs/blueprint/05-ia-wireframes.md`, `tests/integration/http-smoke.test.ts` | Giao diện duyệt trên DEV; BMSL duyệt thiết kế | #84, `CUSTOMER_APPROVAL` |
| T-02 | Chrome/Safari/Edge/Firefox trên Windows/macOS/iOS/Android | Chromium/Firefox/WebKit tự động (`docs/security/W5B4-browser-uat.md`, lịch sử) | Safari, Edge thương hiệu, thiết bị thật | `NOT_PROVEN` |
| T-03 | CMS thêm/sửa/xoá bài, dự án, tuyển dụng, banner, tải về; vai trò ≥ ADMIN/EDITOR | `docs/handover/huong-dan-cms.md`; test CMS trong `tests/`. Collection thực tế (`src/collections/content.ts`): `articles`, `projects`, `job-postings`, `documents` (tải về), `service-areas`, `article-categories`; media: `MediaAssets.ts` | **Banner**: bản 2026-10-08 ghi thiếu điều khiển banner riêng. Từ PR #108/#111/#114 (đã merge), `HomePage.hero` có ảnh desktop/mobile, CTA, điểm lấy nét và lớp phủ chỉnh được trong CMS (migration `20261008_120000_home_page_hero`), và DEV đang hiển thị Hero có ảnh. Issue #102 vẫn mở; **chưa xác minh** Hero này có thoả yêu cầu "banner" của hợp đồng hay không (`OWNER-DECISION`). Ảnh Hero hiện tại có alt `"anh test"` và nguồn ảnh chưa rõ. Chưa thử đăng nhập từng vai trò trên DEV | #84 → PR #98; `NOT_PROVEN` |
| T-04 | URL thân thiện, title/description theo trang/bài, sitemap, robots, structured data cơ bản, tối ưu ảnh | `tests/integration/seo-content.test.ts`, `docs/blueprint/02-redirect-map.md` | Trên nội dung thật đã duyệt, đúng SHA DEV | #84 |
| T-05 | GA4 + Search Console; sự kiện điện thoại/Zalo/form/tải về | Analytics giả lập + đồng ý trước khi tải GA4 (`seo-content.test.ts`) | GA4 thật, GSC; BMSL cung cấp mã/quyền | `MISSING_SOURCE` |
| T-06 | HTTPS, chống spam, sao lưu tự động nếu host hỗ trợ | `tests/integration/http-smoke.test.ts`, `scripts/backup/`, `tests/integration/backup-restore.test.ts`, `docs/runbooks/backup-restore.md` | Sao lưu của host, restore thử; domain chính thức | `FUTURE` |
| T-07 | Tối ưu hiệu năng (phụ thuộc hosting) | Cơ chế đo Lighthouse + trình duyệt: `docs/security/W5B4-browser-uat.md` (mục Performance, ngân sách `LIGHTHOUSE_BUDGET`), `tests/integration/http-smoke.test.ts`, `tests/integration/support/browser-policy.ts`, `tests/integration/support/browser-blocks.ts` (`CODE/CI`, lịch sử) | Hiệu năng trên host/DEV thật đúng SHA hiện tại chưa đo; kết quả lịch sử không thay cho host thật | `NOT_PROVEN` |
| H-01 | Quản trị cao nhất, sao lưu mã nguồn + DB | `huong-dan-cms.md` §2, `docs/runbooks/van-hanh.md` | Chuyển giao thật | `FUTURE` |
| H-02 | Hướng dẫn sử dụng; một buổi đào tạo ≤ 2 giờ | `huong-dan-cms.md` §9–§10 | Buổi đào tạo chưa diễn ra | `FUTURE` |
| H-03 | 4 giai đoạn: IA 5 ngày / thiết kế 10 / dựng + nhập liệu đầu 12 / kiểm thử + bàn giao 3; tổng 30 ngày làm việc | — (kế hoạch, không phải chức năng) | Không xác nhận mốc, thanh toán hay hạn chót từ tài liệu này; cửa sổ khách xem xét ≠ đã nghiệm thu | Điều phối #81 |

## 4. Ma trận nghiệm thu theo hợp đồng (CASE C — giữ từ bản #86, bổ sung lớp bằng chứng)

Cột "Đã chứng minh hiện có": test/mã tồn tại trong repo (có tệp, lớp `CODE/CI`). Chạy xanh trên đúng SHA cần run CI cụ thể; số run ở §5 là quan sát của điều phối viên.

| CASE | Năng lực theo hợp đồng | Đã chứng minh hiện có (tệp trong repo) | NOT_PROVEN (runtime / khách duyệt) | Issue/phụ thuộc | Quyết định chủ sở hữu | Bằng chứng cần |
| --- | --- | --- | --- | --- | --- | --- |
| C-01 | 8 trang: Trang chủ, Giới thiệu, Dịch vụ, Dự án, Quy trình & Minh bạch, Kiến thức & tin tức, Tuyển dụng, Liên hệ | IA: `docs/blueprint/05-ia-wireframes.md`; `tests/integration/http-smoke.test.ts`, `seo-content.test.ts` | Điều hướng + SEO trên nội dung thật đã duyệt, trên DEV đúng SHA (`DEV_RUNTIME` chưa có) | #84 (sửa/chứng minh tổng hợp 8 trang, đang khởi chạy); #78 | BMSL duyệt cấu trúc/nội dung từng trang | CI đúng SHA + ảnh chụp/biên bản UAT |
| C-02 | Form liên hệ gửi **email** | Lưu lead bền trước hiệu ứng phụ: `tests/integration/payload.test.ts`, `http-smoke.test.ts`; cơ chế SMTP/outbox: #82 (đã đóng) | Cấu hình SMTP trên Northflank DEV; email **được giao** vào hộp thư test rồi hộp thư chính thức. Cơ chế/CI **không** chứng minh điều này | #82 (cơ chế), #83 | BMSL cung cấp hộp thư nhận; chọn nhà cung cấp | Một lần gửi thử thấy trong hộp thư test + dòng lead (không đính PII) |
| C-03 | Hotline / Zalo / bản đồ / CTA | Cổng `CONFIRMED` cho dữ kiện liên hệ (`docs/blueprint/06`); legacy ≠ hợp đồng | Giá trị thật chưa xác nhận (`MISSING_SOURCE`); bấm gọi/Zalo/bản đồ trên thiết bị thật. DEV hiện **không** hiển thị hotline, Zalo, email, địa chỉ hay bản đồ (`DEV_RUNTIME`, 2026-10-19). PR #93 chưa merge; head `22a6ea4` có `verify` + `integration` thành công và `CLEAN` lúc quan sát (§5), nhưng chưa có Reviewer/xác nhận ở phiên này | **#83/PR #93 (chủ sở hữu chính)**, #82, #84 → PR #98; câu hỏi mở #1 trong `07-open-questions.md` | BMSL xác nhận bằng văn bản | Văn bản xác nhận + kiểm tra trên điện thoại thật |
| C-04 | ≤ 21 hồ sơ dự án, ≤ 10 ảnh/dự án (trần) | 17 hồ sơ nháp `LEGACY-SOURCE` (`tests/integration/legacy-seed.test.ts`, `docs/blueprint/03`); không phải trần CMS | Danh sách dự án được duyệt; ảnh + quyền dùng; phản hồi BQT; số lượng đã nhập vào DEV: `UNKNOWN` | #75/PR #77 (lịch sử), #78 (nhập DEV bản nháp), PR #79 (trạng thái: `NOT_PROVEN` bởi Builder) | BMSL duyệt dự án công khai, quyền ảnh | Danh sách duyệt + biểu mẫu quyền ảnh (không đưa vào Git) |
| C-05 | 4 lĩnh vực dịch vụ: vận hành, an ninh, vệ sinh, PCCC | Cấu trúc trang Dịch vụ (`05`) | Nội dung phạm vi/quy trình/cam kết chưa được BMSL cung cấp/duyệt (`MISSING_SOURCE`) | #84 (fixtures tổng hợp độc lập; nguồn thật tách riêng) | BMSL cung cấp mô tả | Văn bản duyệt |
| C-06 | 5 chuyên mục; ≤ 10 bài đầu khách cung cấp | Bài đề xuất theo slug: `docs/blueprint/04`; `selectionApproved=false` | Tên 5 chuyên mục theo hợp đồng cần đối chiếu với taxonomy trong repo; danh sách ≤ 10 bài chưa có. "120 bài SEO" không phải đầu vào ban đầu | #11, #13 trong `07`; #78 | BMSL chốt bài. Không đổi trần | Văn bản duyệt |
| C-07 | ≤ 5 tuyển dụng, ≤ 5 tài liệu | Giới hạn ghi nhận (`05`); tin cũ `LEGACY-SOURCE` đang ẩn | Vị trí, lương, quyền lợi, hạn nộp, tệp tài liệu (báo cáo thu chi mẫu, khung QĐ33) chưa có | #9, #10 trong `07` | BMSL cung cấp/duyệt | Tệp đã duyệt + văn bản |
| C-08 | SEO, GA4, Google Search Console | Sitemap, JSON-LD có điều kiện, noindex, analytics giả lập + đồng ý trước khi tải GA4 (`seo-content.test.ts`, `docs/security/W5B4-browser-uat.md`) | GA4 thật, sự kiện điện thoại/Zalo/form/tải về trên property thật, quyền GSC, chính sách cookie. Mã không có route chính sách cookie/dữ liệu cá nhân; DEV không tải script GA4 (`DEV_RUNTIME`, 2026-10-19). Canonical/sitemap trên DEV vẫn trỏ host `code.run`, `robots.txt` không có dòng `Sitemap:` (#109, `OWNER-DECISION`) | #15 trong `07` | BMSL cung cấp mã GA4/quyền GSC | Property GA4 thật thấy sự kiện; xác minh GSC |
| C-09 | Trình duyệt Chrome / Safari / Edge / Firefox | Chromium, Firefox, WebKit tự động (lịch sử) | Safari và Edge **thương hiệu**, thiết bị thật | `NOT_PROVEN` | Người nghiệm thu chọn thiết bị | Bảng kết quả theo trình duyệt/thiết bị |
| C-10 | HTTPS, chống spam | Header/chống spam trong test tích hợp (`http-smoke.test.ts`); HTTPS trên domain Northflank DEV đã được quan sát trước đây (`uat-handover-matrix.md` §5) | TLS trên **domain chính thức**; chống spam ngoài edge | `FUTURE` | BMSL cấp domain/DNS | Kiểm tra trên domain thật |
| C-11 | Sao lưu nếu host hỗ trợ | `scripts/backup/`, `tests/integration/backup-restore.test.ts`, `docs/runbooks/backup-restore.md` | Sao lưu **off-site** của host; một lần restore thử | `FUTURE` | BMSL/host ký lịch sao lưu | Cấu hình lịch + biên bản restore thử |
| C-12 | Bàn giao ADMIN, mã nguồn, CSDL | `huong-dan-cms.md` §2, `van-hanh.md` | Chuyển giao ADMIN thật; giao mã/CSDL thật | `FUTURE` | Chủ quyết ai nhận | Biên bản giao nhận (không ghi mật khẩu) |
| C-13 | Một buổi đào tạo (≤ 2 giờ) | Chương trình: `huong-dan-cms.md` §9–§10 | Buổi đào tạo chưa diễn ra | `FUTURE` | Chốt lịch/người tham dự | Biên bản đào tạo có chữ ký |
| C-14 | Nội dung do khách xác nhận (dữ kiện công ty, giấy phép, cam kết) | Mọi dữ kiện giữ `UNCONFIRMED` (`07` §1, §3) | Toàn bộ chưa xác nhận (`MISSING_SOURCE` + `CUSTOMER_APPROVAL`) | #4–#7 trong `07` | BMSL | Văn bản xác nhận |

Phân biệt: hàng chỉ thiếu tài liệu khách (C-04…C-07, C-14) là **thiếu vật liệu khách**, không phải lỗi lập trình. Hàng thiếu runtime (C-02, C-08…C-11) là việc kỹ thuật/hạ tầng còn lại. Sửa lỗi bằng dữ liệu tổng hợp (#84) và nguồn/xuất bản thật là hai việc riêng; dữ liệu tổng hợp không thay thế nguồn của BMSL.

## 5. Bằng chứng GitHub

### 5.1 Quan sát trực tiếp 2026-10-19 (`gh`, chỉ đọc; `main` = `87e6498aa902ce687aa0380f6f5728f41be9169d`)

| Mục | Trạng thái quan sát | Nhãn |
| --- | --- | --- |
| #105 (bài published không chuyên mục) | PR #107 đã merge `7fba1370dd4f2d1f4b4d1ccc3de79c531a996284` (tổ tiên của `main`); CI exact-main run `37795407982` `verify`+`integration` thành công; DEV: 4 bài `category=null` mở `200` ở `/kien-thuc/bai-viet/<slug>`, bài có chuyên mục giữ URL cũ, cùng slug sai chuyên mục `404`. Còn thiếu SHA triển khai bất biến. Đề xuất đóng | `CI-PROVEN`, `DEV-RUNTIME-PROVEN` (hành vi); SHA triển khai `NOT_PROVEN` |
| #109 (canonical/sitemap) | Vẫn mở. DEV: canonical + sitemap (54 URL) dùng host `code.run`; robots không có `Sitemap:`; hai host cùng phục vụ nội dung. Chờ chọn tên miền chính | `DEV-RUNTIME-PROVEN` (lỗi), `OWNER-DECISION` |
| #98 (editorial) | Draft, đáy cũ `5131e59`, `CONFLICTING` với `main` (`page.tsx`), không có check; một test trong PR mâu thuẫn #107. Chia nhỏ: xem audit §7 | không merge được; `NOT_PROVEN` |
| #99 (PR này) | Draft; cập nhật bởi lần hiệu chỉnh 3; CI của head này do GitHub chạy sau khi push | `NOT_PROVEN` cho tới khi CI đúng head |
| #93 (liên hệ/bản đồ/CTA, phiên khác) | Draft, head `22a6ea4d68e89d50302637f98feb9bbf96a53238`, `CLEAN`, `verify`+`integration` thành công lúc quan sát; chưa merge, chưa Reviewer ở phiên này | `CI-PROVEN` (head đó) |
| #100 (guard nhập DEV) | Đã merge | `CI-PROVEN` theo trạng thái merge; không kiểm lại |
| #79 (docs nhập DEV) | Draft, `BEHIND`, chỉ 1 tệp docs; phiên CMS đề nghị đóng (bình luận #81 ngày 2026-10-19) | chờ điều phối viên |
| #78 (nhập DEV) | Mở; bình luận 2026-10-19: DEV có 21 dự án published (17 cũ đã `CONFIRMED` bởi người, chưa thấy văn bản duyệt), 20 bài, 8 dịch vụ, 6 tài liệu, 65 media APPROVED; xoá mẫu chưa thực hiện | `DEV-RUNTIME-PROVEN` (số đếm ẩn danh, phiên khác); `OWNER-DECISION` |
| #102 (banner) | Mở; Hero (#108/#111/#114) đã merge; chưa rõ có thoả yêu cầu banner | `OWNER-DECISION` |
| #118/#119 (tài liệu nội bộ trong repo công khai) | PR #118 mở; #119 R3 chờ chủ; phiên khác | ngoài phạm vi |
| BMSL ký nhận/nghiệm thu | Chưa có | `NOT_PROVEN`, không `CUSTOMER-APPROVED` |

### 5.2 Quan sát của điều phối viên 2026-10-08 (lịch sử, giữ để so sánh)

| Mục | Trạng thái theo quan sát điều phối viên | Ý nghĩa | Lớp |
| --- | --- | --- | --- |
| `main` | `5131e599d24328655b977fa7092d0b228e4efd18`; run `37615468154` `verify` + `integration` thành công | CI xanh cho đúng SHA này | `CODE/CI` |
| #80 kiểm toán nguồn, #82 SMTP/outbox, #85 sửa test, #86 ma trận trước | Đã đóng/merge | Chứng minh cơ chế/CI. **Không** chứng minh Northflank đã cấu hình hay email đã giao | `CODE/CI` |
| #78 | Mở rộng: nhập bản nháp vào Northflank DEV hiện có theo chủ sở hữu uỷ quyền; **không có cổng nhập production mới** cho đích này | Số lượng đã nhập có xác thực: `UNKNOWN` | `DEV_RUNTIME` chưa có |
| PR #93 | Head `d7e2e4f`: CI run `37717635686` ở trạng thái `ACTION_REQUIRED` | **Không** có khẳng định xanh cho head hiện tại | chưa chứng minh |
| #84 → PR #98 | Theo điều phối viên: PR #98 **một phần**, đã yêu cầu thêm sửa tích hợp/frontend; nguồn thật và xuất bản là việc riêng | Chưa hoàn tất | chưa chứng minh |
| #97 → PR #100 | Điều phối viên `REQUEST_CHANGES` vì guard chế độ remote fail-open | Chưa đạt | chưa chứng minh |
| #81, #83, PR #79 | Builder không có quan sát trạng thái; #83/PR #93 là chủ sở hữu chính của liên hệ/bản đồ | `NOT_PROVEN` | — |

Tài liệu này không nhúng SHA của chính commit chứa nó. SHA ở trên là mốc ngoài, gắn với thời điểm quan sát.

## 6. Các bước bàn giao / UAT (chạy sau khi có nội dung duyệt)

Mọi bước ghi **SHA triển khai chính xác** và loại bằng chứng. Không sinh bằng chứng giả; không có biên bản chính thức nào được tạo ở đây.

| Bước | Việc | Loại bằng chứng | Kết quả |
| --- | --- | --- | --- |
| 1 | Ghi SHA đã triển khai lên Northflank DEV và CI `verify` + `integration` của đúng SHA | URL run CI | `NOT_PROVEN` |
| 2 | Điều hướng 8 trang + kiểm tra SEO trên nội dung thật | Ảnh chụp/ghi chú theo trang | `NOT_PROVEN` |
| 3 | Gửi form tới **hộp thư test**; kiểm tra lead đã lưu trong CSDL | Ảnh hộp thư (che PII) + xác nhận dòng lead | `NOT_PROVEN` |
| 4 | CMS: đăng nhập ADMIN và EDITOR; kiểm tra cổng quyền ảnh (`APPROVED`) và `CONFIRMED` | Ghi chú theo vai trò | `NOT_PROVEN` |
| 5 | GA4: đồng ý trước khi tải, sự kiện điện thoại/Zalo/form/tải về trên property thật | Báo cáo realtime GA4 | `NOT_PROVEN` |
| 6 | Trình duyệt/điện thoại: Chrome, Safari, Edge, Firefox, ít nhất một điện thoại thật | Bảng kết quả | `NOT_PROVEN` |
| 7 | Sao lưu + restore thử, rồi restore từ bản off-site | Biên bản restore | `NOT_PROVEN` |
| 8 | Domain chính thức + TLS (production, cần chủ phê duyệt riêng) | Kết quả kiểm tra | `NOT_PROVEN` |
| 9 | Đào tạo (tối đa 2 giờ) | Biên bản có chữ ký | `NOT_PROVEN` |
| 10 | BMSL ký nghiệm thu | Văn bản ký của BMSL/chủ | `NOT_PROVEN` — chỉ con người ký |

## 7. Gói yêu cầu đầu vào gửi BMSL (theo 8 trang)

Không đưa số điện thoại, email, địa chỉ thật hay dữ liệu cá nhân vào Git công khai: BMSL gửi qua kênh riêng; repo chỉ ghi "đã nhận / chưa nhận". "Chưa nhận" = chưa có nguồn trong repo. `SOURCE_PRESENT_PENDING_CONFIRMATION` = có nguồn (cũ hoặc đã commit) nhưng BMSL chưa xác nhận dữ kiện cuối cùng. Hai trạng thái không được gộp.

| Trang | BMSL cần cung cấp | Trạng thái |
| --- | --- | --- |
| Toàn site — tên, màu, phông | Tên công ty chính thức, màu, phông | Tên công ty: `SOURCE_PRESENT_PENDING_CONFIRMATION` (nguồn cũ `LEGACY-SOURCE`; xác nhận dữ kiện cuối cùng riêng). Màu/phông: chưa có nguồn chính thức |
| Toàn site — logo | Logo gốc BMSL | `SOURCE_PRESENT_PENDING_CONFIRMATION`: logo gốc đã được chấp nhận và commit bởi #74/PR #76 (`src/assets/brand/bmsl-logo.jpg`, `docs/brand/logo.md`); BMSL xác nhận dùng chính thức vẫn riêng |
| Trang chủ | Thông điệp chính, số liệu năng lực đã duyệt, giấy phép, dự án tiêu biểu | Chưa nhận |
| Giới thiệu | Lịch sử 5 năm, đội ngũ, năng lực pháp lý hiện hành, văn hoá | Chưa nhận |
| Dịch vụ | Mô tả 4 lĩnh vực (vận hành, an ninh, vệ sinh, PCCC): phạm vi, quy trình, cam kết | Chưa nhận |
| Dự án | Danh sách dự án đã duyệt công khai (≤ 21; hiện có 17 hồ sơ nháp cũ), vị trí, quy mô, ngày vận hành, ảnh thật (≤ 10/dự án), quyền dùng ảnh, phản hồi BQT | Chưa nhận |
| Quy trình & Minh bạch | Quy trình tiếp nhận 30 ngày, báo cáo thu chi mẫu, khung giá QĐ33, tài liệu tải về (≤ 5) | Chưa nhận |
| Kiến thức & tin tức | Xác nhận 5 chuyên mục, ≤ 10 bài đầu | Chưa nhận |
| Tuyển dụng | ≤ 5 vị trí kèm lương, quyền lợi, hạn nộp, địa điểm; video nhân viên nếu có | Chưa nhận |
| Liên hệ & vận hành | Địa chỉ trụ sở, hotline, Zalo, hộp thư nhận form, vị trí bản đồ; chính sách cookie/dữ liệu cá nhân; GA4 và Search Console; domain chính thức, host, xác nhận sao lưu | Chưa nhận |

## 8. Điểm không nhất quán của hợp đồng (từ bản #86, chưa đối chiếu)

Các điểm sau lấy từ Issue #86 và **không** nằm trong bản lược của Issue #96; không được điều phối viên xác nhận trong lần này nên giữ `NOT_PROVEN`. Không đề xuất cách giải quyết, không diễn giải pháp lý.

1. Điều 4: 10 ngày làm việc; Phụ lục 02: 30 ngày (xem C1 trong `07-open-questions.md`). Bản lược #96 ghi 4 giai đoạn 5/10/12/3 = 30 ngày làm việc; việc mâu thuẫn với Điều 4 chưa được đối chiếu.
2. Điều 3.3: số tiền bằng số và bằng chữ khác nhau.
3. Điều 1.5 dẫn chiếu 18.3, có vẻ phải là 17.3.
4. Điều 3.2 dẫn chiếu Điều 7, trong khi thay đổi phạm vi ở Điều 6.
5. Thông tin pháp lý của các bên còn để trống.
6. Chưa rõ văn bản là bản ký cuối hay bản nháp.

## 9. Theo dõi và phát hành

- Điều phối #81. Chủ sở hữu từng hàng ghi ở §1, §3, §4.
- Northflank CD gốc có thể phát hành khi có push lên `main`. Môi trường hiện tại là DEV; việc merge vẫn do chủ quyết định. Issue này không merge hay triển khai.

## PROVEN

- Các tệp/test được nêu có trong repo (tham chiếu tên tệp, không chạy lại).
- Nhánh làm việc xuất phát từ commit `5131e599d24328655b977fa7092d0b228e4efd18` (kiểm cục bộ bằng `git rev-parse HEAD`).

## NOT_PROVEN

- Nội dung hợp đồng gốc (Builder không truy cập); bản lược do điều phối viên cung cấp; ký/thanh toán/hạn chót.
- §5.2 là quan sát lịch sử của điều phối viên 2026-10-08; §5.1 là quan sát `gh` 2026-10-19 và có thể đã đổi khi bạn đọc.
- Cấu hình Northflank DEV, email đã giao, số lượng đã nhập, mọi runtime, sự chấp thuận của khách và nghiệm thu ở §4 và §6.
