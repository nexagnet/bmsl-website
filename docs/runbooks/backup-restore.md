# Runbook — Sao lưu và khôi phục thử (backup / restore)

Trạng thái: công cụ và bằng chứng tổng hợp (synthetic) đã chuẩn bị. **Chưa** có lịch sao lưu tại máy chủ thật, **chưa** có
bản sao lưu nào được bàn giao cho BMSL (xem `docs/handover/uat-handover-matrix.md`, các mục `NOT_PROVEN`).

Công cụ nằm ở `scripts/backup/` (ngoài các đường dẫn control-plane được bảo vệ). Kiểm thử: `tests/integration/support/backup-archive.test.ts`,
`backup-safety.test.ts` (chạy trong `pnpm test`) và `tests/integration/backup-restore.test.ts` (chạy trong `pnpm test:integration`,
job CI `integration` có PostgreSQL thật).

## 1. Gói sao lưu (bundle)

Một thư mục **riêng tư** (mode `0700`, tệp `0600`) gồm đúng bốn tệp, tên cố định:

| Tệp | Nội dung |
| --- | --- |
| `manifest.json` | SHA của commit nguồn, trạng thái migration đã áp dụng, SHA-256 + kích thước từng thành phần, dấu vân tay (hash) của schema/nội dung/sequence CSDL, số dòng mỗi bảng. **Không** có dữ liệu dòng, không có mật khẩu |
| `source.bmslarc` | Các tệp thường của **một commit Git** (đọc từ Git objects, không đọc working tree, không có tệp chưa commit). Tệp `.env`, `.env.*` (trừ `.env.example`) bị loại kể cả khi lỡ commit; symlink/submodule trong commit bị từ chối |
| `media.bmslarc` | Thư mục media (`BMSL_MEDIA_DIR` hoặc `media/`), gồm cả tệp gốc và tệp sinh ra |
| `database.dump` | `pg_dump --format=custom --no-owner --no-privileges --no-tablespaces --no-comments` |

**Định dạng lưu trữ.** `source.bmslarc` và `media.bmslarc` dùng định dạng `BMSLARC1` của repo (`scripts/backup/archive.mjs`), **không** dùng tar/zip:
magic 8 byte, độ dài index, index JSON (đường dẫn tương đối, kích thước, SHA-256), rồi byte của tệp. Định dạng **không biểu diễn được**
symlink, hardlink, thư mục hay thiết bị. Khi ghi và khi đọc đều kiểm tra: đường dẫn tuyệt đối, ổ đĩa (`C:`), UNC / dấu `\`, `..`, `.`, đoạn rỗng, ký tự điều khiển,
trùng tên (không phân biệt hoa thường), tệp trùng thư mục, độ dài tệp khớp index. Giải nén chỉ ghi bằng `O_EXCL` vào thư mục **mới** do chính lệnh vừa tạo; lưu trữ được
kiểm tra toàn bộ (cả SHA-256) **trước** khi ghi byte đầu tiên.

## 2. Tạm dừng ghi để có bộ sao lưu nhất quán

Sao lưu nhất quán = CSDL, media và nguồn thuộc cùng một thời điểm. Quy trình bắt buộc:

1. Dừng ứng dụng (`next start`) hoặc chuyển sang chế độ bảo trì ở reverse proxy; xác nhận không còn người ghi vào CSDL hoặc thư mục media.
2. Chạy lệnh backup với cờ `--confirm-writes-paused`. Cờ này là **lời xác nhận của người vận hành** rằng việc ghi đã dừng; công cụ không tự kiểm chứng được điều đó. Không có cờ này lệnh từ chối chạy.
3. Công cụ chạy **hai phép kiểm tra trước/sau** quanh lúc chụp: băm cây media khi đóng gói và băm lại sau `pg_dump`; lấy dấu vân tay CSDL trước và sau `pg_dump`. Nếu hai lần đọc khác nhau, lệnh thất bại và xoá gói dang dở
   (`media changed during capture` / `database fingerprint mismatch`). Hai lần đọc **giống nhau** là một dấu hiệu tốt nhưng **không tự chứng minh** rằng không có ghi đồng thời nào xảy ra (ví dụ một thay đổi được hoàn tác giữa hai lần đọc, hoặc
   thay đổi nằm ngoài dữ liệu được lấy dấu vân tay); sự nhất quán dựa vào lời xác nhận ở bước 2. Trong `manifest.json`, `capture.writesPausedAttested` là lời xác nhận đó; `mediaTreeStable` và `databaseFingerprintStable` chỉ nghĩa là hai phép kiểm tra không thấy khác biệt.
4. Bật lại ứng dụng.

`pg_dump` tự chạy trong một snapshot nhất quán của CSDL; việc tạm dừng là để media và CSDL khớp nhau (quan hệ dự án → ảnh, tài liệu → tệp).

## 3. Lệnh

URL CSDL **không** bao giờ nằm trong tham số dòng lệnh: truyền tên biến môi trường chứa nó. Công cụ chuyển thông tin đăng nhập cho `pg_dump`/`pg_restore` bằng biến môi trường
`PG*` của tiến trình con (môi trường cha **không** được kế thừa) nên không xuất hiện trong danh sách tiến trình hay log.

```
# Sao lưu (Linux/macOS). --out phải là đường dẫn tuyệt đối MỚI, ngoài repo và ngoài mọi Git work tree, thư mục cha đã tồn tại.
BMSL_BACKUP_DATABASE_URL='<postgresql://...>' \
node scripts/backup/cli.mjs backup \
  --out /var/backups/bmsl/2026-10-05T0100 \
  --source-commit <40-hex-sha-dang-chay> \
  --media-dir /srv/bmsl/media \
  --database-url-env BMSL_BACKUP_DATABASE_URL \
  --confirm-writes-paused

# Kiểm tra gói (cấu trúc, quyền riêng tư, SHA-256 từng thành phần, hai kho lưu trữ). Không tạo gì.
node scripts/backup/cli.mjs verify --bundle /var/backups/bmsl/2026-10-05T0100

# Khôi phục thử vào CSDL mới, cô lập, dùng một lần (chỉ máy cục bộ).
BMSL_RESTORE_ADMIN_DATABASE_URL='<postgresql://admin@localhost:5432/postgres>' \
node scripts/backup/cli.mjs restore \
  --bundle /var/backups/bmsl/2026-10-05T0100 \
  --target-dir /var/tmp/bmsl-restore-check \
  --database-name bmsl_restore_$(openssl rand -hex 8) \
  --admin-database-url-env BMSL_RESTORE_ADMIN_DATABASE_URL \
  --cleanup
```

Đầu ra là JSON không chứa bí mật (đường dẫn gói, SHA commit, số migration, số tệp media; với `restore`: đúng những tài nguyên đã tạo). Không có `--cleanup`, tài nguyên được giữ lại để kiểm tra
và JSON ghi rõ cần xoá gì.

Khi lệnh **thất bại**, dòng lỗi chỉ chứa văn bản cố định: thông báo kiểm tra của chính công cụ, hoặc tên công cụ + mã thoát / tín hiệu / quá hạn (ví dụ `pg_restore failed (exit 1)`), hoặc `SQLSTATE` / mã lỗi hệ thống.
Đầu ra (stderr) của `pg_dump`/`pg_restore` **không** được thu thập hay in, vì nó có thể chứa giá trị dòng (vi phạm ràng buộc trích dẫn dữ liệu lead), tên vai trò và chi tiết kết nối; lỗi của máy khách PostgreSQL và lỗi hệ thống tệp
cũng được rút gọn về mã. Các lỗi thật vẫn là lỗi (mã thoát khác 0); không có lỗi nào bị biến thành thành công. Cần chẩn đoán sâu hơn thì chạy lại thủ công `pg_restore --list` hoặc xem log máy chủ PostgreSQL trong môi trường riêng tư của người vận hành.

Yêu cầu: Node 22+, `git`, `pg_dump` và `pg_restore` cùng phiên bản chính **≥** phiên bản máy chủ CSDL (thiếu hoặc lệch phiên bản thì lệnh **thất bại**, không bỏ qua).
`git` là **bắt buộc** cho cả việc đọc nguồn lẫn kiểm tra "đích nằm ngoài Git" (xem §4): thiếu `git`, `git` hỏng hoặc không trả lời được thì lệnh từ chối trước khi tạo bất cứ thứ gì.

Windows: **không hỗ trợ** tạo/khôi phục gói. Quyền `chmod 0700/0600` là thứ giữ gói riêng tư; công cụ chưa xử lý ACL Windows nên **từ chối chạy** thay vì giả vờ bảo mật (`unsupported on Windows`).
Chạy trên Linux/macOS. (Bản build ứng dụng thông thường đã di động nhờ `scripts/build.mjs`; xem mục 8.)

## 4. Quy tắc an toàn của lệnh restore

Chỉ khôi phục **gói do người vận hành tin cậy tạo bằng công cụ này**. SHA-256 chứng minh toàn vẹn, **không** chứng minh nguồn gốc, và một dump PostgreSQL là SQL mà máy chủ sẽ thực thi: không bao giờ khôi phục gói lạ.

* Mọi kiểm tra chạy **trước khi tạo tài nguyên đầu tiên**: tên CSDL, máy chủ cục bộ, gói đầy đủ (thiếu/thừa/hỏng/sai quyền/sai SHA đều bị từ chối), hai kho lưu trữ hợp lệ, thư mục đích (xem dưới), `pg_restore --list` đọc được dump, phiên bản công cụ.
* Chỉ máy chủ cục bộ (`localhost`, `127.0.0.1`, `::1`). Tên đích bắt buộc `bmsl_restore_<12-16 hex>`; tên khác (kể cả CSDL nguồn, CSDL quản trị, `postgres`) bị từ chối. URL kết nối không được mang tham số khác ngoài `sslmode`.
* CSDL đích phải **chưa tồn tại**: công cụ kiểm tra rồi `CREATE DATABASE` (nguyên tử). Một CSDL có sẵn, kể cả rỗng, bị từ chối và **không bao giờ** bị xoá hay ghi. Quyền sở hữu chỉ được ghi nhận sau khi PostgreSQL xác nhận `CREATE`.
* Thư mục đích (`--target-dir`) dùng cùng quy tắc "đầu ra riêng tư chuẩn tắc" như `--out` của backup, kiểm tra **trước** khi tạo CSDL: đường dẫn tuyệt đối; thư mục cha đã tồn tại và **không có symlink ở bất kỳ cấp tổ tiên nào**
  (đường dẫn thật phải trùng đường dẫn được cho, nên symlink trỏ vào repo hay một Git work tree khác đều bị từ chối); nằm **ngoài repo này và ngoài mọi Git work tree** (dữ liệu riêng tư không bao giờ vào Git); thư mục cha không cho nhóm/người khác đổi tên mục
  (không ghi được bởi nhóm/người khác nếu không có sticky bit); đích chưa tồn tại (kể cả symlink treo). Sau khi tạo, thư mục được `chmod 0700` và kiểm tra. `source/` và `media/` được giải nén vào đó qua trình giải nén an toàn.
* **Kiểm tra Git đóng khi lỗi.** "Nằm ngoài Git" chỉ được chấp nhận khi chính `git rev-parse --is-inside-work-tree` trả lời "not a git repository" (mã thoát 128). `git` thiếu hoặc không chạy được, hết thời gian (15 giây), bị tín hiệu dừng, từ chối thư mục
  (ví dụ "dubious ownership"), mã thoát hoặc đầu ra bất ngờ → công cụ **từ chối** với thông báo cố định `cannot verify the destination is outside Git`, trước khi tạo CSDL hay thư mục. Thư mục cha không phải Git hợp lệ vẫn được chấp nhận
  (đây không phải lỗi chung). Văn bản stderr của `git` chỉ dùng để phân loại, không bao giờ được in.
* `pg_restore --no-owner --no-privileges --no-tablespaces --no-comments --no-security-labels --no-publications --no-subscriptions --exit-on-error --single-transaction --dbname=<đích>`: không dùng `--create`/`--clean`, lưu trữ không thể
  chọn đích, owner/ACL/tablespace gốc bị bỏ. Có giới hạn thời gian (mặc định 10 phút; `--timeout-seconds`); quá hạn thì cả nhóm tiến trình bị dừng.
* Sau khi khôi phục, so sánh lại dấu vân tay schema / nội dung (md5 từng bảng) / sequence / trạng thái migration với manifest, và băm lại cây media + nguồn.
* Khi thất bại ở bất kỳ bước nào sau khi tạo tài nguyên, công cụ xoá **chỉ** CSDL và thư mục mà chính lần chạy đó tạo ra. CSDL chỉ bị `DROP` khi PostgreSQL báo **không còn phiên nào** (không `WITH (FORCE)`, không kết thúc phiên của ai). Gói gốc, media/nguồn gốc và mọi
  thư mục/CSDL có sẵn không bao giờ bị động tới.

## 5. Bằng chứng tổng hợp (synthetic, dùng một lần)

`tests/integration/backup-restore.test.ts` chạy trong bước CI bắt buộc hiện có (`pnpm test:integration`); không có workflow nào bị sửa. Dữ liệu hoàn toàn giả lập. Nó sở hữu: CSDL nguồn `bmsl_bkp_src_<hex>`,
CSDL rỗng `bmsl_bkp_empty_<hex>`, một CSDL mồi `bmsl_restore_<hex>` (để chứng minh bị từ chối), và một thư mục tạm riêng tư; mọi CSDL restore do chính `restoreBundle` tạo và xoá.

| Chứng minh | Cách kiểm tra |
| --- | --- |
| Sao lưu mã nguồn + PostgreSQL + media giả lập qua **CLI thật**; gói riêng tư (`0700/0600`), ngoài repo, không `.env*`, không mật khẩu/PII trong manifest hay log | test `creates one consistent, private bundle...` |
| Trạng thái migration trong manifest = các migration đã commit | so tên với `src/migrations` |
| Khôi phục vào CSDL **khác biệt**, so schema/nội dung/sequence/migration + cây media | `restores, compares ...` (kết nối mới độc lập với công cụ) |
| Lead giả lập còn nguyên; dự án → ảnh và tài liệu → tệp phân giải đúng tệp gốc (SHA-256 byte-cho-byte); tạo lead mới sau restore được (sequence tiếp tục) | fixture `use-restored` chạy Payload thật trên CSDL đã khôi phục |
| Đóng worker/pool: sau mỗi fixture, `pg_stat_activity` không còn phiên; không dựa vào `payload.destroy()` | `sessions(...) === 0` |
| CSDL có sẵn bị từ chối và không bị đụng; thư mục đích có sẵn bị từ chối; tên không hợp lệ bị từ chối trước mọi thay đổi | các test `rejects ...` |
| Thư mục đích (restore) hoặc đầu ra (backup) nằm trong Git work tree khác, trong repo, hoặc đi qua symlink (tới thư mục thường, tới Git work tree khác, tới repo) → bị từ chối **trước** khi tạo CSDL; không CSDL, thư mục đích, gói gốc, media nguồn hay tài nguyên không liên quan nào bị thay đổi | `restore target must be a canonical private location...`, `refuses backup output reached through a symbolic link...`, và các test thuần `validatePrivateDestination` |
| `git` thiếu / thoát mã 1 / từ chối thư mục (dubious ownership) / bị tín hiệu dừng / in đầu ra bất ngờ, trong khi `pg_restore`/`pg_dump` vẫn chạy được (CLI thật, PATH có công cụ PostgreSQL nhưng `git` giả hoặc thiếu) → restore từ chối thư mục đích riêng tư thông thường với `cannot verify the destination is outside Git`; **không** tạo CSDL hay thư mục, gói gốc/media nguồn/CSDL nguồn/tệp lân cận nguyên vẹn. Thư mục đích thông thường không phải Git (với `git` thật) vẫn được chấp nhận và khôi phục xong | `fails closed when Git is missing or broken...` và `insideGitWorkTree fails closed when Git cannot answer` (unit) |
| Gói thiếu thành phần / hỏng từng thành phần / dump bị cắt / tệp thừa / quyền không riêng tư → bị từ chối, **không tạo CSDL nào** | `incomplete, corrupt or inconsistent bundles` |
| manifest nói sai về dữ liệu đã khôi phục → bị phát hiện **sau** khi tạo, tài nguyên do lần chạy đó tạo bị dọn | `lying manifest` |
| `pg_restore` quá hạn, ghi media dở dang, lỗi worker ngay sau `CREATE DATABASE` → dọn đúng tài nguyên đã tạo; gói, media nguồn và tệp lân cận còn nguyên | `worker failure and bounded cleanup` |
| `pg_restore` giả in PII của lead + mật khẩu ra stderr rồi thoát mã 1 (qua CLI thật, sau khi đã tạo CSDL): dòng lỗi chỉ có `pg_restore failed (exit 1)`, **không** có PII/mật khẩu/giá trị dòng, CSDL và thư mục của lần chạy bị dọn; lỗi PostgreSQL thật có trích giá trị chỉ còn `SQLSTATE`; không kết nối được chỉ còn `ECONNREFUSED`, không có mật khẩu hay máy chủ | `failure text never carries row values, tool output or credentials`, và các test thuần `runTool` / `toPublicError` |
| Từ chối backup: thiếu `--confirm-writes-paused`, đầu ra trong repo/đã tồn tại, SHA không đủ 40 hex, media tương đối, tham số URL lạ, CSDL chưa migrate | `refuses unsafe backup invocations` |
| Kho lưu trữ: đường dẫn tuyệt đối/ổ đĩa/UNC/`..`/symlink/hardlink/thư mục có sẵn, cắt cụt, đệm thừa, byte hỏng, ghi dở | `backup-archive.test.ts` (test thuần, không cần CSDL) |

Dọn dẹp: mọi tài nguyên do test tạo nằm trong CSDL `bmsl_it_*` của lần chạy tích hợp hoặc thư mục tạm riêng; `afterAll` xoá đúng những gì đã tạo.
Kết quả được in thành dòng `W5C_BACKUP_REPORT {...}` trong log CI (chỉ có hash và số đếm). Trường `sourceCommit` là `git rev-parse HEAD` của bản checkout mà CI dùng để chạy test (commit Git được chọn làm nguồn sao lưu); nó **không** được khẳng định là
HEAD của pull request (merge ref hoặc checkout khác có thể khác). Bằng chứng cho một HEAD cụ thể chỉ là CI chạy trên đúng HEAD đó.

**Không chứng minh:** lịch sao lưu tại máy chủ thật; sao lưu off-site; khôi phục từ dữ liệu thật của BMSL; sao lưu trên Windows; hiệu năng với khối lượng media lớn; rằng không có ghi đồng thời nào xảy ra khi chụp (chỉ có lời xác nhận của người vận hành cộng hai phép kiểm tra trước/sau).

## 6. Lịch sao lưu và trách nhiệm

Nếu nhà cung cấp hosting hỗ trợ, người vận hành tại máy chủ chịu trách nhiệm đặt lịch (cron/systemd timer) cho quy trình mục 2–3, lưu **off-site** và thử `verify`/`restore` định kỳ. Repo không có quyền truy cập máy chủ nên
**không tuyên bố đã có lịch sao lưu**. Chu kỳ lưu giữ, nơi lưu off-site, người chịu trách nhiệm và việc mã hoá lưu trữ là quyết định của BMSL/nhà cung cấp (chưa có).

Gói chứa PII của lead, hash mật khẩu và phiên đăng nhập: không đưa vào Git, không đăng làm artifact CI công khai, không gửi qua kênh không mã hoá.

## 7. Xoay `PAYLOAD_SECRET`

`PAYLOAD_SECRET` ký mã đăng nhập (JWT) của Payload. Khi đổi: mọi phiên đăng nhập hiện tại **hết hiệu lực** và người dùng phải đăng nhập lại; mật khẩu (đã băm trong CSDL) **không** bị ảnh hưởng.
Quy trình: tạo giá trị mới ngẫu nhiên ở nơi bảo mật → cập nhật biến môi trường của dịch vụ → khởi động lại → thông báo nhân sự đăng nhập lại. Không sao chép giá trị thật vào repo, ticket, log hay gói sao lưu.
Bản sao lưu CSDL không chứa `PAYLOAD_SECRET`; lưu giữ bí mật này riêng, nếu mất thì chỉ mất các phiên (không mất dữ liệu).

## 8. Build ứng dụng thông thường

`pnpm build` = `node scripts/build.mjs`: chạy `payload generate:importmap` (với `NEXT_PHASE=phase-production-build` chỉ cho tiến trình con đó, không cần CSDL), dừng nếu lỗi, rồi `next build` với môi trường của người gọi
(môi trường chạy production vẫn fail-fast). Không dùng cú pháp shell đặc thù nên di động giữa sh/cmd/PowerShell; kiểm thử bằng `build-launcher.test.ts` (6 kiểm tra).
Trạng thái chứng minh: CI Linux (job `verify` chạy `pnpm build`; job `integration` build lại qua `http-smoke`). Build đầy đủ trên Windows thật và build tại máy chủ production thật **chưa được chạy** (`NOT_PROVEN`).

## 9. Giới hạn đã biết

* Gói dùng bộ nhớ tỉ lệ với kích thước nguồn khi đóng gói mã nguồn (đọc từ Git; vài MB). Media được băm/ghi theo luồng.
* `contentHash` dùng `md5` của văn bản dòng chỉ để so sánh hai CSDL; tính toàn vẹn của dump dựa trên SHA-256.
* Công cụ không mã hoá gói. Mã hoá lúc nghỉ là trách nhiệm của đích lưu trữ.
* Trên macOS, `/tmp` và `/var` là symlink: dùng đường dẫn thật (ví dụ `/private/tmp/...`) cho `--out`/`--target-dir`, vì đường dẫn đi qua symlink bị từ chối.
