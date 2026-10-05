# 06 — Technical blueprint (repo độc lập `nexagnet/bmsl-website`)

Quyết định **đã chốt bởi chủ** (không mở lại): website giao trước BMSL AI · chạy độc lập khi không có AI ·
không nằm ở `apps/bmsl` · repo riêng · `apps/marketing` chỉ là mẫu tham khảo · lead phải lưu **bền** trong thiết kế production
(không in-memory/JSON cục bộ).
Mục khác trong tệp này là `PROPOSAL` (đề xuất kỹ thuật của W0), kèm điều kiện kiểm ở W1.

## 1. Kiến trúc tổng thể (PROPOSAL)

| Lớp | Đề xuất | Lý do / ghi chú |
|---|---|---|
| Web + CMS | Next.js (App Router, TypeScript) + CMS nhúng cùng app, ví dụ Payload CMS | Một codebase, một deploy, admin có vai trò sẵn. `apps/marketing` đang dùng Next 15 → đồng bộ kỹ năng |
| CSDL | PostgreSQL | Lead và nội dung là dữ liệu kinh doanh → bền, backup được |
| Media | Đĩa/volume của máy chủ khách hoặc object storage tương thích S3 | Chọn theo hạ tầng khách (§8) |
| Reverse proxy/TLS | Theo máy chủ khách (Caddy/Nginx) | HTTPS bắt buộc |

**Điều kiện kiểm ở W1 (spike ngắn, ghi kết quả vào PR):** CMS đã chọn phải đạt: ≥2 vai trò, sửa được 6 loại nội dung
của hợp đồng, quản lý media, xuất bản nháp/đã đăng, chạy trên Postgres, license cho phép dùng thương mại,
bản đang được bảo trì. Nếu không đạt, chọn phương án thay thế **mà không đổi** các entity ở §3.
Phiên bản cụ thể: kiểm lại tại W1, W0 không ghi phiên bản vì không thể xác minh từ môi trường này.
Không dùng thư viện/CMS chưa kiểm license hay lịch bảo trì.

## 2. Ranh giới với nền tảng Nexagnet

- Không import từ `nexagnet-platform`, không dùng `@netviet/*`, không chia sẻ DB với Nexagent.
- Không phụ thuộc BMSL AI để build, chạy, hay nghiệm thu.
- Mã tham khảo từ `apps/marketing` (cấu trúc, SEO helper) chỉ **sao chép có chủ đích** nếu giấy phép nội bộ cho phép; không liên kết package.

## 3. CMS entities

Mọi entity có `id`, `createdAt`, `updatedAt`, `status` (`draft|published`) trừ khi nói khác. `SeoMeta` = `{title, metaDescription, ogImage?, noindex?}`.

| Entity | Giới hạn ban đầu (hợp đồng) | Trường chính |
|---|---|---|
| `Project` | ≤21 hồ sơ; ≤10 ảnh/hồ sơ | `name`, `slug`, `summary`, `address?`, `scale?` (số toà/căn, tuỳ chọn), `operatingSince?`, `services[]` → `ServiceArea`, `images[]` → `MediaAsset`, `bqtFeedback?` (có cờ `approvedBySource`), `legacyUrls[]`, `sourceStatus` (`LEGACY-SOURCE|CONFIRMED`), `seo` |
| `Article` | nhập ≤10 bài ban đầu | `title`, `slug`, `excerpt`, `body` (rich text), `category` → `ArticleCategory`, `cover?`, `publishedAt`, `legacyUrl?`, `seo` |
| `ArticleCategory` | đúng 5 | `name`, `slug`, `order` |
| `JobPosting` | ≤5 ban đầu | `title`, `slug`, `description`, `requirements`, `benefits?`, `salary?`, `deadline?`, `applyInstruction`, `seo` |
| `Document` | ≤5 tải về ban đầu | `title`, `file` → `MediaAsset`, `description?`, `category?` |
| `ServiceArea` | 4 (quản lý vận hành, bảo vệ, vệ sinh, PCCC) | `name`, `slug`, `summary`, `body`, `order`, `seo` |
| `MediaAsset` | — | `file`, `alt`, `width`, `height`, `rightsStatus` (`UNCONFIRMED|APPROVED`), `source?` |
| `HomePage`, `AboutPage`, `ProcessPage`, `ContactPage` | singleton | khối nội dung theo wireframe 05 §3, `seo` |
| `SiteSettings` | singleton | liên hệ công khai (`CONTACT_DETAILS_REQUIRES_BMSL_CONFIRMATION`), liên kết mạng xã hội, ID GA4 |
| `Redirect` | — | `from`, `to`, `type` (301) — nạp từ `redirects.json` (02) |
| `ContactLead` | không giới hạn | xem §5 |

Ràng buộc "tối đa N" là **giới hạn nghiệm thu của đợt bàn giao ban đầu**, không phải ràng buộc cứng của CMS,
trừ `ArticleCategory` (đúng 5) và `ServiceArea` (đúng 4). Kiểm số lượng bằng test nghiệm thu, không chặn BMSL sau bàn giao
— trừ khi hợp đồng nói khác (`OWNER-DECISION`).

## 4. Auth và vai trò

- Tối thiểu 2 vai trò theo hợp đồng: **ADMIN** (toàn quyền, quản người dùng, cài đặt, redirect, xem lead) và **EDITOR**
  (bài, dự án, tuyển dụng, media, tài liệu; không quản người dùng/cài đặt; xem lead: `OWNER-DECISION`).
- Đăng nhập email + mật khẩu băm mạnh; khoá tạm sau nhiều lần sai; phiên có hạn; khuyến nghị 2FA cho ADMIN (PROPOSAL).
- Bàn giao: tài khoản ADMIN cao nhất cho BMSL. Không có tài khoản/mật khẩu mặc định trong repo; bí mật qua biến môi trường, không commit.
- Trang quản trị không được index (`noindex`, `robots`) và không lộ trong sitemap.

## 5. Contact lead

- `ContactLead`: `id`, `name`, `phone`, `email?`, `requestType` (`khao-sat|bao-gia|khac`), `message`, `consent` (bool + thời điểm),
  `sourcePage`, `utm?`, `createdAt`, `status` (`new|handled`), `spamScore?`. **Lưu vào PostgreSQL trước**, rồi mới thông báo.
- Thông báo email cho BMSL là hiệu ứng phụ có thể lỗi; lỗi gửi mail **không** làm mất lead và được ghi lại để gửi lại.
- Chống spam: honeypot + giới hạn tần suất theo IP + kiểm tra phía server; CAPTCHA chỉ thêm nếu thực tế bị spam (PROPOSAL).
- Dữ liệu cá nhân (SĐT, tên): tối thiểu hoá, có câu đồng ý, có quy tắc lưu trữ/xoá do BMSL quyết (`OWNER-DECISION`);
  không gửi sang bên thứ ba ngoài kênh thông báo đã thoả thuận. Tuân thủ Luật BVDLCN 91/2025/QH15 và NĐ 356/2025.
- Không lưu lead vào bộ nhớ tiến trình hay file JSON cục bộ làm nguồn sự thật.

## 6. SEO

URL thân thiện (05 §1) · title + meta description riêng từng trang/bài (`SeoMeta`) · `sitemap.xml` sinh tự động ·
`robots.txt` (chặn `/admin`) · structured data cơ bản (`Organization`, `BreadcrumbList`, `Article`, `JobPosting`;
`LocalBusiness` chỉ khi địa chỉ đã xác nhận) · tối ưu ảnh (định dạng hiện đại, kích thước, lazy-load, `alt` bắt buộc) ·
canonical · redirect theo 02. Mục tiêu hiệu năng tham chiếu: LCP < 2,5 s, CLS < 0,1 (theo `.claude/rules/ecc/web/performance.md`), đo ở W4.

## 7. Analytics

- GA4 và Google Search Console (giữ xác minh hiện có khi cutover).
- Sự kiện tối thiểu (hợp đồng): `phone_click`, `zalo_click`, `form_submit`, `document_download`. Tên sự kiện cố định để báo cáo không đổi.
- Mã GA4 là cấu hình (`SiteSettings`), không hard-code; ID thật do BMSL cấp (chưa có → `UNCONFIRMED`).
- Cần banner/đồng ý cookie hay không: `OWNER-DECISION` (tư vấn pháp lý của BMSL).

### 7.1 W5A — bằng chứng kỹ thuật và phần còn thiếu

**SEO (đã triển khai, `src/lib/seo.ts`, `src/lib/cms.ts`, `src/app/sitemap.ts`)**
- Sitemap đọc *mọi* trang của từng collection (200 bản ghi/lần), không giới hạn 500; lỗi DB làm sitemap lỗi (HTTP 500) thay vì trả bản cắt cụt; > 50.000 URL → lỗi rõ ràng (cần tách sitemap index trước khi đạt mức này).
- Singleton đã *publish* với `seo.noindex` (home/giới thiệu/quy trình/liên hệ) bị loại khỏi sitemap; bản nháp không ảnh hưởng.
- `SITE_URL` phải là origin `http(s)` (không path/query/fragment/credential); giá trị sai làm build/runtime lỗi, chỉ khi *không đặt* mới dùng `http://localhost:3000`.
- Slug do CMS nhập phải khớp `^[a-z0-9]+(-[a-z0-9]+)*$` (≤ 120 ký tự); bản ghi có slug khác bị coi là không công khai. Canonical/OG/sitemap/JSON-LD chỉ dùng đường dẫn qua `isPublicContentPath` (từ chối `..`, `%2e`, `?`, `#`, `\`, `/admin`, `/api`). Đường dẫn ảnh được kiểm tra riêng (`isApprovedMediaPath`: chỉ `/api/media-assets/file/<tên tệp>`).
- JSON-LD được escape (`<`, `>`, `&`, U+2028/9). Phát ra: `Organization` (trang chủ; chỉ tên + URL), `BreadcrumbList` (dịch vụ, dự án, chuyên mục, bài viết, tuyển dụng), `Article` (cần ngày đăng hợp lệ; không bịa tác giả). `JobPosting` có sẵn hàm dựng nhưng **chưa phát ra**: tin tuyển dụng chưa có `datePosted` và địa điểm làm việc. `LocalBusiness` **tắt**: chưa có địa chỉ được xác nhận.
- Search Console: trường `searchConsoleVerification` (chỉ ký tự `A-Za-z0-9_-`, 20–100) được in thành thẻ meta nếu bản *đã publish* hợp lệ. Việc in thẻ **không chứng minh** quyền sở hữu property.

**Ảnh / media**
- Chỉ ảnh `APPROVED` có đường dẫn nội bộ hợp lệ mới ra `<img>`, OG, JSON-LD. `<img>` có `decoding="async"`, `loading="lazy"`, width/height khi có đủ cả hai.
- Bộ tối ưu ảnh của Next (`/_next/image`) **bị tắt** (`images.unoptimized`; endpoint trả 404 trước khi tra cache). Lý do: cache ảnh đã biến đổi sẽ giữ byte sau khi quyền sử dụng bị thu hồi mà không có kiểm tra Payload mới. Test HTTP kiểm tra GET/HEAD của URL optimizer tự dựng (APPROVED, UNCONFIRMED, và sau khi thu hồi) và GET/HEAD của tệp gốc. **Chuyển cho W5B**: pipeline ảnh responsive/định dạng mới *có kiểm tra quyền* (hoặc cache có cơ chế vô hiệu hoá khi thu hồi).

**Analytics (mặc định tắt, `src/lib/analytics.ts`, `src/components/Analytics.tsx`)**
- Chỉ đọc `SiteSettings` đã publish. Cần đồng thời: `analyticsEnabled = true` (mặc định `false`, migration `20261005_120000_site_settings_analytics`), `ga4Id` dạng `G-XXXXXXXX` hợp lệ, và đồng ý analytics của khách. Thiếu một điều kiện → không render component, không tải script, không gửi sự kiện. Chỉ có ID mà không bật công tắc → vẫn tắt.
- Tích hợp consent (chính sách cookie là `OWNER-DECISION`, chưa dựng banner): gọi `window.bmslAnalytics.setConsent(true|false)` hoặc phát `window.dispatchEvent(new CustomEvent('bmsl:analytics-consent', { detail: true }))`. Rút consent dừng toàn bộ traffic về sau. Đồng ý trong form liên hệ **không** phải đồng ý analytics.
- Riêng tư: `send_page_view=false`; mọi sự kiện/`page_view` mang `page_location` = origin + path (không query/UTM/hash) và `page_referrer` = origin của site (không bao giờ gửi referrer thật). Tắt Google signals/quảng cáo cá nhân hoá. **Enhanced Measurement phải tắt trong data stream GA4** (mã không điều khiển được; các sự kiện tự động khác vẫn kế thừa `page_location` đã làm sạch).
- Sự kiện: đúng 4 tên; tham số allowlist: `link_location`, `request_type` (`khao-sat|bao-gia|khac`), `document_id` (chỉ số). Không gửi tên/SĐT/email/nội dung/URL tuỳ ý.
- `phone_click`/`zalo_click`: liên kết ở chân trang, chỉ xuất hiện khi `SiteSettings` đã publish có hotline/Zalo hợp lệ (không bịa). `document_download`: liên kết tài liệu ở trang Quy trình & Minh bạch. `form_submit`: chỉ sau khi server trả `{ ok: true, persisted: true }` (sau khi lưu lead vào PostgreSQL); dữ liệu sai, honeypot, lỗi ghi → không sự kiện.

**Cần tài khoản/phê duyệt thật (chưa chứng minh)**
- ID GA4 thật, tắt Enhanced Measurement, kiểm tra hành vi GA4 thực tế; xác minh Search Console thực tế; banner consent + chính sách cookie (`OWNER-DECISION`); hotline/Zalo/địa chỉ đã xác nhận; `datePosted` + địa điểm cho `JobPosting`.
- Biến `SITE_URL` đúng domain production.

## 8. Backup, vận hành, hạ tầng, đường nối AI

- **Hosting:** deploy lên domain/server của khách. Loại máy chủ, quyền truy cập, backup tự động của host: chưa biết → hỏi BMSL (07 §1).
- **Backup:** CSDL theo lịch tự động + media; lưu ngoài máy chủ chính; có quy trình restore đã thử một lần trước bàn giao.
  Hợp đồng chỉ yêu cầu backup tự động "nếu host hỗ trợ" → nếu không hỗ trợ, ghi rõ phần này do BMSL/host chịu và bàn giao script/hướng dẫn.
- **Bàn giao theo hợp đồng:** tài khoản ADMIN cao nhất, bản backup source code, bản backup database, hướng dẫn sử dụng, đào tạo ≤2 giờ.
- **HTTPS** bắt buộc, header bảo mật cơ bản (HSTS, `X-Content-Type-Options`, CSP phù hợp).
- **Đường nối AI (tương lai, không phải điều kiện nghiệm thu):** `ContactLead` → API tích hợp CRM/BMSL AI qua một cổng
  outbound riêng (ví dụ webhook ký HMAC, retry, idempotency theo `lead.id`). Website vẫn hoàn chỉnh khi cổng này tắt. W0 không thiết kế sâu hơn.

## 9. Chiến lược migration

1. **Không sửa/xoá WordPress cũ.** Dùng làm nguồn đọc; không đổi DNS (cutover là Task Contract riêng).
2. Trích dữ liệu nguồn từ site cũ (REST API hoặc export, do W1 chọn) vào **tệp trung gian ngoài Git công khai** nếu có dữ liệu cá nhân/ảnh chưa duyệt.
3. Tập lệnh import chạy lặp lại được (idempotent theo `legacyUrl`), ghi `sourceStatus=LEGACY-SOURCE`.
4. Nội dung **chưa duyệt không được ở trạng thái `published`** ở môi trường production. Staging có thể chứa bản nháp.
5. Tải ảnh về media của site mới, chuẩn hoá `http://` → `https://`; chỉ xuất bản ảnh có `rightsStatus=APPROVED`.
6. Chạy kiểm: 47/47 URL có luật redirect (02); không dự án nào mất (03: 18 URL → 17 hồ sơ); đếm bài/ảnh theo trần hợp đồng.
7. Chỉ khi BMSL duyệt (07 §1) mới sang cutover.

## 10. Kiểm thử và nghiệm thu kỹ thuật (gợi ý)

Unit/integration cho import, redirect, lead, phân quyền; E2E cho 8 khu và form; kiểm trình duyệt hiện hành
Chrome/Safari/Edge/Firefox trên Windows/macOS/iOS/Android (theo hợp đồng); kiểm responsive 3 khổ; axe/Lighthouse ở W4.
