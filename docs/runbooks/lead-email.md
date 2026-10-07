# Email thông báo ContactLead (Issue #82)

**Trạng thái mặc định: TẮT.** Không có người gửi, người nhận hay SMTP nào được chốt (OWNER-DECISION). Mã này **không tự bật email** ở production khi deploy.

## Thiết kế (tóm tắt)

| Thành phần | Dùng gì |
|---|---|
| Gửi mail | `@payloadcms/email-nodemailer` 3.90.2 + `payload.sendEmail` (SMTP chuẩn) |
| Hàng đợi / retry | Payload **Jobs Queue** gốc (task `send-lead-notification`, queue `lead-mail`, retry mũ 6 lần, nền 30 s) |
| Độ bền | **Outbox trên chính dòng lead**: nhóm `notification` (`state`, `attempts`, `lastAttemptAt`, `leaseUntil`, `sentAt`, `lastError`) |
| Khoảng trống giao dịch | Job được tạo trong **cùng transaction** với lead (hook `afterChange` dùng cùng `req`): hoặc có cả hai, hoặc không có gì |
| Không gửi trùng | Mỗi lần gửi phải **claim** dòng lead bằng một `UPDATE` điều kiện nguyên tử (lease 120 s). Job trùng/cũ chỉ thua claim |
| Restart | `onInit` quét lại lead chưa xong (job bị kẹt `processing` sau crash không bao giờ tự mở khóa trong Payload) rồi chạy queue; cron `autoRun` mỗi phút + quét lại mỗi 5 phút |
| Form / lead / chống spam | **Giữ nguyên** `ContactForm`, `/lien-he/gui`, `ContactLead`, honeypot, rate-limit, ADMIN-only. Response không đổi |

Trạng thái `notification.state`: `not_configured` (lead đến khi tính năng TẮT, **không bao giờ gửi bồi**) → `pending` → `sending` → `sent` | `failed` (sẽ thử lại) | `dead` (lỗi vĩnh viễn hoặc hết 8 lần; ADMIN đặt lại `pending` trong trang quản trị để gửi lại).

### Giới hạn đã biết (trung thực)

- Gửi mail là **at-least-once**: nếu tiến trình chết đúng giữa lúc SMTP đã nhận thư và lúc ghi `sent`, sau khi hết lease lead sẽ được gửi lại **một lần nữa**. Mọi lần gửi dùng cùng `Message-ID` (`<bmsl-lead-{id}@{domain người gửi}>`) để hộp thư có thể gộp trùng. Không có cách nào loại bỏ hoàn toàn cửa sổ này với SMTP.
- Hai lần `jobs.run` chạy chồng nhau có thể làm Payload ném lỗi nội bộ (job bị lần kia xóa); mã gọi nuốt lỗi này và claim vẫn đảm bảo một lần gửi.
- Job kẹt `processing` sau crash vẫn nằm lại trong `payload-jobs` (chỉ là rác, hiển thị cho ADMIN); lead được gửi qua job mới do reconcile tạo.
- Thư gửi tới hộp thư của BMSL **có chứa họ tên, số điện thoại, nội dung** (để nhân viên gọi lại). Tiêu đề thư, job, log và `lastError` **không** chứa PII (chỉ mã lỗi như `ESOCKET`).

## Biến môi trường (chỉ phía server; KHÔNG commit giá trị)

| Biến | Bắt buộc | Ý nghĩa |
|---|---|---|
| `LEAD_EMAIL_ENABLED` | có | phải đúng chữ `true`, nếu không tính năng TẮT |
| `SMTP_HOST`, `SMTP_PORT` | có | máy chủ SMTP |
| `LEAD_EMAIL_FROM` | có | địa chỉ gửi đã được BMSL xác nhận |
| `LEAD_EMAIL_TO` | có | **một** hộp thư nhận đã được BMSL xác nhận |
| `SMTP_SECURE` | không | `true` = TLS ngầm (cổng 465). Mặc định STARTTLS bắt buộc nếu host không phải loopback |
| `SMTP_USER`, `SMTP_PASS` | cặp | cùng có hoặc cùng không; có một nửa = cấu hình lỗi, tính năng TẮT |

Thiếu hoặc sai bất kỳ giá trị nào ⇒ **TẮT**, log một dòng khi khởi động chỉ nêu **tên** biến lỗi (không bao giờ giá trị), ví dụ:
`lead e-mail notification: OFF (configuration required: SMTP_HOST, LEAD_EMAIL_TO)`.
Khi TẮT: không có email adapter, không cron, không job; lead vẫn lưu với `state = not_configured`.

## Triển khai (cần owner duyệt riêng — NGOÀI phạm vi task này)

1. Owner/BMSL xác nhận người gửi, người nhận và nhà cung cấp SMTP; cấp thông tin xác thực qua secret của nền tảng.
2. Migration `20261007_075550_lead_email_outbox` (thêm cột `notification_*` vào `contact_leads`, tạo `payload_jobs`, `payload_jobs_log`; **chỉ thêm, không xóa**) được áp dụng theo quy trình migration production có sao lưu. **Cảnh báo cổng production:** `payload.config.ts` dùng `prodMigrations`, nên migration chưa áp dụng sẽ **tự chạy khi ứng dụng production khởi động**; Northflank `bmsl-main-delivery` được kích hoạt bởi push vào `main`. Vì vậy merge code này (dù email vẫn TẮT) sẽ dẫn tới migration additive trên DB production. Cần owner xác nhận cổng production (sao lưu trước, đúng thời điểm) **trước khi merge**.
3. Đặt các biến ở trên, redeploy, kiểm tra log khởi động có `lead e-mail notification: ON`.
4. Gửi **một** yêu cầu thử nghiệm (dữ liệu giả) và xác nhận thư đến hộp thư đã chốt; `notification.state = sent` trong trang quản trị.
5. Rollback tính năng: bỏ `LEAD_EMAIL_ENABLED` (lead vẫn lưu, state `not_configured`). Rollback schema (`migrateDown`) giữ nguyên mọi lead.

## Chứng minh cục bộ (Docker, dữ liệu giả)

```bash
docker compose -f scripts/lead-email/compose.yml -p bmsl-lead-mail up -d   # Postgres 127.0.0.1:15432, Mailpit SMTP :18025, UI :18026
export DATABASE_URL=postgresql://bmsl:local-throwaway-not-a-secret@127.0.0.1:15432/lead_mail_proof PAYLOAD_SECRET=synthetic-local-secret
export LEAD_EMAIL_ENABLED=true SMTP_HOST=127.0.0.1 SMTP_PORT=18025 LEAD_EMAIL_FROM=website@bmsl-sandbox.example LEAD_EMAIL_TO=inbox@bmsl-sandbox.example
# (tạo database lead_mail_proof, rồi) pnpm exec payload migrate
docker stop bmsl-lead-mail-mailpit-1                                       # SMTP "hỏng"
pnpm exec payload run scripts/lead-email/proof.ts -- submit                # lead lưu, persisted:true, state=failed(ESOCKET)
docker start bmsl-lead-mail-mailpit-1                                      # SMTP trở lại
pnpm exec payload run scripts/lead-email/proof.ts -- recover               # tiến trình MỚI: thư đến Mailpit đúng 1 lần, state=sent
docker compose -f scripts/lead-email/compose.yml -p bmsl-lead-mail down -v # xóa sạch
```

Kiểm thử tự động (CI, không cần Mailpit — dùng SMTP sink trong tiến trình): `tests/integration/lead-email*.test.ts`.
Các tình huống: lưu trước; SMTP sập; 4xx tạm thời; 5xx vĩnh viễn → `dead`; trần số lần thử; job trùng và chạy đồng thời → 1 thư; crash giữa chừng → reconcile; lease còn hạn không bị cướp; header-injection; không PII trong job/log/console; ADMIN-only; OFF; migration up/down trên DB đã có lead.
