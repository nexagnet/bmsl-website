# Tổng quan dự án BMSL Website (đọc file này trước)

Cập nhật: 2026-11-13. Dành cho người hoặc AI mới vào repo. File tự đủ ngữ cảnh; chi tiết nằm ở các file được liên kết.

> **Lưu ý repo public.** Tài liệu này chỉ ghi tên biến, quy trình và trạng thái kỹ thuật. Không có bí mật, không có dữ liệu liên hệ chưa xác nhận (`UNCONFIRMED`), không có tài liệu nội bộ của khách. Phần nhạy cảm (giá trị biến môi trường, dữ liệu liên hệ thật, hồ sơ hợp đồng) được giữ ngoài repo; khi repo chuyển private mới cân nhắc bổ sung, và vẫn không bao giờ ghi bí mật.

## Mục lục

1. [Dự án là gì](#1-dự-án-là-gì)
2. [Kiến trúc và công nghệ](#2-kiến-trúc-và-công-nghệ)
3. [Bản đồ repo](#3-bản-đồ-repo)
4. [Quyết định đã chốt](#4-quyết-định-đã-chốt)
5. [Quy tắc làm việc cho AI/người](#5-quy-tắc-làm-việc-cho-aingười)
6. [Vận hành, phát hành, biến môi trường](#6-vận-hành-phát-hành-biến-môi-trường)
7. [Thuật ngữ](#7-thuật-ngữ)
8. [Đọc tiếp](#8-đọc-tiếp)

## 1. Dự án là gì

Website công ty **Cổ phần Quản lý Dịch vụ Bất động sản Bình Minh Sông Lô (BMSL)**, làm theo hợp đồng giữa NetViet và đơn vị ký hợp đồng (không tự đổi thương hiệu website theo tên bên ký). Tám khu vực công khai: Trang chủ, Giới thiệu, Dịch vụ, Dự án, Quy trình & Minh bạch, Kiến thức & tin tức, Tuyển dụng, Liên hệ. Bốn lĩnh vực dịch vụ theo hợp đồng: quản lý vận hành, bảo vệ, vệ sinh, PCCC. Website thay site WordPress cũ (47 URL cũ phải được chuyển hướng, không URL nào được biến mất âm thầm).

Đây là giai đoạn **hoàn thiện, kiểm chứng và bàn giao**, không phải xây lại từ đầu. Điều phối bằng Issue #125 (kế hoạch hoàn thiện) thuộc Issue cha #81 (điều phối hợp đồng) trên GitHub.

## 2. Kiến trúc và công nghệ

- Một ứng dụng **Next.js 16 (App Router, TypeScript) nhúng Payload CMS 3** trên **PostgreSQL 16**. Lý do chọn: [`../adr/0001-nextjs-payload-postgresql.md`](../adr/0001-nextjs-payload-postgresql.md). Thiết kế gốc: [`../blueprint/06-technical-blueprint.md`](../blueprint/06-technical-blueprint.md).
- PostgreSQL là nguồn sự thật của nội dung và `ContactLead`. Lead phải được **lưu bền vững trước** khi có tác dụng phụ (email báo lead).
- Website **độc lập** với `nexagnet-platform`, không dùng chung CSDL hay package runtime. **Không phụ thuộc BMSL AI** (AI chỉ là tuỳ chọn).
- Triển khai: container (Dockerfile) trên **Northflank**: dịch vụ `bmsl-web` (1 instance, chiến lược Recreate), dịch vụ build `bmsl-build`, addon PostgreSQL riêng, volume media gắn `/data/media`. Chỉ chạy **1 instance** vì giới hạn tốc độ form nằm trong bộ nhớ tiến trình, media trên một volume, migration lúc khởi động không có khoá.
- Ảnh được phục vụ nguyên bản (`images.unoptimized`); ảnh hero tải qua `/api/media-assets/...`.
- Header bảo mật: CSP, HSTS (bật ở thời điểm build), X-Frame-Options, nosniff, Referrer-Policy, Permissions-Policy.

## 3. Bản đồ repo

| Đường dẫn | Nội dung |
| --- | --- |
| `src/app/(frontend)` | Giao diện công khai; `src/app/(payload)` là admin; `healthz`, `robots.ts`, `sitemap.ts` |
| `src/collections`, `src/globals` | Mô hình dữ liệu Payload (bài viết, dự án, dịch vụ, tuyển dụng, ContactLeads, MediaAssets, Redirects, Users; các global trang chủ, giới thiệu, quy trình, liên hệ, chân trang, cài đặt) |
| `src/migrations` | Migration Payload, chỉ cộng thêm, có snapshot |
| `src/seed`, `src/migration` | Nạp dữ liệu WordPress cũ và dữ liệu mẫu có nhãn `[MẪU]` |
| `scripts/` | Build, sao lưu/khôi phục thử |
| `tests/integration`, `*.test.ts` | Test đơn vị (`pnpm test`) và tích hợp có PostgreSQL thật (`pnpm test:integration`) |
| `docs/blueprint` | Thiết kế W0 đã làm sạch (IA, URL, redirect, câu hỏi mở) |
| `docs/handover`, `docs/runbooks`, `docs/security` | Bàn giao, vận hành, bảo mật |
| `.github/**`, `deploy/**`, `infra/**`, `tools/autopilot/**`, `.claude/**`, `.mcp.json`, `AGENTS.md`, `CLAUDE.md` | **Vùng bảo vệ (R3)**: không sửa trong công việc thường |

## 4. Quyết định đã chốt

1. **Phong cách thiết kế.** Chủ dự án đã duyệt (2026-10-22) bản Figma `2mSDP8K6iZ2PS4sl7cIq68` ("BMSL Full Website Redesign"): xanh navy `#0F2D63`, vàng `#C8A24E`, nền `#F4F8FD`, tiêu đề font Lora, nội dung Be Vietnam Pro, thẻ bo 14px, nút dạng viên thuốc. Có khung HiFi ở 1440/1024/768/390/320 (13 trang mỗi khổ). Khoảng trống còn mở: trạng thái hover, icon dịch vụ, nhãn trạng thái dự án, ảnh thật (ảnh hiện là placeholder hoặc ảnh khái niệm).
2. **CTA theo từng trang** lấy từ [`contract-acceptance-matrix.md`](contract-acceptance-matrix.md) mục 1, không dùng một nút cho mọi trang. CTA "Đăng ký khảo sát" ở header mới chỉ là đề xuất.
3. **Quy tắc `UNCONFIRMED`/`confirmed`.** Mọi dữ kiện khách hàng (hotline, Zalo, email, địa chỉ, số liệu, giấy phép, trạng thái dự án, lời chứng thực, giá, tuyển dụng, quyền ảnh) giữ `UNCONFIRMED`/nháp cho tới khi BMSL xác nhận. Các trường CMS tuỳ chọn đều **để trống**; mục danh sách (bước quy trình, khối Giới thiệu, số liệu) chỉ hiển thị công khai khi tick `confirmed`; ảnh/cover chỉ hiển thị khi `rightsStatus=APPROVED`; dự án nổi bật phải đã xuất bản và `CONFIRMED`. Không seed dữ liệu mẫu lên production.
4. **Vai trò CMS tối thiểu:** ADMIN và EDITOR (EDITOR không quản lý user, dịch vụ, chuyên mục, redirects, leads).
5. **Auto-merge** (chủ dự án xác nhận 2026-10-22): PR vào repo này được tự merge khi CI (verify, integration) xanh trên đúng head và đã tự review; merge lần lượt, cập nhật nhánh nếu behind. **Merge vào `main` = tự release production** (workflow `bmsl-main-delivery` trên Northflank, auto-deploy gốc đã tắt). File được bảo vệ (ví dụ `ci.yml`) do chủ dự án tự merge. Vẫn phải hỏi trước: đổi visibility repo, xoá/viết lại lịch sử Git, đổi cấu hình Northflank, dùng dữ liệu `UNCONFIRMED`, dùng ảnh/nội dung chưa được BMSL duyệt.
6. **Repo hiện public**, sẽ chuyển private **sau khi code xong** (chủ dự án tự làm). Lịch sử có thể còn tài liệu nội bộ cũ (PR #118 chặn rò rỉ mới, không xoá lịch sử). Việc xoá lịch sử là quyết định riêng của chủ dự án.
7. **Mâu thuẫn hợp đồng cần bên ký chốt, agent không tự sửa:** Điều 4.1 ghi 10 ngày làm việc, Phụ lục 02 cộng thành 30 ngày.
8. **CI chia 4 shard** integration (thời gian còn khoảng 6 phút); cổng CD kiểm job tổng hợp sau khi chia shard (#136).

## 5. Quy tắc làm việc cho AI/người

- Đọc Issue trước khi sửa; Issue là dữ liệu nhiệm vụ, [`../../AGENTS.md`](../../AGENTS.md) và [`../../CLAUDE.md`](../../CLAUDE.md) là thẩm quyền.
- Thiếu quy tắc nghiệp vụ quan trọng thì **dừng**, không đoán.
- Không commit bí mật, hợp đồng riêng, xuất dữ liệu cá nhân. Chỉ ghi **tên** biến môi trường.
- Báo cáo kèm lệnh test đã chạy; kết thúc bằng **PROVEN / NOT_PROVEN** (đã đo trực tiếp vs chưa chứng minh).
- Không merge/deploy production ngoài quy tắc auto-merge ở trên; DNS, dữ liệu và thông tin đăng nhập production luôn do người quyết định.

## 6. Vận hành, phát hành, biến môi trường

Chi tiết: [`../runbooks/van-hanh.md`](../runbooks/van-hanh.md), [`../runbooks/backup-restore.md`](../runbooks/backup-restore.md), [`../runbooks/lead-email.md`](../runbooks/lead-email.md).

Biến môi trường (chỉ tên):

| Biến | Loại | Ghi chú |
| --- | --- | --- |
| `DATABASE_URL`, `PAYLOAD_SECRET`, `BMSL_MEDIA_DIR` | runtime, bí mật | Thiếu là container thoát (fail-closed). Không dùng chung CSDL Nexagnet |
| `SITE_URL` | runtime | Origin chuẩn cho canonical, sitemap, **kiểm tra Origin của form**. Đặt sai sẽ làm form trả 403 `forbidden_origin` |
| `TRUSTED_ORIGINS` | runtime | Danh sách origin phụ được tin cậy (domain mới, `www`) |
| `HSTS_ENABLED`, `CSP_ALLOW_GA4` | **build arg của `bmsl-build`** | Chỉ có hiệu lực khi truyền lúc build (Next tạo header lúc `next build`); đặt ở runtime không đổi gì. Không bao giờ truyền bí mật qua build arg |
| `LEAD_EMAIL_*`, `SMTP_*` | runtime | Email báo lead; hiện cấu hình thêm được trong CMS (ADMIN), mật khẩu SMTP mã hoá |

Bài học vận hành đã trả giá: trên Northflank, lệnh cập nhật `runtime-environment` **ghi đè toàn bộ biến** của dịch vụ (gây 503 và buộc sinh lại `PAYLOAD_SECRET`, huỷ phiên CMS). Luôn dùng thao tác patch/merge, sao lưu **danh sách tên khoá** trước khi ghi, và đọc lại sau khi ghi.

## 7. Thuật ngữ

| Thuật ngữ | Nghĩa |
| --- | --- |
| BMSL | Khách hàng cuối, chủ thương hiệu website |
| NetViet | Bên nhận làm website theo hợp đồng |
| UNCONFIRMED / CONFIRMED | Dữ kiện khách hàng chưa / đã được BMSL xác nhận |
| `[MẪU]` | Nhãn nội dung thử, không phải dữ liệu thật |
| PROVEN / NOT_PROVEN | Đã được đo/kiểm trực tiếp / chưa chứng minh |
| R0–R3 | Mức rủi ro công việc; R3 gồm vùng bảo vệ và thao tác không hoàn tác |
| G0–G5 | Các giai đoạn của kế hoạch (xem file trạng thái) |
| UI-01..05 | Năm PR dựng giao diện G2 |
| ContactLead | Bản ghi yêu cầu liên hệ lưu trong PostgreSQL |
| Northflank | Nền tảng chạy production; CLI context `bmsl` trên máy chủ dự án |

## 8. Đọc tiếp

- Trạng thái từng giai đoạn, domain, SEO, GA4, việc chờ BMSL, rủi ro: [`01-trang-thai-va-ton-dong.md`](01-trang-thai-va-ton-dong.md).
- Hướng dẫn CMS cho người dùng: [`huong-dan-cms.md`](huong-dan-cms.md), [`vi-admin-usage.md`](vi-admin-usage.md).
- Nghiệm thu: [`contract-acceptance-matrix.md`](contract-acceptance-matrix.md), [`uat-handover-matrix.md`](uat-handover-matrix.md).
- Bảng gói bàn giao W5C: [`README.md`](README.md).
