# Rà soát trải nghiệm public 8 khu vực + bằng chứng bàn giao (2026-10-19)

Điều phối #81 · hiệu chỉnh ma trận #96/PR #99 · bằng chứng cho #105, #109 · đánh giá PR #98.

Trạng thái: **bằng chứng quan sát, không phải nghiệm thu của BMSL.** Tài liệu không sửa dữ liệu CMS, secret, hạ tầng hay production. Mọi phép đo là đọc ẩn danh (GET) vào website DEV.

## 0. Phạm vi và cách đo

| Mục | Giá trị |
| --- | --- |
| Thời điểm quan sát | 2026-10-19 |
| `main` quan sát (GitHub live) | `87e6498aa902ce687aa0380f6f5728f41be9169d` |
| Website DEV | `https://app.binhminhsonglo.dynv6.net` (Northflank; host mặc định `code.run` cũng phục vụ cùng nội dung) |
| SHA đang chạy trên DEV | **`NOT_PROVEN`** (`/healthz` chỉ trả `{"status":"ok"}`, không có SHA). Chỉ suy ra được: DEV chạy mã có nhãn nav "Tin tức" (PR #117) và Hero editorial (PR #108/#111/#114), nên chứa PR #107 theo quan hệ tổ tiên git |
| Công cụ | Chromium (DevTools) emulation 390×844 DPR2 và 1440×900; Lighthouse navigation (Accessibility/Best Practices/SEO; công cụ không chạy Performance); `PerformanceObserver` cho LCP/CLS; `curl` cho trạng thái HTTP/header |
| Giới hạn | Một lần chạy mỗi trang, DEV lạnh; LCP là chỉ báo, không phải ngân sách pass/fail. **Chưa chạy**: Safari/Edge thương hiệu, thiết bị thật, đọc màn hình thật, gửi form thật (tránh tạo lead trên DEV) |
| Figma | Tài khoản phiên này **không có quyền** đọc `ehS8iWatCVz8FWhqPo3lur` qua MCP; so khớp Hero dựa trên đặc tả bằng chữ của Issue #113 (§3) và ảnh chụp, **không** so pixel với Figma |

## 1. Ma trận 8 khu vực (trạng thái public thực tế)

HTTP: cả 8 route `200`. Crawl 74 đường dẫn nội bộ (sitemap + liên kết trên các trang): **0 liên kết 404**. `CLS = 0` và không tràn ngang ở 390px trên cả 8 trang.

| Khu vực | Route | LCP mobile (ms) | Phân loại vấn đề |
| --- | --- | --- | --- |
| Trang chủ | `/` | 2012 (ảnh Hero); desktop 3140 | **Nội dung**: `[MẪU]` tiêu đề/lời dẫn, noindex; `UNCONFIRMED` ở thẻ dịch vụ. **Giao diện**: ổn. **Hiệu năng**: §4 |
| Giới thiệu | `/gioi-thieu` | 420 | **Nội dung**: chỉ có `[MẪU]` + khung; chưa có lịch sử/đội ngũ/pháp lý. CTA hợp đồng "Xem dự án": **thiếu** (`FRONTEND_GAP`) |
| Dịch vụ | `/dich-vu` | 720 | **Nội dung**: 4 dịch vụ thật có mô tả `UNCONFIRMED: chờ BMSL xác nhận nội dung.` + 4 bản `[MẪU]` trùng. **Giao diện**: ổn |
| Dự án | `/du-an` | 2524 | 21 thẻ công khai = 17 hồ sơ cũ + 4 `[MẪU]`. Ảnh hiển thị. **Nội dung/quyền**: dự án do con người chuyển `CONFIRMED`, chưa thấy văn bản duyệt (#78). CTA "Đăng ký tham quan": **thiếu** |
| Quy trình & Minh bạch | `/quy-trinh-minh-bach` | 424 | **Nội dung**: `[MẪU]` + 5 tài liệu thật + 1 tài liệu mẫu; noindex. Liên kết tải về hoạt động (GET `200`, xem ghi chú HEAD ở §6). Thiếu quy trình 30 ngày, báo cáo thu chi mẫu, khung QĐ33 do BMSL cung cấp |
| Tin tức | `/kien-thuc` | 1312 | Menu "Tin tức", tiêu đề trang vẫn "Kiến thức & tin tức" (không nhất quán nhẹ). 5 chuyên mục đều `mau-chuyen-muc-*`; 15 bài cũ nằm trong chuyên mục mẫu; 4 bài mới chưa có chuyên mục, mở ở `/kien-thuc/bai-viet/<slug>` |
| Tuyển dụng | `/tuyen-dung` | 420 | Chỉ 1 tin `[MẪU]` (hạn 7/10/2027). CTA "Nộp hồ sơ qua Zalo": **thiếu** (chưa có `SiteSettings.zalo`) |
| Liên hệ | `/lien-he` | 608 | Form đủ 7 trường có nhãn; honeypot ẩn ngoài màn hình (`left:-10000px`, `tabindex=-1`). **Không có hotline, Zalo, email, địa chỉ, bản đồ**: `SiteSettings` chưa có dữ kiện duyệt (`MISSING-SOURCE`); mã cho việc này nằm ở PR #93, không thuộc phiên này |

## 2. Lỗi giao diện hay nội dung?

**Lỗi giao diện (UI) có bằng chứng**: không có lỗi chặn. Chỉ có điểm nhỏ:

1. Menu mobile là `<details>/<summary>`; thử `Escape` bằng sự kiện tổng hợp không đóng menu. `NOT_PROVEN` vì không dùng bàn phím thật; nếu đúng, là cải tiến a11y mức thấp.
2. Ô honeypot không có `aria-hidden` ở chính ô nhập (container ngoài màn hình, `tabindex=-1`); mức thấp.
3. Tiêu đề trang "Kiến thức & tin tức" so với menu "Tin tức".
4. 25 liên kết/nút nhỏ hơn 44px trên trang chủ mobile (chủ yếu menu/chân trang); cần xem xét, không vi phạm mục tiêu tối thiểu 24px của WCAG 2.2 AA khi chưa đo từng phần tử.

**Nội dung Payload (không phải lỗi UI)**: nhãn `[MẪU]` (tiêu đề + lời dẫn Trang chủ/Giới thiệu/Quy trình/Liên hệ), `UNCONFIRMED` (4 dịch vụ), dự án/dịch vụ/chuyên mục/tuyển dụng/tài liệu mẫu, alt ảnh Hero là `"anh test"`, ảnh/tài liệu cần xác nhận quyền, bài viết chưa được BMSL duyệt.

**Điểm tốt đã quan sát**: mọi trang có đúng một `h1`, mọi `<img>` có `alt`, skip link `#main` có đích, Lighthouse Accessibility = 100 và Best Practices = 100 (Trang chủ, mobile + desktop), độ tương phản Hero ≥ 9.9:1, header bảo mật (CSP, HSTS, `X-Frame-Options`). Điểm SEO 69 chỉ do `noindex` có chủ đích trên trang `[MẪU]` (kiểm `is-crawlable`); đó là hành vi thiết kế, không phải lỗi.

## 3. Hero Architectural Editorial so với đặc tả Figma (Issue #113)

| Yêu cầu | Quan sát trên DEV | Kết quả |
| --- | --- | --- |
| Đường kẻ dọc desktop (`border-left` 1px + `padding-left` 2.5rem) | `0.8px solid rgb(203,213,225)`, padding 40px | Khớp |
| Bo góc nút 2px | primary 2px, secondary 2px | Khớp |
| Serif có đủ glyph tiếng Việt | `Noto Serif, Source Serif 4, Palatino Linotype, Book Antiqua, Times New Roman, serif`; ảnh chụp "MẪU", "chủ" hiển thị đúng dấu | Khớp (`Georgia` đã bỏ; thứ tự phông khác issue) |
| Mobile: nút trước, ảnh sau | Đúng ở 390px | Khớp theo quan sát |
| Biến thể không ảnh | Có test trong `HeroSection.test.ts`; DEV hiện có ảnh nên **không** kiểm trực tiếp | `NOT_PROVEN` trên DEV |

Ảnh Hero DEV: `thiet-ke-toa-nha-van-phong-hien-dai-cao-31-tang-giua-do-thi-lia-building-1.jpg`, alt `"anh test"`; media `rightsStatus=APPROVED` trong CMS nhưng **nguồn và người duyệt không có trong repo** (`MISSING-SOURCE`/`OWNER-DECISION`). Ảnh trong Figma chỉ là minh hoạ, không phải ảnh được duyệt (#110).

## 4. Hiệu năng quan sát (chỉ báo)

- Ảnh LCP Hero: JPEG gốc 1280×945, ~275 KB, **không `srcset`/`sizes`**, phục vụ qua `/api/media-assets/file/…` **không có `Cache-Control`**; một lần tải trên DEV đo 2.5 s (thời gian xử lý máy chủ 8 ms). HTML trả `no-store`.
- Đề xuất (cần Issue R1 riêng, không làm ở đây): biến thể ảnh (`imageSizes`/`next/image`) và header cache cho media đã APPROVED. Không chặn UAT.

## 5. Issue #105 — bài đã Publish nhưng chưa có chuyên mục

| Tiêu chí Acceptance | Bằng chứng | Mức |
| --- | --- | --- |
| Bài published không chuyên mục hiển thị ở list + chi tiết, URL ổn định | Live 2026-10-19: `/api/articles` có 4 bài published `category=null` (id 17–20); `/kien-thuc/bai-viet/binh-minh-song-lo-tren-bao-chi` và `/kien-thuc/bai-viet/bo-tieu-chuan-quan-ly-van-hanh` trả `200`, canonical dạng `/kien-thuc/bai-viet/<slug>` | DEV-RUNTIME-PROVEN |
| Bài có chuyên mục giữ URL cũ, không có bản trùng | `/kien-thuc/mau-chuyen-muc-1/van-hoa-doanh-nghiep-…` `200`; cùng slug dưới `/kien-thuc/bai-viet/…` trả `404` | DEV-RUNTIME-PROVEN |
| Exact-head CI + Reviewer PASS | PR #107 head `f6dad74521bb1bdc6fefa7994cb4cd54d64b34e4`: CI `verify`+`integration` thành công, run `37759198441` (điều phối viên); Reviewer PASS run `37763255193` (bình luận `nexagnet-autopilot-v4`, `risk=R2`) | CI-PROVEN |
| Exact-main CI | Merge `7fba1370dd4f2d1f4b4d1ccc3de79c531a996284`, run `37795407982`: `integration`=success, `verify`=success; commit này là tổ tiên của `main` hiện tại | CI-PROVEN |
| Draft không lộ; cổng quyền ảnh không đổi | Phủ bằng test trong PR #107; **không** kiểm bản nháp trên DEV (không có quyền ADMIN) | CODE-PROVEN; DEV `NOT_PROVEN` |
| SHA triển khai bất biến trên Northflank | Không đọc được từ phiên này | `NOT_PROVEN` |

Kết luận: các tiêu chí hành vi đã được chứng minh ở exact-main và runtime DEV; chỉ còn thiếu nhãn SHA triển khai bất biến, được thay bằng suy luận theo quan hệ tổ tiên. **Đề xuất cho điều phối viên: đóng #105** kèm bảng này (PROVEN/NOT_PROVEN). Không code lại.

Ngoài phạm vi #105: 4 bài mới (id 17–20) đang công khai kể cả qua `/api/articles`; quyết định cho phép công khai và phân loại là **OWNER-DECISION** (#78).

## 6. Issue #109 — canonical, sitemap, noindex

Quan sát 2026-10-19 (không đổi so với 2026-10-08):

- Mọi trang public trên `app.binhminhsonglo.dynv6.net` có `<link rel="canonical">` trỏ `https://http--bmsl-web--wkbbfyv6gcrp.code.run/…`.
- `/sitemap.xml`: 54 URL, toàn bộ host `code.run`, không `lastmod`; vắng `/`, `/gioi-thieu`, `/quy-trinh-minh-bach`, `/lien-he` do 4 trang này `noindex` (đúng thiết kế).
- `/robots.txt`: `Allow: /`, `Disallow: /admin`, `Disallow: /api`; **không có dòng `Sitemap:`**.
- Hai host cùng phục vụ nội dung (không chuyển hướng); chỉ trang singleton `[MẪU]` mang `noindex`; `/du-an`, `/dich-vu`, `/kien-thuc` và trang chi tiết **không** `noindex`, kể cả khi còn mục `[MẪU]`.
- Mã: `getSiteUrl` lấy `SITE_URL`; không có công tắc "DEV không index" cấp site. Giá trị `SITE_URL` thực tế trên Northflank: **không đọc, không suy** (secret/env).

Phương án cho chủ sở hữu (không tự chọn tên miền chính thức):

| Phương án | Nội dung | Ưu | Nhược / điều kiện |
| --- | --- | --- | --- |
| A | Tên miền chính = `app.binhminhsonglo.dynv6.net` (đang chạy) | Ít thay đổi; chỉ đặt `SITE_URL` | Là tên miền DEV dynv6, không phải thương hiệu; đổi domain sau này sẽ đổi canonical lần nữa |
| B | Chính thức = `binhminhsonglo.vn` (tên miền cũ) | Giữ SEO/thương hiệu, khớp 47 luật redirect WordPress | Cần quyền DNS/TLS và di chuyển; không coi DEV là production; DEV cần `noindex` riêng |
| C | Tên miền khác do chủ chọn | — | Như B |
| DEV | Giữ DEV không index (cần mã mới: công tắc env trả `noindex` toàn site và robots `Disallow: /`) | Tránh DEV bị lập chỉ mục khi còn `[MẪU]` | Cần Issue R1/R2 riêng; không làm khi chưa có quyết định |

Chủ cần quyết (theo #109): (1) tên miền chính; (2) DEV có được index không; (3) có chuyển hướng host `code.run` về tên miền chính không (thay đổi hạ tầng R3). Sau quyết định mới mở Issue triển khai (`SITE_URL`, test hai host, dòng `Sitemap:` trong robots).

Ghi chú: `HEAD` tới `/api/media-assets/file/*` trả `404` còn `GET` trả `200`; công cụ kiểm liên kết dùng `HEAD` sẽ báo sai "link 404". Không phải lỗi người dùng.

## 7. PR #98 — phần còn giá trị

PR #98 (draft, đáy `5131e59`, `CONFLICTING`, không có check, 13 tệp +576/−19). `git merge-tree` với `main` hiện tại: xung đột ở `src/app/(frontend)/page.tsx` (Hero đã thay phần mở đầu trang chủ).

| Phần của PR #98 | Trạng thái so với `main` | Đề xuất |
| --- | --- | --- |
| `docs/handover/editorial-readiness-matrix.md` | Chưa có trên `main`; đã lỗi thời (nói "bài không có chuyên mục bị loại", "chưa phát hiện lỗi hiển thị", Hero chưa tồn tại) | Không merge nguyên; phần còn đúng (gói BMSL cần cung cấp theo trang) đã nằm ở ma trận hợp đồng §7 |
| `src/lib/editorial-readiness.test.ts` | Có phép kiểm `toArticle` loại bài không có chuyên mục published → **mâu thuẫn với #107**, sẽ đỏ trên `main` | Giữ phép kiểm còn đúng (17/21 dự án, 15 ứng viên backlog, 8 route, sitemap), sửa phép kiểm bài viết theo #107 |
| `tests/integration/support/editorial-blocks.ts`, mở rộng `smoke-fixture.ts`, `http-smoke.test.ts` | Chưa có trên `main`; là phần giá trị nhất (luồng ADMIN/EDITOR tạo nháp → xuất bản → thu hồi ảnh, 3 trình duyệt) | PR riêng từ `main` hiện tại, chạy CI tích hợp (cần Postgres + Playwright; không chạy được trên Windows) |
| CTA hợp đồng: `site.ts`, `page.tsx` (hồ sơ năng lực), `gioi-thieu`, `du-an/[slug]`, `tuyen-dung/[slug]` | CTA thiếu đã **xác minh trên DEV** (§1) | PR riêng, viết lại trên `main` hiện tại |
| `ContactForm.tsx`, `request-type.ts(+test)` (điền sẵn `?context=`/`?project=`) | `request-type.ts` và test đã có trên `main`; phần `contextMessageFromSearch` là mới | **Không tách ở đây**: vùng Contact/CMS của PR #93; chờ PR #93 |

Đề xuất: không merge PR #98; đóng sau khi các phần trên có PR kế nhiệm. Hai PR kế nhiệm từ `main` hiện tại: (A) test tích hợp editorial, R1; (B) CTA hợp đồng, R1/R2.

## 8. Bảng chặn bởi dữ liệu đầu vào của BMSL/chủ (quyết định, không sửa thay)

| # | Vấn đề | Ai quyết | Trạng thái |
| --- | --- | --- | --- |
| 1 | Tên miền chính thức, DEV có index hay không (#109) | Chủ | `OWNER-DECISION` |
| 2 | Hotline, Zalo, email nhận form, địa chỉ, tọa độ bản đồ | BMSL | `MISSING-SOURCE` |
| 3 | SMTP, người gửi đã xác minh, hộp thư nhận lead; email thật tới hộp thư thực tế | BMSL + chủ | `MISSING-SOURCE`; runtime `NOT_PROVEN` |
| 4 | Chính sách cookie/dữ liệu cá nhân (chưa có route nào trong mã), mã GA4, quyền GSC | BMSL | `MISSING-SOURCE`; runtime `NOT_PROVEN` |
| 5 | Nội dung Trang chủ, Giới thiệu, Quy trình, Liên hệ còn `[MẪU]`; mô tả 4 dịch vụ còn `UNCONFIRMED` | BMSL | `MISSING-SOURCE` |
| 6 | 5 chuyên mục chính thức và ≤10 bài; cho phép công khai 4 bài mới (id 17–20) | BMSL/chủ | `OWNER-DECISION` |
| 7 | 17 dự án đã `CONFIRMED`/published do ai, văn bản duyệt đâu; quyền ảnh/tài liệu (hồ sơ năng lực PDF, giấy ISO, khảo sát cư dân, ảnh Hero "anh test") | BMSL/chủ | `MISSING-SOURCE`/`OWNER-DECISION` |
| 8 | Xoá 5 slug mẫu trên DEV, các mẫu còn lại, sao lưu mới trước khi xoá (#78) | Chủ | `OWNER-DECISION` |
| 9 | Quyền ADMIN/EDITOR thật, luồng nháp → xuất bản trên DEV | Chủ | `NOT_PROVEN` (cần phiên ADMIN) |
| 10 | Sao lưu off-site + restore thử | Chủ/host | `NOT_PROVEN` |
| 11 | Đào tạo ≤ 2 giờ, bàn giao quyền cao nhất, ký nghiệm thu | BMSL/chủ | Chưa diễn ra |
| 12 | Tài liệu nội bộ `assets/tai-lieu` trong repo công khai (#118/#119, phiên khác) | Chủ (R3) | `OWNER-DECISION`, ngoài phạm vi tài liệu này |

## PROVEN

- Cả 8 route trả `200`; 74 đường dẫn nội bộ không có `404` (GET, 2026-10-19).
- Hành vi #105 trên DEV; CI exact-main `37795407982` thành công cho `7fba137…`, tổ tiên của `main` `87e6498…`.
- Canonical/sitemap trên DEV vẫn trỏ host `code.run`; `robots.txt` không có dòng `Sitemap:`.
- Hero khớp các thuộc tính CSS ghi trong Issue #113; Lighthouse Accessibility/Best Practices = 100 trên Trang chủ.
- PR #98 xung đột với `main` ở `page.tsx`; một phép kiểm trong PR mâu thuẫn với #107.

## NOT_PROVEN

- SHA triển khai bất biến của DEV; so pixel với Figma; Safari/Edge/thiết bị thật; đọc màn hình; luồng form + email thật.
- Bản nháp ẩn trên DEV, vai trò ADMIN/EDITOR, sao lưu off-site, GA4/GSC, đào tạo, nghiệm thu của BMSL.
- Nguồn/người duyệt của ảnh, tài liệu và 17 dự án đang công khai.
