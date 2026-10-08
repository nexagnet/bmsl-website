# Ma trận nghiệm thu hợp đồng ↔ repo, và gói đầu vào cho BMSL (Issue #86 bản đầu, sửa theo Issue #96, điều phối #81)

Trạng thái: **bản soạn để chủ và BMSL xem xét. Không phải nghiệm thu.** CI xanh ≠ BMSL nghiệm thu. Tài liệu này không tạo bằng chứng, chữ ký hay biên bản nào, và không diễn giải pháp lý.
Bổ sung cho [`uat-handover-matrix.md`](uat-handover-matrix.md) (mốc CI/SHA lịch sử, cutover) — không thay thế.

## 0. Nguồn và giới hạn (đọc trước)

| Nguồn | Tình trạng |
| --- | --- |
| Hợp đồng `HD_Thiet_ke_Website_NetViet.docx` | Điều phối viên **đã đọc độc lập bản đính kèm riêng tư vào 2026-10-08** và nêu yêu cầu đã làm sạch trong Issue #96. Builder **không** truy cập bản gốc và không giả vờ đã đọc; mọi hàng "theo hợp đồng" dưới đây là theo tóm tắt của điều phối viên. Không chép nguyên văn hợp đồng vào repo. |
| Ký / thanh toán / hạn chót | Không khẳng định gì từ tệp này. Cửa sổ khách xem xét và "duyệt" trong lịch 4 giai đoạn **không** có nghĩa đã nghiệm thu. |
| Bản ghi của bản đầu (2026-10-07) | Bản đầu ghi rằng chưa đọc hợp đồng và chưa biết ánh xạ Issue; điều đó đã được thay bằng mục này. Các điểm không nhất quán lấy từ bản đầu (mục 7) giữ nguyên ở dạng lịch sử, `NOT_PROVEN`. |
| Trạng thái sống Issue #78/#81/#83/#84, PR #79/#93, SHA `main`, CI | Builder chạy trong sandbox không có quyền gọi GitHub API, nên **không tự re-fetch được**. Các giá trị ở mục 3 là quan sát của điều phối viên (có mốc thời gian), được ghi lại nguyên trạng. Ai dùng ma trận này phải re-fetch trước khi dựa vào. |
| Chạy mã / môi trường | Không chạy gì (docs-only, R0). Không ghi vào Northflank. |

Quy ước "đã chứng minh": chỉ test có trong repo (tên tệp) và CI của **đúng SHA** mới tính là bằng chứng CODE/CI. Không nhúng SHA của chính commit chứa tài liệu này.

## 1. Bốn lớp bằng chứng (không được trộn)

| Lớp | Ý nghĩa | Ví dụ ở đây |
| --- | --- | --- |
| CODE/CI | Mã + test + CI xanh của đúng SHA | Cơ chế SMTP/outbox (#82), sửa test (#85), audit nguồn (#80) |
| DEV runtime mới | Quan sát tươi trên môi trường Northflank DEV hiện có, có thời điểm | Chưa có. Số đếm có xác thực của #78: `UNKNOWN` |
| MISSING_SOURCE | Khách chưa cung cấp tư liệu/quyết định | Dữ kiện công ty, ảnh + quyền, hộp thư nhận, GA4 |
| Khách duyệt / production-bàn giao tương lai | Người ký của BMSL; bàn giao thật | Nghiệm thu, đào tạo, domain chính thức |

CODE/CI xanh **không** chứng minh Northflank đã cấu hình hay email đã gửi tới hộp thư.

## 2. Đặt tên môi trường

Môi trường Northflank hiện tại là **DEV (bản nháp, chủ đã cho phép nhập vào)**, không phải production. Chủ nêu hướng này trong Issue #78 (được trích lại trong Issue #96; Builder chưa đọc lại nguyên văn). Mọi chỗ trước đây gọi môi trường hiện tại là "production" trong ma trận này đã đổi thành "DEV". Từ "production" chỉ dùng cho tương lai: domain chính thức, nội dung công khai đã duyệt, bàn giao. Riêng `uat-handover-matrix.md` chưa được sửa trong Issue này; nếu còn chữ "production" chỉ môi trường hiện tại thì cần một task tài liệu riêng.

Phân biệt nội dung: **nguồn** (tư liệu khách cung cấp) ≠ **lưu trữ** (archive legacy `LEGACY-SOURCE`) ≠ **nháp** (trong CMS DEV, chưa công khai) ≠ **đã xuất bản** (công khai, đã duyệt). Nhập toàn bộ archive vào DEV là việc phát triển bổ sung do chủ yêu cầu, khác với tập chọn lọc xuất bản ban đầu.

## 3. Bằng chứng GitHub do điều phối viên quan sát (2026-10-08)

Chưa được Builder re-fetch. Dùng làm liên kết ngoài, không phải bằng chứng của tài liệu này.

| Mục | Quan sát | Ý nghĩa |
| --- | --- | --- |
| `main` | `5131e599d24328655b977fa7092d0b228e4efd18` | CI cùng SHA: run `37615468154`, `verify` + `integration` success. Chỉ chứng minh CODE/CI cho SHA đó |
| #80 audit nguồn, #82 cơ chế SMTP/outbox, #85 sửa test, #86 ma trận cũ | Đã đóng/merge | Cơ chế + CI. **Không** chứng minh Northflank đã cấu hình hay email đã giao |
| #78 | Mở rộng thành nhập bản nháp từ nguồn hiện có vào Northflank **DEV** do chủ cho phép; không phải production | Số đếm có xác thực: `UNKNOWN` |
| PR #93 | Đầu hiện tại `d7e2e4f`, CI run `37717635686` là `ACTION_REQUIRED` | Không có tuyên bố xanh cho head hiện tại |
| #84 | Đang khởi chạy sửa và chứng minh độc lập 8 trang bằng dữ liệu tổng hợp | Nguồn thật và xuất bản vẫn là việc riêng |
| #83, #81, PR #79 | Builder không có trạng thái sống | `NOT_PROVEN`; re-fetch |

## 4. Ma trận theo trang và CTA (8 trang)

| Trang | Nội dung theo hợp đồng (tóm tắt) | CTA | Mã/test hiện có (CODE) | Chủ / phụ thuộc | Trạng thái |
| --- | --- | --- | --- | --- | --- |
| Trang chủ | Thông điệp, số liệu năng lực, giấy phép, dự án tiêu biểu | Nhận hồ sơ năng lực | IA `docs/blueprint/05-ia-wireframes.md`; `tests/integration/http-smoke.test.ts` | #84 (sửa/chứng minh tổng hợp); nội dung thật MISSING_SOURCE | Số liệu/giấy phép `UNCONFIRMED` |
| Giới thiệu | Lịch sử 5 năm, đội ngũ, năng lực pháp lý, văn hoá | Xem dự án | như trên | #84; MISSING_SOURCE | `UNCONFIRMED` |
| Dịch vụ | Vận hành, bảo vệ/an ninh, vệ sinh, PCCC; phạm vi/quy trình/cam kết | Đăng ký khảo sát | như trên | #84; BMSL mô tả 4 lĩnh vực | MISSING_SOURCE |
| Dự án | Vị trí, quy mô, ảnh thật, ngày vận hành, phản hồi BQT | Đăng ký tham quan | `tests/integration/legacy-seed.test.ts`, `docs/blueprint/03` | #78 (nhập nháp DEV), #84; quyền ảnh MISSING_SOURCE | 17 hồ sơ nháp `LEGACY-SOURCE`; chưa xuất bản |
| Quy trình & Minh bạch | Tiếp nhận 30 ngày, mẫu báo cáo thu chi, khung giá QĐ33 | Tải báo cáo mẫu | `docs/blueprint/05` | #84; tệp tài liệu MISSING_SOURCE | `UNCONFIRMED` |
| Kiến thức & tin tức | 5 chuyên mục: pháp lý / phí / kỹ thuật / an toàn / tin công ty | Tư vấn | `seo-content.test.ts`, `docs/blueprint/04` | #78, #84; BMSL chốt tên + bài | `selectionApproved=false` |
| Tuyển dụng | Vị trí, lương, quyền lợi, video nhân viên nếu có | Ứng tuyển qua Zalo | `docs/blueprint/05` | #84; BMSL cung cấp | Tin cũ `LEGACY-SOURCE` đang ẩn |
| Liên hệ | Form, hotline, Zalo, bản đồ trụ sở | Gửi yêu cầu | `payload.test.ts`, `http-smoke.test.ts` (lead lưu bền trước hiệu ứng phụ) | #82 (cơ chế, đã đóng); cấu hình Northflank + hộp thư nhận chưa chứng minh | Giá trị liên hệ `UNCONFIRMED` |

"120 bài SEO" là chiến lược năng lực/nội dung, **không** phải nghĩa vụ đầu vào ban đầu.

## 5. Trần đầu vào ban đầu

Đây là **trần**, không phải tối thiểu; không bịa số lượng cho đủ.

| Hạng mục | Trần | Hiện có (nguồn) | Ghi chú |
| --- | --- | --- | --- |
| Hồ sơ dự án | ≤21 | 17 nháp `LEGACY-SOURCE` | Chưa xuất bản mục nào; BMSL duyệt |
| Ảnh mỗi dự án | ≤10 | Chưa nhận | Cần quyền dùng ảnh (không đưa vào Git) |
| Chuyên mục | 5 | Tên do BMSL chốt | Không tự đặt tên mới thay hợp đồng |
| Bài đầu BMSL cung cấp | ≤10 | 0 được duyệt | Phân biệt với bài archive nhập DEV |
| Tuyển dụng | ≤5 | Chưa nhận | |
| Tài liệu tải về | ≤5 | Chưa nhận | |

Nhập toàn bộ archive vào DEV là phát triển bổ sung do chủ yêu cầu (#78), không thay đổi các trần trên cho tập xuất bản ban đầu.

## 6. Yêu cầu kỹ thuật và bàn giao

| CASE | Yêu cầu | CODE hiện có | NOT_PROVEN (DEV runtime / khách duyệt) | Issue |
| --- | --- | --- | --- | --- |
| T-01 | Thiết kế tuỳ biến, responsive, tiếng Việt | `docs/blueprint/05` | Trên nội dung thật, thiết bị thật | #84 |
| T-02 | Chrome/Safari/Edge/Firefox hiện hành trên Windows/macOS/iOS/Android | Chromium/Firefox/WebKit tự động (`docs/security/W5B4-browser-uat.md`, lịch sử) | Safari, Edge thương hiệu, thiết bị thật | `NOT_PROVEN` |
| T-03 | CMS thêm/sửa/xoá bài, dự án, tuyển dụng, banner, tải về; vai trò ≥ ADMIN/EDITOR | `docs/handover/huong-dan-cms.md` | Đăng nhập ADMIN/EDITOR trên DEV | #78 |
| T-04 | URL thân thiện, title/description từng trang/bài, sitemap, robots, structured data cơ bản, tối ưu ảnh | `seo-content.test.ts`; JSON-LD có điều kiện, noindex | Trên nội dung thật đã duyệt | `NOT_PROVEN` |
| T-05 | GA4 + Search Console; sự kiện điện thoại/Zalo/form/tải về | Analytics giả lập + đồng ý trước khi tải GA4 | Property thật, quyền GSC, chính sách cookie | MISSING_SOURCE |
| T-06 | HTTPS, chống spam, sao lưu tự động nếu host hỗ trợ | `http-smoke.test.ts`; `scripts/backup/`, `backup-restore.test.ts`, `docs/runbooks/backup-restore.md` | TLS domain chính thức; sao lưu off-site; restore thử | `NOT_PROVEN` |
| T-07 | Tối ưu hiệu năng (phụ thuộc hosting) | — | Chưa đo | `NOT_PROVEN` |
| T-08 | Form liên hệ gửi email | Cơ chế SMTP/outbox (#82, `docs/runbooks/lead-email.md`) | Email thật tới hộp thư test rồi chính thức; Northflank chưa chứng minh đã cấu hình | `NOT_PROVEN` |
| H-01 | Bàn giao: ADMIN cao nhất, sao lưu mã nguồn + CSDL, hướng dẫn sử dụng | `huong-dan-cms.md`, `docs/runbooks/van-hanh.md` | Chuyển giao thật; chỉ là tương lai | `NOT_PROVEN` |
| H-02 | Một buổi đào tạo ≤2 giờ | Chương trình `huong-dan-cms.md` §9–§10 | Chưa diễn ra | `NOT_PROVEN` |
| H-03 | Lịch 4 giai đoạn: IA 5 ngày / thiết kế 10 / dựng + nhập đầu vào 12 / kiểm thử + bàn giao 3; tổng 30 ngày làm việc | — | Cửa sổ khách xem xét/duyệt **không** ngụ ý đã nghiệm thu; không khẳng định hạn chót | — |
| H-04 | Dữ kiện do khách xác nhận (công ty, giấy phép, cam kết) | Giữ `UNCONFIRMED` (`07-open-questions.md`) | Toàn bộ chưa xác nhận | MISSING_SOURCE |

## 7. Điểm không nhất quán (lịch sử từ bản đầu, chỉ để các bên ký quyết định)

Không đề xuất cách giải quyết; điều phối viên chưa xác nhận các điểm này trong Issue #96. `NOT_PROVEN` cho tới khi đối chiếu văn bản gốc.

1. Điều 4: 10 ngày làm việc; Phụ lục 02: 30 ngày (xem C1 trong `07-open-questions.md`).
2. Điều 3.3: số tiền bằng số và bằng chữ khác nhau.
3. Điều 1.5 dẫn chiếu 18.3, có vẻ phải là 17.3.
4. Điều 3.2 dẫn chiếu Điều 7, trong khi thay đổi phạm vi ở Điều 6.
5. Thông tin pháp lý của các bên còn để trống.
6. Chưa rõ bản ký cuối hay bản nháp.

## 8. Gói yêu cầu đầu vào gửi BMSL

Không đưa số điện thoại, email, địa chỉ hay dữ liệu cá nhân vào Git; BMSL gửi qua kênh riêng, repo chỉ ghi "đã nhận / chưa nhận".

| Trang | BMSL cần cung cấp | Trạng thái |
| --- | --- | --- |
| Toàn site | Tên công ty chính thức, logo, màu, phông | Chưa nhận |
| Trang chủ | Thông điệp, số liệu năng lực, giấy phép, dự án tiêu biểu đã duyệt | Chưa nhận |
| Giới thiệu | Lịch sử, đội ngũ, năng lực pháp lý, văn hoá | Chưa nhận |
| Dịch vụ | Mô tả 4 lĩnh vực, quy trình, cam kết | Chưa nhận |
| Dự án | Duyệt công khai trong các hồ sơ (≤21), ảnh (≤10/dự án), quyền ảnh, ngày vận hành, phản hồi BQT | Chưa nhận |
| Quy trình & Minh bạch | Quy trình 30 ngày, báo cáo thu chi mẫu, khung giá QĐ33, tài liệu (≤5) | Chưa nhận |
| Kiến thức & tin tức | 5 tên chuyên mục, ≤10 bài đầu | Chưa nhận |
| Tuyển dụng | ≤5 vị trí: lương, quyền lợi, hạn nộp, video nếu có, kênh Zalo | Chưa nhận |
| Liên hệ & vận hành | Địa chỉ, hotline, Zalo, hộp thư nhận form, bản đồ; cookie/dữ liệu cá nhân; GA4 + GSC; domain, host, sao lưu | Chưa nhận |

## 9. Các bước DEV → bàn giao (chạy sau khi có nội dung duyệt)

Mọi bước ghi SHA chính xác, thời điểm và loại bằng chứng. Không có biên bản nào được tạo ở đây.

| Bước | Việc | Loại bằng chứng | Kết quả |
| --- | --- | --- | --- |
| 1 | Ghi SHA triển khai lên DEV và CI `verify` + `integration` của đúng SHA | URL run CI | `NOT_PROVEN` |
| 2 | Số đếm có xác thực của nội dung nhập DEV (#78) | Số đếm + thời điểm | `UNKNOWN` |
| 3 | Điều hướng 8 trang + SEO trên nội dung thật | Ảnh chụp/ghi chú | `NOT_PROVEN` |
| 4 | Gửi form tới hộp thư test; lead đã lưu trong CSDL | Ảnh hộp thư (che PII) + xác nhận dòng lead | `NOT_PROVEN` |
| 5 | CMS: ADMIN và EDITOR; cổng quyền ảnh và `CONFIRMED` | Ghi chú theo vai trò | `NOT_PROVEN` |
| 6 | GA4: đồng ý trước khi tải, sự kiện điện thoại/Zalo/form/tải về | Báo cáo realtime | `NOT_PROVEN` |
| 7 | Trình duyệt/thiết bị | Bảng kết quả | `NOT_PROVEN` |
| 8 | Sao lưu + restore thử, rồi từ bản off-site | Biên bản restore | `NOT_PROVEN` |
| 9 | Domain chính thức + TLS (production tương lai) | Kết quả kiểm tra | `NOT_PROVEN` |
| 10 | Đào tạo (≤2 giờ) | Biên bản có chữ ký | `NOT_PROVEN` |
| 11 | BMSL ký nghiệm thu | Văn bản ký | `NOT_PROVEN` — chỉ con người ký |

## 10. Theo dõi và phát hành

- Điều phối #81. Chủ sở hữu Issue theo mục 4 và 6; cập nhật khi trạng thái sống được xác minh.
- Northflank CD gốc có thể phát hành khi có push lên `main`; cần phê duyệt riêng của chủ trước khi merge. Issue này không merge hay triển khai.

## PROVEN

- Tài liệu chỉ ghi lại yêu cầu do điều phối viên cung cấp; các tệp/test được nêu là tên tệp trong repo (chưa chạy lại trong Issue này).

## NOT_PROVEN

- Nội dung hợp đồng gốc (Builder không truy cập), ký/thanh toán/hạn chót.
- Trạng thái sống của #78/#81/#83/#84, PR #79/#93, SHA `main` và CI: Builder không re-fetch được; các giá trị là quan sát của điều phối viên.
- Cấu hình Northflank, email thật đã giao, số đếm DEV có xác thực, mọi runtime, khách duyệt và nghiệm thu.
