# Runbook vận hành — BMSL Website

Dành cho người vận hành kỹ thuật. Mọi lệnh dưới đây là quy trình **đã chuẩn bị**; chưa có máy chủ BMSL nào được truy cập, nên việc triển khai thật, DNS, HTTPS và lịch sao lưu tại host đều
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

## 10. Triển khai container trên Northflank (đã chuẩn bị, chưa thực hiện)

Repo có `Dockerfile` + `.dockerignore` ở thư mục gốc. Builder chỉ chuẩn bị mã; **việc tạo tài nguyên, build image, deploy và cấu hình CD trên Northflank do điều phối viên thực hiện và chưa được chứng minh** (`NOT_PROVEN`). Image **không** chứa `.env`, media, bản sao lưu hay bí mật.

**Tài nguyên (tách riêng, một instance ban đầu):**
* Một PostgreSQL **riêng cho BMSL**, với database đã được **tạo sẵn** bởi người vận hành (ứng dụng được cấu hình `disableCreateDatabase: true`: nếu database trong `DATABASE_URL` không tồn tại, ứng dụng **không** tự chạy `CREATE DATABASE` mà báo lỗi/`/healthz` trả 503). **Không bao giờ** dùng lại CSDL của ứng dụng Nexagnet.
* Một **volume bền vững** riêng gắn vào dịch vụ BMSL, ví dụ mount `/data/media`; đặt `BMSL_MEDIA_DIR=/data/media`. Không dùng lưu trữ tạm của container cho upload. Tiến trình chạy bằng user `node` (uid 1000): volume phải ghi được bởi user này, nếu không container tự dừng với lỗi cố định (`BMSL_MEDIA_DIR is not writable`).
* Chỉ chạy **1 instance** (giới hạn form liên hệ là bộ nhớ theo tiến trình; media nằm trên một volume; migration khi khởi động không có khoá nên không được khởi động song song nhiều instance).

**Biến môi trường runtime (đặt dưới dạng secret của Northflank, không đặt ở build-arg):** `DATABASE_URL` (CSDL riêng, `?sslmode=require` nếu nhà cung cấp hỗ trợ), `PAYLOAD_SECRET`, `BMSL_MEDIA_DIR`, `SITE_URL` = **URL HTTPS thực tế** do Northflank cấp (cập nhật khi đổi domain; kiểm tra Origin dựa vào giá trị này). `PORT` do nền tảng cấp (mặc định 3000); ứng dụng lắng nghe `0.0.0.0`. Thiếu `DATABASE_URL`/`PAYLOAD_SECRET`/`BMSL_MEDIA_DIR` thì container thoát ngay (fail-closed).

**Header bảo mật HSTS/GA4 (cấu hình thời điểm build, không phải bí mật):** `next.config.mjs` tạo header lúc `next build`, nên `HSTS_ENABLED` và `CSP_ALLOW_GA4` chỉ có hiệu lực khi truyền qua **build arg** của Dockerfile (`HSTS_ENABLED`, `CSP_ALLOW_GA4`, mặc định `false`); đặt chúng ở runtime sẽ **không** thay đổi header đã build. Không bao giờ truyền bí mật qua build arg (lộ trong lịch sử image). Giữ analytics tắt (`CSP_ALLOW_GA4=false`, không bật mã GA4 trong CMS) cho tới khi BMSL xác nhận; chỉ bật `HSTS_ENABLED=true` (build lại image) sau khi HTTPS đã kiểm chứng. Sau khi build, kiểm chứng bằng `curl -I` trên URL thật: có/không có `Strict-Transport-Security` và `Content-Security-Policy` không chứa `googletagmanager.com` khi analytics tắt (chưa chạy, `NOT_PROVEN`).

**Migration:** không áp dụng khi build image. Khi khởi động, Payload áp dụng các migration đã commit (`prodMigrations`, vòng đời hiện có) lên database đã tồn tại rồi mới sẵn sàng; không có reset/seed/xoá dữ liệu tự động. **Không có khoá advisory** được triển khai hay chứng minh cho bước này (khoá advisory của bootstrap ADMIN đầu tiên là việc khác, không liên quan), vì vậy bắt buộc giữ đúng 1 instance và không rolling/blue-green song song khi có migration mới.

**Health check:** `GET /healthz` (chỉ đọc, `Cache-Control: no-store`). `200 {"status":"ok"}` chỉ khi kết nối PostgreSQL của runtime trả lời và **mọi** migration đã commit đã được ghi nhận; ngược lại `503 {"status":"unavailable"}`, không lộ chi tiết CSDL/bí mật. Truy vấn dùng lại pool của Payload (không tạo pool mới), tối đa một truy vấn kiểm tra tại một thời điểm, có `lock_timeout`/`statement_timeout` 2 giây phía máy chủ và `connectionTimeoutMillis` 5 giây của pool, nên khoá bảng `payload_migrations` không làm tích tụ truy vấn treo. Dùng cho readiness (và liveness với ngưỡng lỗi rộng rãi, ví dụ khởi động có thể chậm do migration).

**Build / deploy:** build đúng commit `main` SHA đã được CI xác minh (`verify` + `integration`) và đối chiếu SHA đó với image đang chạy. Ghi lại SHA/ tag image mỗi lần deploy.

**ADMIN đầu tiên:** theo §4, qua kênh riêng đã được duyệt (đặt `INITIAL_ADMIN_BOOTSTRAP_TOKEN` tạm thời, ưu tiên mạng riêng/chưa mở công khai, gỡ ngay sau khi dùng). Không đặt mật khẩu mặc định, không ghi vào repo/log.

**Rollback:** triển khai lại **image trước đó đã xác minh**; giữ nguyên CSDL và volume media. Không chạy migration `down` hay ghi đè CSDL khi rollback ứng dụng; nếu migration mới không tương thích, dùng quy trình khôi phục vào CSDL mới (§8, `backup-restore.md`).

**Nhóm (group) của image và volume:** image chạy bằng `USER node:node` (uid 1000, gid 1000, vẫn không phải root; mã ứng dụng chỉ đọc). Northflank xác định quyền sở hữu volume bền vững theo **group của image tại thời điểm build**, nên group được khai báo tường minh; không có bước `chown` root khi khởi động. Quyền ghi vào volume gắn tại `/data/media` được kiểm chứng trong proof Docker của CI (xem "Bằng chứng trong CI" bên dưới), còn volume thật trên Northflank vẫn là việc điều phối viên chứng minh.

### 10.1 Quy trình CD gốc (native) của Northflank: cổng "exact-main CI"

Mục tiêu: mỗi lần `git push` lên `main` chỉ deploy đúng commit đã được CI chính thức (workflow `ci`, job `verify` **và** `integration`) xác nhận thành công. **Tài liệu và cấu hình dưới đây chỉ là minh hoạ; chưa có bằng chứng một lần chạy thật** (`NOT_PROVEN`) và **không được coi là "CD xong"** cho tới khi điều phối viên chứng minh một workflow được kích hoạt thật, build thật, qua cổng, deploy thật và `/healthz` 200.

**Luồng (tuần tự, mọi bước dùng đúng SHA kích hoạt ban đầu):**
1. **Trigger**: `git push` lên `main` (VCS trigger, ghim `triggers.mainPush.sha`).
2. **Build** ứng dụng với đúng SHA kích hoạt đó (không phải `latest`, không phải đầu nhánh hiện tại).
3. **Cổng CI (JobRun, `condition: success`)**: chạy job đã tạo sẵn từ **một image cổng cố định, đã được review trước đó (ghim theo build ID/digest bất biến, không dùng `latest`, không dùng script của chính commit ứng viên chưa được xác minh)**, với lệnh ghi đè `node scripts/cd/gate-main-ci.mjs` và biến môi trường **theo từng lần chạy** `BMSL_TARGET_SHA=${triggers.mainPush.sha}`. Job chỉ thoát 0 khi CI tin cậy của đúng SHA đó hoàn tất thành công và `main` vẫn đúng là SHA đó; mọi trường hợp khác (CI fail/cancel/skip/neutral/timeout, thiếu job hoặc bước, run giả mạo, attempt cũ, `main` đã bị vượt, lỗi/giới hạn API, quá hạn) đều thoát khác 0 và workflow dừng ở đây.
4. **Release**: chỉ khi cổng thành công, deploy **đúng bản build ứng viên đã build ở bước 2** (tham chiếu build ID bất biến `${refs.appBuild.id}`, không phải `latest`), chờ dịch vụ healthy (`GET /healthz` = 200), rồi chạy smoke check (trang chủ, `/healthz`).
5. **Tuần tự hoá**: `concurrencyPolicy: latest` — chạy mới thì huỷ/bỏ qua công việc cũ đã bị `main` vượt. Một workflow chỉ phát hành một SHA; commit cũ hơn không được ghi đè commit mới hơn.

**Phải tắt** cơ chế tự deploy gốc độc lập của dịch vụ (auto-deploy theo commit/Git checks): nếu bật, nó đi vòng qua cổng. Đặc biệt, "check suite Git thành công" của Northflank chỉ phủ **một** check suite của PR và **không** chờ các suite bắt buộc khác, nên **không** được dùng làm bằng chứng "CI exact-main xong".

**Cổng (`scripts/cd/gate-main-ci.mjs`) kiểm tra, cố định trong mã:** repository `nexagnet/bmsl-website`, nhánh `main`, workflow id `375023465`, đường dẫn `.github/workflows/ci.yml`, sự kiện `push`, `head_branch=main`, `head_sha` = SHA ứng viên, `head_repository` đúng repo; chọn run **mới nhất** của SHA và **attempt mới nhất**; tải job của **đúng attempt đó** (có phân trang, thiếu trang là lỗi) và yêu cầu **cả** `verify` và `integration` `completed/success`, cùng hai bước `Application verify scripts` và `Required application integration suite` đều `completed/success` (job xanh nhưng bước bị skip bị từ chối); đọc lại run/attempt/run mới nhất trước khi chấp nhận và xác nhận `main` vẫn đúng là SHA ứng viên ngay trước khi thoát 0. Chỉ gọi GitHub REST (GET) tới `api.github.com`; token là tuỳ chọn (`BMSL_GITHUB_TOKEN`, chỉ từ biến môi trường, quyền đọc tối thiểu cho repo BMSL: Actions + Contents/metadata read; **không** sao chép token OAuth rộng của người điều phối) và không bao giờ được ghi log; chỉ in SHA/run/attempt/trạng thái. Mã thoát: `0` đạt, `1` CI/không đủ điều kiện, `2` cấu hình sai, `3` `main` đã bị vượt, `4` quá hạn, `5` lỗi/giới hạn API, `143` SIGTERM. Tuỳ chỉnh có giới hạn: `BMSL_GATE_TIMEOUT_SECONDS` (mặc định 1500, tối đa 3600), `BMSL_GATE_POLL_SECONDS` (mặc định 60, 1–300).

**Hạn mức API:** API GitHub không xác thực chỉ có hạn mức thấp theo IP dùng chung (60 yêu cầu/giờ). Khi còn chờ, mỗi vòng chỉ gọi **một** yêu cầu (danh sách run), các yêu cầu nặng hơn chỉ chạy khi run đã hoàn tất; `Retry-After`/`x-ratelimit-reset` được tôn trọng nếu chờ xong vẫn nằm trong hạn tổng, nếu không thì **fail closed**. Dùng được không token cho repo công khai, nhưng **không được tuyên bố "bền vững" khi chưa có bằng chứng chạy thật với hạn mức thật**; ưu tiên cấu hình token đọc-tối-thiểu dưới dạng secret của Northflank.

**Cấu hình minh hoạ (không bí mật, chỉ là ví dụ; ID là chỗ giữ chỗ, không phải ID thật):** điều phối viên phải tự xác nhận bằng API/giao diện/export thật của Northflank rồi mới áp dụng; các node và trường dưới đây là hình dạng dự kiến theo tài liệu chính thức, **chưa được kiểm chứng với API tạo workflow thật**.

```json
{
  "apiVersion": "v1.2",
  "options": { "autorun": false, "concurrencyPolicy": "latest" },
  "spec": {
    "type": "workflow",
    "triggers": { "mainPush": { "kind": "vcs-push", "spec": { "vcsService": "github", "accountLogin": "nexagnet", "repoUrl": "https://github.com/nexagnet/bmsl-website", "branchNamePatterns": ["main"] } } },
    "steps": { "kind": "Workflow", "spec": { "type": "sequential", "steps": [
      { "kind": "Build", "ref": "appBuild", "condition": "success", "spec": { "id": "<build-service-id>", "type": "service", "projectId": "<project-id>", "sha": "${triggers.mainPush.sha}", "branch": "main", "buildRuleFallThroughHandling": "fail" } },
      { "kind": "JobRun", "condition": "success", "spec": { "projectId": "<project-id>", "jobId": "<gate-job-id>", "runtimeEnvironment": { "BMSL_TARGET_SHA": "${triggers.mainPush.sha}" }, "deployment": { "internal": { "buildId": "<fixed-reviewed-gate-image-build-id>" }, "docker": { "customCommand": "node scripts/cd/gate-main-ci.mjs" } } } },
      { "kind": "Release", "condition": "running", "timeoutDuration": 600, "spec": { "type": "build", "origin": { "id": "<build-service-id>", "branch": "main", "build": "${refs.appBuild.id}" }, "target": { "id": "<web-service-id>", "type": "service" } } }
    ] } }
  }
}
```

Lưu ý nền tảng: schema chính thức của release-flow dùng kind `Release` với `origin.build` là **ID build bất biến (không phải SHA)**; không được tự bịa kind `DeployBuild` hay giả định mọi node release được API workflow chung chấp nhận. Chỉ tuyên bố cấu hình triển khai được sau khi tạo/lấy/export workflow thật thành công. Phương án dự phòng đã có tài liệu độc lập: API triển khai dịch vụ với `internal.buildSHA` = SHA kích hoạt và ID build thật. Không bao giờ coi "chỉ chạy tay" là CD xong.

**Điều kiện an toàn một instance (điều phối viên):** chỉ `instances: 1` **không** đủ vì chiến lược mặc định là rolling (instance cũ/mới chạy chồng và cùng chạy migration Payload không khoá). Dùng `deployment.strategy.type: recreate` (cần GET xác nhận nền tảng chấp nhận; tính năng có thể bị cờ tính năng giới hạn) hoặc bước workflow dừng-và-chờ trước khi release / khởi động-và-chờ. Nếu nền tảng không hỗ trợ, ghi rõ là điều kiện chưa đạt thay vì giả định.

**Bằng chứng trong CI (không cần Northflank):** `pnpm test` chạy test đơn vị/mock của cổng (không mạng, không token) và test chạy tiến trình thật `node scripts/cd/gate-main-ci.mjs` với fetch giả (mã thoát thật cho đạt, chờ rồi đạt và từng ca lỗi). `pnpm test:integration` (job `integration` hiện có) build đúng `Dockerfile` của commit, chạy image không phải root trên mạng host với CSDL **mới do lần chạy sở hữu** + volume media riêng, chờ `GET /healthz` 200 sau migration, kiểm chứng fail-closed khi thiếu cấu hình/CSDL, upload media tổng hợp rồi xoá và tạo lại container trên cùng volume (media còn, quyền vẫn bị thực thi), và chạy CLI cổng trong image không cần bí mật ứng dụng. Thiếu Docker thì test **fail** (không bỏ qua). Phần dọn dẹp chỉ xoá container/image/volume/CSDL do chính lần chạy tạo ra, CSDL bị `DROP` (không `FORCE`) sau khi không còn session.

**Còn thiếu bằng chứng (`NOT_PROVEN`):** build image thật (Docker) và chạy trên Northflank; quyền ghi của volume cho uid 1000; `/healthz` 200/503 trên môi trường thật; header HSTS/CSP của image thật; cấu hình CD gốc của Northflank (workflow thật, một lần chạy thật do push kích hoạt qua cổng và release, chiến lược `recreate`, hạn mức GitHub API/token thật; hạn mức tài khoản Northflank hiện chưa cho tạo dự án BMSL); HTTPS/domain thật; lịch sao lưu CSDL + media; ADMIN đầu tiên và bàn giao thật; xác nhận của BMSL về analytics, liên hệ và các dữ kiện khách hàng (vẫn `UNCONFIRMED`).

## 11. Quyết định chính sách còn mở (cần BMSL/nhà cung cấp)

Hạ tầng, domain, host, quyền truy cập, backup của host · nơi lưu và mã hoá bản sao lưu off-site, chu kỳ lưu giữ · ai được xem lead, EDITOR có xem lead không · thời hạn lưu/xoá lead · 2FA · kênh thông báo lead · WAF/chống lạm dụng ·
chính sách cookie/đồng ý và mã GA4, quyền Search Console · bật HSTS. Xem thêm `docs/blueprint/07-open-questions.md`.
