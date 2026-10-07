# W78 — Chuẩn bị nhập seed website cũ vào Payload CMS (DRAFT) — gói quyết định owner & runbook production

Issue #78 (R2, **Phase A only**). Tài liệu này **không** cấp quyền ghi production. Không có lệnh nào trong tài liệu này
đã được chạy trên production; không đọc/ghi DB hay volume Northflank. Base: `main` @ `40a09b688f2c3685509d44366d9908affac8ce9b`
(PR #77). Không có thay đổi mã; chỉ tài liệu.

**Trạng thái bằng chứng: `NOT STAGING-PROVEN`** — phiên builder không có PostgreSQL cô lập (không có `DATABASE_URL`,
không được cấp quyền khởi tạo DB/Docker). Xem §6. Trạng thái cuối chỉ là `WAITING_STAGING_PROOF` cho tới khi chạy §5.

## 1. Ánh xạ seed → CMS (từ `src/seed/bmsl-legacy`, loader hiện có)

| Seed | Số lượng | Đích | Trạng thái sau `--write` | Ảnh liên kết |
|---|---|---|---|---|
| `records/service-areas.json` | 4 (quan-ly-van-hanh, bao-ve, ve-sinh, pccc) | collection `service-areas` | `draft` | ảnh trong thân (nếu có) |
| `records/projects.json` | 17 (từ 18 nguồn) | `projects` | `draft` + `sourceStatus=LEGACY-SOURCE` | `images[]` → `media-assets` |
| `records/articles.json` | 15 ứng viên | `articles` | `draft`, có `legacyUrl` | `cover` + node `upload` trong thân |
| `records/globals.json` | 2 (about-page, contact-page) | globals `about-page`, `contact-page` | `draft` | node `upload` trong thân |
| `manifest.media` | 56 tệp, 18.451.067 byte | `media-assets` | `rightsStatus=UNCONFIRMED` (không công khai) | — |
| `manifest.pendingMedia` | 172 URL | **không nhập** | — | liệt kê theo lớp trong báo cáo |
| `manifest.inventory` | 51 (47 chuẩn + 4 mới) | không phải bản ghi | 4 nhóm `notSeeded` được báo cáo | — |

* `site-settings`, `search verification`, `article-categories` **không bị đụng tới** (không tạo chuyên mục).
* **15 bài ứng viên ≠ tối đa 10 bài của bàn giao xuất bản ban đầu** trong hợp đồng gốc. Cả 15 chỉ là bản nháp; việc chọn
  ≤10 bài xuất bản là **quyết định của BMSL**, không được thực hiện ở đây.
* 4 bài ngày 2026-10-06 (tiêu chuẩn năng lực, nguyên tắc vàng, văn hoá doanh nghiệp, tác phong) mang
  `owner-decision-mapping` + `redirect-not-in-47-inventory`: BMSL phải chốt chúng thuộc Kiến thức hay Giới thiệu/Quy trình.

### Cần BMSL duyệt (không tự bịa)
1. Phân loại/chuyên mục bài (8 chuyên mục + tác giả chưa seed — `TAXONOMY_NOT_SEEDED`).
2. Chọn bài (≤10) để xuất bản ban đầu; duyệt từng nguồn/số liệu/pháp lý trong thân bài (giữ UNCONFIRMED).
3. Quyền dùng từng ảnh trong 56 tệp (đang `UNCONFIRMED`) và quyết định riêng cho 172 URL chờ (164 ảnh có người,
   6 ảnh trên web bên thứ ba, 1 watermark báo, 1 thư cảm ơn có chữ ký/dấu). Không được nói "đã có đủ ảnh cũ".
4. Văn bản bị giữ (`BLOCKED_OWNER_DECISION`, `BLOCKED_THIRD_PARTY_TEXT`, `NO_SOURCE_BODY`): trang chủ cũ không có thân bài.
5. Thông tin liên hệ/số điện thoại/email: pack đã loại bỏ; `contact-page` chỉ là nháp.

## 2. Preflight không phá huỷ — hành vi hiện có (không thêm importer mới)

`runSeed` phân loại **trước** khi ghi (đọc bằng Payload Local API, `draft:true`):

| Nhãn issue | Tương ứng loader |
|---|---|
| CREATED | `report.created` (cùng slug/legacy URL không tồn tại) |
| SKIPPED / EXISTING_CONTENT | `report.skipped`: khớp legacy URL, cùng slug lĩnh vực, hoặc global đã có `title`/thân bài |
| CONFLICT | `report.conflicts`: slug dự án/bài trùng nhưng khác nguồn legacy |
| MEDIA_NEEDS_REVIEW | `media.created` (sẽ tạo `UNCONFIRMED`) + `pendingImages` (172, không nhập) |

Global không rỗng (ví dụ `[MẪU] Giới thiệu`) **bị bỏ qua có chủ ý**, không bao giờ tự thay. Lựa chọn thủ công an toàn:
biên tập viên sao chép nội dung từ bản seed (chạy trên staging cô lập, hoặc xem `records/globals.json`) và ghép tay bằng
bản nháp/version của Payload; hoặc BMSL quyết định riêng việc thay thế. **Không có ghi đè tự động.**

Tests hiện có phủ các kịch bản này trên DB dùng một lần: `tests/integration/legacy-seed.test.ts` (dry-run 0 dòng/0 tệp,
`--write`, idempotent, không ghi đè chỉnh sửa, ẩn với anonymous, guard production/non-local).

## 3. Lưu ý quan trọng: dry-run KHÔNG đảm bảo zero-write trên DB lạ

`run.ts` gọi `getPayload({ config })`, có thể chạy migration đã commit khi khởi động. Vì vậy:

* **Cấm** chạy `pnpm seed:bmsl-legacy` (kể cả `--dry-run`) với `DATABASE_URL` production/khách hàng.
* **Cấm** đặt `NODE_ENV=development` hay `BMSL_IMPORT_ALLOW_STAGING=true` để vượt chốt trên production.
* Preflight production tương lai phải dùng **một trong hai**: (a) kết nối PostgreSQL chỉ-đọc (role không có DDL/DML,
  `default_transaction_read_only=on`) với truy vấn SQL thuần (không khởi động Payload) đếm slug/legacy URL/globals; hoặc
  (b) bản sao cô lập đã được owner cho phép riêng (restore từ backup đã kiểm chứng) rồi chạy CLI trên bản sao đó.
  Công cụ (a) chưa tồn tại; nếu cần, đó là một thay đổi mã R2 riêng (đề xuất, chưa làm).

## 4. Runbook import production (CHỈ TÀI LIỆU — không thực thi; cần cổng owner Phase B)

Điều kiện tiên quyết (thiếu một mục là DỪNG): chỉ thị owner bằng văn bản nêu **mục tiêu cụ thể** (`bmsl-web`), SHA pack,
SHA deploy + image tag, phạm vi ghi; CI exact-head xanh; reviewer tin cậy trên HEAD hiện tại.

1. Ghi lại SHA deploy và image tag đang chạy; xác nhận trùng SHA chứa pack đã duyệt; tính `sha256` của `manifest.json`
   và thư mục `records/` + 56 tệp assets; so với giá trị owner đã duyệt.
2. Snapshot **bất biến trước** của PostgreSQL (`pg_dump -Fc`, theo `docs/runbooks/backup-restore.md`) **và** volume media
   (snapshot Northflank hoặc `tar` + `sha256`). **Thử restore** vào một DB/volume cô lập và kiểm đếm trước khi tiếp tục.
3. Preflight chỉ-đọc (§3a hoặc §3b); lập bảng xung đột thật (published `[MẪU]`, dự án trùng slug, global không rỗng,
   media đã có). Owner xem bảng này; số liệu production hiện là **UNKNOWN**.
4. Cửa sổ thực hiện bởi operator được chỉ định, job một lần (không nằm trong build/start/CD), log không chứa dữ liệu
   khách/bí mật. Hành vi chỉ-tạo: `pnpm seed:bmsl-legacy --write` — **hiện bị chặn** trong production bởi
   `assertImportAllowed`; owner phải quyết định cách thực thi (ví dụ trên bản sao đã khôi phục rồi áp dụng có kiểm soát)
   — việc nới chốt chặn là thay đổi riêng, không nằm trong tài liệu này.
5. Resume: chạy lại là an toàn (bản ghi theo slug/legacy URL, media nhận diện bằng khoá trong `source`); không bao giờ xoá.
6. Sau import: đếm bản ghi (kỳ vọng 4/17/15 + 2 global + 56 media nếu DB trống), mọi bản ghi `_status=draft`, media
   `UNCONFIRMED`; kiểm bằng editor Payload đã xác thực; kiểm âm tính: anonymous không thấy nháp qua trang/API/`/api/media-assets`/tệp.
   Trang đã xuất bản trước đó không đổi (so sánh trước/sau).
7. DỪNG/Rollback: gặp bất kỳ sai khác → dừng. Rollback mã **không** là rollback dữ liệu. Khôi phục dữ liệu chỉ qua restore
   đã thử (DB + media cùng thời điểm) và theo quyết định owner; **không** xoá dữ liệu nghiệp vụ có trước.

## 5. Kế hoạch bằng chứng staging (chưa chạy — cần PostgreSQL + thư mục media dùng một lần)

```bash
export DATABASE_URL=postgres://…@localhost:5432/bmsl_w78_stage   # DB mới, KHÔNG phải production
export PAYLOAD_SECRET=<ngẫu nhiên, chỉ staging>  BMSL_MEDIA_DIR=/abs/tmp/w78-media
pnpm exec payload migrate
pnpm seed:bmsl-legacy                 # kỳ vọng: 0 dòng, 0 tệp
pnpm seed:bmsl-legacy --write         # kỳ vọng: 4+17+15+2 = 38 bản ghi, 56 media
pnpm seed:bmsl-legacy --write         # kỳ vọng: created 0, 0 tệp mới
pnpm test:integration                 # tests/integration/legacy-seed.test.ts (tự tạo/xoá DB riêng)
```
Kịch bản 2 (DB không rỗng): thêm trước một dự án đã xuất bản, `about-page` có nội dung, search verification và
site-settings tổng hợp; kỳ vọng các bản ghi này nguyên vẹn, xung đột/bỏ qua được liệt kê. Thêm: SHA-256 56 tệp so với
manifest, khởi động lại rồi kiểm tệp còn, ảnh chụp editor (dự án/bài/about), backup+restore `pg_dump`/`pg_restore` + tar media.

## 6. Bằng chứng phiên này

* `pnpm exec vitest run --config vitest.config.ts src/seed/bmsl-legacy` → **4 file, 62 tests passed, 0 failed** (kiểm tra pack/loader offline, không DB).
* `pnpm test:integration legacy-seed` → **không chạy được**: `DATABASE_URL is required` (không có PostgreSQL cô lập trong phiên).
* Không có ảnh chụp editor, không có kiểm đếm staging, không có thử backup/restore.

## 7. OWNER GATE REQUIRED — báo cáo ngắn

* **Mục tiêu:** nhập nội dung site cũ vào CMS dạng nháp; nội dung đã xuất bản giữ nguyên.
* **Sẽ ghi (ước tính trên DB trống):** 4 service-areas, 17 projects, 15 articles, 2 globals nháp, 56 media UNCONFIRMED.
  Production thực tế: **UNKNOWN** tới khi có preflight chỉ-đọc được cấp phép riêng.
* **Không nhập:** 172 URL ảnh chờ duyệt, nội dung bị chặn, chuyên mục/tác giả, trang chủ cũ.
* **Xung đột đã biết có thể có:** `[MẪU] Giới thiệu` (global không rỗng → bỏ qua), dự án/bài trùng slug → CONFLICT.
* **Rủi ro:** mất dữ liệu (cần restore đã thử DB+media), bảo mật/quyền ảnh (UNCONFIRMED, riêng tư), SEO (không xuất bản,
  không gửi Search Console).
* **Hành động không thể đảo ngược / cần owner:** mọi ghi vào DB/volume production; nới `assertImportAllowed`; xuất bản; duyệt quyền ảnh.
* **Phê duyệt đề xuất sau này:** chỉ-tạo, chỉ nháp, đúng mục tiêu `bmsl-web`, SHA pack + deploy cụ thể, sau khi có
  STAGING-PROVEN, backup+restore đã thử và bảng xung đột thật. Một lệnh "go ahead" chung chung là không đủ.
