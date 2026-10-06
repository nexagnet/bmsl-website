# W75 — Bộ seed ban đầu cho Payload CMS từ website WordPress cũ

Issue #75 (R2, Claude Code Desktop, thủ công). Quyết định của owner (2026-10-06): nội dung văn bản và ảnh được phép
của website cũ `https://binhminhsonglo.vn/` là **bộ seed ban đầu lưu trong Git**, repository giữ **công khai**. Seed là
*ứng viên nháp* do lập trình viên kiểm soát; CMS (PostgreSQL) là nguồn sự thật nghiệp vụ; duyệt xuất bản và duyệt quyền
dùng ảnh là bước nghiệp vụ riêng của BMSL.

Báo cáo từng URL (do generator sinh, không sửa tay): [`w75-legacy-seed-report.md`](w75-legacy-seed-report.md).

## 1. Cái gì nằm trong repository

```
src/seed/bmsl-legacy/
  manifest.json            kiểm kê 47 URL chuẩn + mục mới, nguồn gốc ảnh (URL, SHA-256, kích thước), ảnh chờ duyệt, ghi chú chuyển đổi
  records/                 giá trị nội dung ĐÃ CHUẨN HOÁ: service-areas, projects, articles, globals (about/contact) ở dạng Lexical
  assets/                  56 tệp ảnh được phép commit (JPEG/PNG gốc, đặt tên <sha12>-<tên>.jpg|png)
  review/image-review.json quyết định quyền cho từng URL ảnh (COMMIT/PENDING + lý do); ảnh chưa có trong tệp này mặc định PENDING
  review/content-review.json  bài mà VĂN BẢN không được commit (lý do kèm theo)
  generate-cli.ts, generator.ts, html.ts, lexical.ts, image-meta.ts   bộ sinh pack (CÓ dùng mạng, chỉ chạy khi được yêu cầu)
  run.ts, loader.ts, pack.ts                                          bộ nạp OFFLINE + kiểm tra toàn vẹn pack
```

Mọi thứ tạo ra là **bản nháp**: `projects` ở `LEGACY-SOURCE`, ảnh ở `rightsStatus=UNCONFIRMED`, trang `about-page` và
`contact-page` ở trạng thái `draft`, không có chuyên mục (`article-categories`) nào được tạo (phân loại chưa được chốt),
`site-settings` không bị đụng tới.

## 2. Cách dùng (chỉ local hoặc staging cô lập)

Yêu cầu: PostgreSQL **trống hoặc cô lập** đã chạy migration (`pnpm exec payload migrate`), `DATABASE_URL`, `PAYLOAD_SECRET`
và (khuyến nghị) `BMSL_MEDIA_DIR` là đường dẫn tuyệt đối của volume media riêng.

```bash
pnpm seed:bmsl-legacy                 # mặc định là --dry-run: đọc pack trong repo + đọc DB, KHÔNG ghi dòng nào, KHÔNG ghi tệp nào
pnpm seed:bmsl-legacy --write         # hành động tường minh của operator: ghi bản nháp + sao chép ảnh vào media-assets
```

* **Offline**: chỉ đọc pack đã commit (không truy cập WordPress). Pack được kiểm tra toàn vẹn (SHA-256, kích thước, loại tệp
  theo byte, đường dẫn an toàn, không trường trạng thái/phê duyệt, không SĐT/email, không nội dung chủ động) **trước khi**
  Payload khởi động: pack lỗi thì không ghi gì.
* **Không bao giờ chạy tự động**: không nằm trong `build`, `start`, `container-start` hay CD khi push `main`.
* **Chốt chặn môi trường** (dùng chung với `migrate:legacy`): từ chối `--write` khi `NODE_ENV=production`; từ chối DB không
  phải local trừ khi đặt `BMSL_IMPORT_ALLOW_STAGING=true` cho một DB staging cô lập. Ghi vào production cần một cổng owner
  riêng; Issue này không cho phép.
* **Không ghi đè**: bản ghi đã tồn tại (cùng slug hoặc cùng đường dẫn cũ) được *bỏ qua*, không bao giờ sửa; trùng slug với
  bản ghi khác nguồn là *xung đột* (báo cáo, không đụng tới). Trang `about-page`/`contact-page` đã có tiêu đề hoặc nội dung thì
  bỏ qua. Chạy lần 2 trên DB đã seed tạo 0 bản ghi, 0 tệp, 0 trùng; chỉnh sửa của biên tập viên được giữ nguyên.
* **Phục hồi lỗi**: ghi theo thứ tự media → lĩnh vực → dự án → bài → trang; nếu dừng giữa chừng, chạy lại tiếp tục phần còn
  thiếu (media nhận diện lại bằng SHA-256 trong trường nguồn, staff-only).
* Thứ tự khuyến nghị trên DB mới: chạy seed này **thay cho** `migrate:legacy` và `seed:service-areas`. Nếu các lệnh đó đã
  chạy trước, dự án khớp theo đường dẫn cũ được bỏ qua và 4 lĩnh vực dịch vụ đã có được giữ nguyên.

## 3. Tạo lại pack từ website cũ (có mạng, tường minh)

```bash
pnpm seed:bmsl-legacy:generate --observed-at 2026-10-06
```

Chỉ truy cập `https://binhminhsonglo.vn` (WordPress REST công khai, sitemap, ảnh trong `/wp-content/uploads/`; không theo
redirect sang host khác, ≤ 10 MB mỗi tệp, chỉ JPEG/PNG xác nhận theo byte). Kết quả xác định (cùng đầu vào → cùng byte).
Duyệt quyền sau này = sửa `review/image-review.json` hoặc `review/content-review.json`, chạy lại generator, xem diff, commit.
Ảnh/bài chưa được duyệt luôn nằm ngoài repository. Lần chạy đầy đủ mất vài phút (site cũ chậm); đặt
`BMSL_SEED_IMAGE_CACHE=<thư mục tuyệt đối ngoài repo>` để tái dùng ảnh đã tải (vẫn kiểm tra loại tệp/kích thước và tính hash như thường).

## 4. Kết quả kiểm kê (từ `manifest.json`)

* **Nguồn**: WordPress 6.7.1; 40 bài + 2 trang + 14 chuyên mục qua REST; sitemap 51 URL, tất cả đều có trong kiểm kê.
* **51 dòng kiểm kê = 47 URL chuẩn (giữ nguyên thứ tự, redirect không đổi) + 4 bài mới** đăng ngày 2026-10-06 chưa có trong
  bộ 47 (tiêu chuẩn năng lực, bộ nguyên tắc vàng, văn hoá doanh nghiệp, quy định tác phong). Bốn bài này được seed như bài
  nháp ứng viên, đánh dấu `owner-decision-mapping` (có thể thuộc `process-page`/Giới thiệu) và `redirect-not-in-47-inventory`;
  manifest redirect 47 mục / 46 redirect 301 **không bị sửa**.
* **Đích CMS**: 17 `projects` (từ 18 nguồn; Học viện Quốc phòng gộp 2 nguồn), 15 `articles` nháp, 4 `service-areas`,
  `about-page` (#1 + văn phòng #28 + cơ cấu #36), `contact-page` (#38). Trang chủ cũ không có nội dung (`NO_SOURCE_BODY`);
  8 chuyên mục + tác giả không seed (`TAXONOMY_NOT_SEEDED`).
* **Độ khớp văn bản**: 13 `EXACT`, 6 `EXACT_EXCEPT_REDACTIONS`, 0 `DIFFERS` (so văn bản nguồn với văn bản trong Lexical, sau khi
  chuẩn hoá khoảng trắng). Dự án: các trường được tách từ dòng "Địa điểm / Quy mô / Chủ đầu tư / Năm thực hiện / Dịch vụ".
* **Ảnh**: 235 URL ảnh dùng trong thân bài/ảnh bìa → **56 tệp duy nhất được commit** (62 URL, 18,5 MB): 9 đồ hoạ, 31 cảnh/vật thể
  không có người, 16 ảnh toà nhà dự án. Ảnh đại diện của bài #1 (logo) không bản ghi nào dùng nên không commit (liệt kê ở `manifest.unused`). **172 URL chờ duyệt**: 164 ảnh có người nhận diện được (nhân viên, cư dân, trẻ
  em), 6 ảnh nằm trên website của bên thứ ba (không tải về), 1 ảnh có watermark báo, 1 thư cảm ơn có chữ ký và con dấu.
  Vị trí của từng ảnh chờ duyệt trong bài được ghi trong `manifest.json` (`pendingMedia[].usedBy.blockIndex`); ảnh được commit
  nằm đúng vị trí gốc dưới dạng node `upload` trong nội dung Lexical.
* **Alt text**: 6 ảnh dùng alt do người viết trên site cũ; 50 ảnh dùng alt *suy ra* từ tiêu đề bài/tên dự án (đánh dấu
  `altSource: derived` trong manifest) vì alt gốc là tên tệp hoặc số vô nghĩa ("Qnt03494", "0"). BMSL nên rà lại khi duyệt ảnh.
* **Văn bản không được commit** (dòng kiểm kê vẫn có, kèm lý do): #2, #3, #4 là **bài báo đăng lại** (có dẫn nguồn
  doisongphapluat.com.vn, nguoiduatin.vn; bản quyền thuộc toà soạn) và #33 (OWNER-DECISION của blueprint: thông tin cá nhân
  của lãnh đạo). Hệ quả: cả 4 `service-areas` ở dạng placeholder UNCONFIRMED giống `seed:service-areas`.
* **Dữ liệu liên hệ** (8 SĐT, 1 email) bị thay bằng `[số điện thoại — chờ BMSL xác nhận]` / `[email — chờ BMSL xác nhận]` và
  chỉ được thống kê số lượng; các dòng đó có `official-contact-confirmation`. Tên người liên hệ viết kèm số hotline trong bài mới
  (chỉ tên riêng, không kèm số) vẫn nằm trong văn bản nháp, cần BMSL xem lại.
* **Phần loại bỏ khi chuyển đổi** (có báo cáo): iframe YouTube trong bài #31, 1 liên kết nội bộ trỏ về site cũ (giữ chữ), 4 tiêu đề
  H1 hạ xuống H2, 1 thẻ `pre` được làm phẳng. Không có script/style/shortcode còn sót.

## 5. Ảnh trong thân bài hiển thị trên website như thế nào

`src/components/RichText.tsx` trước đây trả `null` cho mọi `upload`, nên ảnh trong nội dung không bao giờ hiện. Nay node
`upload` đi qua **cùng cổng quyền** như mọi ảnh công khai (`toPublicImage`): chỉ hiện khi tài liệu media đã được nạp bởi đường
đọc công khai (`overrideAccess:false`), `rightsStatus=APPROVED` và URL là đường dẫn media cùng site; còn lại không hiện gì, tại
đúng vị trí đó. Không thay đổi `MediaAssets`, quyền đọc, schema hay migration. Vì seed để ảnh ở `UNCONFIRMED` nên chưa có ảnh
nào hiện công khai cho tới khi BMSL duyệt từng tệp trong `/admin` (và xuất bản bản ghi chứa nó).

## 6. Kiểm thử (đã chạy)

| Lớp | Tệp | Nội dung |
| --- | --- | --- |
| Unit | `lexical.test.ts` | HTML→Lexical: định dạng, danh sách lồng, ảnh đúng vị trí, chú thích, bỏ iframe/script/shortcode, ẩn SĐT/email, liên kết an toàn |
| Unit | `generator.test.ts` | dữ liệu WordPress tổng hợp: đủ 47 URL, xác định (2 lần chạy trùng byte), fail-closed với ảnh chưa duyệt, không bao giờ tải host khác, đường dẫn ngoài `/wp-content/uploads`, SVG/ảnh hỏng, chặn bài, bài ngoài bộ 47 |
| Unit | `pack.test.ts` | pack thật: 47 URL giữ nguyên, 17 dự án, SHA-256/kích thước/loại tệp, không ảnh chờ duyệt nào nằm trong repo, không SĐT/email/hotlink, ≤ 10 MB mỗi tệp, không trường phê duyệt; validator từ chối tệp bị sửa, SVG, path traversal, lớp ảnh bị cấm, host lạ, trường `_status`/`rightsStatus`, upload/liên kết/nội dung chủ động không an toàn |
| Tích hợp (PostgreSQL thật) | `tests/integration/legacy-seed.test.ts` | DB trống: dry-run ghi 0 dòng 0 tệp; `--write` tạo bản nháp + tệp ảnh; lần 2 tạo 0; xung đột slug và bản ghi đã xuất bản không bị đụng; chỉnh sửa của staff được giữ; người ẩn danh không đọc được bản ghi/global/media; ảnh APPROVED hiện đúng vị trí và biến mất khi thu hồi; chốt chặn production/staging |

**Bằng chứng runtime** (môi trường cô lập, ghi trong PR): checkout mới của đúng commit → PostgreSQL trống + volume media trống →
migrate → `--dry-run` (0 dòng, 0 tệp) → `--write` (38 bản ghi + 56 tệp ảnh) → lần 2 (0 mới) → chạy website thật: người ẩn danh thấy 0
nội dung seed, tệp ảnh chưa duyệt trả 403, 56 tệp trên đĩa khớp SHA-256 với pack và còn nguyên sau khi khởi động lại tiến trình.
Phần seed chạy trên mạng Docker `internal` (không có đường ra internet) nên không thể liên hệ WordPress.

Ảnh chụp trình soạn thảo CMS (`/admin`, tài khoản test cục bộ) nằm ở `docs/migration/screenshots/w75/`: `cms-about-page-*`,
`cms-project-ecolife-*` (1440 và 390 px), `cms-article-infographics-1440`, `cms-media-list-1440` (mọi ảnh `Chưa xác nhận quyền sử dụng`),
`cms-articles-list-1440`, `public-du-an-anonymous-1440` (website công khai không hiện bản nháp nào). Ảnh chụp trang nguồn
không được commit: chúng có số điện thoại nổi và nội dung bên thứ ba. Dấu tiếng Việt trong ảnh chụp có thể lệch do font dự phòng của
Chromium trên máy chụp; dữ liệu đã ở dạng Unicode NFC.

## 7. Chưa chứng minh (`NOT_PROVEN`)

* Quyền sử dụng ảnh/văn bản của 56 ảnh và các bài đã commit: chỉ là quyết định của owner dùng lại tài liệu website cũ của BMSL;
  nguồn gốc ảnh dự án (ảnh gửi qua Zalo, có phối cảnh của chủ đầu tư) và quyền nhân thân chưa được xác minh độc lập.
* Mọi dữ kiện lịch sử (quy mô, địa chỉ, trạng thái vận hành, giấy phép/xác nhận pháp lý trong bài Giới thiệu, mốc lịch sử): chưa xác nhận.
* Chưa chạy trên DB/volume staging thật của BMSL và chưa có ảnh chụp so sánh nguồn–CMS trên staging: chỉ có bằng chứng trên
  PostgreSQL local dùng một lần (xem PR).
* Trang chủ, `process-page`, danh mục bài, `site-settings`: không có nguồn văn bản nên không được seed.

## 8. Danh sách BMSL cần duyệt trước mọi migration production hoặc phát hành công khai

Mỗi cổng do người có thẩm quyền áp dụng qua quy trình riêng, không do seed tự làm:

1. Dữ kiện dự án (tên chính thức, địa chỉ, quy mô, năm, trạng thái; Himlam "đã vận hành"; B10/B3/B5 không ghi trạng thái).
2. Tuyên bố pháp lý/năng lực trong bài Giới thiệu và bài mới (số hiệu giấy xác nhận, danh sách đơn vị đủ điều kiện).
3. Thông tin liên hệ chính thức (SĐT, email, địa chỉ) và tên người liên hệ.
4. Chọn bài đưa lên, phân loại (tối đa 5 chuyên mục) và quyết định 4 bài mới thuộc đâu.
5. Quyền ảnh: duyệt từng tệp trong `/admin`; **đồng ý của người trong ảnh** cho 164 ảnh chờ duyệt; giấy phép đăng lại bài báo (#2, #3, #4);
   quyết định đăng lại #33.
6. Dọn các bản ghi mẫu/demo đang tồn tại trên môi trường live (không bị seed này đụng tới).
7. Bước đưa lên production (DB/volume live) là cổng owner riêng, ngoài phạm vi Issue này.
