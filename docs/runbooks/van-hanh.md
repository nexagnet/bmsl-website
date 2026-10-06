# Runbook vận hành — BMSL Website

Dành cho người vận hành kỹ thuật. Phần lớn lệnh dưới đây là quy trình **đã chuẩn bị**. Môi trường Northflank thật đã được điều phối viên dựng và xác minh một phần ngày 2026-10-06 (§10.0); CD do push, DNS tuỳ chỉnh, lịch sao lưu tại host và các đầu vào khách hàng vẫn
`NOT_PROVEN` (xem `docs/handover/uat-handover-matrix.md`). Không điền giá trị thật vào repo, ticket hay log.

## 1. Cấu hình môi trường

| Biến | Bắt buộc | Ý nghĩa |
| --- | --- | --- |
| `DATABASE_URL` | Có (runtime) | URL PostgreSQL của website. Thiếu thì ứng dụng **không khởi động** (fail-fast). Chỉ giai đoạn build dùng giá trị rỗng vô hại |
| `PAYLOAD_SECRET` | Có (runtime) | Bí mật ký phiên đăng nhập. Ngẫu nhiên, dài, giữ riêng. Xoay: xem `backup-restore.md` §7 |
| `SITE_URL` | Có khi deploy | Origin chuẩn (canonical, sitemap, kiểm tra Origin). Khi không đặt chỉ `http://localhost:3000` được tin cậy |
| `TRUSTED_ORIGINS` | Tuỳ chọn | Danh sách origin đầy đủ (scheme+host+port) cách nhau bằng dấu phẩy, ví dụ host `www` đã được duyệt |
| `INITIAL_ADMIN_BOOTSTRAP_TOKEN` | Chỉ khi tạo ADMIN đầu tiên | ≥ 32 ký tự do người vận hành tự sinh; không có giá trị mặc định; **gỡ bỏ ngay sau khi dùng** |
| `BMSL_MEDIA_DIR` | Khuyến nghị khi tách media | Đường dẫn **tuyệt đối** tới ổ/thư mục media bền vững. Mặc định `media/` trong repo. Đường dẫn tương đối bị từ chối |
| `HSTS_ENABLED` | Tuỳ chọn, **thời điểm build** | `true` chỉ sau khi HTTPS đã xác nhận trên domain thật. Header được cố định lúc `next build` (`next.config.mjs`): đặt ở runtime **không** đổi header đã build; với image dùng build arg (§10) |
| `CSP_ALLOW_GA4` | Tuỳ chọn, **thời điểm build** | `true` chỉ cùng với một property GA4 đã được duyệt; cùng quy tắc thời điểm build như trên |
| `CONTACT_RATE_LIMIT_MAX`, `CONTACT_RATE_LIMIT_WINDOW_SECONDS` | Tuỳ chọn | Giới hạn fail-closed của form liên hệ (mặc định 30 / 600 giây, một bucket mỗi tiến trình Node) |
| `BMSL_ALLOW_SEED`, `BMSL_IMPORT_ALLOW_STAGING` | Hiếm | Chỉ khi chủ phê duyệt (xem §5) |

Mẫu: `.env.example` (chỉ tên giả). `.env*` không bao giờ được commit và không nằm trong gói sao lưu mã nguồn.

## 2. Tách máy chủ CSDL và media

* **CSDL:** PostgreSQL riêng (khuyến nghị dịch vụ được quản lý), TLS (`?sslmode=require` trong `DATABASE_URL`), người dùng ứng dụng không phải superuser, mạng chỉ cho phép máy chủ ứng dụng.
* **Media:** thư mục bền vững (`BMSL_MEDIA_DIR`) gắn vào máy chủ ứng dụng; tệp được ứng dụng phục vụ qua route của Payload và chỉ khi `rightsStatus=APPROVED`. Chưa có bộ chuyển đổi object storage/CDN.
  Thư mục media **phải** nằm trong sao lưu và được khôi phục cùng CSDL (quan hệ dự án → ảnh dựa vào tên tệp).
* Cả hai nằm trong quy trình sao lưu nhất quán (`backup-restore.md` §2).

## 3. Khởi động development / staging

```
pnpm install --frozen-lockfile
# đặt DATABASE_URL, PAYLOAD_SECRET, SITE_URL (staging) trong môi trường, không trong repo
pnpm exec payload migrate          # áp dụng các migration đã commit (src/migrations)
pnpm dev                           # development
# staging / production-like:
pnpm build && pnpm start
```

Schema chỉ thay đổi bằng migration đã commit (không auto-push). Adapter đặt `prodMigrations`, vì vậy ở `NODE_ENV=production` các migration đã commit cũng được áp dụng khi dịch vụ khởi tạo (theo tài liệu Payload; tests của repo
chứng minh `payload.db.migrate()` lên/xuống/lên, và CI kiểm tra không lệch schema). Vẫn nên chạy `payload migrate` có chủ đích trước khi chuyển lưu lượng.

## 4. Tạo ADMIN đầu tiên một cách an toàn

1. Sinh token ngẫu nhiên tại chỗ (ví dụ `openssl rand -hex 32`) và đặt `INITIAL_ADMIN_BOOTSTRAP_TOKEN`; khởi động dịch vụ trên **mạng riêng** (hoặc chưa mở cho công chúng).
2. Gửi một lần `POST /api/users/first-register` với header `x-bootstrap-token: <token>` và JSON gồm `email`, `password` (do người nhận bàn giao chọn; không dùng mật khẩu mặc định/chung). Tài khoản đầu tiên luôn nhận vai trò `ADMIN`.
3. **Gỡ** `INITIAL_ADMIN_BOOTSTRAP_TOKEN` và khởi động lại. Sau khi đã có người dùng, mọi request mạng không phải ADMIN đều bị từ chối tạo tài khoản; màn hình "tạo người dùng đầu tiên" của giao diện không còn tạo được qua HTTP.
4. Đăng nhập, đổi mật khẩu nếu cần, tạo tài khoản EDITOR trong **Users** (chỉ ADMIN). Đăng nhập sai 5 lần khoá 10 phút; phiên hết hạn sau 2 giờ.
5. Chuyển giao tài khoản ADMIN cao nhất cho BMSL qua kênh an toàn đã thống nhất: **không** gửi mật khẩu qua email/chat thường, **không** ghi vào repo. Việc chuyển giao thật chưa diễn ra (`NOT_PROVEN`).

Mật khẩu quên: chưa cấu hình gửi email của Payload trong repo này, vì vậy quy trình đặt lại là ADMIN đặt mật khẩu mới cho người dùng trong giao diện. Nếu mất **mọi** tài khoản ADMIN, cần người vận hành tạo lại bằng cách dùng quyền
Local API của máy chủ (không có đường HTTP) — việc này cần quyền truy cập máy chủ và chưa được diễn tập.

## 5. Seed và dữ liệu legacy (chỉ khi được phép)

* `pnpm seed:service-areas`: bốn lĩnh vực dịch vụ; bị từ chối ở production trừ khi `BMSL_ALLOW_SEED=true` (chỉ sau khi chủ đồng ý).
* `pnpm migrate:legacy`: mặc định dry-run; ghi dữ liệu bản nháp chỉ ở local/staging. Chi tiết: `docs/migration/w4-legacy-migration.md`. Toàn bộ nội dung legacy giữ `UNCONFIRMED`/nháp cho tới khi BMSL duyệt.
* `pnpm seed:bmsl-legacy [--write]`: bộ seed ban đầu lưu trong Git (nội dung + ảnh được phép của website cũ), nạp offline, mặc định dry-run, không bao giờ chạy tự động và bị từ chối ở production. Chi tiết và danh sách BMSL cần duyệt: `docs/migration/w75-legacy-seed-pack.md`.

## 6. Log không chứa PII

* Ứng dụng chỉ ghi `error.name` khi lưu/gửi thông báo lead thất bại; không ghi tên, điện thoại, email, nội dung. Giữ nguyên tắc này khi thêm log mới.
* Reverse proxy/WAF: tắt ghi **body** và query string của `POST /lien-he/gui`; không bật `log_statement=all` ở PostgreSQL; phân quyền và xoay vòng log.
* Báo cáo sao lưu/khôi phục chỉ chứa hash và số đếm; không dán gói, dump hay URL CSDL vào ticket. Dòng lỗi của CLI sao lưu/khôi phục chỉ có văn bản cố định, mã thoát/tín hiệu và `SQLSTATE` (không có đầu ra của `pg_dump`/`pg_restore`, giá trị dòng hay thông số kết nối): xem `backup-restore.md` §3.

## 7. Xoay bí mật

| Bí mật | Cách xoay | Hệ quả |
| --- | --- | --- |
| `PAYLOAD_SECRET` | Đặt giá trị mới, khởi động lại | Mọi phiên đăng nhập hết hiệu lực; mật khẩu không đổi |
| Mật khẩu CSDL | Đổi ở PostgreSQL, cập nhật `DATABASE_URL`, khởi động lại | Gián đoạn ngắn |
| `INITIAL_ADMIN_BOOTSTRAP_TOKEN` | Gỡ sau khi dùng; sinh mới cho lần bootstrap sau | Không có giá trị mặc định |
| Mật khẩu người dùng | ADMIN đặt lại trong CMS | — |

## 8. Sao lưu, khôi phục, rollback

* Sao lưu/khôi phục thử: `docs/runbooks/backup-restore.md`. Trách nhiệm đặt lịch tại host thuộc người vận hành host; **chưa** có lịch thật (`NOT_PROVEN`).
* Rollback ứng dụng: triển khai lại commit trước đó đã được kiểm chứng; migration có `down` đã commit, nhưng chỉ chạy `down` sau khi đã có bản sao lưu và đã thử trên bản khôi phục.
  Rollback dữ liệu = khôi phục gói sao lưu vào CSDL **mới**, kiểm tra, rồi mới chuyển ứng dụng sang đó (không ghi đè CSDL đang chạy).
* Lệnh `restore` của công cụ cố ý **không** ghi đè CSDL production; dùng nó để kiểm chứng gói, không để thay thế sống.

## 9. Sự cố và xử lý lead

* Lead được **lưu vào PostgreSQL trước** mọi tác vụ thông báo; nếu lưu thất bại, người dùng nhận lỗi 500 an toàn và không có dòng nào được tạo. Hiện **chưa có kênh thông báo** được cấu hình: ADMIN phải xem mục **Contact Leads** trong `/admin`.
* Chỉ ADMIN đọc/sửa lead; không ai xoá được qua API. Lead giả/bot (honeypot) được xác nhận nhưng không lưu.
* Khi nghi ngờ lạm dụng: giảm `CONTACT_RATE_LIMIT_MAX`, chặn ở edge/WAF (bảo vệ chống lạm dụng ở production là quyết định hạ tầng, `NOT_PROVEN`). Khi nghi lộ dữ liệu: xoay `PAYLOAD_SECRET`, mật khẩu CSDL, đổi mật khẩu ADMIN, đánh giá phạm vi, báo cáo BMSL.
* Khi lệch/hỏng dữ liệu: dừng ghi, khôi phục bản sao lưu gần nhất vào CSDL mới, so sánh, quyết định cùng BMSL.

## 10. Triển khai container trên Northflank

Repo có `Dockerfile` + `.dockerignore` ở thư mục gốc. Builder chỉ chuẩn bị mã; việc tạo tài nguyên, build image, deploy và cấu hình CD trên Northflank do điều phối viên thực hiện (kết quả báo cáo ở §10.0; Builder không thao tác nền tảng). Image **không** chứa `.env`, media, bản sao lưu hay bí mật.

### 10.0 Môi trường thật đã triển khai (điều phối viên báo cáo, xác minh 2026-10-06 03:31 UTC)

Bản triển khai thật do điều phối viên dựng; Builder không truy cập nền tảng. Không có giá trị bí mật nào được ghi ở đây.

* **Dự án:** `bmsl-website`, riêng biệt, gói miễn phí vùng Europe West (London) (Singapore không có trong gói miễn phí). Dự án thử nghiệm CD cũ của Nexagnet (dùng một lần) đã được gỡ, theo uỷ quyền của người dùng, để giải phóng hạn mức Sandbox; hạn mức **không còn** chặn việc tạo/triển khai BMSL (chỉ là lịch sử).
* **URL HTTPS công khai:** https://http--bmsl-web--wkbbfyv6gcrp.code.run (domain do Northflank cấp; **không phải** domain tuỳ chỉnh của BMSL).
* **Web `bmsl-web`:** 1 instance `nf-compute-20`, chiến lược `Recreate` (API chấp nhận, GET xác nhận); CD tự động độc lập của dịch vụ **đã tắt**.
* **Build `bmsl-build`:** CI gốc của dịch vụ build **đã tắt**; chỉ workflow chủ động khởi chạy build. Build đặt `HSTS_ENABLED=true`, `CSP_ALLOW_GA4=false`.
* **CSDL:** addon PostgreSQL 16 riêng `bmsl-postgres`, TLS trong mạng riêng, database thường `bmsl`; không dùng CSDL chung của nền tảng.
* **Media:** volume NVMe RWO bền vững `bmsl-media` 6 GB, trạng thái BOUND, gắn tại `/data/media`.
* **Bí mật runtime:** sinh riêng tư; `SITE_URL` là URL HTTPS thật ở trên. **Chưa** tạo tài khoản ADMIN hay token bootstrap ban đầu.
* **Build chính:** `meek-dolls-7450` SUCCESS cho commit `6a6433f`. CI exact-main run 37407312565 PASS (464 unit, 581 integration, 19 file, gồm 13 test Docker thật).
* **Kiểm tra trực tiếp:** 8 route IA, `robots.txt`, `sitemap.xml`, `/healthz` trả 200; `/healthz` chỉ trả trạng thái tối thiểu `ok` kèm `no-store`; trang gốc có HSTS và CSP; `/api/users` ẩn danh trả 403.
* **Cổng CI thật:** job `bmsl-ci-gate` chạy thật (run `c510e91c-4f11-4f22-9e87-4fe5113cf605`) SUCCESS với image đã review cố định `meek-dolls-7450`, gọi API GitHub công khai thật, không dùng fixture/preload vận chuyển.

Phân loại bằng chứng:

| Nhóm | Nội dung |
| --- | --- |
| Đã kiểm thử kỹ thuật (CI) | Mã, migration, cổng CI (unit/mock + tiến trình thật), proof Docker (§10.1) |
| Triển khai thật đã quan sát | Dự án, dịch vụ, CSDL, volume, URL HTTPS, build chính, healthz/header, job cổng (danh sách trên) |
| Đã cấu hình nhưng **chưa chứng minh** CD do push | Workflow `bmsl-main-delivery` tồn tại và trigger bật; lần chạy tự động do push (Build → cổng → Release) đang **chờ** (PENDING) khi soạn tài liệu |
| `NOT_PROVEN` | Hạn mức API GitHub công khai bền vững và token đọc-tối-thiểu; nội dung đã duyệt; chuyển giao ADMIN đầu tiên; đào tạo và UAT bằng văn bản; GA4/Search Console thật; DNS tuỳ chỉnh; sao lưu off-site và giao cho khách hàng |

**Tài nguyên (tách riêng, một instance ban đầu):**
* Một PostgreSQL **riêng cho BMSL**, với database đã được **tạo sẵn** bởi người vận hành (ứng dụng được cấu hình `disableCreateDatabase: true`: nếu database trong `DATABASE_URL` không tồn tại, ứng dụng **không** tự chạy `CREATE DATABASE` mà báo lỗi/`/healthz` trả 503). **Không bao giờ** dùng lại CSDL của ứng dụng Nexagnet.
* Một **volume bền vững** riêng gắn vào dịch vụ BMSL, ví dụ mount `/data/media`; đặt `BMSL_MEDIA_DIR=/data/media`. Không dùng lưu trữ tạm của container cho upload. Tiến trình chạy bằng user `node` (uid 1000): volume phải ghi được bởi user này, nếu không container tự dừng với lỗi cố định (`BMSL_MEDIA_DIR is not writable`).
* Chỉ chạy **1 instance** (giới hạn form liên hệ là bộ nhớ theo tiến trình; media nằm trên một volume; migration khi khởi động không có khoá nên không được khởi động song song nhiều instance).

**Biến môi trường runtime (đặt dưới dạng secret của Northflank, không đặt ở build-arg):** `DATABASE_URL` (CSDL riêng, `?sslmode=require` nếu nhà cung cấp hỗ trợ), `PAYLOAD_SECRET`, `BMSL_MEDIA_DIR`, `SITE_URL` = **URL HTTPS thực tế** do Northflank cấp (cập nhật khi đổi domain; kiểm tra Origin dựa vào giá trị này). `PORT` do nền tảng cấp (mặc định 3000); ứng dụng lắng nghe `0.0.0.0`. Thiếu `DATABASE_URL`/`PAYLOAD_SECRET`/`BMSL_MEDIA_DIR` thì container thoát ngay (fail-closed).

**Header bảo mật HSTS/GA4 (cấu hình thời điểm build, không phải bí mật):** `next.config.mjs` tạo header lúc `next build`, nên `HSTS_ENABLED` và `CSP_ALLOW_GA4` chỉ có hiệu lực khi truyền qua **build arg** của Dockerfile (`HSTS_ENABLED`, `CSP_ALLOW_GA4`, mặc định `false`); đặt chúng ở runtime sẽ **không** thay đổi header đã build. Không bao giờ truyền bí mật qua build arg (lộ trong lịch sử image). Giữ analytics tắt (`CSP_ALLOW_GA4=false`, không bật mã GA4 trong CMS) cho tới khi BMSL xác nhận; chỉ bật `HSTS_ENABLED=true` (build lại image) sau khi HTTPS đã kiểm chứng. Sau khi build, kiểm chứng bằng `curl -I` trên URL thật. Điều phối viên báo cáo HSTS và CSP có mặt ở trang gốc của URL Northflank; HSTS/CSP trên domain tuỳ chỉnh và GA4 thật vẫn `NOT_PROVEN`.

**Migration:** không áp dụng khi build image. Khi khởi động, Payload áp dụng các migration đã commit (`prodMigrations`, vòng đời hiện có) lên database đã tồn tại rồi mới sẵn sàng; không có reset/seed/xoá dữ liệu tự động. **Không có khoá advisory** được triển khai hay chứng minh cho bước này (khoá advisory của bootstrap ADMIN đầu tiên là việc khác, không liên quan), vì vậy bắt buộc giữ đúng 1 instance và không rolling/blue-green song song khi có migration mới.

**Health check:** `GET /healthz` (chỉ đọc, `Cache-Control: no-store`). `200 {"status":"ok"}` chỉ khi kết nối PostgreSQL của runtime trả lời và **mọi** migration đã commit đã được ghi nhận; ngược lại `503 {"status":"unavailable"}`, không lộ chi tiết CSDL/bí mật. Truy vấn dùng lại pool của Payload (không tạo pool mới), tối đa một truy vấn kiểm tra tại một thời điểm, có `lock_timeout`/`statement_timeout` 2 giây phía máy chủ và `connectionTimeoutMillis` 5 giây của pool, nên khoá bảng `payload_migrations` không làm tích tụ truy vấn treo. Dùng cho readiness (và liveness với ngưỡng lỗi rộng rãi, ví dụ khởi động có thể chậm do migration).

**Build / deploy:** build đúng commit `main` SHA đã được CI xác minh (`verify` + `integration`) và đối chiếu SHA đó với image đang chạy. Ghi lại SHA/ tag image mỗi lần deploy.

**ADMIN đầu tiên:** theo §4, qua kênh riêng đã được duyệt (đặt `INITIAL_ADMIN_BOOTSTRAP_TOKEN` tạm thời, ưu tiên mạng riêng/chưa mở công khai, gỡ ngay sau khi dùng). Không đặt mật khẩu mặc định, không ghi vào repo/log.

**Rollback:** triển khai lại **image trước đó đã xác minh**; giữ nguyên CSDL và volume media. Không chạy migration `down` hay ghi đè CSDL khi rollback ứng dụng; nếu migration mới không tương thích, dùng quy trình khôi phục vào CSDL mới (§8, `backup-restore.md`).

**Nhóm (group) của image và volume:** image chạy bằng `USER node:node` (uid 1000, gid 1000, vẫn không phải root; mã ứng dụng chỉ đọc). Northflank xác định quyền sở hữu volume bền vững theo **group của image tại thời điểm build**, nên group được khai báo tường minh; không có bước `chown` root khi khởi động. Quyền ghi vào volume gắn tại `/data/media` được kiểm chứng trong proof Docker của CI (xem "Bằng chứng trong CI" bên dưới), còn volume thật trên Northflank vẫn là việc điều phối viên chứng minh.

### 10.1 Quy trình CD gốc (native) của Northflank: cổng "exact-main CI"

Mục tiêu: mỗi lần `git push` lên `main` chỉ deploy đúng commit đã được CI chính thức (workflow `ci`, job `verify` **và** `integration`) xác nhận thành công. Workflow `bmsl-main-delivery` **đã tồn tại** và trigger đã bật (API CREATE rồi UPDATE/GET chấp nhận), nhưng **chưa có lần chạy tự động do push hoàn tất**: Build → cổng → Release đang `PENDING` khi soạn tài liệu. Không được coi là "CD xong" cho tới khi một push thật build thật, qua cổng, release thật và `/healthz` 200. Điều phối viên sẽ ghi kết quả thật vào metadata PR/báo cáo sau merge; tài liệu này không nhúng SHA của chính nó.

**Luồng (tuần tự, mọi bước dùng đúng SHA kích hoạt ban đầu):**
1. **Trigger**: `git push` lên `main` (VCS trigger, ghim `refs.mainPush.sha`).
2. **Build** ứng dụng với đúng SHA kích hoạt đó (không phải `latest`, không phải đầu nhánh hiện tại).
3. **Cổng CI (JobRun, `condition: success`)**: chạy job đã tạo sẵn từ **một image cổng cố định, đã được review trước đó (hiện là build `meek-dolls-7450`; ghim theo build ID/digest bất biến, không dùng `latest`, không dùng script của chính commit ứng viên chưa được xác minh)**, với lệnh ghi đè `node scripts/cd/gate-main-ci.mjs` và biến môi trường **theo từng lần chạy** `BMSL_TARGET_SHA=${refs.mainPush.sha}`. Job chỉ thoát 0 khi CI tin cậy của đúng SHA đó hoàn tất thành công và `main` vẫn đúng là SHA đó; mọi trường hợp khác (CI fail/cancel/skip/neutral/timeout, thiếu job hoặc bước, run giả mạo, attempt cũ, `main` đã bị vượt, lỗi/giới hạn API, quá hạn) đều thoát khác 0 và workflow dừng ở đây.
4. **Release**: chỉ khi cổng thành công, deploy **đúng bản build ứng viên đã build ở bước 2** (tham chiếu build ID bất biến `${refs.appBuild.id}`, không phải `latest`), chờ dịch vụ healthy (`GET /healthz` = 200), rồi chạy smoke check (trang chủ, `/healthz`).
5. **Tuần tự hoá**: khuyến nghị `concurrencyPolicy: latest` kèm chiến lược triển khai `recreate` đã được GET xác nhận (xem "Điều kiện an toàn một instance"). `latest` chỉ giữ lại lần chạy **xếp hàng** mới nhất; nó **không** huỷ công việc đang chạy (chính sách `replace` mới dừng các lần chạy đang hoạt động, theo https://northflank.com/docs/v1/application/release/configure-workflows#concurrency-policy). Cổng và release bất biến **không** làm việc thay thế (supersession) trở nên nguyên tử sau khi bước Release đã bắt đầu: một lần chạy cũ đang release vẫn có thể hoàn tất. Không được tuyên bố rằng việc huỷ một lần chạy sẽ rollback migration an toàn; không có cơ chế đó. Hành vi hàng đợi/supersession thật trên nền tảng vẫn `NOT_PROVEN`.

**Phải tắt** cơ chế tự deploy gốc độc lập của dịch vụ (auto-deploy theo commit/Git checks; hiện đã tắt theo báo cáo điều phối viên): nếu bật, nó đi vòng qua cổng. Đặc biệt, "check suite Git thành công" của Northflank chỉ phủ **một** check suite của PR và **không** chờ các suite bắt buộc khác, nên **không** được dùng làm bằng chứng "CI exact-main xong".

**Cổng (`scripts/cd/gate-main-ci.mjs`) kiểm tra, cố định trong mã:** repository `nexagnet/bmsl-website`, nhánh `main`, workflow id `375023465`, đường dẫn `.github/workflows/ci.yml`, sự kiện `push`, `head_branch=main`, `head_sha` = SHA ứng viên, `head_repository` đúng repo; chọn run **mới nhất** của SHA và **attempt mới nhất**; tải job của **đúng attempt đó** (có phân trang, thiếu trang là lỗi) và yêu cầu **cả** `verify` và `integration` `completed/success`, cùng hai bước `Application verify scripts` và `Required application integration suite` đều `completed/success` (job xanh nhưng bước bị skip bị từ chối); đọc lại run/attempt/run mới nhất trước khi chấp nhận và xác nhận `main` vẫn đúng là SHA ứng viên ngay trước khi thoát 0. Chỉ gọi GitHub REST (GET) tới `api.github.com`; token là tuỳ chọn (`BMSL_GITHUB_TOKEN`, chỉ từ biến môi trường, quyền đọc tối thiểu cho repo BMSL: Actions + Contents/metadata read; **không** sao chép token OAuth rộng của người điều phối) và không bao giờ được ghi log; chỉ in SHA/run/attempt/trạng thái. Mã thoát: `0` đạt, `1` CI/không đủ điều kiện, `2` cấu hình sai, `3` `main` đã bị vượt, `4` quá hạn, `5` lỗi/giới hạn API, `143` SIGTERM. Tuỳ chỉnh có giới hạn: `BMSL_GATE_TIMEOUT_SECONDS` (mặc định 1500, tối đa 3600), `BMSL_GATE_POLL_SECONDS` (mặc định 60, 1–300).

**Hạn mức API:** API GitHub không xác thực chỉ có hạn mức thấp theo IP dùng chung (60 yêu cầu/giờ). Một lần chạy cổng thật đã thành công với API công khai (§10.0) nhưng chỉ là một mẫu. Khi còn chờ, mỗi vòng chỉ gọi **một** yêu cầu (danh sách run), các yêu cầu nặng hơn chỉ chạy khi run đã hoàn tất; `Retry-After`/`x-ratelimit-reset` được tôn trọng nếu chờ xong vẫn nằm trong hạn tổng, nếu không thì **fail closed**. Dùng được không token cho repo công khai, nhưng **không được tuyên bố "bền vững": độ bền hạn mức và token đọc-tối-thiểu `NOT_PROVEN`**; ưu tiên cấu hình token đọc-tối-thiểu dưới dạng secret của Northflank.

**Cấu hình workflow đã được API Northflank chấp nhận (không bí mật):** `apiVersion` `v1.2`; `options` `autorun:false`, `concurrencyPolicy:latest`; trigger `vcs-push` (ref `mainPush`, `paused:false`, `spec.vcs` github/`nexagnet`/repoURL, `branchNamePatterns: ["main"]`); gốc `kind: Workflow`, `spec.type: sequential`. Giao diện hiển thị trigger là `refs.mainPush`. Biểu thức `${triggers.mainPush.sha}` trong bản minh hoạ trước đây **bị parser thật từ chối (400)**; binding được chấp nhận là `${refs.mainPush.sha}`. Không cần thêm tệp workflow trong repo.

Các node tuần tự đã chấp nhận:
1. **Build** (`ref: appBuild`, `condition: success`): `id` `bmsl-build`, `type` `service`, `projectId` `bmsl-website`, `branch` `main`, `sha` `${refs.mainPush.sha}`, `buildRuleFallThroughHandling: fail`, `reuseExistingBuilds: true`.
2. **JobRun** (`ref: ciGate`, `condition: success`): `projectId` `bmsl-website`, `jobId` `bmsl-ci-gate`, `runtimeEnvironment` `BMSL_TARGET_SHA` = `${refs.mainPush.sha}`; `deployment.internal` gồm `id` `bmsl-build`, `branch` `main`, `buildId` `meek-dolls-7450` (**image đã review, cố định**); `deployment.docker` `configType: customCommand`, `customCommand: node scripts/cd/gate-main-ci.mjs`. Job: backoff 0, deadline 1800 giây, không có bí mật ứng dụng.
3. **Release** (`ref: appRelease`, `condition: running`, `timeoutDuration: 600`): `type: build`, `origin` gồm `id` `bmsl-build`, `branch` `main`, `build` `${refs.appBuild.id}`; `target` `id` `bmsl-web`, `type` `service`.

Lưu ý nền tảng: `origin.build` của `Release` là **ID build bất biến (không phải SHA)**. API cập nhật workflow thật **từ chối** kind `DeploymentService` (workflow gốc cho phép `Release`); không nhầm schema template chung với schema workflow của dự án. `timeoutDuration` cấp cao của node Build và JobRun **không được hỗ trợ** (chỉ node Release dùng ở trên). Không tự bịa kind `DeployBuild`. Phương án dự phòng đã có tài liệu độc lập: API triển khai dịch vụ với `internal.buildSHA` = SHA kích hoạt và ID build thật. Không bao giờ coi "chỉ chạy tay" là CD xong.

**Điều kiện an toàn một instance:** chỉ `instances: 1` **không** đủ vì chiến lược mặc định là rolling (instance cũ/mới chạy chồng và cùng chạy migration Payload không khoá). `bmsl-web` đã đặt `Recreate` (API chấp nhận, GET xác nhận), nên không khởi động đồng thời; hành vi thật khi release qua CD do push chưa được quan sát. Nếu cấu hình bị đổi lại, điều kiện này không còn đạt.

**Bằng chứng trong CI (không cần Northflank):** test của cổng nằm ở `tests/integration/support/cd-gate.test.ts` (cùng `never-ready.test.ts`) nhưng được cấu hình chạy bởi `pnpm test` (`vitest.config.ts` gồm `tests/integration/support/**/*.test.ts`); lệnh tập trung: `pnpm exec vitest run --config vitest.config.ts tests/integration/support/cd-gate`. Đó là test đơn vị/mock của cổng (không mạng, không token) và test chạy tiến trình thật `node scripts/cd/gate-main-ci.mjs` với fetch giả (mã thoát thật cho đạt, chờ rồi đạt và từng ca lỗi). Proof image trong `tests/integration/container-image.test.ts` chạy qua `pnpm test:integration` (job `integration` hiện có); **chưa được coi là đã xác minh cho tới khi lần chạy CI thật của job đó đạt** (`NOT_PROVEN`). Proof đó build đúng `Dockerfile` của commit, chạy image không phải root trên mạng host với CSDL **mới do lần chạy sở hữu** + volume media riêng, chờ `GET /healthz` 200 sau migration, kiểm chứng fail-closed khi thiếu cấu hình/CSDL, upload media tổng hợp rồi xoá và tạo lại container trên cùng volume (media còn, quyền vẫn bị thực thi), và chạy CLI cổng trong image không cần bí mật ứng dụng. Thiếu Docker thì test **fail** (không bỏ qua). Phần dọn dẹp chỉ xoá container/image/volume/CSDL do chính lần chạy tạo ra, CSDL bị `DROP` (không `FORCE`) sau khi không còn session.

**Còn thiếu bằng chứng (`NOT_PROVEN`):** một lần chạy CD do push hoàn tất Build → cổng → Release → `/healthz` 200 (đang chờ); hạn mức API GitHub công khai bền vững/token đọc-tối-thiểu; hành vi hàng đợi `latest` và supersession trên nền tảng; rollback thật trên Northflank; domain tuỳ chỉnh/DNS (URL hiện tại do Northflank cấp); lịch sao lưu CSDL + media và sao lưu off-site/giao cho khách hàng; ADMIN đầu tiên và bàn giao thật; nội dung đã duyệt, đào tạo, UAT bằng văn bản, GA4/Search Console thật; xác nhận của BMSL về analytics, liên hệ và các dữ kiện khách hàng (vẫn `UNCONFIRMED`).

## 11. Quyết định chính sách còn mở (cần BMSL/nhà cung cấp)

Hạ tầng, domain, host, quyền truy cập, backup của host · nơi lưu và mã hoá bản sao lưu off-site, chu kỳ lưu giữ · ai được xem lead, EDITOR có xem lead không · thời hạn lưu/xoá lead · 2FA · kênh thông báo lead · WAF/chống lạm dụng ·
chính sách cookie/đồng ý và mã GA4, quyền Search Console · bật HSTS. Xem thêm `docs/blueprint/07-open-questions.md`.
