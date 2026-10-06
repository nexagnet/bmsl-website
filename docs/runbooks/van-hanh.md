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
| `HSTS_ENABLED` | Tuỳ chọn | `true` chỉ sau khi HTTPS đã xác nhận trên domain thật |
| `CSP_ALLOW_GA4` | Tuỳ chọn | `true` chỉ cùng với một property GA4 đã được duyệt |
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
* Một PostgreSQL **riêng cho BMSL**. **Không bao giờ** dùng lại CSDL của ứng dụng Nexagnet.
* Một **volume bền vững** riêng gắn vào dịch vụ BMSL, ví dụ mount `/data/media`; đặt `BMSL_MEDIA_DIR=/data/media`. Không dùng lưu trữ tạm của container cho upload. Tiến trình chạy bằng user `node` (uid 1000): volume phải ghi được bởi user này, nếu không container tự dừng với lỗi cố định (`BMSL_MEDIA_DIR is not writable`).
* Chỉ chạy **1 instance** (giới hạn form liên hệ là bộ nhớ theo tiến trình; media nằm trên một volume).

**Biến môi trường (chỉ runtime, đặt dưới dạng secret của Northflank, không đặt ở build-arg):** `DATABASE_URL` (CSDL riêng, `?sslmode=require` nếu nhà cung cấp hỗ trợ), `PAYLOAD_SECRET`, `BMSL_MEDIA_DIR`, `SITE_URL` = **URL HTTPS thực tế** do Northflank cấp (cập nhật khi đổi domain; kiểm tra Origin dựa vào giá trị này). `PORT` do nền tảng cấp (mặc định 3000); ứng dụng lắng nghe `0.0.0.0`. Thiếu `DATABASE_URL`/`PAYLOAD_SECRET`/`BMSL_MEDIA_DIR` thì container thoát ngay (fail-closed). Không bật analytics (`CSP_ALLOW_GA4`, mã GA4 trong CMS) cho tới khi BMSL xác nhận; `HSTS_ENABLED=true` chỉ sau khi HTTPS đã kiểm chứng.

**Migration:** không áp dụng khi build image. Khi khởi động, Payload áp dụng các migration đã commit (`prodMigrations`, có khoá advisory) rồi mới sẵn sàng; không có reset/seed/xoá dữ liệu tự động. Giữ 1 instance để khởi động không tranh chấp.

**Health check:** `GET /healthz` (chỉ đọc, `Cache-Control: no-store`). `200 {"status":"ok"}` chỉ khi kết nối PostgreSQL của runtime trả lời và **mọi** migration đã commit đã được ghi nhận; ngược lại `503 {"status":"unavailable"}`, không lộ chi tiết CSDL/bí mật. Dùng cho readiness (và liveness với ngưỡng lỗi rộng rãi, ví dụ khởi động có thể chậm do migration).

**Build / deploy:** build đúng commit `main` SHA đã được CI xác minh (`verify` + `integration`) và đối chiếu SHA đó với image đang chạy. Ghi lại SHA/ tag image mỗi lần deploy.

**ADMIN đầu tiên:** theo §4, qua kênh riêng đã được duyệt (đặt `INITIAL_ADMIN_BOOTSTRAP_TOKEN` tạm thời, ưu tiên mạng riêng/chưa mở công khai, gỡ ngay sau khi dùng). Không đặt mật khẩu mặc định, không ghi vào repo/log.

**Rollback:** triển khai lại **image trước đó đã xác minh**; giữ nguyên CSDL và volume media. Không chạy migration `down` hay ghi đè CSDL khi rollback ứng dụng; nếu migration mới không tương thích, dùng quy trình khôi phục vào CSDL mới (§8, `backup-restore.md`).

**Còn thiếu bằng chứng (`NOT_PROVEN`):** build image thật và chạy trên Northflank (Builder không có Docker/PG ở đây); quyền ghi của volume cho uid 1000; `/healthz` 200/503 trên môi trường thật; cấu hình CD gốc của Northflank; HTTPS/domain thật; lịch sao lưu CSDL + media; ADMIN đầu tiên và bàn giao thật; xác nhận của BMSL về analytics, liên hệ và các dữ kiện khách hàng (vẫn `UNCONFIRMED`).

## 11. Quyết định chính sách còn mở (cần BMSL/nhà cung cấp)

Hạ tầng, domain, host, quyền truy cập, backup của host · nơi lưu và mã hoá bản sao lưu off-site, chu kỳ lưu giữ · ai được xem lead, EDITOR có xem lead không · thời hạn lưu/xoá lead · 2FA · kênh thông báo lead · WAF/chống lạm dụng ·
chính sách cookie/đồng ý và mã GA4, quyền Search Console · bật HSTS. Xem thêm `docs/blueprint/07-open-questions.md`.
