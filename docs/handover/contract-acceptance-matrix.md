# Ma trận nghiệm thu hợp đồng ↔ repo, và gói đầu vào cho BMSL (Issue #86, điều phối #81)

Trạng thái: **bản soạn để chủ và BMSL xem xét. Không phải nghiệm thu.** CI xanh ≠ BMSL nghiệm thu. Tài liệu này không tạo bằng chứng, chữ ký hay biên bản nào.
Bổ sung cho [`uat-handover-matrix.md`](uat-handover-matrix.md) (mốc CI/SHA lịch sử, cutover) — không thay thế.

## 0. Giới hạn của lần soạn này (đọc trước)

| Nguồn | Tình trạng khi soạn (2026-10-07) |
| --- | --- |
| Văn bản hợp đồng (Google Docs, Điều 2, Điều 7, Phụ lục 01–02) | Builder **không đọc được** bản gốc. Các hàng dưới đây dựa trên tóm tắt trong Issue #86 và `docs/blueprint/`. Mỗi con số/điều khoản phải được người ký đối chiếu lại với văn bản gốc: `NOT_PROVEN` |
| Hợp đồng đã ký hay còn là bản nháp chỉnh sửa được | **Chưa xác nhận.** Không coi đây là bản đã ký. Nếu chỉ là bản nháp, mọi hàng "hợp đồng" bên dưới có thể đổi |
| Trạng thái sống của Issue/PR #78–#85 và #81 | Builder không truy vấn được GitHub API. Cột "Issue/phụ thuộc" chỉ ghi số Issue theo Issue #86; nội dung và trạng thái từng Issue: `NOT_PROVEN`, điều phối viên điền từ #81 |
| CI của `main` hiện tại (`40a09b688f2c3685509d44366d9908affac8ce9b`) | **Không được kiểm.** Số CI trong `uat-handover-matrix.md` là lịch sử của `f363129…`, không phải HEAD hiện tại |
| Chạy mã / môi trường | Không chạy gì trong lần soạn này (docs-only, R0) |

Quy ước "đã chứng minh": chỉ test có trong repo (tên tệp) và CI của **đúng SHA** mới tính. Bằng chứng từ Issue/CI cũ là lịch sử.

## 1. Ma trận nghiệm thu theo hợp đồng

Cột "Đã chứng minh hiện có": test/mã tồn tại trong repo tại `40a09b6` (có tệp), **chưa** chạy lại; chạy xanh trên đúng SHA = `NOT_PROVEN` cho tới khi có run CI cụ thể.

| CASE | Năng lực theo hợp đồng | Đã chứng minh hiện có (tệp trong repo) | NOT_PROVEN (runtime / khách duyệt) | Issue/phụ thuộc | Quyết định chủ sở hữu | Bằng chứng cần |
| --- | --- | --- | --- | --- | --- | --- |
| C-01 | 8 trang: Trang chủ, Giới thiệu, Dịch vụ, Dự án, Quy trình & Minh bạch, Kiến thức & tin tức, Tuyển dụng, Liên hệ | IA: `docs/blueprint/05-ia-wireframes.md`; test điều hướng: `tests/integration/http-smoke.test.ts`, `seo-content.test.ts` | Điều hướng + SEO trên **nội dung thật đã duyệt**, trên staging đúng SHA | #78–#85 (ánh xạ: `NOT_PROVEN`) | BMSL duyệt cấu trúc/nội dung từng trang | CI đúng SHA + ảnh chụp/biên bản UAT sau khi nhập nội dung |
| C-02 | Form liên hệ gửi **email** | Lưu lead bền trước hiệu ứng phụ: `tests/integration/payload.test.ts`, `http-smoke.test.ts` | Gửi email thật tới **hộp thư test**, rồi hộp thư chính thức; SMTP/provider chưa duyệt | Chưa rõ (`NOT_PROVEN`) | BMSL cung cấp hộp thư nhận; chọn nhà cung cấp gửi mail | Một lần gửi thử thấy trong hộp thư test + dòng lead trong CSDL (không đính PII) |
| C-03 | Hotline / Zalo / bản đồ / CTA | Cổng `CONFIRMED` cho dữ kiện liên hệ (`docs/blueprint/06`); legacy ≠ hợp đồng | Giá trị thật chưa được xác nhận; bấm gọi/Zalo/bản đồ trên thiết bị thật | #1 trong `07-open-questions.md` | BMSL xác nhận bằng văn bản | Văn bản xác nhận + kiểm tra trên điện thoại thật |
| C-04 | Tối đa 21 hồ sơ dự án, ≤10 ảnh/dự án | 17 hồ sơ nháp `LEGACY-SOURCE` (`tests/integration/legacy-seed.test.ts`, `docs/blueprint/03`); 21/10 là **giới hạn nghiệm thu**, không phải trần CMS | Danh sách dự án được duyệt; ảnh + quyền dùng; phản hồi BQT | #75 đã merge (PR #77, lịch sử); còn lại `NOT_PROVEN` | BMSL duyệt dự án nào công khai, quyền ảnh | Danh sách duyệt + biểu mẫu quyền ảnh (không đưa vào Git) |
| C-05 | 4 lĩnh vực dịch vụ | Cấu trúc trang Dịch vụ (`05`) | Nội dung 4 dịch vụ chưa được BMSL cung cấp/duyệt | `NOT_PROVEN` | BMSL cung cấp mô tả 4 dịch vụ | Văn bản duyệt |
| C-06 | Đúng 5 chuyên mục do BMSL duyệt; ≤10 bài đầu BMSL cung cấp | Bài đề xuất theo slug: `docs/blueprint/04`; `selectionApproved=false`, 0 bài tính là đã chuyển | 5 tên chuyên mục và danh sách ≤10 bài chưa có | #11, #13 trong `07` | BMSL chốt 5 tên và ≤10 bài. Không đổi giới hạn trên | Văn bản duyệt |
| C-07 | ≤5 tuyển dụng, ≤5 tài liệu | Giới hạn ghi nhận (`05`); tin cũ `LEGACY-SOURCE` đang ẩn | Vị trí, lương, hạn nộp, tệp tài liệu giá/minh bạch chưa có | #9, #10 trong `07` | BMSL cung cấp/duyệt | Tệp đã duyệt + văn bản |
| C-08 | SEO, GA4, Google Search Console | Sitemap, JSON-LD có điều kiện, noindex, analytics giả lập + đồng ý trước khi tải GA4 (`seo-content.test.ts`, `docs/security/W5B4-browser-uat.md`) | GA4 thật, 4 sự kiện trên property thật, quyền sở hữu GSC, chính sách cookie | #15 trong `07` | BMSL cung cấp mã GA4/quyền GSC; quyết định chính sách cookie | Property GA4 thật thấy sự kiện; xác minh GSC |
| C-09 | Trình duyệt Chrome / Safari / Edge / Firefox | Chromium, Firefox, WebKit tự động (`docs/security/W5B4-browser-uat.md`, lịch sử) | Safari và Edge **thương hiệu**, thiết bị thật | `NOT_PROVEN` | Người nghiệm thu chọn thiết bị | Bảng kết quả theo trình duyệt/thiết bị |
| C-10 | HTTPS, chống spam | Kiểm tra header/chống spam trong test tích hợp (`http-smoke.test.ts`) | TLS trên **domain chính thức**; cơ chế chống spam ngoài edge | `NOT_PROVEN` | BMSL cấp domain/DNS | Kiểm tra trên domain thật |
| C-11 | Sao lưu nếu host hỗ trợ | `scripts/backup/`, `tests/integration/backup-restore.test.ts`, `docs/runbooks/backup-restore.md` | Sao lưu **off-site** của host; một lần restore thử từ bản off-site | `NOT_PROVEN` | BMSL/host ký quyết định lịch sao lưu | Cấu hình lịch + biên bản restore thử |
| C-12 | Bàn giao ADMIN, mã nguồn, CSDL | `docs/handover/huong-dan-cms.md` §2, `docs/runbooks/van-hanh.md` | Chuyển giao ADMIN thật; giao mã/CSDL thật | `NOT_PROVEN` | Chủ quyết ai nhận | Biên bản giao nhận (không ghi mật khẩu) |
| C-13 | Một buổi đào tạo (tối đa 2 giờ) | Chương trình: `huong-dan-cms.md` §9–§10 | Buổi đào tạo chưa diễn ra | `NOT_PROVEN` | Chốt lịch/người tham dự | Biên bản đào tạo có chữ ký |
| C-14 | Nội dung do khách xác nhận (dữ kiện công ty, giấy phép, cam kết) | Mọi dữ kiện giữ `UNCONFIRMED` (`07` §1, §3) | Toàn bộ chưa xác nhận | #4–#7 trong `07` | BMSL | Văn bản xác nhận |

Phân biệt: hàng chỉ thiếu tài liệu khách (C-04…C-07, C-14) là **thiếu vật liệu khách**, không phải lỗi lập trình. Hàng thiếu runtime (C-02, C-08…C-11) là việc kỹ thuật/hạ tầng còn lại.

## 2. Gói yêu cầu đầu vào gửi BMSL (theo 8 trang)

Không đưa số điện thoại, email, địa chỉ thật hay dữ liệu cá nhân vào Git công khai: BMSL gửi qua kênh riêng; repo chỉ ghi "đã nhận / chưa nhận".

| Trang | BMSL cần cung cấp | Trạng thái |
| --- | --- | --- |
| Toàn site | Tên công ty chính thức, logo, màu, phông | Chưa nhận |
| Trang chủ | Thông điệp chính, số liệu công ty đã duyệt (số toà/căn/nhân sự) | Chưa nhận |
| Giới thiệu | Giấy phép/năng lực pháp lý hiện hành, lịch sử, đội ngũ | Chưa nhận |
| Dịch vụ | Mô tả 4 lĩnh vực dịch vụ | Chưa nhận |
| Dự án | Danh sách 17 dự án hiện có (so với hợp đồng ≤21) đã duyệt công khai, trạng thái, ảnh (≤10/dự án), văn bản quyền dùng ảnh/đồng ý người trong ảnh, phản hồi BQT | Chưa nhận |
| Quy trình & Minh bạch | Quy trình 30 ngày, giá theo QĐ33, tài liệu báo cáo (≤5) | Chưa nhận |
| Kiến thức & tin tức | 5 tên chuyên mục, danh sách ≤10 bài đầu | Chưa nhận |
| Tuyển dụng | ≤5 vị trí kèm lương, quyền lợi, hạn nộp, địa điểm | Chưa nhận |
| Liên hệ & vận hành | Địa chỉ, hotline, Zalo, hộp thư nhận form, vị trí bản đồ; chính sách cookie/dữ liệu cá nhân theo quy định địa phương; GA4 và quyền Search Console; domain chính thức, host, xác nhận sao lưu | Chưa nhận |

## 3. Điểm không nhất quán của hợp đồng — chỉ để các bên ký quyết định

Không đề xuất cách giải quyết. Đối chiếu với văn bản gốc; có thể hợp đồng chỉ là bản nháp, chưa ký.

1. Điều 4: 10 ngày làm việc; Phụ lục 02: 30 ngày (xem C1 trong `07-open-questions.md`).
2. Điều 3.3: số tiền bằng số và bằng chữ khác nhau (27 triệu so với 25 triệu). Không trích thêm số khác.
3. Điều 1.5 dẫn chiếu 18.3, trong khi có vẻ phải là 17.3.
4. Điều 3.2 dẫn chiếu Điều 7, trong khi thay đổi phạm vi nằm ở Điều 6.
5. Thông tin pháp lý của các bên còn để trống.
6. Chưa rõ văn bản là bản ký cuối hay bản nháp còn chỉnh sửa.

Mục 3 và 4 lấy từ Issue #86; `NOT_PROVEN` cho tới khi đối chiếu văn bản gốc.

## 4. Các bước bàn giao / UAT (chạy sau khi có nội dung duyệt)

Mọi bước ghi **SHA triển khai chính xác** và loại bằng chứng. Không sinh bằng chứng giả; không có biên bản chính thức nào được tạo ở đây.

| Bước | Việc | Loại bằng chứng | Kết quả |
| --- | --- | --- | --- |
| 1 | Ghi SHA đã triển khai lên staging và CI `verify` + `integration` của đúng SHA | URL run CI | `NOT_PROVEN` |
| 2 | Điều hướng 8 trang + kiểm tra SEO trên nội dung thật | Ảnh chụp/ghi chú theo trang | `NOT_PROVEN` |
| 3 | Gửi form tới **hộp thư test**; kiểm tra lead đã lưu trong CSDL | Ảnh hộp thư (che PII) + xác nhận dòng lead | `NOT_PROVEN` |
| 4 | CMS: đăng nhập ADMIN và EDITOR; kiểm tra cổng quyền ảnh (`APPROVED`) và `CONFIRMED` | Ghi chú theo vai trò | `NOT_PROVEN` |
| 5 | GA4: đồng ý trước khi tải, 4 sự kiện trên property thật | Báo cáo realtime GA4 | `NOT_PROVEN` |
| 6 | Trình duyệt/điện thoại: Chrome, Safari, Edge, Firefox, ít nhất một điện thoại thật | Bảng kết quả | `NOT_PROVEN` |
| 7 | Sao lưu + restore thử, rồi restore từ bản off-site | Biên bản restore | `NOT_PROVEN` |
| 8 | Domain chính thức + TLS | Kết quả kiểm tra | `NOT_PROVEN` |
| 9 | Đào tạo (tối đa 2 giờ) | Biên bản có chữ ký | `NOT_PROVEN` |
| 10 | BMSL ký nghiệm thu | Văn bản ký của BMSL/chủ | `NOT_PROVEN` — chỉ con người ký |

## 5. Theo dõi và phát hành

- Điều phối #81; các Issue #78, #80, #82, #83, #84, #85 theo Issue #86. Cột "Issue/phụ thuộc" ở §1 do điều phối viên cập nhật khi trạng thái sống được xác minh.
- Northflank CD gốc có thể phát hành khi có push lên `main`. **Kể cả commit chỉ có tài liệu** cần phê duyệt production riêng của chủ trước khi merge; Issue này không merge hay triển khai.

## PROVEN

- Các tệp/test được nêu có trong repo tại `40a09b688f2c3685509d44366d9908affac8ce9b` (tham chiếu tên tệp, chưa chạy lại).

## NOT_PROVEN

- Nội dung hợp đồng gốc, và việc đã ký hay còn là bản nháp.
- Trạng thái sống của #78–#85, #81 và CI của `main` hiện tại.
- Mọi runtime, sự chấp thuận của khách và nghiệm thu ở §1 và §4.
