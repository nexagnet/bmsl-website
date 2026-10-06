# Hướng dẫn sử dụng CMS — dành cho ADMIN và EDITOR của BMSL

Tài liệu này là **tài liệu đã chuẩn bị**. Việc đào tạo thực tế **chưa diễn ra** và chưa có biên bản xác nhận (xem §11 và `uat-handover-matrix.md`).
Tài liệu không chứa mật khẩu, tài khoản thật hay thông tin BMSL chưa được xác nhận; mọi ví dụ là giả lập. Màn hình quản trị: `/admin` của website. Phần thực hành với dữ liệu mẫu [MẪU] nằm ở **§12** (bắt đầu nhanh ở §12.1).

## 1. Vai trò

| Vai trò | Được làm | Không được làm |
| --- | --- | --- |
| **ADMIN** | Mọi thứ: người dùng, nội dung, media, chuyển hướng, cài đặt website, lead liên hệ, 4 trang giới thiệu/quy trình/liên hệ/trang chủ, lĩnh vực dịch vụ, chuyên mục | — |
| **EDITOR** | Dự án, bài viết, tin tuyển dụng, tài liệu, media (tạo/sửa/xoá); đọc **hồ sơ của chính mình** | Quản lý người dùng; xem lead; sửa cài đặt website, chuyển hướng, trang cố định (home/about/process/contact), chuyên mục, lĩnh vực dịch vụ |

Đây là mặc định an toàn của hệ thống; EDITOR có được xem lead hay không là **quyết định chưa chốt của BMSL**. Khách truy cập chỉ đọc nội dung **đã xuất bản**.

## 2. Đăng nhập, mật khẩu, chuyển giao tài khoản

* Đăng nhập tại `/admin` bằng email + mật khẩu do bạn đặt. **Không có mật khẩu mặc định**; không dùng chung tài khoản; không gửi mật khẩu qua email/chat thường.
* Đăng nhập sai 5 lần sẽ bị khoá 10 phút. Phiên đăng nhập hết hạn sau 2 giờ; đăng nhập lại khi được yêu cầu.
* ADMIN tạo tài khoản EDITOR trong **Tài khoản → Tạo mới**, chọn vai trò, đặt mật khẩu riêng và chuyển cho người dùng qua kênh an toàn; người dùng nên đổi mật khẩu.
* Quên mật khẩu: nhờ ADMIN đặt lại trong **Tài khoản** (email tự động chưa được cấu hình).
* Chuyển giao ADMIN cao nhất: người vận hành tạo tài khoản đầu tiên bằng quy trình bảo mật (`docs/runbooks/van-hanh.md` §4); BMSL đổi mật khẩu ngay lần đầu, tạo một ADMIN dự phòng thứ hai
  và cất thông tin ở nơi an toàn. Chủ sở hữu đã được ghi nhận đăng nhập được vào một tài khoản ADMIN **có sẵn**, nhưng việc chuyển giao ADMIN chính thức cho BMSL (đổi mật khẩu, ADMIN dự phòng, biên bản) là bước riêng và **chưa được xác nhận**.

## 3. Nguyên tắc cốt lõi: bản nháp, xác nhận, quyền dùng ảnh

1. **Mọi nội dung mới bắt đầu là bản nháp.** Chỉ khi nhấn **Xuất bản** nội dung mới hiện ra công khai. **Lưu bản nháp** không làm hiện nội dung.
2. **Không đăng thông tin chưa được BMSL xác nhận.** Địa chỉ, email, hotline, Zalo, quy mô/trạng thái dự án, giấy phép/năng lực pháp lý, số liệu, lương/quyền lợi tuyển dụng, phản hồi BQT, ảnh: để trống hoặc giữ nháp
   cho tới khi có xác nhận bằng văn bản. Không tự suy đoán hoặc chép từ website cũ rồi coi như đúng.
3. **Cổng xác nhận (`sourceStatus`)** — dự án và tin tuyển dụng có trường `sourceStatus`: `LEGACY-SOURCE` (lấy từ web cũ, chưa xác nhận, mặc định) hoặc `CONFIRMED`.
   Hệ thống **từ chối Xuất bản** nếu chưa `CONFIRMED`; đừng chọn `CONFIRMED` chỉ để vượt qua cảnh báo.
4. **Cổng BQT:** phản hồi của Ban quản trị chỉ hiện công khai khi tích **"Đã được nguồn duyệt"** và BQT/chủ đầu tư đã đồng ý bằng văn bản.
5. **Quyền sử dụng media (`rightsStatus`):** mọi tệp tải lên mặc định `UNCONFIRMED` (không hiển thị công khai). Chỉ đặt `APPROVED` khi BMSL xác nhận có quyền dùng tệp (và, với ảnh có người, đã có đồng ý).
   Đổi lại về `UNCONFIRMED` là gỡ tệp khỏi công chúng ngay.
6. Nếu một dự án/tin tuyển dụng **đã đăng** nhưng chưa `CONFIRMED` (dữ liệu cũ) thì không lưu lại được: trước hết chuyển về bản nháp (**Gỡ xuất bản**), sửa, rồi chỉ **Xuất bản** lại sau khi nguồn đã xác nhận.

## 4. Đăng bản nháp thành nội dung công khai (quy trình chung)

1. Vào mục cần thiết ở thanh bên → **Tạo mới** (hoặc mở bản ghi có sẵn).
2. Điền các trường bắt buộc (có dấu `*`). **Slug** chỉ gồm chữ thường a–z, số và dấu gạch ngang đơn (ví dụ `bao-ve-toa-nha`); slug sai sẽ bị từ chối.
3. **Lưu bản nháp**. Dùng **Lịch sử phiên bản** nếu cần xem hoặc khôi phục phiên bản cũ.
4. Kiểm tra: nội dung có dữ kiện chưa xác nhận không? Ảnh đã `APPROVED` chưa? `sourceStatus` đúng chưa?
5. **Xuất bản** (với nội dung đã xuất bản trước đó, nút ghi **Xuất bản các thay đổi**). Mở trang công khai tương ứng để kiểm tra. Muốn gỡ: **Gỡ xuất bản** (quay về nháp).

## 5. Từng mục nội dung

| Mục | Dùng để | Lưu ý |
| --- | --- | --- |
| **Dự án (Projects)** | Hồ sơ dự án (tối đa ban đầu 21 hồ sơ, tối đa 10 ảnh mỗi dự án — là giới hạn bàn giao, không phải số dự án thật) | Phạm vi **dự kiến** nhập từ web cũ là 17 hồ sơ (chưa nhập). Hiện trên CMS **chỉ có 1 hồ sơ [MẪU]** (Draft, `LEGACY-SOURCE`) để tập thao tác, không có 17 hồ sơ thật. Hồ sơ nhập từ web cũ sẽ là **nháp, `LEGACY-SOURCE`**. Chỉ Xuất bản khi `CONFIRMED`. Địa chỉ/quy mô/thời gian vận hành chỉ nhập khi có nguồn. Ảnh chọn từ Media đã `APPROVED`. Phản hồi BQT theo cổng ở §3 |
| **Bài viết (Articles)** | Kiến thức & tin tức (10 bài đầu là kế hoạch, chờ khách duyệt) | Danh sách 10 bài đầu chỉ là **dự kiến, chưa được BMSL chốt/duyệt**; hiện CMS chỉ có 1 bài [MẪU] (Draft) để tập thao tác. Gắn chuyên mục, ảnh bìa (`APPROVED`), ngày đăng. Số liệu/tên riêng/cam kết cần nguồn được duyệt |
| **Chuyên mục (Article Categories)** | Đúng **5** chuyên mục | **Tên chưa được xác nhận**: chỉ nhập khi BMSL cung cấp. Chỉ ADMIN sửa |
| **Tin tuyển dụng (Job Postings)** | Tuyển dụng (tối đa 5 ban đầu) | Chưa có dữ liệu thật. Lương, quyền lợi, hạn nộp, ngày đăng, địa điểm: `UNCONFIRMED`. Chỉ Xuất bản khi `sourceStatus=CONFIRMED`. Dữ liệu có cấu trúc cho Google chỉ phát ra khi có đủ ngày đăng + địa điểm (mã quốc gia 2 chữ in hoa, ví dụ `VN` do BMSL xác nhận) |
| **Tài liệu (Documents)** | Tệp tải về ở trang Quy trình & minh bạch (tối đa 5 ban đầu) | Tệp là media: chỉ hiển thị khi `rightsStatus=APPROVED`. Tài liệu giá/minh bạch chưa có tệp đã duyệt |
| **Media** | Ảnh (PNG/JPEG/GIF/WebP/AVIF) và PDF, tối đa 10 MB | Tên tệp, loại tệp và nội dung phải khớp; SVG/HTML/script bị từ chối. Điền `alt` (mô tả ảnh). Trường `source` là ghi chú nội bộ về chủ sở hữu, không công khai. Kiểm tra này **không** phải quét virus |
| **Lĩnh vực dịch vụ (Service Areas)** | Đúng 4 lĩnh vực: quản lý vận hành, bảo vệ, vệ sinh, PCCC | Chỉ ADMIN. Không thêm giấy phép/cam kết/số liệu khi BMSL chưa duyệt |
| **Chuyển hướng (Redirects)** | Bảng ghi chuyển hướng 301 (`from`, `to`) | Chỉ ADMIN. **Lưu ý: hiện website chưa đọc bảng này lúc chạy.** 47 URL của web cũ được phục vụ bằng luật cố định trong mã (`next.config.mjs`, đã kiểm thử), nên bản ghi thêm ở đây **chưa có hiệu lực** cho tới khi có thay đổi mã riêng. Không dựa vào nó để chuyển hướng |
| **Trang cố định (Globals)** | Trang chủ, Giới thiệu, Quy trình, Liên hệ | Chỉ ADMIN. Có bản nháp riêng và bản đã xuất bản; công chúng chỉ thấy bản đã xuất bản |
| **Cài đặt website (Site Settings)** | Liên hệ chính thức, mạng xã hội, GA4, Search Console | Chỉ ADMIN. **Liên hệ là `UNCONFIRMED`: để trống tới khi BMSL xác nhận.** Hotline/Zalo sai định dạng sẽ bị ẩn chứ không tự sửa. Chỉ bật `analyticsEnabled` khi BMSL đã quyết định chính sách cookie; ngay cả khi bật, không có dữ liệu nào gửi đi trước khi khách đồng ý |
| **Lead liên hệ (Contact Leads)** | Yêu cầu từ form Liên hệ (khảo sát, báo giá, khác) | Chỉ ADMIN xem/sửa; không ai xoá được qua giao diện. Chứa dữ liệu cá nhân: không xuất ra tệp công khai, không gửi qua kênh không an toàn. Trạng thái `new` → `handled` sau khi xử lý |

## 6. Lead liên hệ và các giới hạn "đóng khi lỗi" (fail-closed)

* Khi khách gửi form hợp lệ, lead được **lưu vào CSDL trước**, rồi trang mới báo thành công. Nếu lưu lỗi, khách nhận thông báo lỗi và **không** có dòng nào được tạo.
* Không đồng ý điều khoản, thiếu tên/điện thoại/nội dung, hoặc bot (trường ẩn honeypot) → không lưu.
* Giới hạn: nội dung tối đa 16 KiB; tối đa 30 lượt gửi / 10 phút cho cả website (cấu hình được); yêu cầu phải cùng website (kiểm tra Origin); khi hệ thống không chắc chắn, nó **từ chối** thay vì cho qua.
* Hiện **chưa có thông báo tự động** (email/Zalo) khi có lead: ADMIN cần mở **Yêu cầu liên hệ** thường xuyên. Quy tắc lưu trữ/xoá lead và việc EDITOR có xem được hay không là quyết định BMSL chưa chốt.

## 7. Việc thường gặp và cách xử lý

| Tình huống | Làm gì |
| --- | --- |
| Không Xuất bản được dự án/tin tuyển dụng | Kiểm tra `sourceStatus`; nếu chưa có xác nhận bằng văn bản của BMSL thì giữ nháp |
| Ảnh không hiện công khai | Kiểm tra `rightsStatus=APPROVED` và ảnh đã được chọn trong bản ghi **đã xuất bản** |
| Tải ảnh bị từ chối | Dùng đúng PNG/JPEG/GIF/WebP/AVIF/PDF ≤ 10 MB; tên tệp có phần mở rộng đúng; không đổi đuôi tệp |
| Slug bị từ chối | Chỉ chữ thường a–z, số, dấu `-` đơn |
| Bị khoá đăng nhập | Chờ 10 phút hoặc nhờ ADMIN |
| Phát hiện nội dung sai đã công khai | **Gỡ xuất bản** ngay, sửa ở bản nháp, kiểm tra nguồn rồi mới Xuất bản |

## 8. Danh sách kiểm tra trước khi Xuất bản bất kỳ nội dung nào

- [ ] Mọi dữ kiện về BMSL/dự án/tuyển dụng có nguồn được BMSL xác nhận (không suy đoán, không chép nguyên từ web cũ)
- [ ] `sourceStatus = CONFIRMED` (dự án, tuyển dụng) chỉ khi đã có xác nhận
- [ ] Ảnh/tệp `rightsStatus = APPROVED` và người trong ảnh đã đồng ý
- [ ] Phản hồi BQT chỉ hiện khi có "Đã được nguồn duyệt"
- [ ] Slug, tiêu đề, mô tả SEO hợp lệ; `noindex` đúng ý
- [ ] Đã xem trang công khai sau khi Xuất bản và kiểm tra trên điện thoại

## 9. Chương trình đào tạo đề xuất (≤ 2 giờ)

| Thời lượng | Nội dung | Thực hành |
| --- | --- | --- |
| 10' | Mục tiêu, vai trò ADMIN/EDITOR, nguyên tắc "chưa xác nhận thì không đăng" | — |
| 15' | Đăng nhập, mật khẩu, tạo/chuyển giao tài khoản (ADMIN) | ADMIN tạo một EDITOR thử trên môi trường staging |
| 20' | Bản nháp → Xuất bản → Gỡ xuất bản; Lịch sử phiên bản | Tạo bài nháp, xuất bản, gỡ |
| 20' | Cổng xác nhận, BQT, quyền dùng media | Thử Xuất bản dự án `LEGACY-SOURCE` (bị từ chối), tải ảnh `UNCONFIRMED` → `APPROVED` |
| 20' | Dự án, bài viết, chuyên mục, tuyển dụng, tài liệu | Mỗi người tạo một bản ghi nháp |
| 15' | Cài đặt website, chuyển hướng, trang cố định (ADMIN) | Xem trước, không điền dữ kiện chưa xác nhận |
| 10' | Lead liên hệ: xem, xử lý, giới hạn, dữ liệu cá nhân | Gửi lead thử trên staging và xử lý |
| 10' | Sự cố, sao lưu/khôi phục (tổng quan), liên hệ hỗ trợ | Hỏi đáp |
| **120'** | **Tổng** (không vượt 2 giờ) | |

## 10. Danh sách kiểm tra đào tạo (điền khi đào tạo thật diễn ra)

| Mục | Ai thực hiện | Đã làm (ngày, người ký) |
| --- | --- | --- |
| ADMIN đăng nhập, đổi mật khẩu, tạo EDITOR | ADMIN BMSL | _chưa_ |
| EDITOR đăng nhập và tạo bản nháp | EDITOR BMSL | _chưa_ |
| Xuất bản/Gỡ xuất bản một bản ghi trên staging | ADMIN + EDITOR | _chưa_ |
| Hiểu cổng `sourceStatus`, BQT, `rightsStatus` | ADMIN + EDITOR | _chưa_ |
| Xử lý một lead thử | ADMIN | _chưa_ |
| Biết cách xoay mật khẩu và liên hệ khi sự cố | ADMIN | _chưa_ |
| Người tham dự ký **biên bản đã nhận đào tạo** | Người đào tạo + BMSL | _chưa_ |

## 11. Tài liệu sẵn sàng ≠ đào tạo đã giao

Có tài liệu này và chương trình ở §9 nghĩa là **vật liệu đã sẵn sàng**. Nó **không** chứng minh buổi đào tạo đã diễn ra, người dùng đã hiểu hay BMSL đã xác nhận đã nhận đào tạo.
Bảng §10 để trống cho tới khi có bằng chứng thật; mục "training acknowledgement" trong ma trận bàn giao vẫn là `NOT_PROVEN`.

## 12. Thực hành với bộ dữ liệu mẫu [MẪU]

Bộ dữ liệu này chỉ để **tập thao tác CMS**. Nó **không** phải thông tin BMSL, **không** được xuất bản và **không** hiện trên website công khai (khách chỉ thấy nội dung đã xuất bản và media đã duyệt). Tập thao tác với bộ mẫu **không** thay thế đào tạo thật, bàn giao ADMIN chính thức hay xác nhận của khách hàng (§11).
Mọi nội dung mẫu đều hư cấu; không có địa chỉ, quy mô, giấy phép, lương, hạn nộp hay ngày vận hành thật của BMSL. Không có tài khoản ADMIN/EDITOR mới nào được tạo cho phần này và tài liệu không chứa mật khẩu.

### 12.1 Bắt đầu nhanh

1. Mở <https://http--bmsl-web--wkbbfyv6gcrp.code.run/admin> và đăng nhập bằng tài khoản ADMIN **của bạn** (không dùng chung, không có mật khẩu mặc định).
2. Giao diện quản trị hiển thị **tiếng Việt** cho mọi tài khoản. Tài liệu này dùng đúng nhãn tiếng Việt trên màn hình; xem bảng thuật ngữ ở §12.6 (có tên tiếng Anh trong ngoặc chỉ để đối chiếu). Nhãn do Payload cung cấp có thể thay đổi nhỏ giữa các phiên bản; nếu khác mô tả, hãy theo giao diện thật.
3. Thanh bên liệt kê các mục; mỗi bản ghi có đường dẫn `/admin/collections/<mục>/<ID>`.
4. Chỉ làm bài tập với bản ghi có tiền tố **[MẪU]**.

### 12.2 Danh sách bản ghi mẫu

Gốc: `https://http--bmsl-web--wkbbfyv6gcrp.code.run`. Đây là ảnh chụp lúc tạo; nếu ai đó đã sửa/xoá thì bản ghi có thể khác.

| Mục | Bản ghi mẫu | Trạng thái | Mở trong CMS |
| --- | --- | --- | --- |
| Lĩnh vực dịch vụ (Service Areas) | ID 1–4: `mau-quan-ly-van-hanh`, `mau-bao-ve`, `mau-ve-sinh`, `mau-pccc`; tên [MẪU], mô tả ghi rõ là hư cấu | Draft (mẫu) | [1](https://http--bmsl-web--wkbbfyv6gcrp.code.run/admin/collections/service-areas/1) · [2](https://http--bmsl-web--wkbbfyv6gcrp.code.run/admin/collections/service-areas/2) · [3](https://http--bmsl-web--wkbbfyv6gcrp.code.run/admin/collections/service-areas/3) · [4](https://http--bmsl-web--wkbbfyv6gcrp.code.run/admin/collections/service-areas/4) |
| Chuyên mục bài viết (Article Categories) | ID 1–5: `mau-chuyen-muc-1`…`5` ([MẪU] Vận hành / An toàn / Vệ sinh / Quy trình / Tin nội bộ) | Draft (mẫu); **không phải** 5 tên chuyên mục chính thức do khách duyệt | [1](https://http--bmsl-web--wkbbfyv6gcrp.code.run/admin/collections/article-categories/1) · [2](https://http--bmsl-web--wkbbfyv6gcrp.code.run/admin/collections/article-categories/2) · [3](https://http--bmsl-web--wkbbfyv6gcrp.code.run/admin/collections/article-categories/3) · [4](https://http--bmsl-web--wkbbfyv6gcrp.code.run/admin/collections/article-categories/4) · [5](https://http--bmsl-web--wkbbfyv6gcrp.code.run/admin/collections/article-categories/5) |
| Dự án (Projects) | ID 1 [MẪU] Hồ sơ dự án thực hành, `mau-du-an-thuc-hanh`; dịch vụ 1, 2; ảnh media 1; không có địa chỉ/quy mô/ngày vận hành | Draft, `LEGACY-SOURCE`, BQT chưa duyệt | [1](https://http--bmsl-web--wkbbfyv6gcrp.code.run/admin/collections/projects/1) |
| Bài viết (Articles) | ID 1 [MẪU] Bài viết hướng dẫn thực hành, `mau-bai-viet-thuc-hanh`; chuyên mục 1, ảnh bìa media 1, nội dung rich text, SEO + noindex; đã lưu 2 lần (phiên bản 2 cập nhật excerpt) | Draft | [1](https://http--bmsl-web--wkbbfyv6gcrp.code.run/admin/collections/articles/1) |
| Tin tuyển dụng (Job Postings) | ID 1 [MẪU] Tin tuyển dụng thực hành, `mau-tuyen-dung-thuc-hanh`; mô tả/yêu cầu/quyền lợi/cách ứng tuyển là văn bản mẫu; không lương, hạn nộp, ngày đăng, địa điểm | Draft, `LEGACY-SOURCE` | [1](https://http--bmsl-web--wkbbfyv6gcrp.code.run/admin/collections/job-postings/1) |
| Thư viện ảnh và tệp (Media Assets) | ID 1 `mau-anh-cms.png` (PNG 1 điểm ảnh tổng hợp, chỉ để thử tải lên, không phải ảnh dự án); ID 2 `mau-tai-lieu-cms.pdf` (PDF 1 trang ghi "DEMO CMS - NOT AN OFFICIAL BMSL DOCUMENT"); nguồn nội bộ ghi là tổng hợp | `UNCONFIRMED` | [1](https://http--bmsl-web--wkbbfyv6gcrp.code.run/admin/collections/media-assets/1) · [2](https://http--bmsl-web--wkbbfyv6gcrp.code.run/admin/collections/media-assets/2) |
| Tài liệu (Documents) | ID 1 [MẪU] Tài liệu thực hành tải tệp; tệp media 2; phân loại [MẪU] Đào tạo CMS | Draft | [1](https://http--bmsl-web--wkbbfyv6gcrp.code.run/admin/collections/documents/1) |
| Chuyển hướng URL (Redirects) | ID 1: `/mau-cms-chuyen-huong` → `/lien-he`, 301 | Không có nháp; **chưa có hiệu lực** (§5) | [1](https://http--bmsl-web--wkbbfyv6gcrp.code.run/admin/collections/redirects/1) |
| Yêu cầu liên hệ (Contact Leads) | ID 1 [MẪU] Lead khảo sát giả lập (điện thoại/email giả, loại `khao-sat`, nguồn `/admin/mau-dao-tao`) | Tạo `New`, đã chuyển `Handled`; bản ghi giả, không phải khách thật | [1](https://http--bmsl-web--wkbbfyv6gcrp.code.run/admin/collections/contact-leads/1) |
| Trang cố định (Globals) | Home, About, Process, Contact: tiêu đề [MẪU], nội dung hư cấu ngắn, SEO noindex | Draft | [home](https://http--bmsl-web--wkbbfyv6gcrp.code.run/admin/globals/home-page) · [about](https://http--bmsl-web--wkbbfyv6gcrp.code.run/admin/globals/about-page) · [process](https://http--bmsl-web--wkbbfyv6gcrp.code.run/admin/globals/process-page) · [contact](https://http--bmsl-web--wkbbfyv6gcrp.code.run/admin/globals/contact-page) |
| Cài đặt website (Site Settings) | Chỉ có liên kết mạng xã hội mẫu `https://example.com` (có nhãn mẫu); liên hệ thật để trống; `analyticsEnabled` tắt; không có mã GA4/Search Console | Draft | [site-settings](https://http--bmsl-web--wkbbfyv6gcrp.code.run/admin/globals/site-settings) |

Users không thay đổi: không có tài khoản ADMIN/EDITOR bổ sung.

### 12.3 Bài tập từng bước

**Bài 1 — Sửa, lưu nháp bài viết và xem lịch sử phiên bản.**
1. **Bài viết** → mở [MẪU] Bài viết hướng dẫn thực hành.
2. Các trường: **Title** (tiêu đề), **Slug** (chỉ a–z, số, `-` đơn), **Excerpt** (tóm tắt), **Body** (nội dung), **Category** (chuyên mục), **Cover** (ảnh bìa), **Published At** (ngày đăng), **SEO Noindex** (không cho công cụ tìm kiếm lập chỉ mục). **Trạng thái** là **Bản nháp**. Tên trường tiếng Anh ở đây là tên trong dữ liệu; nhãn tiếng Việt trên màn hình có thể diễn đạt khác chút, hãy đối chiếu theo nghĩa.
3. Sửa một câu ở phần tóm tắt → **Lưu bản nháp**. Trạng thái vẫn là **Bản nháp**.
4. Mở **Lịch sử phiên bản** để xem các phiên bản đã lưu và so sánh/khôi phục nếu cần. (Giao diện này đã được kiểm tra khi còn tiếng Anh: bài mẫu có 2 phiên bản Draft; nếu giao diện thật khác mô tả, hãy theo giao diện thật.) **API** chỉ để kỹ thuật viên xem dữ liệu.
5. **Không** nhấn **Xuất bản** hay **Xuất bản các thay đổi** với bài mẫu.

**Bài 2 — Gắn chuyên mục, ảnh bìa, SEO.** Trong cùng bài, chọn Category là một chuyên mục [MẪU], Cover là `mau-anh-cms.png`, điền SEO title/description ngắn và giữ noindex bật; Lưu bản nháp. Ảnh còn `UNCONFIRMED` nên sẽ không hiện công khai.

**Bài 3 — Tạo dự án nháp.** **Dự án → Tạo mới**: tên [MẪU], slug đúng định dạng, chọn Service Areas và ảnh; giữ `sourceStatus = LEGACY-SOURCE`; không nhập địa chỉ/quy mô/ngày vận hành; không tích "Đã được nguồn duyệt" của BQT; Lưu bản nháp. Xuất bản sẽ bị từ chối vì chưa `CONFIRMED` — đó là cổng bảo vệ, đừng vượt qua.

**Bài 4 — Tin tuyển dụng nháp.** **Tin tuyển dụng → Tạo mới**: nhập **Title** bắt đầu bằng [MẪU] và **Slug** hợp lệ, duy nhất (chỉ a–z, số, `-` đơn, ví dụ `mau-tuyen-dung-thuc-hanh-2`); rồi nhập mô tả, yêu cầu, quyền lợi, cách ứng tuyển bằng văn bản mẫu; để trống lương, hạn nộp, ngày đăng, địa điểm; giữ `LEGACY-SOURCE`; Lưu bản nháp.

**Bài 5 — Tải media, PDF và tài liệu.** **Thư viện ảnh và tệp → Tạo mới**: chọn PNG/JPEG/GIF/WebP/AVIF/PDF ≤ 10 MB, điền `alt`, ghi `source` (ghi chú nội bộ), giữ `rightsStatus = UNCONFIRMED`. Rồi **Tài liệu → Tạo mới**: nhập **Title** bắt đầu bằng [MẪU], chọn tệp là `mau-tai-lieu-cms.pdf`, đặt phân loại, Lưu bản nháp. Tải tệp lên **không** tự làm quyền sử dụng được duyệt.

**Bài 6 — Trang cố định và Cài đặt website.** Mở từng trang cố định và Site Settings, sửa nội dung mẫu, giữ noindex, lưu nháp. Không điền liên hệ thật khi BMSL chưa xác nhận; không bật `analyticsEnabled`.

**Bài 7 — Xử lý lead mẫu.** **Yêu cầu liên hệ** → lead [MẪU]. Trạng thái: `new` (mới) → `handled` (đã xử lý) sau khi ADMIN liên hệ/đóng việc. Không ai xoá được lead qua giao diện. Việc tạo lead trong CMS **không** chứng minh form công khai gửi được lead, cũng không chứng minh có thông báo (hiện chưa cấu hình). Quy tắc lưu trữ lead là quyết định BMSL chưa chốt.

**Bài 8 — Tìm kiếm và lọc.** Trong danh sách mỗi mục, tìm `[MẪU]` hoặc `mau-` ở ô tìm kiếm; dùng bộ lọc theo **Trạng thái** (Bản nháp/Đã xuất bản) hoặc cột khác, và sắp xếp theo cột, để tách bản mẫu khỏi nội dung thật.

### 12.4 Bản nháp, Xuất bản, Gỡ xuất bản và các cổng

* **Lưu bản nháp**: lưu nội bộ, công chúng không thấy. **Xuất bản / Xuất bản các thay đổi**: hiện công khai — chỉ khi đã có xác nhận. **Gỡ xuất bản**: đưa về bản nháp để gỡ khỏi công chúng.
* Bản mẫu [MẪU] **không được xuất bản**. Nội dung thật phải là bản ghi mới với dữ kiện đã xác nhận.
* Cổng `sourceStatus`, BQT và `rightsStatus` (§3) vẫn áp dụng. **Không** chọn `CONFIRMED`, "Đã được nguồn duyệt" hay `APPROVED` cho dữ liệu mẫu chỉ để vượt cổng: một bản mẫu không phải là xác nhận.
* Quản lý người dùng (**Tài khoản**, chỉ ADMIN): xem §1–§2; không mật khẩu mặc định, không tạo thêm tài khoản chỉ để thực hành.

### 12.5 Mẫu CMS ≠ xuất bản và bàn giao thật

Bộ mẫu chỉ minh hoạ thao tác CMS trên bản chạy đã chụp lại. Nó **không** chứng minh: website công khai hiển thị nội dung thật; BMSL đã được đào tạo hoặc ký nhận; ADMIN đã được bàn giao chính thức; chuyển hướng trong bảng Redirects có hiệu lực; form liên hệ công khai hoặc thông báo email/Zalo hoạt động; chính sách lưu lead hay quyền EDITOR xem lead đã chốt. Tài liệu không kèm ảnh chụp màn hình và không có xác nhận của khách hàng.


### 12.6 Bảng thuật ngữ: nhãn trên màn hình ↔ ý nghĩa thao tác

| Nhãn trên màn hình | Tiếng Anh (đối chiếu) | Ý nghĩa thao tác |
| --- | --- | --- |
| **Trở lại** | Go back | Quay về màn hình trước; không lưu, không xuất bản |
| **Bảng điều khiển** | Dashboard | Trang tổng quan của CMS |
| **Tạo mới** | Create New | Tạo bản ghi mới (bản nháp) |
| **Lưu** | Save | Lưu thay đổi; không tự xuất bản |
| **Lưu bản nháp** | Save Draft | Lưu nội bộ, **không** công khai |
| **Xuất bản** / **Xuất bản các thay đổi** | Publish / Publish changes | **Công khai** nội dung (hoặc các thay đổi mới) trên website; chỉ làm khi đã có xác nhận |
| **Gỡ xuất bản** | Unpublish | Nội dung không còn công khai, quay về bản nháp |
| **Bản nháp** / **Đã xuất bản** | Draft / Published | Trạng thái của bản ghi, không phải thao tác xoá |
| **Lịch sử phiên bản** | Versions | Xem, so sánh, khôi phục các lần lưu trước |
| **Chỉnh sửa** / **Xóa** | Edit / Delete | Sửa bản ghi / xoá bản ghi (đọc kỹ cảnh báo trước khi xác nhận) |
| **Hủy** / **Xác nhận** | Cancel / Confirm | Đóng hộp thoại không thực hiện / đồng ý thực hiện thao tác đang hiện |

Lưu ý: trong Payload, "document" nghĩa là **bản ghi nội dung bất kỳ** (bài viết, dự án, tin tuyển dụng, trang cố định), không phải mục **Tài liệu** (tệp tải về). Vì vậy nút xuất bản không còn ghi "Xuất bản tài liệu".

Các chuỗi chưa chứng minh được là đã khớp: một số chuỗi khác của Payload vẫn dùng chữ "tài liệu" theo nghĩa bản ghi (ví dụ thông báo khoá/sửa đổi); chúng chưa được sửa và chưa kiểm tra bằng trình duyệt.
