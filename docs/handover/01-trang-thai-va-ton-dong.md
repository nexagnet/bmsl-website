# Trạng thái dự án và việc tồn đọng

Cập nhật: 2026-11-13. Đọc [`00-tong-quan-du-an.md`](00-tong-quan-du-an.md) trước. Nhãn: **PROVEN** = đã đo/kiểm trực tiếp tại thời điểm ghi; **NOT_PROVEN** = chưa chứng minh. Trạng thái production thay đổi nhanh; hãy kiểm lại trước khi dựa vào.

## 1. Tiến độ theo giai đoạn (kế hoạch Issue #125)

| Giai đoạn | Nội dung | Trạng thái |
| --- | --- | --- |
| G0 | Ổn định build, xử lý rủi ro bảo mật, phân loại PR | Xong (PR #118 ngừng rò rỉ tài liệu nội bộ mới; #93, #98 đã đóng). Lịch sử Git public vẫn còn tài liệu cũ |
| G1 | Figma high-fidelity | Xong, chủ dự án duyệt 2026-10-22 |
| G2 | Dựng giao diện UI-01..05 (PR #126–#130) | Đã merge. Sau đó có: sửa khoảng đệm theo Figma (gutter 16/20/32/48/64, rộng tối đa 1440px) |
| G3 | CMS, nội dung, banner | Đã merge: trường CMS tuỳ chọn (#132–#137), hero chỉnh được từ CMS, tuyển dụng thêm hình thức/số lượng/kinh nghiệm (#141), email báo lead cấu hình trong CMS (#140), chân trang và nền chọn được (#142), sắp xếp lại cấu hình CMS mỗi thứ một chỗ (#143, #144), logo/icon admin BMSL (#145), banner cookie nối GA4 (#146). **Nội dung thật vẫn chờ BMSL** |
| G4 | QA/UAT, SEO, backup-restore | Đã có hai đợt QA production và một báo cáo SEO (mục 4). Nhiều mục còn NOT_PROVEN |
| G5 | Bàn giao, nghiệm thu | Chưa xong: cần domain chính thức, xác nhận khách hàng, đào tạo, nghiệm thu bằng văn bản |

CI chia 4 shard (#131). Hạ tầng và bằng chứng triển khai: [`../runbooks/van-hanh.md`](../runbooks/van-hanh.md) §triển khai thật.

## 2. Chuyển tên miền `binhminhsonglo.vn`

Trạng thái ghi nhận mới nhất (cuối 2026-10-27, thread chuyển domain):

- PROVEN: domain đã verified trên Northflank; subdomain `www` đã tạo; `TRUSTED_ORIGINS` đã thêm `https://binhminhsonglo.vn` và `https://www.binhminhsonglo.vn` (giữ domain tạm `app.binhminhsonglo.dynv6.net`).
- Chờ người làm: đổi bản ghi DNS của `@` và `www` tại nhà cung cấp DNS để trỏ về Northflank (chi tiết bản ghi lấy từ trang domain của Northflank, không ghi ở repo). Chỉ sửa `@` và `www`; **không đụng MX, SPF, DMARC** và các bản ghi mail/xác minh khác. Khi lưu, site WordPress cũ ngừng phục vụ, nên chọn thời điểm ít truy cập.
- Sau khi DNS đổi: gắn `@` và `www` vào dịch vụ `bmsl-web`, chờ chứng chỉ, kiểm `curl -I`, rồi **mới đổi `SITE_URL`** sang domain chính thức (đúng thứ tự, vì `SITE_URL` quyết định kiểm Origin của form).
- NOT_PROVEN (kiểm tra ngày 2026-11-13 từ môi trường soạn tài liệu này không truy cập được `binhminhsonglo.vn`, nên không kết luận được DNS đã đổi hay chưa): DNS đã đổi, gắn domain, chứng chỉ, HTTPS tới domain mới, `SITE_URL` mới. **Cần kiểm tra lại trạng thái thật trước khi tin các dòng này.**
- Mẹo: nếu nhà cung cấp DNS không hỗ trợ ALIAS/CNAME flattening cho apex, IP của apex có thể đổi; cân nhắc dùng `www` làm host chính.

## 3. GA4 và cookie

- Banner cookie tiếng Việt nối GA4 theo Google Consent Mode v2 (#146): mặc định từ chối, chỉ tải GA4 sau khi người dùng bấm "Đồng ý"; có "Cài đặt cookie" ở chân trang. ID GA4 lấy từ CMS (mục Theo dõi và SEO); không có ID thì không tải gì.
- Để GA4 hoạt động trên production cần **cả ba**: bật analytics + nhập GA4 ID trong CMS; đặt build arg `CSP_ALLOW_GA4=true` cho `bmsl-build` rồi **build lại** (đặt ở runtime vô hiệu); và BMSL cung cấp property GA4 đã duyệt.
- Trang `/chinh-sach-cookie` là bản nháp `noindex`, cần BMSL duyệt trước khi gỡ `noindex`.
- NOT_PROVEN: production sau release #146; GA4 thật nhận dữ liệu; Search Console (có ô verify trong CMS, cần quyền GSC của BMSL).

## 4. SEO còn tồn đọng (báo cáo 2026-10-26, chưa sửa lúc đó)

Chặn bàn giao:
1. Canonical, `og:url`, sitemap trỏ host Northflank mặc định thay vì domain thật, do `SITE_URL`. Sửa khi chốt domain (mục 2).
2. Nội dung mẫu/thử đang công khai và nằm trong sitemap: title `[MẪU]` ở Trang chủ, Liên hệ, Quy trình & Minh bạch; 4 dự án mẫu; 1 bài mẫu; danh mục tên `mau-chuyen-muc-1` nằm trong URL của 18+ bài thật (đổi slug trước khi Google lập chỉ mục). Các trang này còn `noindex, nofollow`, nên trang chủ chưa được lập chỉ mục. Cần BMSL/CMS quyết định tên danh mục và dọn nội dung.
3. Meta description còn là chữ giữ chỗ ở nhiều trang; các trang danh sách (dự án, dịch vụ, kiến thức, tuyển dụng) thiếu mô tả riêng trong mã.

Nên sửa: 301 từ 47 URL WordPress cũ đang về trang mục thay vì trang chi tiết tương ứng (nguy cơ soft-404); collection `redirects` trong admin hiện **không có tác dụng** (cần gỡ hoặc nối); `robots.txt` thiếu dòng `Sitemap:`; chưa có `og:image` mặc định; dữ liệu có cấu trúc còn mỏng; trang 404 mặc định của Next; hiệu năng ảnh (Lighthouse mô phỏng trang chủ mobile khoảng 79, LCP khoảng 4,9 giây). Báo cáo đầy đủ nằm trong thư mục tệp dự án (`seo-audit/bao-cao-seo-truoc-ban-giao.md`), chưa đưa vào repo vì có thể chứa chi tiết vận hành.

## 5. Kết quả QA gần nhất (production, 2026-10-22)

- PROVEN: 8 khu vực và 73 URL nội bộ trả 200; axe 0 vi phạm trên 49/50 tổ hợp (còn 1 `heading-order` ở `/du-an`); header bảo mật có mặt; không cuộn ngang ở các khổ đã đo; form liên hệ gửi thành công sau khi sửa `TRUSTED_ORIGINS`.
- Sự cố đã xảy ra: ghi đè biến môi trường làm production 503 (mục 6 của file tổng quan). Đã khôi phục; **chưa chắc** biến email báo lead (`LEAD_EMAIL_*`, `SMTP_*`) cũ còn nguyên, cần người vận hành kiểm. Còn một lead thử (tên `QA-TEST`) trong production cần xoá trong CMS.
- NOT_PROVEN: so khớp Figma bằng mắt/pixel ở 5 khổ; Lighthouse trên hạ tầng thật; email báo lead chạy thật; production đang chạy đúng `main` hiện tại (từng có lúc production chạy bản cũ do khâu release).

## 6. Đang chờ BMSL (không phải lỗi lập trình)

Hotline, Zalo, email nhận form, địa chỉ, bản đồ; quyền dùng ảnh; nội dung dự án (danh sách duyệt công khai ≤ 21, ảnh thật ≤ 10/dự án), bài viết (5 chuyên mục, ≤ 10 bài đầu), tuyển dụng (≤ 5 vị trí); hồ sơ năng lực và tài liệu tải về; dữ liệu cho khối lịch sử/đội ngũ/năng lực/giá trị ở trang Giới thiệu; số liệu trang chủ kèm nguồn; ảnh banner thật kèm quyền; chính sách cookie/dữ liệu cá nhân; property GA4 và quyền Search Console; quyết định tên domain chính thức (Issue #109); xác nhận tiến độ hợp đồng (Điều 4.1 vs Phụ lục 02). Danh mục chi tiết: [`contract-acceptance-matrix.md`](contract-acceptance-matrix.md) §7.

## 7. Rủi ro và việc tồn đọng của dự án

| Rủi ro / việc | Ghi chú |
| --- | --- |
| Repo public còn lịch sử tài liệu nội bộ | Chủ dự án sẽ chuyển private sau khi code xong; xoá lịch sử là quyết định riêng |
| Biến bootstrap ban đầu của `bmsl-web` có thể đã lộ | Khuyến nghị xoay bí mật; xoay `PAYLOAD_SECRET` sẽ huỷ phiên CMS |
| Merge vào `main` = release production | Chỉ merge khi CI xanh trên đúng head |
| Chưa kiểm chứng production sau nhiều release gần đây | Cần một đợt QA lại (G4) sau khi domain ổn |
| Chỉ chạy 1 instance | Giới hạn thiết kế, không scale ngang khi chưa đổi cơ chế |
| Sao lưu off-site chưa giao khách | [`../runbooks/backup-restore.md`](../runbooks/backup-restore.md) |
| Issue #102 (banner CMS) | Đóng sau khi có bằng chứng trình duyệt ở 320–1440 |
| Chưa có tài khoản ADMIN bàn giao, đào tạo ≤ 2 giờ, nghiệm thu văn bản | NOT_PROVEN, thuộc G5 |

## 8. Cách vận hành thường ngày

1. Làm trên nhánh, mở PR, chờ CI (verify + integration 4 shard) xanh trên đúng head; auto-merge theo quy tắc ở file tổng quan.
2. Test cục bộ: `pnpm typecheck`, `pnpm lint`, `pnpm test`; tích hợp cần PostgreSQL: `pnpm test:integration`.
3. Thay đổi CMS/schema phải có migration cộng thêm, snapshot và kiểm up/down/up; trường mới để trống, mapper công khai bỏ qua khối rỗng.
4. Sau release: kiểm `/healthz`, 8 khu vực, `/admin`, form liên hệ (không gửi lead thật nếu chưa cần; nếu gửi thử thì xoá sau).
5. Sửa biến Northflank bằng patch, không ghi đè; ghi chú PROVEN/NOT_PROVEN vào báo cáo.
