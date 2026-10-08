# W80 — Đối chiếu nguồn WordPress ↔ seed Git (kết luận và bàn giao)

Issue #80 (R2, Claude Code Desktop, thủ công, chỉ đọc nguồn + chỉ chạy trên DB cô lập). Chi tiết từng URL / từng dự án / từng ảnh do máy sinh:
[`w80-source-fidelity-audit.md`](w80-source-fidelity-audit.md) và [`w80-image-ledger.csv`](w80-image-ledger.csv). Tạo lại bằng
`pnpm seed:bmsl-legacy:audit` (có mạng, chỉ đọc; `--check` để chỉ kiểm tra, thoát mã 1 nếu có sai lệch).

## 1. Kết luận

* **Seed trong Git khớp nguồn WordPress tại thời điểm chạy (2026-10-07), không có sai lệch**: 51 dòng kiểm kê ↔ 42 bài/trang công khai + 9 trang
  lưu trữ; **văn bản nguồn hiện tại được so với đúng bản ghi đã commit** ở cả 19 dòng có văn bản được seed (13 khớp hoàn toàn, 6 khớp sau khi che SĐT/email), bằng chính hàm `fidelity()` của generator, không chỉ so độ dài; 17 bản ghi dự án khớp từng dòng dữ kiện (địa điểm, quy mô,
  chủ đầu tư, năm, trạng thái, dịch vụ); 235 URL ảnh = 62 đã commit (56 tệp, SHA-256 băm lại từ tệp trong repo) + 172 chờ duyệt + 1 ảnh logo
  đã duyệt nhưng không bản ghi nào dùng.
* **Không có nội dung dự án nào bị mất do parser.** Mỗi trang dự án nguồn chỉ có 1 ảnh và tối đa 5 dòng "Nhãn : giá trị", không có
  đoạn mô tả dài (0 đoạn văn ngoài dòng dữ kiện trong cả 18 trang nguồn). **Vì vậy không thêm `Projects.body`, không có schema/migration**,
  không cần tách việc R2-schema.
* **Việc "thấy ít nội dung" trên website mới không phải do seed thiếu dữ liệu nguồn**: seed là bản nháp (`NOT_PUBLISHED`), ảnh
  `UNCONFIRMED` không hiện công khai, và việc seed đã được nạp vào Northflank hay chưa (`NOT_IMPORTED_TO_LIVE`) **không thể và không được
  chẩn đoán từ website ẩn danh**. Việc đó thuộc #78 (nhập vào staging an toàn).

## 2. Các ca cụ thể mà issue yêu cầu

| Ca | Kết quả | Phân loại |
| --- | --- | --- |
| `a6-nam-trung-yen` (không có địa chỉ/quy mô) | Trang nguồn #196 có thân bài rỗng, chỉ có ảnh. Không có địa điểm/quy mô/chủ đầu tư/năm/dịch vụ ở nguồn. Không phải lỗi parser; không suy diễn. BMSL cần cung cấp dữ kiện. | `SOURCE_ABSENT` |
| `b-ia20-ciputra` (chưa có ảnh) | Ảnh bìa nguồn (`chung-cu-phia-bac-ha-noi-5-…jpg`) có watermark của báo Dân Trí: tài sản bên thứ ba, đang chờ duyệt, không commit vào Git công khai. Đây là ảnh bị chặn quyền, không phải ảnh thất lạc. Mọi dữ kiện văn bản khớp. | `PRIVACY/RIGHTS_PENDING` |
| `b3-lang-quoc-te-thang-long` | Khớp: địa chỉ (nối đúng dòng bị ngắt), 84 căn hộ, chủ đầu tư, 1/1/2023, dịch vụ; ảnh bìa đã commit. Nguồn không ghi trạng thái vận hành nên seed cũng không ghi. | `EXISTING_BUT_DRAFT` |
| `ecolife-tay-ho` | Khớp toàn bộ; ảnh bìa đã commit. | `EXISTING_BUT_DRAFT` |
| Trang giới thiệu + bài viết | Văn bản trong Payload bằng đúng văn bản/vị trí ảnh trong Git (mục 6); độ dài thân bài nguồn bằng manifest. | `EXISTING_BUT_DRAFT` |

## 3. Khoảng trống còn lại (đã phân loại; không phải lỗi nguồn–seed nên không sửa trong PR này)

| Phân loại | Nội dung | Cần ai |
| --- | --- | --- |
| `SCHEMA_MISMATCH` (nhỏ) | Dòng "Dịch vụ cung cấp" gốc (vd. "Quản lý vận hành toà nhà", "Cung cấp dịch vụ bảo vệ và vệ sinh cho tòa nhà") được chuẩn hoá thành khu vực dịch vụ (`quan-ly-van-hanh`, `bao-ve`, `ve-sinh`). Câu chữ gốc không được giữ vì `Projects.services` là quan hệ. Không có thông tin thực tế bị mất. Muốn giữ câu chữ gốc cần thêm một trường văn bản = thay đổi schema (R2 riêng). | Owner quyết định |
| `PRIVACY/RIGHTS_PENDING` | 172 ảnh chờ duyệt (164 có người, 1 ảnh có watermark báo, 1 thư có chữ ký/con dấu, 6 ảnh nằm ở website bên thứ ba); 4 văn bản bị chặn (3 bài báo đăng lại, 1 bài thông tin cá nhân lãnh đạo). | BMSL (đồng ý của người trong ảnh, giấy phép đăng lại) |
| `SOURCE_ABSENT` | A6 (không dữ kiện), trang chủ (thân bài rỗng), 9 trang lưu trữ chuyên mục/tác giả. | BMSL |
| Phát hiện mới: **ảnh chỉ có trong thư viện** | 67 tệp có trong thư viện media công khai nhưng **không hiện ở trang công khai nào** (56 tệp gắn với bài "Kỉ niệm 5 năm", gồm các bản gốc tương ứng với ảnh `-1` đang dùng; còn lại là logo/ảnh cắt/ảnh tạm). Chưa có quyết định quyền, không bản ghi nào dùng → không đưa vào Git; có trong sổ ảnh dưới trạng thái `LIBRARY_ONLY`. Nếu BMSL muốn bộ ảnh đầy đủ hơn cần quyết định riêng và vị trí đặt ảnh. | BMSL |
| Phát hiện mới: **12 tệp media không đọc được khi ẩn danh** | `X-WP-Total` báo 305, danh sách công khai liệt kê 293; phần chênh thuộc bài/đối tượng không công khai (REST trả 401, ví dụ ảnh bìa #179 và #148 của một số bài; ảnh đó vẫn có trong thân bài nên được xử lý). Không thể kiểm khi chưa được cấp quyền đọc; không cố đọc. | Owner (nếu cần, qua kênh đọc có uỷ quyền) |

## 4. Thay đổi trong PR này

* `source-fetch.ts` (mới): đưa phần đọc WordPress (REST, sitemap, thử lại có backoff, chỉ một host, `redirect: error`) ra khỏi
  `generate-cli.ts` để generator và audit **dùng chung một bộ đọc**, không có crawler thứ hai. Hành vi giữ nguyên, trừ một biện pháp phòng ngừa:
  mọi trang REST nay gửi `orderby=id&order=asc` (thứ tự mặc định theo ngày không phải thứ tự toàn phần nên các mục cùng dấu thời gian
  về nguyên tắc có thể lặp/bỏ sót giữa các trang; ảnh bìa/alt text được tra qua danh sách này). Trên nguồn hiện nay hai cách sắp xếp
  trả cùng 293 mục, nên đây là phòng ngừa chứ không phải lỗi đã quan sát được.
* `generator.ts`: chỉ **export** `fidelity()` (thêm tham số `mode`, mặc định giữ hành vi cũ nên pack sinh ra không đổi) để audit dùng lại cùng quy tắc chuẩn hoá/che SĐT, email, không có parser thứ hai.
* `audit.ts`, `audit-cli.ts` (mới): bộ đối chiếu độc lập (tự đọc dòng dữ kiện từ HTML nguồn, ngoại trừ ánh xạ dịch vụ dùng lại
  `parseProjectFacts`), kiểm 235 URL ảnh, băm lại 56 tệp, đối soát số lượng với manifest, phát hiện nguồn đổi sau lúc tạo seed,
  bài/URL mới chưa có trong kiểm kê, đoạn văn nguồn chưa vào seed, và **văn bản nguồn đổi mà giữ nguyên độ dài** (so nội dung với bản ghi đã commit; trang giới thiệu gộp 3 nguồn thì mỗi nguồn phải nằm trong trang). Có test hồi quy cho ca cùng độ dài khác chữ, ca che SĐT hợp lệ và ca đổi số điện thoại (không in lại số). Báo cáo **không bao giờ in văn bản nguồn** (chỉ độ dài + SHA-256 12 ký tự).
* `package.json`: thêm script `seed:bmsl-legacy:audit`. **Không** thêm vào build, start, container-start hay CD.
* Không đổi schema, migration, loader, pack, quyền ảnh, `.github/**`, `deploy/**`, `infra/**`.

## 5. Ngữ nghĩa nạp lại (seed đã cập nhật ≠ dữ liệu đã nạp được cập nhật)

Loader chỉ **tạo mới** và **bỏ qua** bản ghi đã có (cùng slug/đường dẫn cũ); không bao giờ sửa. Do đó:

* DB mới/trống: nạp pack hiện tại cho ra đầy đủ bản nháp (mục 6).
* DB đã nạp trước đây: sửa pack **không** làm đổi bản ghi đã nạp (chỉnh sửa của biên tập viên cũng được giữ). Muốn áp dụng một sửa lỗi
  của pack cho bản ghi cụ thể trên staging: sửa tay trong `/admin`, hoặc (chỉ trên staging cô lập, có sao lưu, qua #78) xoá bản nháp
  seed đó rồi chạy lại `--write` để nạp bản mới. Bản ghi đã xuất bản không bị loader động đến.
* PR này không đổi pack nên **không có gì cần nạp lại**.

## 6. Bằng chứng chạy thật (DB cô lập dùng một lần, không dùng DB/volume thật)

PostgreSQL 16 trong Docker, chỉ nghe `127.0.0.1`, mật khẩu ngẫu nhiên dùng một lần; thư mục media trống riêng. Node 24.18, pnpm 10.34.4.

| Bước | Lệnh | Kết quả |
| --- | --- | --- |
| Migrate DB trống | `pnpm exec payload migrate` | 3 migration áp dụng |
| Dry-run | `pnpm seed:bmsl-legacy` | sẽ tạo 38 bản ghi (15 bài, 2 trang, 17 dự án, 4 lĩnh vực) + 56 ảnh; **0 dòng, 0 tệp được ghi**; 172 ảnh chờ duyệt không nhập |
| Ghi | `pnpm seed:bmsl-legacy --write` | tạo 38 bản ghi, 56 tệp; 0 xung đột |
| Chạy lần 2 | `pnpm seed:bmsl-legacy --write` | tạo **0**, bỏ qua 38 (idempotent), vẫn 56 tệp |
| Trạng thái | truy vấn DB | 17 `projects` + 15 `articles` đều `draft`; 56 `media_assets` đều `UNCONFIRMED`; about/contact là bản nháp |
| Tệp ảnh | băm SHA-256 từng tệp trong thư mục media | 56 tệp, tập hash **bằng đúng** tập `sha256` trong manifest |
| Payload = Git | so sánh văn bản + vị trí node `upload` | 15/15 bài, about, contact: bằng nhau; about có 1 ảnh đúng vị trí |
| Dự án trong DB | truy vấn | 16/17 có 1 ảnh bìa; `a6-nam-trung-yen` không có địa chỉ/quy mô; `b-ia20-ciputra` không có ảnh |
| Test tích hợp | `pnpm test:integration tests/integration/legacy-seed.test.ts` | 11/11 qua (dry-run 0 dòng, ghi, lần 2 = 0, xung đột slug và bản ghi đã xuất bản không bị đụng, chỉnh sửa staff được giữ, **người ẩn danh không đọc được bản ghi/global/media** qua Payload Local API, ảnh APPROVED hiện đúng vị trí rồi biến mất khi thu hồi, chốt chặn production/staging) |

Seed chạy offline: chỉ đọc pack trong Git; ảnh được sao chép từ pack, không có hotlink (kiểm bởi `pack.test.ts`).

## 7. Bàn giao cho #78 (nhập vào mục tiêu)

* Nguồn → seed: **đã đối chiếu xong, sạch** (báo cáo audit). Có thể dùng pack hiện tại cho staging.
* #78 cần: staging cô lập có sao lưu/phục hồi, kiểm kê xung đột với bản ghi mẫu/demo đang có trên live (loader báo xung đột/bỏ qua, không ghi đè), rồi
  chạy `--write` trên **staging** và chụp so sánh nguồn–CMS. **Nhập vào production vẫn là cổng owner riêng** (OWNER_GATE); PR này không cho phép và không làm.
* Chạy lại `pnpm seed:bmsl-legacy:audit --check` ngay trước khi nhập staging để chắc nguồn không đổi.
* Merge PR này: không đổi code chạy lúc build/start, không có migration, không có bước seed tự động (loader không nằm trong `build`/`start`/`container-start`).
  Tuy vậy CD tự động của `main` vẫn sẽ chạy như với mọi merge: **cần người duyệt xác nhận trước khi merge** rằng việc đó không phát hành ra production ngoài ý muốn (theo STOP condition của issue).

## 8. Chưa chứng minh (`NOT_PROVEN`)

* Chưa chạy trên staging/volume Northflank thật, chưa có ảnh chụp so sánh nguồn–admin trên staging (thuộc #78). Bằng chứng ở trên là PostgreSQL local dùng một lần.
* Chưa chạy web server thật để chứng minh bằng HTTP rằng người ẩn danh không thấy bản nháp/ảnh chưa duyệt; chỉ có test tích hợp qua Payload Local API với `overrideAccess:false` (và bằng chứng HTTP của #75).
* Chưa đọc được 12 tệp media của đối tượng không công khai; chưa đọc DB production (cố ý, không được phép).
* Quyền sử dụng ảnh/văn bản, và mọi dữ kiện lịch sử/pháp lý/liên hệ: vẫn `UNCONFIRMED`, thuộc BMSL.
* Audit đối chiếu với **nguồn tại thời điểm chạy** (2026-10-07). Nếu website cũ đổi sau đó, chạy lại.
* Với 32 dòng không có văn bản được commit (4 bị chặn, trang chủ rỗng, 9 trang lưu trữ, 18 nguồn dự án) chỉ phát hiện được thay đổi **độ dài**; dự án được so từng trường dữ kiện nhưng không so toàn văn. Vì không có văn bản trong Git để so, thay đổi cùng độ dài ở các dòng bị chặn không bị phát hiện.
* Chưa có reviewer độc lập và CI exact-head cho PR này (làm sau khi mở PR).
