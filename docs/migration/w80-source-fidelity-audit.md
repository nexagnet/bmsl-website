# Báo cáo đối chiếu nguồn WordPress ↔ seed Git (Issue #80)

> Tệp này do `pnpm seed:bmsl-legacy:audit` tạo ra (chỉ đọc, có mạng). Không sửa tay. Không chứa thân bài nguồn, chỉ có độ dài/SHA-256 và các dữ kiện dự án đã nằm sẵn trong seed.

Nguồn: https://binhminhsonglo.vn (WordPress 6.7.1), seed quan sát 2026-10-06.

**Kết quả: không có sai lệch giữa nguồn và seed.** Điều này KHÔNG có nghĩa 100% nội dung đã sẵn sàng công khai: xem các nhóm chặn bên dưới.

## 1. Đối soát số lượng

* REST công khai: 40 bài + 2 trang + 14 chuyên mục; sitemap 51 URL; thư viện media liệt kê 293 (máy chủ báo 305: chênh 12 tệp, thuộc bài không công khai, không đọc được khi ẩn danh).
* Kiểm kê seed 51 dòng; 42 tài liệu (bài + trang) công khai, tất cả phải có trong kiểm kê (thiếu thì liệt kê ở danh sách sai lệch).
* Số bản ghi seed ít hơn số bài WordPress KHÔNG phải là mất nội dung: dự án (18 nguồn → 17 bản ghi), bài gộp vào trang giới thiệu, bài bị chặn, trang chủ rỗng, chuyên mục/tác giả chỉ là trang lưu trữ.

| Nhóm (đích · trạng thái) | Số dòng |
| --- | --- |
| articles · SEEDED | 11 |
| articles · SEEDED_REDACTED | 4 |
| globals · MERGED_INTO_TARGET | 2 |
| globals · SEEDED | 1 |
| globals · SEEDED_REDACTED | 1 |
| không seed · BLOCKED_OWNER_DECISION | 1 |
| không seed · BLOCKED_THIRD_PARTY_TEXT | 3 |
| không seed · NO_SOURCE_BODY | 1 |
| không seed · TAXONOMY_NOT_SEEDED | 9 |
| projects · MERGED_INTO_TARGET | 1 |
| projects · SEEDED_FACTS_ONLY | 17 |

## 2. Ma trận truy vết từng URL

Độ khớp: EXACT = văn bản seed khớp nguồn (trừ SĐT/email); FACTS_ONLY = trang dự án chỉ có dòng dữ kiện; MISSING = không có văn bản để seed (lý do ghi rõ); BLOCKED = có ở nguồn nhưng không được commit; DIFFERS = văn bản nguồn hiện tại khác bản ghi đã commit.

"Văn bản so với bản ghi đã commit" so văn bản nguồn hiện tại với đúng bản ghi trong Git (cùng quy tắc chuẩn hoá và che SĐT/email với generator), không chỉ so độ dài. Dòng không có văn bản được commit (bị chặn, dự án chỉ có dữ kiện, trang lưu trữ) chỉ so được độ dài (NOT_COMPARED); dự án được so từng trường ở mục 3.

| Ref | URL cũ | Loại/ID | Tiêu đề | Ngày | Chuyên mục | Thân bài nguồn (ký tự · SHA-256 12) | Độ dài so với seed | Văn bản so với bản ghi đã commit | Ảnh nguồn / dòng seed | Đích | Độ khớp | Phân loại | Lý do |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| legacy:1 | `/gioi-thieu-tong-qua/` | post #142 | Giới thiệu tổng quan | 2024-12-06 | cong-ty | 1139 · f685db3a32b7 | SAME_AS_SEED | MATCH | 0 / 0 | globals/about-page | EXACT | EXISTING_BUT_DRAFT | Văn bản khớp nguồn; bản ghi là bản nháp. |
| legacy:2 | `/duoc-tang-danh-hieu-nguoi-tot-viec-tot-vi-da-tra-lai-tui-xach-co-500-trieu-dong-cho-kho-chu/` | post #150 | Chỉ huy an ninh Bình Minh Sông Lô được tặng danh hiệu “người tốt, việc tốt” vì đã trả lại túi xách có 500 triệu đồng cho “khổ chủ” | 2024-12-06 | tin-tuc | 4714 · f4813e49b7a8 | SAME_AS_SEED | NOT_COMPARED | 4 / 4 | none | BLOCKED | PRIVACY/RIGHTS_PENDING | Bài báo đăng lại của bên thứ ba: văn bản không được commit vào Git công khai. |
| legacy:3 | `/xu-huong-phat-trien-nganh-dich-vu-bao-ve-co-hoi-va-thach-thuc/` | post #153 | Xu hướng phát triển ngành dịch vụ bảo vệ: Cơ hội và thách thức | 2024-12-06 | tin-tuc | 6939 · 9061095bbf77 | SAME_AS_SEED | NOT_COMPARED | 3 / 3 | none | BLOCKED | PRIVACY/RIGHTS_PENDING | Bài báo đăng lại của bên thứ ba: văn bản không được commit vào Git công khai. |
| legacy:4 | `/dich-vu-quan-ly-van-hanh-toa-nha-doi-hoi-nhan-su-gioi-chuyen-nghiep-va-uy-tin-2/` | post #158 | Dịch vụ quản lý vận hành tòa nhà đòi hỏi nhân sự giỏi, chuyên nghiệp và uy tín | 2024-12-06 | tin-tuc | 7420 · 2fca66000e25 | SAME_AS_SEED | NOT_COMPARED | 1 / 1 | none | BLOCKED | PRIVACY/RIGHTS_PENDING | Bài báo đăng lại của bên thứ ba: văn bản không được commit vào Git công khai. |
| legacy:5 | `/chung-cu-hoc-vien-quoc-phong-dang-van-hanh/` | post #181 | Chung cư Học Viện Quốc Phòng (đang vận hành) | 2024-12-14 | du-an | 307 · e0ed71abd89c | SAME_AS_SEED | NOT_COMPARED | 1 / 1 | projects/hoc-vien-quoc-phong | FACTS_ONLY | EXISTING_BUT_DRAFT | Trang nguồn chỉ gồm các dòng dữ kiện + 1 ảnh; mọi dòng đã vào trường có cấu trúc, không có đoạn văn dài nào bị bỏ. |
| legacy:6 | `/chung-cu-ecolife-tay-ho-dang-van-hanh/` | post #183 | Chung cư Ecolife Tây Hồ (đang vận hành) | 2024-12-14 | du-an | 261 · df66159d0e6c | SAME_AS_SEED | NOT_COMPARED | 1 / 1 | projects/ecolife-tay-ho | FACTS_ONLY | EXISTING_BUT_DRAFT | Trang nguồn chỉ gồm các dòng dữ kiện + 1 ảnh; mọi dòng đã vào trường có cấu trúc, không có đoạn văn dài nào bị bỏ. |
| legacy:7 | `/cum-nha-chung-cu-ct1-ct2-ct3-newtatco-lai-xa-dang-van-hanh/` | post #186 | Cụm nhà chung cư CT1-CT2-CT3 Newtatco Lai Xá (đang vận hành) | 2024-12-14 | du-an | 229 · d1a006fa9c59 | SAME_AS_SEED | NOT_COMPARED | 1 / 1 | projects/newtatco-lai-xa | FACTS_ONLY | EXISTING_BUT_DRAFT | Trang nguồn chỉ gồm các dòng dữ kiện + 1 ảnh; mọi dòng đã vào trường có cấu trúc, không có đoạn văn dài nào bị bỏ. |
| legacy:8 | `/4-chung-cu-phenikaa-dang-van-hanh/` | post #189 | Chung cư Phenikaa (đang vận hành) | 2024-12-14 | du-an | 243 · a95e1d2f0314 | SAME_AS_SEED | NOT_COMPARED | 1 / 1 | projects/phenikaa | FACTS_ONLY | EXISTING_BUT_DRAFT | Trang nguồn chỉ gồm các dòng dữ kiện + 1 ảnh; mọi dòng đã vào trường có cấu trúc, không có đoạn văn dài nào bị bỏ. |
| legacy:9 | `/chung-cu-jsc34-dang-van-hanh/` | post #193 | Chung cư JSC34 (đang vận hành) | 2024-12-14 | du-an | 273 · ef912ca20dc3 | SAME_AS_SEED | NOT_COMPARED | 1 / 1 | projects/jsc34 | FACTS_ONLY | EXISTING_BUT_DRAFT | Trang nguồn chỉ gồm các dòng dữ kiện + 1 ảnh; mọi dòng đã vào trường có cấu trúc, không có đoạn văn dài nào bị bỏ. |
| legacy:10 | `/cum-chung-cu-a6-nam-trung-yen-dang-van-hanh/` | post #196 | Cụm chung cư A6 Nam Trung Yên (Đang vận hành) | 2024-12-14 | du-an | 0 · e3b0c44298fc | NO_BODY | NOT_COMPARED | 1 / 1 | projects/a6-nam-trung-yen | FACTS_ONLY | SOURCE_ABSENT | Trang nguồn chỉ có ảnh, không có dòng dữ kiện nào (địa điểm/quy mô/…): thiếu ở nguồn, không phải lỗi parser. |
| legacy:11 | `/cum-chung-cu-b6-nam-trung-yen-dang-van-hanh/` | post #200 | Cụm chung cư B6 Nam Trung Yên (đang vận hành) | 2024-12-14 | du-an | 227 · 72e0ab5bc33f | SAME_AS_SEED | NOT_COMPARED | 1 / 1 | projects/b6-nam-trung-yen | FACTS_ONLY | EXISTING_BUT_DRAFT | Trang nguồn chỉ gồm các dòng dữ kiện + 1 ảnh; mọi dòng đã vào trường có cấu trúc, không có đoạn văn dài nào bị bỏ. |
| legacy:12 | `/chung-cu-bo-khoa-hoc-cong-nghe-dang-van-hanh/` | post #203 | Chung cư Bộ Khoa Học Công Nghệ (đang vận hành) | 2024-12-14 | du-an | 227 · b87972ed92dd | SAME_AS_SEED | NOT_COMPARED | 1 / 1 | projects/bo-khoa-hoc-cong-nghe | FACTS_ONLY | EXISTING_BUT_DRAFT | Trang nguồn chỉ gồm các dòng dữ kiện + 1 ảnh; mọi dòng đã vào trường có cấu trúc, không có đoạn văn dài nào bị bỏ. |
| legacy:13 | `/chung-cu-b10-nam-trung-yen/` | post #206 | Chung cư B10 Nam Trung Yên | 2024-12-14 | du-an | 211 · c8f45828b6b6 | SAME_AS_SEED | NOT_COMPARED | 1 / 1 | projects/b10-nam-trung-yen | FACTS_ONLY | EXISTING_BUT_DRAFT | Trang nguồn chỉ gồm các dòng dữ kiện + 1 ảnh; mọi dòng đã vào trường có cấu trúc, không có đoạn văn dài nào bị bỏ. |
| legacy:14 | `/toa-nha-b11a-nam-trung-yen-dang-van-hanh/` | post #210 | Tòa nhà B11A Nam Trung Yên (Đang vận hành) | 2024-12-14 | du-an | 187 · 3f26964cec29 | SAME_AS_SEED | NOT_COMPARED | 1 / 1 | projects/b11a-nam-trung-yen | FACTS_ONLY | EXISTING_BUT_DRAFT | Trang nguồn chỉ gồm các dòng dữ kiện + 1 ảnh; mọi dòng đã vào trường có cấu trúc, không có đoạn văn dài nào bị bỏ. |
| legacy:15 | `/chung-cu-no-1b-kdt-linh-dam-dang-van-hanh/` | post #214 | Chung cư Nơ 1B KĐT Linh Đàm (đang vận hành) | 2024-12-14 | du-an | 197 · dff89f4d44c4 | SAME_AS_SEED | NOT_COMPARED | 1 / 1 | projects/no-1b-linh-dam | FACTS_ONLY | EXISTING_BUT_DRAFT | Trang nguồn chỉ gồm các dòng dữ kiện + 1 ảnh; mọi dòng đã vào trường có cấu trúc, không có đoạn văn dài nào bị bỏ. |
| legacy:16 | `/chung-cu-no-1a-kdt-linh-dam-dang-van-hanh/` | post #218 | Chung cư Nơ 1A KĐT Linh Đàm (đang vận hành) | 2024-12-14 | du-an | 196 · 5bdcb77ca7b2 | SAME_AS_SEED | NOT_COMPARED | 1 / 1 | projects/no-1a-linh-dam | FACTS_ONLY | EXISTING_BUT_DRAFT | Trang nguồn chỉ gồm các dòng dữ kiện + 1 ảnh; mọi dòng đã vào trường có cấu trúc, không có đoạn văn dài nào bị bỏ. |
| legacy:17 | `/toa-nha-b3-lang-quoc-te-thang-long/` | post #221 | Tòa nhà B3 Làng quốc tế Thăng Long | 2024-12-14 | du-an | 207 · d9be0d110253 | SAME_AS_SEED | NOT_COMPARED | 1 / 1 | projects/b3-lang-quoc-te-thang-long | FACTS_ONLY | EXISTING_BUT_DRAFT | Trang nguồn chỉ gồm các dòng dữ kiện + 1 ảnh; mọi dòng đã vào trường có cấu trúc, không có đoạn văn dài nào bị bỏ. |
| legacy:18 | `/toa-nha-b5-lang-quoc-te-thang-long/` | post #224 | Tòa nhà B5 Làng quốc tế Thăng Long | 2024-12-14 | du-an | 205 · 516464a2188f | SAME_AS_SEED | NOT_COMPARED | 1 / 1 | projects/b5-lang-quoc-te-thang-long | FACTS_ONLY | EXISTING_BUT_DRAFT | Trang nguồn chỉ gồm các dòng dữ kiện + 1 ảnh; mọi dòng đã vào trường có cấu trúc, không có đoạn văn dài nào bị bỏ. |
| legacy:19 | `/chung-cu-ct1-a1a2-linh-dam-dang-van-hanh/` | post #228 | Chung cư CT1 – A1&#038;A2 Linh Đàm (đang vận hành) | 2024-12-14 | du-an | 242 · 6e123dc154c9 | SAME_AS_SEED | NOT_COMPARED | 1 / 1 | projects/ct1-a1a2-linh-dam | FACTS_ONLY | EXISTING_BUT_DRAFT | Trang nguồn chỉ gồm các dòng dữ kiện + 1 ảnh; mọi dòng đã vào trường có cấu trúc, không có đoạn văn dài nào bị bỏ. |
| legacy:20 | `/toa-nha-himlam-da-van-hanh/` | post #231 | Tòa nhà Himlam (đã vận hành) | 2024-01-01 | du-an | 195 · fc2c2eebfbdd | SAME_AS_SEED | NOT_COMPARED | 1 / 1 | projects/himlam | FACTS_ONLY | EXISTING_BUT_DRAFT | Trang nguồn chỉ gồm các dòng dữ kiện + 1 ảnh; mọi dòng đã vào trường có cấu trúc, không có đoạn văn dài nào bị bỏ. |
| legacy:21 | `/chung-cu-hoc-vien-quoc-phong-dang-van-hanh-2/` | post #250 | Chung cư Học Viện Quốc Phòng (đang vận hành) | 2024-12-19 | du-an | 307 · e0ed71abd89c | SAME_AS_SEED | NOT_COMPARED | 1 / 1 | projects/hoc-vien-quoc-phong | FACTS_ONLY | EXISTING_BUT_DRAFT | Nguồn trùng lặp của cùng một dự án, gộp vào bản ghi dự án (cùng dữ kiện). |
| legacy:22 | `/252-2/` | post #252 | Toà nhà B-IA20 Ciputra Hà Nội (Đang vận hành) | 2025-06-21 | du-an | 235 · 4d66a7d56a78 | SAME_AS_SEED | NOT_COMPARED | 1 / 1 | projects/b-ia20-ciputra | FACTS_ONLY | EXISTING_BUT_DRAFT | Trang nguồn chỉ gồm các dòng dữ kiện + 1 ảnh; mọi dòng đã vào trường có cấu trúc, không có đoạn văn dài nào bị bỏ. |
| legacy:23 | `/chuong-trinh-tat-nien-2023-chao-don-nam-moi-2024-cua-cbnv-cong-ty-binh-minh-song-lo/` | post #268 | Tiệc tất niên năm 2023 chào đón năm mới 2024 của CBNV Công ty Bình Minh Sông Lô | 2025-06-21 | van-hoa-binh-minh-song-lo | 0 · e3b0c44298fc | NO_BODY | MATCH | 21 / 21 | articles/chuong-trinh-tat-nien-2023-chao-don-nam-moi-2024-cua-cbnv-cong-ty-binh-minh-song-lo | EXACT | EXISTING_BUT_DRAFT | Văn bản khớp nguồn; bản ghi là bản nháp. |
| legacy:24 | `/du-lich-ba-vi-2024-gan-ket-tinh-dong-nghiep-phan-thuong-cho-cbnv/` | post #292 | Team Building Ba Vì 2024- Gắn kết tạo nên sức mạnh, phần thưởng cho CBNV | 2025-06-21 | van-hoa-binh-minh-song-lo | 293 · caf4a14545d1 | SAME_AS_SEED | MATCH | 11 / 11 | articles/du-lich-ba-vi-2024-gan-ket-tinh-dong-nghiep-phan-thuong-cho-cbnv | EXACT | EXISTING_BUT_DRAFT | Văn bản khớp nguồn; bản ghi là bản nháp. |
| legacy:25 | `/tap-huan-nghiep-vu-phong-chay-chua-chay-nam-2024/` | post #304 | Tập huấn Nghiệp vụ Phòng cháy chữa cháy năm 2024 | 2025-06-21 | tin-tuc | 1054 · 5c175cca65fb | SAME_AS_SEED | MATCH | 12 / 12 | articles/tap-huan-nghiep-vu-phong-chay-chua-chay-nam-2024 | EXACT | EXISTING_BUT_DRAFT | Văn bản khớp nguồn; bản ghi là bản nháp. |
| legacy:26 | `/nhung-bong-hoa-khoi-van-phong-cong-ty-binh-minh-song-lo-gioi-giang-xinh-dep/` | post #326 | Những bông hoa Khối Văn phòng Công ty Bình Minh Sông Lô &#8211; Giỏi giang xinh đẹp | 2025-06-21 | tin-tuc | 443 · 7f61519dae92 | SAME_AS_SEED | MATCH | 13 / 13 | articles/nhung-bong-hoa-khoi-van-phong-cong-ty-binh-minh-song-lo-gioi-giang-xinh-dep | EXACT | EXISTING_BUT_DRAFT | Văn bản khớp nguồn; bản ghi là bản nháp. |
| legacy:27 | `/cong-ty-binh-minh-song-lo-tang-hoa-va-qua-cho-cbnv-nu-nhan-ngay-20-10/` | post #345 | Công ty Bình Minh Sông Lô tặng hoa và quà cho CBNV nữ nhân ngày 20/10 | 2025-06-23 | van-hoa-binh-minh-song-lo | 374 · 699ee4dccb6c | SAME_AS_SEED | MATCH | 4 / 4 | articles/cong-ty-binh-minh-song-lo-tang-hoa-va-qua-cho-cbnv-nu-nhan-ngay-20-10 | EXACT | EXISTING_BUT_DRAFT | Văn bản khớp nguồn; bản ghi là bản nháp. |
| legacy:28 | `/354-2/` | post #354 | TRỤ SỞ VĂN PHÒNG CÔNG TY BÌNH MINH SÔNG LÔ | 2025-06-23 | cong-ty | 370 · 49f50098abe6 | SAME_AS_SEED | MATCH | 12 / 12 | globals/about-page | EXACT | EXISTING_BUT_DRAFT | Gộp vào globals/about-page; văn bản khớp nguồn. |
| legacy:29 | `/cac-hoat-dong-mung-ngay-doanh-nhan-viet-nam-ngay-quoc-te-dan-ong-va-ngay-sinh-nhat-nhan-vien/` | post #369 | Các hoạt động mừng ngày Doanh Nhân Việt Nam, ngày Quốc tế đàn ông và ngày sinh nhật nhân viên | 2025-06-23 | van-hoa-binh-minh-song-lo | 489 · 37fc4c588c7e | SAME_AS_SEED | MATCH | 5 / 5 | articles/cac-hoat-dong-mung-ngay-doanh-nhan-viet-nam-ngay-quoc-te-dan-ong-va-ngay-sinh-nhat-nhan-vien | EXACT | EXISTING_BUT_DRAFT | Văn bản khớp nguồn; bản ghi là bản nháp. |
| legacy:30 | `/cong-ty-binh-minh-song-lo-chuc-mung-ngay-dai-doan-ket-18-11-hang-nam-tai-mot-so-du-an-cong-ty-dang-quan-ly-van-hanh/` | post #389 | Công ty Bình Minh Sông Lô chúc mừng Ngày Đại đoàn kết 18/11 hàng năm tại một số Dự án Công ty đang quản lý vận hành | 2025-06-23 | tin-tuc | 400 · 04a229fc1e88 | SAME_AS_SEED | MATCH | 8 / 8 | articles/cong-ty-binh-minh-song-lo-chuc-mung-ngay-dai-doan-ket-18-11-hang-nam-tai-mot-so-du-an-cong-ty-dang-quan-ly-van-hanh | EXACT | EXISTING_BUT_DRAFT | Văn bản khớp nguồn; bản ghi là bản nháp. |
| legacy:31 | `/cong-ty-binh-minh-song-lo-ki-niem-5-nam-thanh-lap-va-phat-trien/` | post #399 | CÔNG TY BÌNH MINH SÔNG LÔ KỈ NIỆM 5 NĂM THÀNH LẬP VÀ PHÁT TRIỂN | 2025-06-23 | cong-ty, he-thong-to-chuc, thong-tin-thong-bao, tin-tuc, van-hoa-binh-minh-song-lo | 2183 · cc235ef6816b | SAME_AS_SEED | MATCH | 51 / 51 | articles/cong-ty-binh-minh-song-lo-ki-niem-5-nam-thanh-lap-va-phat-trien | EXACT | EXISTING_BUT_DRAFT | Văn bản khớp nguồn; bản ghi là bản nháp. |
| legacy:32 | `/chuc-mung-ngay-quoc-te-phu-nu-8-3/` | post #512 | CHÚC MỪNG NGÀY QUỐC TẾ PHỤ NỮ 8.3 | 2025-06-23 | kinh-doanh-bds, van-hoa-binh-minh-song-lo | 340 · 239abdc1f002 | SAME_AS_SEED | MATCH | 6 / 6 | articles/chuc-mung-ngay-quoc-te-phu-nu-8-3 | EXACT | EXISTING_BUT_DRAFT | Văn bản khớp nguồn; bản ghi là bản nháp. |
| legacy:33 | `/chuc-mung-sinh-nhat-chu-tich-hoi-dong-quan-tri-cong-ty-binh-minh-song-lo/` | post #523 | Chúc mừng sinh nhật Chủ tịch Hội đồng quản trị Công ty Bình Minh Sông Lô | 2025-06-23 | cong-ty | 371 · 5b52aec75dfb | SAME_AS_SEED | NOT_COMPARED | 7 / 7 | none | BLOCKED | PRIVACY/RIGHTS_PENDING | Thông tin cá nhân của lãnh đạo: chờ quyết định của owner/BMSL. |
| legacy:34 | `/cong-ty-binh-minh-song-lo-cung-cbnv-don-tet-nguyen-dan-2025/` | post #538 | CÔNG TY BÌNH MINH SÔNG LÔ CÙNG CBNV ĐÓN TẾT NGUYÊN ĐÁN 2025 | 2025-06-23 | cong-ty, van-hoa-binh-minh-song-lo | 783 · 93fabf4dad0e | SAME_AS_SEED | MATCH | 33 / 33 | articles/cong-ty-binh-minh-song-lo-cung-cbnv-don-tet-nguyen-dan-2025 | EXACT | EXISTING_BUT_DRAFT | Văn bản khớp nguồn; bản ghi là bản nháp. |
| legacy:35 | `/binh-minh-song-lo-long-nhan-ai-la-trach-nhiem-voi-cong-dong-ma-doanh-nghiep-ben-bi-theo-duoi/` | post #591 | Bình Minh Sông Lô &#8211; Lòng nhân ái là trách nhiệm với cộng đồng mà doanh nghiệp bền bỉ theo đuổi | 2025-10-01 | thong-tin-thong-bao, tin-tuc, van-hoa-binh-minh-song-lo | 4781 · d0168d88e653 | SAME_AS_SEED | MATCH | 3 / 3 | articles/binh-minh-song-lo-long-nhan-ai-la-trach-nhiem-voi-cong-dong-ma-doanh-nghiep-ben-bi-theo-duoi | EXACT | EXISTING_BUT_DRAFT | Văn bản khớp nguồn; bản ghi là bản nháp. |
| legacy:36 | `/tong-quan-co-cau-to-chuc-va-cac-phong-ban-chuyen-mon-tai-binh-minh-song-lo/` | post #606 | Tổng Quan Cơ Cấu Tổ Chức Và Các Phòng Ban Chuyên Môn Tại Bình Minh Sông Lô | 2026-09-23 | cung-cap-dich-vu-quan-ly-van-hanh-toa-nha-chung-cu, he-thong-to-chuc | 5736 · 0cbe6967e39d | SAME_AS_SEED | MATCH_EXCEPT_REDACTIONS | 6 / 6 | globals/about-page | EXACT | EXISTING_BUT_DRAFT | Gộp vào globals/about-page; văn bản khớp nguồn. |
| legacy:37 | `/` | page #15 | Trang chủ | 2024-11-29 |  | 0 · e3b0c44298fc | NO_BODY | NOT_COMPARED | 0 / 0 | none | MISSING | SOURCE_ABSENT | Trang nguồn có thân bài rỗng. |
| legacy:38 | `/trang-lien-he/` | page #17 | Liên hệ | 2024-11-29 |  | 362 · 375896956013 | SAME_AS_SEED | MATCH_EXCEPT_REDACTIONS | 0 / 0 | globals/contact-page | EXACT | EXISTING_BUT_DRAFT | Văn bản khớp nguồn, trừ SĐT/email được thay bằng placeholder; bản ghi là bản nháp. |
| legacy:39 | `/category/he-thong-to-chuc/` | category |  |  |  |  | NOT_A_DOCUMENT | NOT_COMPARED |  / 0 | none | MISSING | SOURCE_ABSENT | Trang lưu trữ do WordPress sinh ra, không có thân bài riêng; phân loại chờ BMSL duyệt. |
| legacy:40 | `/category/van-hoa-binh-minh-song-lo/` | category |  |  |  |  | NOT_A_DOCUMENT | NOT_COMPARED |  / 0 | none | MISSING | SOURCE_ABSENT | Trang lưu trữ do WordPress sinh ra, không có thân bài riêng; phân loại chờ BMSL duyệt. |
| legacy:41 | `/category/cong-ty/` | category |  |  |  |  | NOT_A_DOCUMENT | NOT_COMPARED |  / 0 | none | MISSING | SOURCE_ABSENT | Trang lưu trữ do WordPress sinh ra, không có thân bài riêng; phân loại chờ BMSL duyệt. |
| legacy:42 | `/category/thong-tin-thong-bao/` | category |  |  |  |  | NOT_A_DOCUMENT | NOT_COMPARED |  / 0 | none | MISSING | SOURCE_ABSENT | Trang lưu trữ do WordPress sinh ra, không có thân bài riêng; phân loại chờ BMSL duyệt. |
| legacy:43 | `/category/kinh-doanh-bds/` | category |  |  |  |  | NOT_A_DOCUMENT | NOT_COMPARED |  / 0 | none | MISSING | SOURCE_ABSENT | Trang lưu trữ do WordPress sinh ra, không có thân bài riêng; phân loại chờ BMSL duyệt. |
| legacy:44 | `/category/tin-tuc/` | category |  |  |  |  | NOT_A_DOCUMENT | NOT_COMPARED |  / 0 | none | MISSING | SOURCE_ABSENT | Trang lưu trữ do WordPress sinh ra, không có thân bài riêng; phân loại chờ BMSL duyệt. |
| legacy:45 | `/category/dich-vu-cong-ty/cung-cap-dich-vu-quan-ly-van-hanh-toa-nha-chung-cu/` | category |  |  |  |  | NOT_A_DOCUMENT | NOT_COMPARED |  / 0 | none | MISSING | SOURCE_ABSENT | Trang lưu trữ do WordPress sinh ra, không có thân bài riêng; phân loại chờ BMSL duyệt. |
| legacy:46 | `/category/du-an/` | category |  |  |  |  | NOT_A_DOCUMENT | NOT_COMPARED |  / 0 | none | MISSING | SOURCE_ABSENT | Trang lưu trữ do WordPress sinh ra, không có thân bài riêng; phân loại chờ BMSL duyệt. |
| legacy:47 | `/author/admin/` | author |  |  |  |  | NOT_A_DOCUMENT | NOT_COMPARED |  / 0 | none | MISSING | SOURCE_ABSENT | Trang lưu trữ do WordPress sinh ra, không có thân bài riêng; phân loại chờ BMSL duyệt. |
| extra:616 | `/tieu-chuan-nang-luc-quy-trinh-dao-tao-doi-ngu-nhan-su-van-hanh-tai-binh-minh-song-lo/` | post #616 | Tiêu Chuẩn Năng Lực &#038; Quy Trình Đào Tạo Đội Ngũ Nhân Sự Vận Hành Tại Bình Minh Sông Lô | 2026-10-05 | cung-cap-dich-vu-quan-ly-van-hanh-toa-nha-chung-cu | 2389 · 7fdc57409aed | SAME_AS_SEED | MATCH_EXCEPT_REDACTIONS | 3 / 3 | articles/tieu-chuan-nang-luc-quy-trinh-dao-tao-doi-ngu-nhan-su-van-hanh-tai-binh-minh-song-lo | EXACT | EXISTING_BUT_DRAFT | Văn bản khớp nguồn, trừ SĐT/email được thay bằng placeholder; bản ghi là bản nháp. |
| extra:620 | `/bo-nguyen-tac-vang-trong-van-hoa-phuc-vu-cu-dan-danh-cho-don-vi-quan-ly-van-hanh-toa-nha/` | post #620 | Bộ Nguyên Tắc Vàng Trong Văn Hóa Phục Vụ Cư Dân Dành Cho Đơn Vị Quản Lý Vận Hành Tòa Nhà | 2026-10-05 | cung-cap-dich-vu-quan-ly-van-hanh-toa-nha-chung-cu, van-hoa-binh-minh-song-lo | 7305 · eb698b3edcce | SAME_AS_SEED | MATCH_EXCEPT_REDACTIONS | 3 / 3 | articles/bo-nguyen-tac-vang-trong-van-hoa-phuc-vu-cu-dan-danh-cho-don-vi-quan-ly-van-hanh-toa-nha | EXACT | EXISTING_BUT_DRAFT | Văn bản khớp nguồn, trừ SĐT/email được thay bằng placeholder; bản ghi là bản nháp. |
| extra:635 | `/van-hoa-doanh-nghiep-binh-minh-song-lo-tan-tam-chuyen-nghiep-minh-bach/` | post #635 | Văn Hóa Doanh Nghiệp Bình Minh Sông Lô: Tận Tâm – Chuyên Nghiệp – Minh Bạch | 2026-10-05 | van-hoa-binh-minh-song-lo | 4974 · 0ab770bc114e | SAME_AS_SEED | MATCH_EXCEPT_REDACTIONS | 2 / 2 | articles/van-hoa-doanh-nghiep-binh-minh-song-lo-tan-tam-chuyen-nghiep-minh-bach | EXACT | EXISTING_BUT_DRAFT | Văn bản khớp nguồn, trừ SĐT/email được thay bằng placeholder; bản ghi là bản nháp. |
| extra:639 | `/quy-dinh-tac-phong-van-hoa-phuc-vu-cua-can-bo-nhan-vien-tai-toa-nha/` | post #639 | Quy Định Tác Phong &#038; Văn Hóa Phục Vụ Của Cán Bộ Nhân Viên Tại Tòa Nhà | 2026-10-05 | van-hoa-binh-minh-song-lo | 5605 · f93ce0441f23 | SAME_AS_SEED | MATCH_EXCEPT_REDACTIONS | 0 / 0 | articles/quy-dinh-tac-phong-van-hoa-phuc-vu-cua-can-bo-nhan-vien-tai-toa-nha | EXACT | EXISTING_BUT_DRAFT | Văn bản khớp nguồn, trừ SĐT/email được thay bằng placeholder; bản ghi là bản nháp. |

## 3. Từng dự án: nguồn so với bản ghi seed

Mỗi trang dự án nguồn chỉ gồm 1 ảnh và tối đa 5 dòng "Nhãn : giá trị"; không có đoạn mô tả dài (cột "Đoạn văn ngoài dòng dữ kiện" bằng 0 cho cả 17 dự án). Vì vậy không có căn cứ để thêm trường `body` vào `Projects`: không cần schema hay migration.

### Chung cư Học viện Quốc phòng (`projects/hoc-vien-quoc-phong`)

Nguồn: legacy:5 (#181, 307 ký tự, 1 ảnh); legacy:21 (#250, 307 ký tự, 1 ảnh). Đoạn văn ngoài dòng dữ kiện: **0**. Ảnh bìa đúng nguồn: **có**.

| Trường | Nguồn | Seed | Kết quả |
| --- | --- | --- | --- |
| address | Tại ô đất có ký hiệu O17-HH2 Khu đô thị mới Tây Hồ Tây, Phường Xuân La, Quận Tây Hồ, TP Hà Nội | Tại ô đất có ký hiệu O17-HH2 Khu đô thị mới Tây Hồ Tây, Phường Xuân La, Quận Tây Hồ, TP Hà Nội | MATCH |
| scale | 02 tòa tháp, 30 tầng nổi, 02 tầng hầm, 610 căn hộ, 3 tầng thương mại | 02 tòa tháp, 30 tầng nổi, 02 tầng hầm, 610 căn hộ, 3 tầng thương mại | MATCH |
| investor | Ban Quản trị chung cư Học viện Quốc phòng | Ban Quản trị chung cư Học viện Quốc phòng | MATCH |
| since | T09/2020 | T09/2020 | MATCH |
| services | Quản lý vận hành toà nhà | quan-ly-van-hanh | WORDING_NORMALIZED |
| status | đang vận hành | đang vận hành | MATCH |

| Ảnh nguồn | Vai trò | Trạng thái | Chi tiết |
| --- | --- | --- | --- |
| `https://binhminhsonglo.vn/wp-content/uploads/2024/12/z6128643237572_64e95f74bee60a3acd5a611787b4467e.jpg` | cover+body | COMMITTED_IN_RECORD | đã commit |
| `https://binhminhsonglo.vn/wp-content/uploads/2024/12/z6128643237572_64e95f74bee60a3acd5a611787b4467e.jpg` | cover+body | COMMITTED_IN_RECORD | đã commit |

* **SCHEMA_MISMATCH** — Dòng "Dịch vụ cung cấp" gốc được chuẩn hoá thành khu vực dịch vụ; câu chữ gốc không được giữ (mô hình hiện tại là quan hệ, không có trường văn bản).

### Ecolife Tây Hồ (`projects/ecolife-tay-ho`)

Nguồn: legacy:6 (#183, 261 ký tự, 1 ảnh). Đoạn văn ngoài dòng dữ kiện: **0**. Ảnh bìa đúng nguồn: **có**.

| Trường | Nguồn | Seed | Kết quả |
| --- | --- | --- | --- |
| address | Tòa nhà Ecolife, phường Xuân La, quận Tây Hồ, Hà Nội | Tòa nhà Ecolife, phường Xuân La, quận Tây Hồ, Hà Nội | MATCH |
| scale | 03 tòa, cao 28-32 tầng nổi, 02 tầng hầm, 630 căn hộ, 02 tầng thương mại | 03 tòa, cao 28-32 tầng nổi, 02 tầng hầm, 630 căn hộ, 02 tầng thương mại | MATCH |
| investor | Ban Quản trị tòa nhà Ecolife Tây Hồ | Ban Quản trị tòa nhà Ecolife Tây Hồ | MATCH |
| since | T6/2024 | T6/2024 | MATCH |
| services | Quản lý vận hành tòa nhà | quan-ly-van-hanh | WORDING_NORMALIZED |
| status | đang vận hành | đang vận hành | MATCH |

| Ảnh nguồn | Vai trò | Trạng thái | Chi tiết |
| --- | --- | --- | --- |
| `https://binhminhsonglo.vn/wp-content/uploads/2024/12/z6128654384679_07dff50005ef35b3aef4226b52bcf854.jpg` | cover+body | COMMITTED_IN_RECORD | đã commit |

* **SCHEMA_MISMATCH** — Dòng "Dịch vụ cung cấp" gốc được chuẩn hoá thành khu vực dịch vụ; câu chữ gốc không được giữ (mô hình hiện tại là quan hệ, không có trường văn bản).

### Cụm CT1-CT2-CT3 Newtatco Lai Xá (`projects/newtatco-lai-xa`)

Nguồn: legacy:7 (#186, 229 ký tự, 1 ảnh). Đoạn văn ngoài dòng dữ kiện: **0**. Ảnh bìa đúng nguồn: **có**.

| Trường | Nguồn | Seed | Kết quả |
| --- | --- | --- | --- |
| address | Cụm nhà chung cư CT1-CT2-CT3 Newtatco Lai Xá, H. Hoài Đức, Hà Nội | Cụm nhà chung cư CT1-CT2-CT3 Newtatco Lai Xá, H. Hoài Đức, Hà Nội | MATCH |
| scale | 03 tòa, 261 căn hộ | 03 tòa, 261 căn hộ | MATCH |
| investor | Ban Quản trị Cụm nhà chung cư CT1-CT2 Newtatco | Ban Quản trị Cụm nhà chung cư CT1-CT2 Newtatco | MATCH |
| since | 2022 | 2022 | MATCH |
| services | Quản lý vận hành toà nhà | quan-ly-van-hanh | WORDING_NORMALIZED |
| status | đang vận hành | đang vận hành | MATCH |

| Ảnh nguồn | Vai trò | Trạng thái | Chi tiết |
| --- | --- | --- | --- |
| `https://binhminhsonglo.vn/wp-content/uploads/2024/12/z6128660791194_b3b8dc22ef5a05ba11e6941cf7e75e47.jpg` | cover+body | COMMITTED_IN_RECORD | đã commit |

* **SCHEMA_MISMATCH** — Dòng "Dịch vụ cung cấp" gốc được chuẩn hoá thành khu vực dịch vụ; câu chữ gốc không được giữ (mô hình hiện tại là quan hệ, không có trường văn bản).

### 4 chung cư Phenikaa (`projects/phenikaa`)

Nguồn: legacy:8 (#189, 243 ký tự, 1 ảnh). Đoạn văn ngoài dòng dữ kiện: **0**. Ảnh bìa đúng nguồn: **có**.

| Trường | Nguồn | Seed | Kết quả |
| --- | --- | --- | --- |
| address | Chung cư Phenikaa 21T1, Thôn 1, xã Thạch Hòa, huyện Thạch Thất, TP Hà Nội | Chung cư Phenikaa 21T1, Thôn 1, xã Thạch Hòa, huyện Thạch Thất, TP Hà Nội | MATCH |
| scale | 21 tầng nổi, 01 tầng hầm, 440 căn hộ | 21 tầng nổi, 01 tầng hầm, 440 căn hộ | MATCH |
| investor | Ban Quản trị nhà chung cư Phenikaa | Ban Quản trị nhà chung cư Phenikaa | MATCH |
| since | 2023 | 2023 | MATCH |
| services | Quản lý vận hành toà nhà | quan-ly-van-hanh | WORDING_NORMALIZED |
| status | đang vận hành | đang vận hành | MATCH |

| Ảnh nguồn | Vai trò | Trạng thái | Chi tiết |
| --- | --- | --- | --- |
| `https://binhminhsonglo.vn/wp-content/uploads/2024/12/z6128675616134_66ce2e5cf370c0e29339415e0293bfaa-1.jpg` | cover | COMMITTED_IN_RECORD | đã commit |
| `https://binhminhsonglo.vn/wp-content/uploads/2024/12/z6128675616134_66ce2e5cf370c0e29339415e0293bfaa.jpg` | body | COMMITTED_IN_RECORD | đã commit |

* **SCHEMA_MISMATCH** — Dòng "Dịch vụ cung cấp" gốc được chuẩn hoá thành khu vực dịch vụ; câu chữ gốc không được giữ (mô hình hiện tại là quan hệ, không có trường văn bản).

### Chung cư JSC34 (`projects/jsc34`)

Nguồn: legacy:9 (#193, 273 ký tự, 1 ảnh). Đoạn văn ngoài dòng dữ kiện: **0**. Ảnh bìa đúng nguồn: **có**.

| Trường | Nguồn | Seed | Kết quả |
| --- | --- | --- | --- |
| address | Tòa nhà JSC34, Số 164 Khuất Duy Tiến, phường Nhân Chính, quận Thanh Xuân, TP Hà Nội | Tòa nhà JSC34, Số 164 Khuất Duy Tiến, phường Nhân Chính, quận Thanh Xuân, TP Hà Nội | MATCH |
| scale | Gồm 19 tầng nổi, 01 tầng hầm với 174 căn hộ và 40 văn phòng | Gồm 19 tầng nổi, 01 tầng hầm với 174 căn hộ và 40 văn phòng | MATCH |
| investor | Ban Quản trị Chung cư JSC34 | Ban Quản trị Chung cư JSC34 | MATCH |
| since | T5/2022 | T5/2022 | MATCH |
| services | Quản lý vận hành toà nhà | quan-ly-van-hanh | WORDING_NORMALIZED |
| status | đang vận hành | đang vận hành | MATCH |

| Ảnh nguồn | Vai trò | Trạng thái | Chi tiết |
| --- | --- | --- | --- |
| `https://binhminhsonglo.vn/wp-content/uploads/2024/12/z6129579785883_428e187c74e31e999c0b861d3b1e8e89.jpg` | cover+body | COMMITTED_IN_RECORD | đã commit |

* **SCHEMA_MISMATCH** — Dòng "Dịch vụ cung cấp" gốc được chuẩn hoá thành khu vực dịch vụ; câu chữ gốc không được giữ (mô hình hiện tại là quan hệ, không có trường văn bản).

### Cụm A6 Nam Trung Yên (`projects/a6-nam-trung-yen`)

Nguồn: legacy:10 (#196, 0 ký tự, 1 ảnh). Đoạn văn ngoài dòng dữ kiện: **0**. Ảnh bìa đúng nguồn: **có**.

| Trường | Nguồn | Seed | Kết quả |
| --- | --- | --- | --- |
| address | — | — | SOURCE_ABSENT |
| scale | — | — | SOURCE_ABSENT |
| investor | — | — | SOURCE_ABSENT |
| since | — | — | SOURCE_ABSENT |
| services | — | — | SOURCE_ABSENT |
| status | đang vận hành | đang vận hành | MATCH |

| Ảnh nguồn | Vai trò | Trạng thái | Chi tiết |
| --- | --- | --- | --- |
| `https://binhminhsonglo.vn/wp-content/uploads/2024/12/z6129587734199_d514ee59f6c6778429c2d283435726df-1.jpg` | cover | COMMITTED_IN_RECORD | đã commit |
| `https://binhminhsonglo.vn/wp-content/uploads/2024/12/z6129587734199_d514ee59f6c6778429c2d283435726df.jpg` | body | COMMITTED_IN_RECORD | đã commit |

* **SOURCE_ABSENT** — Trang nguồn không có địa điểm/quy mô/chủ đầu tư/năm/dịch vụ: chỉ có ảnh. Không suy diễn.

### Cụm B6 Nam Trung Yên (`projects/b6-nam-trung-yen`)

Nguồn: legacy:11 (#200, 227 ký tự, 1 ảnh). Đoạn văn ngoài dòng dữ kiện: **0**. Ảnh bìa đúng nguồn: **có**.

| Trường | Nguồn | Seed | Kết quả |
| --- | --- | --- | --- |
| address | Cụm chung cư B6 Khu đô thị Nam Trung Yên, Quận Cầu Giấy, Hà Nội | Cụm chung cư B6 Khu đô thị Nam Trung Yên, Quận Cầu Giấy, Hà Nội | MATCH |
| scale | 426 căn hộ | 426 căn hộ | MATCH |
| investor | Ban Quản trị nhà B6A, B6B, B6C | Ban Quản trị nhà B6A, B6B, B6C | MATCH |
| since | 2020 (đã gia hạn thêm lần 3) | 2020 (đã gia hạn thêm lần 3) | MATCH |
| services | Quản lý vận hành toà nhà | quan-ly-van-hanh | WORDING_NORMALIZED |
| status | đang vận hành | đang vận hành | MATCH |

| Ảnh nguồn | Vai trò | Trạng thái | Chi tiết |
| --- | --- | --- | --- |
| `https://binhminhsonglo.vn/wp-content/uploads/2024/12/z6129596536847_6dfb4a26645c9f1cba8f17493e082f1d.jpg` | cover+body | COMMITTED_IN_RECORD | đã commit |

* **SCHEMA_MISMATCH** — Dòng "Dịch vụ cung cấp" gốc được chuẩn hoá thành khu vực dịch vụ; câu chữ gốc không được giữ (mô hình hiện tại là quan hệ, không có trường văn bản).

### Chung cư Bộ Khoa học Công nghệ (`projects/bo-khoa-hoc-cong-nghe`)

Nguồn: legacy:12 (#203, 227 ký tự, 1 ảnh). Đoạn văn ngoài dòng dữ kiện: **0**. Ảnh bìa đúng nguồn: **có**.

| Trường | Nguồn | Seed | Kết quả |
| --- | --- | --- | --- |
| address | Tổ 22, phường Quan Hoa, quận Cầu Giấy, Hà Nội | Tổ 22, phường Quan Hoa, quận Cầu Giấy, Hà Nội | MATCH |
| scale | 90 căn hộ | 90 căn hộ | MATCH |
| investor | Ban Quản trị nhà chung cư Bộ Khoa Học Công Nghệ | Ban Quản trị nhà chung cư Bộ Khoa Học Công Nghệ | MATCH |
| since | T03/2023 | T03/2023 | MATCH |
| services | Cung cấp dịch vụ bảo vệ và vệ sinh cho tòa nhà | bao-ve, ve-sinh | WORDING_NORMALIZED |
| status | đang vận hành | đang vận hành | MATCH |

| Ảnh nguồn | Vai trò | Trạng thái | Chi tiết |
| --- | --- | --- | --- |
| `https://binhminhsonglo.vn/wp-content/uploads/2024/12/z6129601290901_ba4422178b4a7b71462041647cb6e11e.jpg` | cover+body | COMMITTED_IN_RECORD | đã commit |

* **SCHEMA_MISMATCH** — Dòng "Dịch vụ cung cấp" gốc được chuẩn hoá thành khu vực dịch vụ; câu chữ gốc không được giữ (mô hình hiện tại là quan hệ, không có trường văn bản).

### Chung cư B10 Nam Trung Yên (`projects/b10-nam-trung-yen`)

Nguồn: legacy:13 (#206, 211 ký tự, 1 ảnh). Đoạn văn ngoài dòng dữ kiện: **0**. Ảnh bìa đúng nguồn: **có**.

| Trường | Nguồn | Seed | Kết quả |
| --- | --- | --- | --- |
| address | Chung cư B10 Khu đô thị Nam Trung Yên, Cầu Giấy, Hà Nội | Chung cư B10 Khu đô thị Nam Trung Yên, Cầu Giấy, Hà Nội | MATCH |
| scale | 210 căn hộ | 210 căn hộ | MATCH |
| investor | Ban Quản trị nhà chung cư B10 Nam Trung Yên | Ban Quản trị nhà chung cư B10 Nam Trung Yên | MATCH |
| since | T1/2024 | T1/2024 | MATCH |
| services | Quản lý vận hành toà nhà | quan-ly-van-hanh | WORDING_NORMALIZED |
| status | — | — | SOURCE_ABSENT |

| Ảnh nguồn | Vai trò | Trạng thái | Chi tiết |
| --- | --- | --- | --- |
| `https://binhminhsonglo.vn/wp-content/uploads/2024/12/z6129606596313_d88b8896e5ae6a5a3036c9fb6656abe0-1.jpg` | cover | COMMITTED_IN_RECORD | đã commit |
| `https://binhminhsonglo.vn/wp-content/uploads/2024/12/z6129606596313_d88b8896e5ae6a5a3036c9fb6656abe0.jpg` | body | COMMITTED_IN_RECORD | đã commit |

* **SCHEMA_MISMATCH** — Dòng "Dịch vụ cung cấp" gốc được chuẩn hoá thành khu vực dịch vụ; câu chữ gốc không được giữ (mô hình hiện tại là quan hệ, không có trường văn bản).

### Toà B11A Nam Trung Yên (`projects/b11a-nam-trung-yen`)

Nguồn: legacy:14 (#210, 187 ký tự, 1 ảnh). Đoạn văn ngoài dòng dữ kiện: **0**. Ảnh bìa đúng nguồn: **có**.

| Trường | Nguồn | Seed | Kết quả |
| --- | --- | --- | --- |
| address | Tòa nhà B11A Khu đô thị Nam Trung Yên, Quận Cầu Giấy | Tòa nhà B11A Khu đô thị Nam Trung Yên, Quận Cầu Giấy | MATCH |
| scale | 120 căn hộ | 120 căn hộ | MATCH |
| investor | Ban Quản trị nhà B11A | Ban Quản trị nhà B11A | MATCH |
| since | T11/2023 | T11/2023 | MATCH |
| services | Quản lý vận hành toà nhà | quan-ly-van-hanh | WORDING_NORMALIZED |
| status | đang vận hành | đang vận hành | MATCH |

| Ảnh nguồn | Vai trò | Trạng thái | Chi tiết |
| --- | --- | --- | --- |
| `https://binhminhsonglo.vn/wp-content/uploads/2024/12/z6129611073015_a96c8daa00082677e9d05afd41fb60be-1.jpg` | cover | COMMITTED_IN_RECORD | đã commit |
| `https://binhminhsonglo.vn/wp-content/uploads/2024/12/z6129611073015_a96c8daa00082677e9d05afd41fb60be.jpg` | body | COMMITTED_IN_RECORD | đã commit |

* **SCHEMA_MISMATCH** — Dòng "Dịch vụ cung cấp" gốc được chuẩn hoá thành khu vực dịch vụ; câu chữ gốc không được giữ (mô hình hiện tại là quan hệ, không có trường văn bản).

### Chung cư Nơ 1B KĐT Linh Đàm (`projects/no-1b-linh-dam`)

Nguồn: legacy:15 (#214, 197 ký tự, 1 ảnh). Đoạn văn ngoài dòng dữ kiện: **0**. Ảnh bìa đúng nguồn: **có**.

| Trường | Nguồn | Seed | Kết quả |
| --- | --- | --- | --- |
| address | KĐT Linh Đàm, p. Đạm Phương, Hoàng Liệt, Hoàng Mai, Hà Nội | KĐT Linh Đàm, p. Đạm Phương, Hoàng Liệt, Hoàng Mai, Hà Nội | MATCH |
| scale | 92 căn hộ | 92 căn hộ | MATCH |
| investor | Ban Quản trị chung cư 1B | Ban Quản trị chung cư 1B | MATCH |
| since | T4/2024 | T4/2024 | MATCH |
| services | Quản lý vận hành tòa nhà | quan-ly-van-hanh | WORDING_NORMALIZED |
| status | đang vận hành | đang vận hành | MATCH |

| Ảnh nguồn | Vai trò | Trạng thái | Chi tiết |
| --- | --- | --- | --- |
| `https://binhminhsonglo.vn/wp-content/uploads/2024/12/z6129616677476_f40b74663dfffdd9e0d2f0e46afd31cb-1.jpg` | cover | COMMITTED_IN_RECORD | đã commit |
| `https://binhminhsonglo.vn/wp-content/uploads/2024/12/z6129616677476_f40b74663dfffdd9e0d2f0e46afd31cb.jpg` | body | COMMITTED_IN_RECORD | đã commit |

* **SCHEMA_MISMATCH** — Dòng "Dịch vụ cung cấp" gốc được chuẩn hoá thành khu vực dịch vụ; câu chữ gốc không được giữ (mô hình hiện tại là quan hệ, không có trường văn bản).

### Chung cư Nơ 1A KĐT Linh Đàm (`projects/no-1a-linh-dam`)

Nguồn: legacy:16 (#218, 196 ký tự, 1 ảnh). Đoạn văn ngoài dòng dữ kiện: **0**. Ảnh bìa đúng nguồn: **có**.

| Trường | Nguồn | Seed | Kết quả |
| --- | --- | --- | --- |
| address | Linh Đàm, phường Đạm Phương, Hoàng Liệt, Hoàng Mai, Hà Nội | Linh Đàm, phường Đạm Phương, Hoàng Liệt, Hoàng Mai, Hà Nội | MATCH |
| scale | 90 căn hộ | 90 căn hộ | MATCH |
| investor | Ban Quản trị chung cư 1A | Ban Quản trị chung cư 1A | MATCH |
| since | T6/2024 | T6/2024 | MATCH |
| services | Quản lý vận hành tòa 1A | quan-ly-van-hanh | WORDING_NORMALIZED |
| status | đang vận hành | đang vận hành | MATCH |

| Ảnh nguồn | Vai trò | Trạng thái | Chi tiết |
| --- | --- | --- | --- |
| `https://binhminhsonglo.vn/wp-content/uploads/2024/12/z6129620777756_be3f6f335f8f27cfe13d37557d44960b.jpg` | cover+body | COMMITTED_IN_RECORD | đã commit |

* **SCHEMA_MISMATCH** — Dòng "Dịch vụ cung cấp" gốc được chuẩn hoá thành khu vực dịch vụ; câu chữ gốc không được giữ (mô hình hiện tại là quan hệ, không có trường văn bản).

### Toà B3 Làng Quốc tế Thăng Long (`projects/b3-lang-quoc-te-thang-long`)

Nguồn: legacy:17 (#221, 207 ký tự, 1 ảnh). Đoạn văn ngoài dòng dữ kiện: **0**. Ảnh bìa đúng nguồn: **có**.

| Trường | Nguồn | Seed | Kết quả |
| --- | --- | --- | --- |
| address | KĐT Làng quốc tế Thăng Long, phường Dịch Vọng, Quận Cầu Giấy, Hà Nội | KĐT Làng quốc tế Thăng Long, phường Dịch Vọng, Quận Cầu Giấy, Hà Nội | MATCH |
| scale | 84 căn hộ | 84 căn hộ | MATCH |
| investor | Ban Quản trị chung cư B3 | Ban Quản trị chung cư B3 | MATCH |
| since | 1/1/2023 | 1/1/2023 | MATCH |
| services | Quản lý vận hành tòa B3 | quan-ly-van-hanh | WORDING_NORMALIZED |
| status | — | — | SOURCE_ABSENT |

| Ảnh nguồn | Vai trò | Trạng thái | Chi tiết |
| --- | --- | --- | --- |
| `https://binhminhsonglo.vn/wp-content/uploads/2024/12/z6129626480939_64d1d78aee1564984f79b13bc7d1c4cf.jpg` | cover+body | COMMITTED_IN_RECORD | đã commit |

* **SCHEMA_MISMATCH** — Dòng "Dịch vụ cung cấp" gốc được chuẩn hoá thành khu vực dịch vụ; câu chữ gốc không được giữ (mô hình hiện tại là quan hệ, không có trường văn bản).

### Toà B5 Làng Quốc tế Thăng Long (`projects/b5-lang-quoc-te-thang-long`)

Nguồn: legacy:18 (#224, 205 ký tự, 1 ảnh). Đoạn văn ngoài dòng dữ kiện: **0**. Ảnh bìa đúng nguồn: **có**.

| Trường | Nguồn | Seed | Kết quả |
| --- | --- | --- | --- |
| address | KĐT Làng quốc tế Thăng Long, phường Dịch Vọng, quận Cầu Giấy, Hà Nội | KĐT Làng quốc tế Thăng Long, phường Dịch Vọng, quận Cầu Giấy, Hà Nội | MATCH |
| scale | 57 căn hộ | 57 căn hộ | MATCH |
| investor | Ban quản trị chung cư B5 | Ban quản trị chung cư B5 | MATCH |
| since | 7/9/2022 | 7/9/2022 | MATCH |
| services | Quản lý vận hành tòa nhà | quan-ly-van-hanh | WORDING_NORMALIZED |
| status | — | — | SOURCE_ABSENT |

| Ảnh nguồn | Vai trò | Trạng thái | Chi tiết |
| --- | --- | --- | --- |
| `https://binhminhsonglo.vn/wp-content/uploads/2024/12/z6129637635889_31b4d603161d7a240bac7c8304b063e5-1.jpg` | cover | COMMITTED_IN_RECORD | đã commit |
| `https://binhminhsonglo.vn/wp-content/uploads/2024/12/z6129637635889_31b4d603161d7a240bac7c8304b063e5.jpg` | body | COMMITTED_IN_RECORD | đã commit |

* **SCHEMA_MISMATCH** — Dòng "Dịch vụ cung cấp" gốc được chuẩn hoá thành khu vực dịch vụ; câu chữ gốc không được giữ (mô hình hiện tại là quan hệ, không có trường văn bản).

### Chung cư CT1 A1-A2 Linh Đàm (`projects/ct1-a1a2-linh-dam`)

Nguồn: legacy:19 (#228, 242 ký tự, 1 ảnh). Đoạn văn ngoài dòng dữ kiện: **0**. Ảnh bìa đúng nguồn: **có**.

| Trường | Nguồn | Seed | Kết quả |
| --- | --- | --- | --- |
| address | Khu nhà ở khu nhà ở xã hội CT1 A1-A2 Tây Nam Linh Đàm – phường, Đại Kim, quận Hoàng Mai, Hà Nội | Khu nhà ở khu nhà ở xã hội CT1 A1-A2 Tây Nam Linh Đàm – phường, Đại Kim, quận Hoàng Mai, Hà Nội | MATCH |
| scale | 217 căn hộ | 217 căn hộ | MATCH |
| investor | Ban quản trị chung cư CT1 – A1&A2 | Ban quản trị chung cư CT1 – A1&A2 | MATCH |
| since | T5/2023 | T5/2023 | MATCH |
| services | Quản lý vận hành tòa nhà | quan-ly-van-hanh | WORDING_NORMALIZED |
| status | đang vận hành | đang vận hành | MATCH |

| Ảnh nguồn | Vai trò | Trạng thái | Chi tiết |
| --- | --- | --- | --- |
| `https://binhminhsonglo.vn/wp-content/uploads/2024/12/z6129641534619_ed8749a220b5469b1cbc1a0c61007761.jpg` | cover+body | COMMITTED_IN_RECORD | đã commit |

* **SCHEMA_MISMATCH** — Dòng "Dịch vụ cung cấp" gốc được chuẩn hoá thành khu vực dịch vụ; câu chữ gốc không được giữ (mô hình hiện tại là quan hệ, không có trường văn bản).

### Toà Himlam (`projects/himlam`)

Nguồn: legacy:20 (#231, 195 ký tự, 1 ảnh). Đoạn văn ngoài dòng dữ kiện: **0**. Ảnh bìa đúng nguồn: **có**.

| Trường | Nguồn | Seed | Kết quả |
| --- | --- | --- | --- |
| address | Tòa nhà Himlam phường Thạch Bàn 2, Quận Long Biên, Hà Nội | Tòa nhà Himlam phường Thạch Bàn 2, Quận Long Biên, Hà Nội | MATCH |
| scale | 126 căn hộ | 126 căn hộ | MATCH |
| investor | Ban Quản trị tòa nhà Himlam | Ban Quản trị tòa nhà Himlam | MATCH |
| since | 2020 | 2020 | MATCH |
| services | Quản lý vận hành tòa nhà | quan-ly-van-hanh | WORDING_NORMALIZED |
| status | đã vận hành | đã vận hành | MATCH |

| Ảnh nguồn | Vai trò | Trạng thái | Chi tiết |
| --- | --- | --- | --- |
| `https://binhminhsonglo.vn/wp-content/uploads/2024/12/z6129646810100_55e326719f409db4c09cc561324154a9.jpg` | cover+body | COMMITTED_IN_RECORD | đã commit |

* **SCHEMA_MISMATCH** — Dòng "Dịch vụ cung cấp" gốc được chuẩn hoá thành khu vực dịch vụ; câu chữ gốc không được giữ (mô hình hiện tại là quan hệ, không có trường văn bản).

### Toà B-IA20 Ciputra Hà Nội (`projects/b-ia20-ciputra`)

Nguồn: legacy:22 (#252, 235 ký tự, 1 ảnh). Đoạn văn ngoài dòng dữ kiện: **0**. Ảnh bìa đúng nguồn: **có**.

| Trường | Nguồn | Seed | Kết quả |
| --- | --- | --- | --- |
| address | Khu Đô thị Nam Thăng Long, phường Đông Ngạc, quận Bắc Từ Liêm, Hà Nội | Khu Đô thị Nam Thăng Long, phường Đông Ngạc, quận Bắc Từ Liêm, Hà Nội | MATCH |
| scale | 700 căn hộ | 700 căn hộ | MATCH |
| investor | Công ty Cổ phần đầu tư Bất động sản Đông Đô – BQP | Công ty Cổ phần đầu tư Bất động sản Đông Đô – BQP | MATCH |
| since | 1/1/2025 | 1/1/2025 | MATCH |
| services | Quản lý vận hành toà nhà | quan-ly-van-hanh | WORDING_NORMALIZED |
| status | đang vận hành | đang vận hành | MATCH |

| Ảnh nguồn | Vai trò | Trạng thái | Chi tiết |
| --- | --- | --- | --- |
| `https://binhminhsonglo.vn/wp-content/uploads/2025/06/chung-cu-phia-bac-ha-noi-5-1651505671024.jpg` | cover+body | PENDING_RIGHTS | THIRD_PARTY: Ảnh có watermark của một trang báo (DÂN TRÍ): tài sản bên thứ ba. |

* **PRIVACY/RIGHTS_PENDING** — Ảnh https://binhminhsonglo.vn/wp-content/uploads/2025/06/chung-cu-phia-bac-ha-noi-5-1651505671024.jpg: THIRD_PARTY: Ảnh có watermark của một trang báo (DÂN TRÍ): tài sản bên thứ ba.
* **SCHEMA_MISMATCH** — Dòng "Dịch vụ cung cấp" gốc được chuẩn hoá thành khu vực dịch vụ; câu chữ gốc không được giữ (mô hình hiện tại là quan hệ, không có trường văn bản).

## 4. Sổ ảnh

* 235 URL ảnh được các trang công khai dùng (thân bài + ảnh bìa) → 62 URL đã commit (56 tệp duy nhất; SHA-256 được băm lại từ tệp trong repo), 1 đã duyệt nhưng không bản ghi seed nào dùng (không commit), 166 chờ duyệt quyền, 6 ở website bên thứ ba (không tải), 0 không tải được, 0 chưa được giải thích.
* 67 tệp có trong thư viện media nhưng KHÔNG hiển thị ở trang công khai nào (`LIBRARY_ONLY`): chưa duyệt quyền nên không nằm trong Git.
* Sổ đầy đủ từng URL (trạng thái, lý do, SHA-256, nơi dùng) nằm ở `docs/migration/w80-image-ledger.csv`.

| Trạng thái · loại | URL |
| --- | --- |
| APPROVED_NOT_USED ·  | 1 |
| COMMITTED · GRAPHIC | 9 |
| COMMITTED · OBJECT | 31 |
| COMMITTED · PROJECT_PHOTO | 16 |
| COMMITTED_DUPLICATE_URL · PROJECT_PHOTO | 6 |
| EXTERNAL_HOST_NOT_FETCHED · THIRD_PARTY_HOST | 6 |
| PENDING_RIGHTS · DOCUMENT | 1 |
| PENDING_RIGHTS · PERSON | 164 |
| PENDING_RIGHTS · THIRD_PARTY | 1 |

