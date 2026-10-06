# Báo cáo seed pack nội dung WordPress cũ (Issue #75)

> Tệp này do `pnpm seed:bmsl-legacy:generate` tạo ra từ `src/seed/bmsl-legacy/manifest.json`. Không sửa tay.

Nguồn: https://binhminhsonglo.vn (WordPress 6.7.1), quan sát 2026-10-06.

## Tổng hợp

* Dòng kiểm kê: **51** = 47 URL của bộ 47 (giữ nguyên) + 4 mục mới trên site cũ chưa có trong bộ 47.
* Bản ghi seed: 17 dự án (từ 18 nguồn), 15 bài viết nháp, 4 lĩnh vực dịch vụ, 2 trang (about-page, contact-page).
* Ảnh: 235 URL ảnh trong thân bài/ảnh bìa → **57 tệp duy nhất được commit** (63 URL, 18.6 MB); **172 URL chờ duyệt**: 164 có người nhận diện được, 7 bên thứ ba, 1 tài liệu có chữ ký, 0 chưa duyệt.
* Sitemap: 51 URL; URL không có trong kiểm kê: không có.

## Từng URL → đích CMS

| Ref | URL cũ | Tiêu đề (nguồn) | Đích CMS | Văn bản | Độ khớp | Ảnh: tìm thấy / commit / chờ / ngoài | Cần BMSL duyệt |
| --- | --- | --- | --- | --- | --- | --- | --- |
| legacy:1 | `/gioi-thieu-tong-qua/` | Giới thiệu tổng quan | about-page (`globals/about-page`) | SEEDED | EXACT | 0 / 0 / 0 / 0 | content-approval, legal-claims-confirmation, image-rights |
| legacy:2 | `/duoc-tang-danh-hieu-nguoi-tot-viec-tot-vi-da-tra-lai-tui-xach-co-500-trieu-dong-cho-kho-chu/` | Chỉ huy an ninh Bình Minh Sông Lô được tặng danh hiệu “người tốt, việc tốt” vì đã trả lại túi xách có 500 triệu đồng cho “khổ chủ” | none | BLOCKED_THIRD_PARTY_TEXT | NOT_APPLICABLE | 4 / 0 / 2 / 2 | republication-licence-or-owner-decision, image-rights |
| legacy:3 | `/xu-huong-phat-trien-nganh-dich-vu-bao-ve-co-hoi-va-thach-thuc/` | Xu hướng phát triển ngành dịch vụ bảo vệ: Cơ hội và thách thức | none | BLOCKED_THIRD_PARTY_TEXT | NOT_APPLICABLE | 3 / 0 / 0 / 3 | republication-licence-or-owner-decision, image-rights |
| legacy:4 | `/dich-vu-quan-ly-van-hanh-toa-nha-doi-hoi-nhan-su-gioi-chuyen-nghiep-va-uy-tin-2/` | Dịch vụ quản lý vận hành tòa nhà đòi hỏi nhân sự giỏi, chuyên nghiệp và uy tín | none | BLOCKED_THIRD_PARTY_TEXT | NOT_APPLICABLE | 1 / 0 / 0 / 1 | republication-licence-or-owner-decision, image-rights |
| legacy:5 | `/chung-cu-hoc-vien-quoc-phong-dang-van-hanh/` | Chung cư Học Viện Quốc Phòng (đang vận hành) | projects (`projects/hoc-vien-quoc-phong`) | SEEDED_FACTS_ONLY | NOT_APPLICABLE | 1 / 1 / 0 / 0 | project-facts, image-rights, publication-approval |
| legacy:6 | `/chung-cu-ecolife-tay-ho-dang-van-hanh/` | Chung cư Ecolife Tây Hồ (đang vận hành) | projects (`projects/ecolife-tay-ho`) | SEEDED_FACTS_ONLY | NOT_APPLICABLE | 1 / 1 / 0 / 0 | project-facts, image-rights, publication-approval |
| legacy:7 | `/cum-nha-chung-cu-ct1-ct2-ct3-newtatco-lai-xa-dang-van-hanh/` | Cụm nhà chung cư CT1-CT2-CT3 Newtatco Lai Xá (đang vận hành) | projects (`projects/newtatco-lai-xa`) | SEEDED_FACTS_ONLY | NOT_APPLICABLE | 1 / 1 / 0 / 0 | project-facts, image-rights, publication-approval |
| legacy:8 | `/4-chung-cu-phenikaa-dang-van-hanh/` | Chung cư Phenikaa (đang vận hành) | projects (`projects/phenikaa`) | SEEDED_FACTS_ONLY | NOT_APPLICABLE | 1 / 1 / 0 / 0 | project-facts, image-rights, publication-approval |
| legacy:9 | `/chung-cu-jsc34-dang-van-hanh/` | Chung cư JSC34 (đang vận hành) | projects (`projects/jsc34`) | SEEDED_FACTS_ONLY | NOT_APPLICABLE | 1 / 1 / 0 / 0 | project-facts, image-rights, publication-approval |
| legacy:10 | `/cum-chung-cu-a6-nam-trung-yen-dang-van-hanh/` | Cụm chung cư A6 Nam Trung Yên (Đang vận hành) | projects (`projects/a6-nam-trung-yen`) | SEEDED_FACTS_ONLY | NOT_APPLICABLE | 1 / 1 / 0 / 0 | project-facts, image-rights, publication-approval |
| legacy:11 | `/cum-chung-cu-b6-nam-trung-yen-dang-van-hanh/` | Cụm chung cư B6 Nam Trung Yên (đang vận hành) | projects (`projects/b6-nam-trung-yen`) | SEEDED_FACTS_ONLY | NOT_APPLICABLE | 1 / 1 / 0 / 0 | project-facts, image-rights, publication-approval |
| legacy:12 | `/chung-cu-bo-khoa-hoc-cong-nghe-dang-van-hanh/` | Chung cư Bộ Khoa Học Công Nghệ (đang vận hành) | projects (`projects/bo-khoa-hoc-cong-nghe`) | SEEDED_FACTS_ONLY | NOT_APPLICABLE | 1 / 1 / 0 / 0 | project-facts, image-rights, publication-approval |
| legacy:13 | `/chung-cu-b10-nam-trung-yen/` | Chung cư B10 Nam Trung Yên | projects (`projects/b10-nam-trung-yen`) | SEEDED_FACTS_ONLY | NOT_APPLICABLE | 1 / 1 / 0 / 0 | project-facts, image-rights, publication-approval |
| legacy:14 | `/toa-nha-b11a-nam-trung-yen-dang-van-hanh/` | Tòa nhà B11A Nam Trung Yên (Đang vận hành) | projects (`projects/b11a-nam-trung-yen`) | SEEDED_FACTS_ONLY | NOT_APPLICABLE | 1 / 1 / 0 / 0 | project-facts, image-rights, publication-approval |
| legacy:15 | `/chung-cu-no-1b-kdt-linh-dam-dang-van-hanh/` | Chung cư Nơ 1B KĐT Linh Đàm (đang vận hành) | projects (`projects/no-1b-linh-dam`) | SEEDED_FACTS_ONLY | NOT_APPLICABLE | 1 / 1 / 0 / 0 | project-facts, image-rights, publication-approval |
| legacy:16 | `/chung-cu-no-1a-kdt-linh-dam-dang-van-hanh/` | Chung cư Nơ 1A KĐT Linh Đàm (đang vận hành) | projects (`projects/no-1a-linh-dam`) | SEEDED_FACTS_ONLY | NOT_APPLICABLE | 1 / 1 / 0 / 0 | project-facts, image-rights, publication-approval |
| legacy:17 | `/toa-nha-b3-lang-quoc-te-thang-long/` | Tòa nhà B3 Làng quốc tế Thăng Long | projects (`projects/b3-lang-quoc-te-thang-long`) | SEEDED_FACTS_ONLY | NOT_APPLICABLE | 1 / 1 / 0 / 0 | project-facts, image-rights, publication-approval |
| legacy:18 | `/toa-nha-b5-lang-quoc-te-thang-long/` | Tòa nhà B5 Làng quốc tế Thăng Long | projects (`projects/b5-lang-quoc-te-thang-long`) | SEEDED_FACTS_ONLY | NOT_APPLICABLE | 1 / 1 / 0 / 0 | project-facts, image-rights, publication-approval |
| legacy:19 | `/chung-cu-ct1-a1a2-linh-dam-dang-van-hanh/` | Chung cư CT1 – A1&A2 Linh Đàm (đang vận hành) | projects (`projects/ct1-a1a2-linh-dam`) | SEEDED_FACTS_ONLY | NOT_APPLICABLE | 1 / 1 / 0 / 0 | project-facts, image-rights, publication-approval |
| legacy:20 | `/toa-nha-himlam-da-van-hanh/` | Tòa nhà Himlam (đã vận hành) | projects (`projects/himlam`) | SEEDED_FACTS_ONLY | NOT_APPLICABLE | 1 / 1 / 0 / 0 | project-facts, image-rights, publication-approval |
| legacy:21 | `/chung-cu-hoc-vien-quoc-phong-dang-van-hanh-2/` | Chung cư Học Viện Quốc Phòng (đang vận hành) | projects (`projects/hoc-vien-quoc-phong`) | MERGED_INTO_TARGET | NOT_APPLICABLE | 1 / 1 / 0 / 0 | project-facts, image-rights, publication-approval |
| legacy:22 | `/252-2/` | Toà nhà B-IA20 Ciputra Hà Nội (Đang vận hành) | projects (`projects/b-ia20-ciputra`) | SEEDED_FACTS_ONLY | NOT_APPLICABLE | 1 / 0 / 1 / 0 | project-facts, image-rights, publication-approval |
| legacy:23 | `/chuong-trinh-tat-nien-2023-chao-don-nam-moi-2024-cua-cbnv-cong-ty-binh-minh-song-lo/` | Tiệc tất niên năm 2023 chào đón năm mới 2024 của CBNV Công ty Bình Minh Sông Lô | articles (`articles/chuong-trinh-tat-nien-2023-chao-don-nam-moi-2024-cua-cbnv-cong-ty-binh-minh-song-lo`) | SEEDED | EXACT | 21 / 0 / 21 / 0 | selection, content, category, image-rights |
| legacy:24 | `/du-lich-ba-vi-2024-gan-ket-tinh-dong-nghiep-phan-thuong-cho-cbnv/` | Team Building Ba Vì 2024- Gắn kết tạo nên sức mạnh, phần thưởng cho CBNV | articles (`articles/du-lich-ba-vi-2024-gan-ket-tinh-dong-nghiep-phan-thuong-cho-cbnv`) | SEEDED | EXACT | 11 / 4 / 7 / 0 | selection, content, category, image-rights |
| legacy:25 | `/tap-huan-nghiep-vu-phong-chay-chua-chay-nam-2024/` | Tập huấn Nghiệp vụ Phòng cháy chữa cháy năm 2024 | articles (`articles/tap-huan-nghiep-vu-phong-chay-chua-chay-nam-2024`) | SEEDED | EXACT | 12 / 2 / 10 / 0 | selection, content, category, image-rights |
| legacy:26 | `/nhung-bong-hoa-khoi-van-phong-cong-ty-binh-minh-song-lo-gioi-giang-xinh-dep/` | Những bông hoa Khối Văn phòng Công ty Bình Minh Sông Lô – Giỏi giang xinh đẹp | articles (`articles/nhung-bong-hoa-khoi-van-phong-cong-ty-binh-minh-song-lo-gioi-giang-xinh-dep`) | SEEDED | EXACT | 13 / 0 / 13 / 0 | selection, content, category, image-rights |
| legacy:27 | `/cong-ty-binh-minh-song-lo-tang-hoa-va-qua-cho-cbnv-nu-nhan-ngay-20-10/` | Công ty Bình Minh Sông Lô tặng hoa và quà cho CBNV nữ nhân ngày 20/10 | articles (`articles/cong-ty-binh-minh-song-lo-tang-hoa-va-qua-cho-cbnv-nu-nhan-ngay-20-10`) | SEEDED | EXACT | 4 / 1 / 3 / 0 | selection, content, category, image-rights |
| legacy:28 | `/354-2/` | TRỤ SỞ VĂN PHÒNG CÔNG TY BÌNH MINH SÔNG LÔ | about-page (`globals/about-page`) | MERGED_INTO_TARGET | EXACT | 12 / 1 / 11 / 0 | content-approval, legal-claims-confirmation, image-rights |
| legacy:29 | `/cac-hoat-dong-mung-ngay-doanh-nhan-viet-nam-ngay-quoc-te-dan-ong-va-ngay-sinh-nhat-nhan-vien/` | Các hoạt động mừng ngày Doanh Nhân Việt Nam, ngày Quốc tế đàn ông và ngày sinh nhật nhân viên | articles (`articles/cac-hoat-dong-mung-ngay-doanh-nhan-viet-nam-ngay-quoc-te-dan-ong-va-ngay-sinh-nhat-nhan-vien`) | SEEDED | EXACT | 5 / 1 / 4 / 0 | selection, content, category, image-rights |
| legacy:30 | `/cong-ty-binh-minh-song-lo-chuc-mung-ngay-dai-doan-ket-18-11-hang-nam-tai-mot-so-du-an-cong-ty-dang-quan-ly-van-hanh/` | Công ty Bình Minh Sông Lô chúc mừng Ngày Đại đoàn kết 18/11 hàng năm tại một số Dự án Công ty đang quản lý vận hành | articles (`articles/cong-ty-binh-minh-song-lo-chuc-mung-ngay-dai-doan-ket-18-11-hang-nam-tai-mot-so-du-an-cong-ty-dang-quan-ly-van-hanh`) | SEEDED | EXACT | 8 / 0 / 8 / 0 | selection, content, category, project-list-cross-check |
| legacy:31 | `/cong-ty-binh-minh-song-lo-ki-niem-5-nam-thanh-lap-va-phat-trien/` | CÔNG TY BÌNH MINH SÔNG LÔ KỈ NIỆM 5 NĂM THÀNH LẬP VÀ PHÁT TRIỂN | articles (`articles/cong-ty-binh-minh-song-lo-ki-niem-5-nam-thanh-lap-va-phat-trien`) | SEEDED | EXACT | 51 / 21 / 30 / 0 | selection, content, category, company-history-confirmation |
| legacy:32 | `/chuc-mung-ngay-quoc-te-phu-nu-8-3/` | CHÚC MỪNG NGÀY QUỐC TẾ PHỤ NỮ 8.3 | articles (`articles/chuc-mung-ngay-quoc-te-phu-nu-8-3`) | SEEDED | EXACT | 6 / 3 / 3 / 0 | selection, content, category, image-rights |
| legacy:33 | `/chuc-mung-sinh-nhat-chu-tich-hoi-dong-quan-tri-cong-ty-binh-minh-song-lo/` | Chúc mừng sinh nhật Chủ tịch Hội đồng quản trị Công ty Bình Minh Sông Lô | none | BLOCKED_OWNER_DECISION | NOT_APPLICABLE | 7 / 0 / 7 / 0 | owner-decision-republish, personal-data-consent |
| legacy:34 | `/cong-ty-binh-minh-song-lo-cung-cbnv-don-tet-nguyen-dan-2025/` | CÔNG TY BÌNH MINH SÔNG LÔ CÙNG CBNV ĐÓN TẾT NGUYÊN ĐÁN 2025 | articles (`articles/cong-ty-binh-minh-song-lo-cung-cbnv-don-tet-nguyen-dan-2025`) | SEEDED | EXACT | 33 / 1 / 32 / 0 | selection, content, category, image-rights |
| legacy:35 | `/binh-minh-song-lo-long-nhan-ai-la-trach-nhiem-voi-cong-dong-ma-doanh-nghiep-ben-bi-theo-duoi/` | Bình Minh Sông Lô – Lòng nhân ái là trách nhiệm với cộng đồng mà doanh nghiệp bền bỉ theo đuổi | articles (`articles/binh-minh-song-lo-long-nhan-ai-la-trach-nhiem-voi-cong-dong-ma-doanh-nghiep-ben-bi-theo-duoi`) | SEEDED | EXACT | 3 / 0 / 3 / 0 | selection, content, category, image-rights |
| legacy:36 | `/tong-quan-co-cau-to-chuc-va-cac-phong-ban-chuyen-mon-tai-binh-minh-song-lo/` | Tổng Quan Cơ Cấu Tổ Chức Và Các Phòng Ban Chuyên Môn Tại Bình Minh Sông Lô | about-page (`globals/about-page`) | MERGED_INTO_TARGET | EXACT_EXCEPT_REDACTIONS | 6 / 0 / 6 / 0 | content-approval, legal-claims-confirmation, image-rights, official-contact-confirmation |
| legacy:37 | `/` | Trang chủ | none | NO_SOURCE_BODY | NOT_APPLICABLE | 0 / 0 / 0 / 0 | home-copy-from-owner |
| legacy:38 | `/trang-lien-he/` | Liên hệ | contact-page (`globals/contact-page`) | SEEDED_REDACTED | EXACT_EXCEPT_REDACTIONS | 0 / 0 / 0 / 0 | official-contact-confirmation |
| legacy:39 | `/category/he-thong-to-chuc/` |  | none | TAXONOMY_NOT_SEEDED | NOT_APPLICABLE | 0 / 0 / 0 / 0 | category-taxonomy-approval |
| legacy:40 | `/category/van-hoa-binh-minh-song-lo/` |  | none | TAXONOMY_NOT_SEEDED | NOT_APPLICABLE | 0 / 0 / 0 / 0 | category-taxonomy-approval |
| legacy:41 | `/category/cong-ty/` |  | none | TAXONOMY_NOT_SEEDED | NOT_APPLICABLE | 0 / 0 / 0 / 0 | category-taxonomy-approval |
| legacy:42 | `/category/thong-tin-thong-bao/` |  | none | TAXONOMY_NOT_SEEDED | NOT_APPLICABLE | 0 / 0 / 0 / 0 | category-taxonomy-approval |
| legacy:43 | `/category/kinh-doanh-bds/` |  | none | TAXONOMY_NOT_SEEDED | NOT_APPLICABLE | 0 / 0 / 0 / 0 | category-taxonomy-approval |
| legacy:44 | `/category/tin-tuc/` |  | none | TAXONOMY_NOT_SEEDED | NOT_APPLICABLE | 0 / 0 / 0 / 0 | category-taxonomy-approval |
| legacy:45 | `/category/dich-vu-cong-ty/cung-cap-dich-vu-quan-ly-van-hanh-toa-nha-chung-cu/` |  | none | TAXONOMY_NOT_SEEDED | NOT_APPLICABLE | 0 / 0 / 0 / 0 | category-taxonomy-approval |
| legacy:46 | `/category/du-an/` |  | none | TAXONOMY_NOT_SEEDED | NOT_APPLICABLE | 0 / 0 / 0 / 0 | category-taxonomy-approval |
| legacy:47 | `/author/admin/` |  | none | TAXONOMY_NOT_SEEDED | NOT_APPLICABLE | 0 / 0 / 0 / 0 |  |
| extra:616 | `/tieu-chuan-nang-luc-quy-trinh-dao-tao-doi-ngu-nhan-su-van-hanh-tai-binh-minh-song-lo/` | Tiêu Chuẩn Năng Lực & Quy Trình Đào Tạo Đội Ngũ Nhân Sự Vận Hành Tại Bình Minh Sông Lô | articles (`articles/tieu-chuan-nang-luc-quy-trinh-dao-tao-doi-ngu-nhan-su-van-hanh-tai-binh-minh-song-lo`) | SEEDED_REDACTED | EXACT_EXCEPT_REDACTIONS | 3 / 2 / 1 / 0 | selection, content, category, image-rights, publication-approval, owner-decision-mapping, redirect-not-in-47-inventory, official-contact-confirmation |
| extra:620 | `/bo-nguyen-tac-vang-trong-van-hoa-phuc-vu-cu-dan-danh-cho-don-vi-quan-ly-van-hanh-toa-nha/` | Bộ Nguyên Tắc Vàng Trong Văn Hóa Phục Vụ Cư Dân Dành Cho Đơn Vị Quản Lý Vận Hành Tòa Nhà | articles (`articles/bo-nguyen-tac-vang-trong-van-hoa-phuc-vu-cu-dan-danh-cho-don-vi-quan-ly-van-hanh-toa-nha`) | SEEDED_REDACTED | EXACT_EXCEPT_REDACTIONS | 3 / 2 / 1 / 0 | selection, content, category, image-rights, publication-approval, owner-decision-mapping, redirect-not-in-47-inventory, official-contact-confirmation |
| extra:635 | `/van-hoa-doanh-nghiep-binh-minh-song-lo-tan-tam-chuyen-nghiep-minh-bach/` | Văn Hóa Doanh Nghiệp Bình Minh Sông Lô: Tận Tâm – Chuyên Nghiệp – Minh Bạch | articles (`articles/van-hoa-doanh-nghiep-binh-minh-song-lo-tan-tam-chuyen-nghiep-minh-bach`) | SEEDED_REDACTED | EXACT_EXCEPT_REDACTIONS | 2 / 1 / 1 / 0 | selection, content, category, image-rights, publication-approval, owner-decision-mapping, redirect-not-in-47-inventory, official-contact-confirmation |
| extra:639 | `/quy-dinh-tac-phong-van-hoa-phuc-vu-cua-can-bo-nhan-vien-tai-toa-nha/` | Quy Định Tác Phong & Văn Hóa Phục Vụ Của Cán Bộ Nhân Viên Tại Tòa Nhà | articles (`articles/quy-dinh-tac-phong-van-hoa-phuc-vu-cua-can-bo-nhan-vien-tai-toa-nha`) | SEEDED_REDACTED | EXACT_EXCEPT_REDACTIONS | 0 / 0 / 0 / 0 | selection, content, category, image-rights, publication-approval, owner-decision-mapping, redirect-not-in-47-inventory, official-contact-confirmation |

## Phần bị loại hoặc chỉnh khi chuyển đổi

* legacy:2: text-not-committed×1 (Bài báo đăng lại, cuối bài ghi nguồn doisongphapluat.com.vn: bản quyền văn bản thuộc toà soạn; có tên cá nhân thứ ba.)
* legacy:3: text-not-committed×1 (Bài báo đăng lại ("Theo báo" nguoiduatin.vn, tác giả t/h): bản quyền văn bản thuộc toà soạn.)
* legacy:4: text-not-committed×1 (Bài phỏng vấn của phóng viên Đời sống & Pháp luật (ĐS&PL) đăng lại, ảnh lưu trên doisongphapluat.com.vn: bản quyền thuộc toà soạn. Nghi trùng bài (hậu tố -2).)
* legacy:31: iframe-dropped×1 (www.youtube.com)
* legacy:33: text-not-committed×1 (Blueprint 01/04: OWNER-DECISION có đăng lại thông tin cá nhân của người lãnh đạo hay không.)
* legacy:36: redacted-phone×1
* legacy:37: wordpress-page-body-empty×1
* legacy:38: redacted-email×1; redacted-phone×3
* extra:616: heading-demoted×1 (h1->h2); link-dropped×1 (legacy-site-link); redacted-phone×1
* extra:620: heading-demoted×1 (h1->h2); redacted-phone×1; unknown-element-flattened×1 (pre)
* extra:635: heading-demoted×1 (h1->h2); redacted-phone×1
* extra:639: heading-demoted×1 (h1->h2); redacted-phone×1

## Ảnh chờ duyệt theo lý do

| Loại | Số URL |
| --- | --- |
| DOCUMENT | 1 |
| PERSON | 164 |
| THIRD_PARTY | 1 |
| THIRD_PARTY_HOST | 6 |
