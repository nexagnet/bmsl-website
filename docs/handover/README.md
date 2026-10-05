# Gói bàn giao kỹ thuật W5C (Issue #24)

Gói này là **vật liệu đã chuẩn bị để xem xét**. Nó không phải bằng chứng rằng BMSL đã nghiệm thu, đã nhận đào tạo, đã nhận sao lưu hay website đã chạy production.

| Tài liệu | Nội dung |
| --- | --- |
| [`huong-dan-cms.md`](huong-dan-cms.md) | Hướng dẫn CMS tiếng Việt cho ADMIN/EDITOR, chương trình đào tạo ≤ 2 giờ và danh sách kiểm tra |
| [`../runbooks/van-hanh.md`](../runbooks/van-hanh.md) | Cấu hình môi trường, tách CSDL/media, migration, khởi động, ADMIN đầu tiên, log không PII, xoay bí mật, sự cố/lead, quyết định còn mở |
| [`../runbooks/backup-restore.md`](../runbooks/backup-restore.md) | Công cụ sao lưu/khôi phục thử (`scripts/backup/`), quy tắc an toàn, bằng chứng tổng hợp, giới hạn |
| [`uat-handover-matrix.md`](uat-handover-matrix.md) | Ma trận UAT ↔ bằng chứng (SHA/CI), danh sách xác nhận khách hàng, danh sách sẵn sàng phát hành, điều kiện cutover |
| [`../security/W5B4-browser-uat.md`](../security/W5B4-browser-uat.md) | Bằng chứng trình duyệt/axe/Lighthouse/analytics (đã làm mới từ CI chính xác) |

Quy tắc: không mật khẩu mặc định, không dữ kiện BMSL bịa, không bí mật thật; mọi dữ kiện khách hàng giữ `UNCONFIRMED` cho tới khi BMSL xác nhận.
Mục nào cần đầu vào thật (host, domain, ký nhận, đào tạo, bàn giao ADMIN, lịch sao lưu off-site) được ghi `NOT_PROVEN`.
