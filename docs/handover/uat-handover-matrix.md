# Ma trận UAT / bàn giao W5C và danh sách sẵn sàng phát hành

Trạng thái: **sẵn sàng kỹ thuật, chưa bàn giao.** Sẵn sàng kỹ thuật không bằng khách hàng nghiệm thu và không bằng bàn giao production hoàn tất.
Mọi mục cần dữ liệu/bằng chứng thật mà chưa có đều ghi `NOT_PROVEN`; không có ký nhận, bàn giao hay hoàn thành nào được bịa ra.

## 1. Mốc bằng chứng chính xác

| Mục | Giá trị |
| --- | --- |
| BASE của W5C | `main` = `f363129eeb8b28cdcded76f8f81c9c6be9f94b13` (merge PR #51) |
| CI chính xác trên BASE | run `37357834196`: job `verify` **và** `integration` PASS (kiểm ngày 2026-10-05 UTC) |
| Chuỗi phụ thuộc đã merge | #23 (PR38), #35 (PR40), #36 (PR42), #37 (PR48), sửa lỗi #49 (PR51) |
| PR51 (head `4530bbea80a494dd9214f0f9dadbc9384908e0b2`) | CI `37356370868` PASS: 278 unit / 355 integration, 12 tệp; Reviewer tin cậy `37357329591` (attempt 2) PASS |
| HEAD W5C đầu tiên `545559aecb155266e50fd1ff288b8c997102eade` (PR **đóng, không merge**) | CI `37361065760`: verify 349 unit PASS; integration 443 PASS, 15 tệp, 411.76 s, gồm **20 test sao lưu/khôi phục thật** (CLI thật, PostgreSQL thật); toàn bộ ma trận W5B PASS. Là bằng chứng thật **chỉ cho head đó**. Bị đóng vì hai lỗ hổng an toàn P2 do review độc lập tìm ra (đích restore có thể nằm trong Git work tree/sau symlink; thông báo lỗi có thể in nguyên stderr của `pg_restore`/lỗi PostgreSQL có giá trị dòng) và một lỗi diễn đạt ("chứng minh" ghi đã tạm dừng). Run Reviewer tin cậy `37362007317` cũng yêu cầu thay đổi nhưng báo cáo không xuất bản được, nên **không** được ghi là PASS |
| HEAD của W5C đã sửa (nhánh này) | Ghi trong PR (một commit không thể chứa SHA của chính nó). Số test và CI của HEAD điền từ run CI của PR, không điền ở đây |
| CI của HEAD W5C đã sửa | **PENDING** cho tới khi chạy. Việc builder không có PostgreSQL cục bộ **không** là lý do bỏ test: `tests/integration/backup-restore.test.ts` bắt buộc chạy trong job `integration`. Chỉ CI của đúng HEAD, review độc lập và Reviewer tin cậy mới là bằng chứng mới |
| `sourceCommit` trong báo cáo sao lưu | `W5C_BACKUP_REPORT.sourceCommit` và `manifest.source.commit` là `git rev-parse HEAD` của bản checkout mà CI dùng để chạy test (commit Git được chọn làm nguồn sao lưu), **không** được khẳng định là HEAD của PR. Giá trị của head đầu tiên (`145b48f6e919d1fa570565e99a4b034cf584ffaf`) là commit của checkout CI, không phải `545559ae...` |

Chuỗi sự kiện cần giữ nguyên: PR48 (head `7587cd94...`) xanh nhưng main sau merge (CI `37354199189`) đỏ ở hai kiểm tra điều hướng Firefox/WebKit desktop; PR50 đóng không merge (CI `37355746008` rốt cuộc PASS,
không phải head lỗi thật); PR51 sửa và main `f363129` xanh. Chi tiết: `docs/security/W5B4-browser-uat.md`.

## 2. Ma trận nghiệm thu ↔ bằng chứng

| # | Tiêu chí | Bằng chứng (mã / test) | Trạng thái |
| --- | --- | --- | --- |
| 1 | 47 URL legacy đều có quyết định | `src/migration/legacy-manifest.json`: 47 mục = 46 `redirect` (301 trực tiếp) + 1 `identity` (`/` giữ HTTP 200); `legacy.test.ts`; `http-smoke.test.ts` kiểm tra mọi `activeTarget` | PROVEN trên CI chính xác của main (kỹ thuật). Đích chi tiết chưa xuất bản vẫn là fallback listing: cần BMSL duyệt (§3) |
| 2 | 18 URL dự án → 17 hồ sơ | 18 URL legacy (17 bài + `/252-2/`), #5 và #21 (Học viện Quốc phòng) gộp một hồ sơ; 17 hồ sơ nhập ở dạng **nháp, `LEGACY-SOURCE`**; không dự án nào bị mất | PROVEN (kỹ thuật). Danh sách/trạng thái thật: `NOT_PROVEN` chờ BMSL |
| 3 | Giới hạn nội dung | ≤21 hồ sơ dự án, ≤10 ảnh/dự án, 10 bài đầu, đúng 5 chuyên mục, đúng 4 lĩnh vực dịch vụ, ≤5 tuyển dụng, ≤5 tài liệu — là **giới hạn nghiệm thu**, không phải trần CMS (không có `maxRows`); `docs/blueprint/03,04,05` | Giới hạn đã ghi nhận. Nội dung thật: `NOT_PROVEN` |
| 4 | 8 luồng IA | Trang chủ, Giới thiệu, Dịch vụ, Dự án, Quy trình & Minh bạch, Kiến thức & tin tức, Tuyển dụng, Liên hệ: mỗi liên kết được **bấm thật** từ trang chủ trên 9 tổ hợp engine × kích thước (W5B4); `href` đúng IA | PROVEN trên CI (main `f363129`) |
| 5 | Lead lưu bền trước hiệu ứng phụ | `contact-submission.test.ts`, `payload.test.ts`, `http-smoke.test.ts` + W5B4: dòng PostgreSQL có trước khi trang báo thành công; lỗi lưu không tạo dòng; **W5C:** lead giả lập còn nguyên sau backup → restore và tạo lead mới được | PROVEN (kỹ thuật, tổng hợp). W5C phần restore: đã chạy thật trên head đầu tiên (đóng); head đã sửa chờ CI |
| 6 | Bảo mật vai trò / media | W5B2: ADMIN/EDITOR, bootstrap có token, quyền media `APPROVED`, thu hồi quyền, upload policy, cổng `CONFIRMED`; W5B4: đăng nhập ADMIN/EDITOR qua giao diện thật trên 3 engine, Lexical, không gọi Gravatar | PROVEN trên CI (kỹ thuật). Không phải quét virus/PDF đầy đủ |
| 7 | SEO / analytics | W5B3 (sitemap, JSON-LD chỉ khi đủ dữ kiện, noindex) và W5B4 (analytics giả lập, đồng ý trước khi tải GA4, bốn sự kiện, tham số bị lọc) | PROVEN với vận chuyển giả lập. GA4 thật, Enhanced Measurement, Search Console, chính sách cookie: `NOT_PROVEN` |
| 8 | Hiệu năng / trình duyệt | Chromium 153.0.8010.12, Firefox 155.0, WebKit 26.6 × 3 kích thước (viewport, không giả lập thiết bị): axe 0 vi phạm mọi mức ở 9 tổ hợp. Lighthouse (mô phỏng): mobile home 98/100/100/100 (perf/a11y/best/SEO) LCP 2304.4545 ms; mobile contact 99/100/100/66 LCP 1660.0246; mobile project 100/100/100/91 LCP 1662.7395; desktop home 100/100/100/91 LCP 447.4607; CLS 0; truyền tải 163600–194541 byte. Browser 292531 ms, provisioning 52430 ms, tổng integration 411.68 s | PROVEN trên CI. Safari/Edge thương hiệu, thiết bị thật, đọc màn hình: `NOT_PROVEN` |
| 9 | Build thông thường di động | `scripts/build.mjs` (Node launcher), 6 kiểm tra đơn vị; CI Linux build thường | PROVEN trên Linux CI. Build Windows production đầy đủ: **chưa chạy** (`NOT_PROVEN`) |
| 10 | Sao lưu/khôi phục thử, dữ liệu giả lập | `scripts/backup/`; `docs/runbooks/backup-restore.md` §5 | Head đầu tiên (đóng) có CI thật: 20 test sao lưu/khôi phục PASS. Head đã sửa: **PENDING** CI của đúng HEAD; không có bằng chứng PostgreSQL cục bộ vì builder không có quyền chạy PostgreSQL |
| 11 | Tài liệu bàn giao | `docs/handover/huong-dan-cms.md`, `docs/runbooks/*.md`, tài liệu này | Đã soạn (chờ BMSL/nhà vận hành xem xét) |

Kiểm toán phụ thuộc (độc lập, khoá chính xác): chỉ production `pnpm audit` = 3 mục, 0 critical, 1 high, 1 moderate, 1 low; toàn bộ lockfile 0 critical, 1 high, 3 moderate, 1 low; `undici` 7.29.1 đã vá.
High `braces` 3.0.3 còn được cài **gián tiếp qua `@payloadcms/next > sass > chokidar > braces`**, không chỉ qua Vitest/dev; điều kiện kích hoạt (chuỗi glob lồng sâu) chưa có đường tiếp cận công khai được chứng minh,
nhưng **không** tuyên bố "không bao giờ vào bundle production" khi chưa có bằng chứng bundle/call-site. Các đường production khác: `@payloadcms/db-postgres > drizzle-kit > @esbuild-kit/esm-loader > @esbuild-kit/core-utils > esbuild 0.18.20`;
`@payloadcms/next > @payloadcms/ui > @monaco-editor/react > monaco-editor > dompurify 3.4.15`. Sự hiện diện của gói ≠ khả năng khai thác; khả năng tiếp cận của DOMPurify là `NOT_PROVEN`; không có tuyên bố "không có lỗ hổng".
Không nâng cấp phụ thuộc lớn trong lát cắt này.

## 3. Danh sách xác nhận khách hàng còn mở (tất cả `UNCONFIRMED`)

Không mục nào được đăng công khai như sự thật cho tới khi BMSL xác nhận bằng văn bản. Nguồn: `docs/blueprint/07-open-questions.md`.

- [ ] **Đúng 5 tên chuyên mục bài viết** (chưa có; CMS giữ trống)
- [ ] **Danh sách 10 bài đầu được duyệt** (danh sách trong blueprint 04 chỉ là đề xuất; `selectionApproved=false`, 0 bài được tính là đã di chuyển)
- [ ] Liên hệ chính thức: địa chỉ, email, thứ tự hotline, Zalo, vị trí bản đồ (legacy ≠ hợp đồng mới)
- [ ] Bộ nhận diện thương hiệu: logo, màu, phông
- [ ] Danh sách dự án đang vận hành và trạng thái từng dự án (B10, B3, B5 không ghi trạng thái); quy mô, thời gian vận hành; số hồ sơ cho cụm nhiều toà
- [ ] Phản hồi/nhận xét BQT kèm văn bản đồng ý của người phát ngôn
- [ ] **Quyền dùng ảnh/media** và đồng ý hiển thị người trong ảnh (dự án, bài viết, nhân sự)
- [ ] Tuyển dụng: vị trí (≤5), lương, quyền lợi, hạn nộp, ngày đăng, địa điểm; các tin cũ `LEGACY-SOURCE` (nếu có) đang bị ẩn cho tới khi người vận hành xem xét
- [ ] Tài liệu giá/minh bạch (≤5 tệp) đã duyệt
- [ ] Giấy phép/năng lực pháp lý, số liệu công ty, lịch sử/đội ngũ, cam kết dịch vụ
- [ ] Có hiện "kinh doanh BĐS" hay không (`/category/kinh-doanh-bds/` đang là OWNER-DECISION)
- [ ] Hạ tầng: máy chủ/domain/host, quyền truy cập, backup của host
- [ ] Mã GA4, quyền Search Console, chính sách cookie/đồng ý
- [ ] Quy tắc lưu trữ/xoá lead; ai xem lead; EDITOR có xem lead không; có cần 2FA
- [ ] Mâu thuẫn hợp đồng C1–C4 (thời hạn, giá/VAT, mục tiêu 120 bài, liên hệ) — chủ hợp đồng quyết định

## 4. Danh sách sẵn sàng phát hành (kỹ thuật)

Đánh dấu chỉ khi có bằng chứng ở cột 3; mục không có bằng chứng giữ trống.

| ✓ | Hạng mục | Bằng chứng |
| --- | --- | --- |
| [x] | `verify` (lint, typecheck, unit, build) PASS trên BASE | CI `37357834196` |
| [x] | `integration` (PostgreSQL thật, HTTP, trình duyệt, axe, Lighthouse) PASS trên BASE | CI `37357834196` |
| [ ] | `verify` + `integration` PASS trên HEAD của PR W5C đã sửa (gồm sao lưu/khôi phục giả lập và các test âm tính mới) | điền từ CI của PR (CI của head đầu tiên `545559ae...`: `37361065760` PASS, nhưng head đó đã đóng) |
| [ ] | Reviewer tin cậy PASS trên đúng HEAD | điền từ run Reviewer của PR |
| [x] | Tài liệu: hướng dẫn CMS tiếng Việt, runbook vận hành, runbook sao lưu/khôi phục, ma trận này | thư mục `docs/handover`, `docs/runbooks` |
| [ ] | BMSL xem xét tài liệu | chưa có |

## 5. Điều kiện tiên quyết production / cutover (tách riêng; mỗi mục hiện là `NOT_PROVEN`)

Cutover cần **uỷ quyền riêng, phạm vi rõ** của chủ và đầu vào môi trường thật. Không có mục nào dưới đây được suy ra từ sự sẵn sàng kỹ thuật.

| Điều kiện | Trạng thái | Bằng chứng cần có |
| --- | --- | --- |
| Hosting và quyền truy cập đã duyệt | `NOT_PROVEN` | Quyết định hạ tầng + truy cập được cấp |
| HTTPS và domain; `SITE_URL`, `TRUSTED_ORIGINS`; HSTS chỉ sau khi HTTPS đã xác nhận | `NOT_PROVEN` | Kiểm tra trên domain thật |
| Lịch sao lưu **off-site** tại host | `NOT_PROVEN` | Cấu hình lịch + một lần khôi phục thử từ bản off-site |
| Sở hữu Search Console; cấu hình GA4 và đồng ý cookie | `NOT_PROVEN` | Xác minh quyền sở hữu; property GA4 thật; chính sách do BMSL quyết |
| Chuyển giao an toàn tài khoản ADMIN cao nhất | `NOT_PROVEN` | Biên bản chuyển giao (không ghi mật khẩu) |
| Duyệt staging bằng văn bản của BMSL | `NOT_PROVEN` | Văn bản ký |
| Bản sao lưu mã nguồn/CSDL thật đã giao cho BMSL | `NOT_PROVEN` | Biên bản giao nhận (không đính kèm gói) |
| Biên bản BMSL đã nhận đào tạo | `NOT_PROVEN` | Biên bản có chữ ký (`huong-dan-cms.md` §10) |
| Build production đầy đủ trên host thật / Windows | `NOT_PROVEN` | Log build tại môi trường đó |
| Bảo vệ chống lạm dụng ở edge/WAF, quét tệp tải lên | `NOT_PROVEN` | Quyết định hạ tầng |

Không xoá WordPress cũ, không đổi DNS, không thay đổi dữ liệu/bí mật production trong phạm vi W5C.

## PROVEN

* Công cụ sao lưu/khôi phục, định dạng lưu trữ an toàn, các kiểm tra đơn vị (83 test mới trong `pnpm test`, tổng 361 test đơn vị trong 24 tệp: chạy cục bộ trên HEAD đã sửa), lint và typecheck sạch.
* Mọi mục "PROVEN trên CI" ở §2 dựa trên run CI của main `f363129` và PR #51 như đã trích; head W5C đầu tiên (đã đóng) có CI thật `37361065760` như ghi ở §1.

## NOT_PROVEN

* Bằng chứng tích hợp sao lưu/khôi phục với PostgreSQL thật của HEAD W5C **đã sửa** (cục bộ không có PostgreSQL; chờ CI của PR), cùng review độc lập và Reviewer tin cậy trên đúng HEAD đó.
* Việc "ghi đã được tạm dừng" khi sao lưu: công cụ chỉ dựa vào lời xác nhận của người vận hành cộng hai phép kiểm tra trước/sau, không chứng minh độc lập rằng không có ghi đồng thời nào.
* Toàn bộ §3 (xác nhận khách hàng) và §5 (cutover), đào tạo thực tế, chuyển giao ADMIN, sao lưu off-site, chấp nhận bằng văn bản.
