# W78 — Chuẩn bị nhập seed website cũ vào Payload CMS (DRAFT) — gói quyết định owner & runbook production

Issue #78 (R2, **Phase A only**). Tài liệu này **không** cấp quyền ghi production. Không có lệnh nào trong tài liệu này
đã được chạy trên production; không đọc/ghi DB hay volume Northflank. Base đã refresh: `main` @ `5131e599d24328655b977fa7092d0b228e4efd18`. Không có thay đổi mã ứng dụng trong PR này; chỉ tài liệu/evidence.

**Trạng thái bằng chứng: `SEED-ISOLATED-PROVEN; WAITING_SEED_RESTORE_PROOF_AND_OWNER_DATA_GATE`** — "staging" ở đây là PostgreSQL/media cô lập và dữ liệu synthetic/local/CI, KHÔNG phải dữ liệu riêng tư Northflank. Không có đọc/ghi DB/volume Northflank. Theo quyết định owner được ghi tại Issue #81 (https://github.com/nexagnet/bmsl-website/issues/81#issuecomment-6030949836), Northflank hiện là DEV/TEST, chưa có production; tuy vậy mọi import vào persistent DB/volume Northflank vẫn là data-write gate riêng và chưa được ủy quyền.

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

* **Cấm** chạy `pnpm seed:bmsl-legacy` (kể cả `--dry-run`) với một DB persistent/khách hàng chưa được owner cấp quyền; điều này áp dụng cả Northflank DEV/TEST hiện tại.
* **Cấm** đặt `NODE_ENV=development` hay `BMSL_IMPORT_ALLOW_STAGING=true` để vượt chốt trên một target persistent không được ủy quyền.
* Preflight persistent target tương lai phải dùng **một trong hai**: (a) kết nối PostgreSQL chỉ-đọc (role không có DDL/DML,
  `default_transaction_read_only=on`) với truy vấn SQL thuần (không khởi động Payload) đếm slug/legacy URL/globals; hoặc
  (b) bản sao cô lập đã được owner cho phép riêng (restore từ backup đã kiểm chứng) rồi chạy CLI trên bản sao đó.
  Công cụ (a) chưa tồn tại; nếu cần, đó là một thay đổi mã R2 riêng (đề xuất, chưa làm).

## 4. Runbook import vào persistent target sau này (CHỈ TÀI LIỆU — không thực thi; cần cổng owner Phase B)

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

## 5. Bằng chứng kiểm thử cô lập — phần đã chứng minh

Không cần dựng importer/harness thứ hai. Bằng chứng được ghép từ các proof đã merge và CI bắt buộc hiện tại; **chưa có một lần backup/restore của chính DB vừa được nhập bộ seed W78**. Vì vậy đây là bằng chứng import cô lập + thử cơ chế backup độc lập, không phải nghiệm thu toàn bộ W78.

### 5.1 Empty staging — import đầy đủ từ pack

Bằng chứng runtime W75 trên checkout sạch + PostgreSQL trống + media dir trống:
- migrate;
- dry-run: **0 dòng / 0 tệp**;
- `--write`: **38 bản ghi** = 4 service areas + 17 projects + 15 articles + 2 globals, cùng **56 media**;
- lần `--write` thứ hai: **0 bản ghi mới / 0 media mới**;
- mọi project/article/global từ seed ở Draft; project = `LEGACY-SOURCE`; media = `UNCONFIRMED`;
- người ẩn danh thấy **0** nội dung seed; file chưa duyệt không được đọc công khai;
- 56 tệp trên disk khớp SHA-256 của pack và còn nguyên sau restart;
- screenshot CMS local/synthetic cho about, project, article, media list và public negative proof đã nằm trong `docs/migration/screenshots/w75/`.

PR #88 / Issue #80 sau đó **độc lập lặp lại** trên PostgreSQL 16 disposable: 38 record + 56 file, rerun tạo 0, 17 project + 15 article đều Draft, 56 media đều UNCONFIRMED và hash khớp manifest. Source audit cũng xác nhận 51 inventory row / 17 project / 235 image URL, trong đó 172 rights-pending vẫn không được nhập.

### 5.2 Non-empty synthetic staging — conflict/no-clobber

`tests/integration/legacy-seed.test.ts` hiện dùng PostgreSQL thật + temp media và chủ động tạo trước:
- một project đã published+CONFIRMED chiếm slug từ pack nhưng khác legacy source → **CONFLICT**, giữ nguyên;
- một article đã tồn tại theo legacy URL → **SKIPPED**, giữ nguyên;
- global có nội dung/human edit → giữ nguyên;
- staff edit trên seeded article/service/global → rerun không ghi đè;
- `article-categories` vẫn không tự tạo; SiteSettings/analytics/contact không bị seed đụng tới;
- anonymous Local API/public mapper không thấy draft hoặc UNCONFIRMED media.

Đây chính là kịch bản EXISTING_CONTENT / SKIPPED / CONFLICT mà Phase A yêu cầu; không cần chạm dữ liệu Northflank để chứng minh.

### 5.3 Backup/restore recovery rehearsal

Exact-main CI run **37615468154** trên `5131e599d24328655b977fa7092d0b228e4efd18` chạy required integration suite với PostgreSQL 16 và backup/restore thật. Structured proof:

```text
W5C_BACKUP_REPORT
sourceCommit = 5131e599d24328655b977fa7092d0b228e4efd18
migrations   = 4
tables       = 41
schemaHash   = 2694233bec0f8023ba650c84c2ddd8143809ad1ae05d3ec1929106ec29758d36
contentHash  = fb165ded5b59e32e49d90eb6ab406efa006909f847d43d7e061118fb6db4b81c
mediaTreeHash= 6d5bc57b906ef3c7b13424bdd1c30b468d390e2d732df3251e104859d9c4681e
restoredDatabaseDistinct = true
sessionsAfterWorkers = 0
```

Proof này dùng dữ liệu synthetic và temp directory; restore đích là DB khác, schema/content/migration/media hash được so sánh và resource được cleanup. Nó chứng minh **cơ chế** recovery hiện tại trên dữ liệu synthetic độc lập (4 media), **không phải rehearsal khôi phục database chứa 38 bản ghi + 56 ảnh seed W78** và không phải quyền restore lên Northflank.

### 5.4 Browser/CMS proof

- W75 đã commit screenshot editor local/synthetic: `cms-about-page-*`, `cms-project-ecolife-*`, `cms-article-infographics-1440`, `cms-media-list-1440`, `cms-articles-list-1440`, và `public-du-an-anonymous-1440`.
- Exact-main integration run 37615468154 tiếp tục PASS real Next server + disposable PostgreSQL + Chromium/Firefox/WebKit; ADMIN/EDITOR flow, draft non-leak và media-rights behavior đều được thực thi.
- Đây là proof kỹ thuật local/CI; không phải khách hàng đã duyệt nội dung.

## 6. Ma trận Acceptance → bằng chứng

| Acceptance #78 | Bằng chứng | Trạng thái |
|---|---|---|
| main/seed/runbook kiểm lại | main `5131e599...`; #80 audit merged; required CI main PASS | PROVEN |
| empty staging dry-run/write/idempotence | W75 runtime + #80 PG16 independent rerun | PROVEN |
| 56 media SHA + restart persistence | W75 runtime + #80 hash audit | PROVEN |
| non-empty conflicts / edits survive | current `legacy-seed.test.ts` on required PostgreSQL integration | PROVEN |
| Draft / LEGACY-SOURCE / UNCONFIRMED | W75/#80 runtime + integration tests | PROVEN |
| anonymous negative access | W75 runtime + legacy-seed + browser HTTP integration | PROVEN |
| authenticated CMS representative views | committed W75 synthetic screenshots + current ADMIN/EDITOR browser suite | PROVEN |
| cơ chế backup/restore trên dữ liệu synthetic độc lập | W5C required integration run 37615468154 | PROVEN-MECHANISM |
| backup/restore đúng DB + media W78 sau import | chưa chạy end-to-end với 38 bản ghi + 56 ảnh | NOT_PROVEN / REQUIRED |\n| persistent preflight avoids Payload startup migration | §3 SQL read-only-role / isolated-clone design, công cụ chưa có | DESIGN-ONLY / NOT_PROVEN |
| actual private Northflank collision counts | deliberately not accessed | NOT_PROVEN / OWNER DATA GATE |
| rights/categories/publication approval | business decision, not inferred | NOT_PROVEN / OWNER DECISION |
| real production import | production not created/authorized | NOT_PROVEN |

Kết luận trung gian Phase A: **SEED-ISOLATED-PROVEN; WAITING_SEED_RESTORE_PROOF_AND_OWNER_DATA_GATE**. Không cần importer mới, nhưng **chưa đóng #78** cho tới khi backup/restore seed-specific được chứng minh trên DB/media cô lập và preflight design-gap được xử lý hoặc tách thành tiêu chí chưa hoàn thành. Phase B trên Northflank persistent cần owner chốt target/phạm vi ghi/backup point.

## 7. OWNER GATE REQUIRED — báo cáo ngắn

* **Mục tiêu:** nhập nội dung site cũ vào CMS dạng nháp; nội dung đã xuất bản giữ nguyên.
* **Đã chứng minh trên DB trống cô lập:** 4 service-areas, 17 projects, 15 articles, 2 globals nháp, 56 media UNCONFIRMED.
  Persistent Northflank thực tế: **UNKNOWN** tới khi có preflight chỉ-đọc/clone được cấp phép riêng.
* **Không nhập:** 172 URL ảnh chờ duyệt, nội dung bị chặn, chuyên mục/tác giả, trang chủ cũ.
* **Xung đột đã biết có thể có:** `[MẪU] Giới thiệu` (global không rỗng → bỏ qua), dự án/bài trùng slug → CONFLICT.
* **Rủi ro:** mất dữ liệu (cần restore đã thử DB+media), bảo mật/quyền ảnh (UNCONFIRMED, riêng tư), SEO (không xuất bản,
  không gửi Search Console).
* **Hành động cần owner:** mọi ghi vào DB/volume persistent Northflank hoặc production tương lai; nới `assertImportAllowed`; xuất bản; duyệt quyền ảnh.
* **Phê duyệt đề xuất sau này:** chỉ-tạo, chỉ nháp, owner nêu rõ target persistent cụ thể, SHA pack + deploy cụ thể, backup+restore point và bảng xung đột thật. Một lệnh "go ahead" chung chung là không đủ.
