# Audit công bố tài liệu `assets/tai-lieu/` (2026-10-19)

Phạm vi: PR #115, #116 (đã merge vào `main` 87e6498). Báo cáo không chứa nội dung tài liệu.
Phân loại dưới đây dựa trên dấu hiệu tự động (nhãn "LƯU HÀNH NỘI BỘ", số liên hệ, số lượng ảnh nhúng), **chưa** có xác nhận quyền công bố của owner.

| Tệp | Dấu hiệu | Phân loại |
|---|---|---|
| 2. Bộ tiêu chuẩn quản lý vận hành | nhãn nội bộ | INTERNAL_ONLY |
| 3. Tiêu chuẩn chất lượng dịch vụ an ninh | nhãn nội bộ | INTERNAL_ONLY |
| 10. Tiêu chuẩn chất lượng dịch vụ vệ sinh | nhãn nội bộ | INTERNAL_ONLY |
| 11. Quy định chế độ công tác | nhãn nội bộ; số điện thoại; điều khoản lao động | SENSITIVE |
| 12. Bộ mô tả vị trí công việc khối văn phòng | nhãn nội bộ; lương/hợp đồng; số điện thoại | SENSITIVE |
| 14. Quy trình đào tạo | nhãn nội bộ; nhiều số điện thoại; từ khoá căn cước | SENSITIVE |
| 15. Bộ mô tả vị trí công việc Ban QLTN | nhãn nội bộ; lương/hợp đồng | SENSITIVE |
| Hồ sơ năng lực BMSL 28.3.2026 | tài liệu marketing nhưng có email, số điện thoại, 56 ảnh; chưa có xác nhận quyền | UNKNOWN |
| bai-bao-doisongphapluat.txt | chỉ chứa liên kết bài báo công khai | PUBLIC_APPROVED (chỉ link) |

Không có tệp nào được xác nhận `PUBLIC_APPROVED` về mặt quyền phân phối ngoài liên kết bài báo.

## Mức độ còn truy cập được
- Repo `nexagnet/bmsl-website` là **PUBLIC**; 8 tệp docx nằm trong history (commit 65a168f, f349240) và trên các branch remote `chore/add-tai-lieu-noi-bo`, `claude/upload-standards-web-repo-714638`. Có thể bị clone/fork/cache.
- Dockerfile cũ có `COPY assets/tai-lieu`: mọi image build từ 65a168f đến trước PR này chứa các tệp (trong registry/Northflank). Không có route Next.js phục vụ thư mục; `/assets/tai-lieu/` và `/tai-lieu/` trả 404 trên host DEV.
- Chưa kiểm chứng: image registry đang public hay private, ai đã pull/clone/fork.

## Đã làm trong PR (thuận nghịch)
- Bỏ `COPY assets/tai-lieu` khỏi Dockerfile; thêm `assets/tai-lieu` vào `.dockerignore`.
- Gỡ 8 tệp docx khỏi index (không xoá khỏi đĩa); `.gitignore` chặn docx/doc/pdf trong thư mục này.

## Cần owner quyết định (human gate)
1. Xác nhận từng tài liệu có được công bố hay không; chuyển các tệp INTERNAL_ONLY/SENSITIVE/UNKNOWN sang kho riêng.
2. Rewrite history (git filter-repo) + xoá branch remote + yêu cầu GitHub gỡ cache/fork, hoặc chuyển repo private. Không thực hiện nếu chưa được duyệt.
3. Xoá/thu hồi image cũ trong registry; rà soát quyền pull.
4. Nếu các số điện thoại/thông tin cá nhân là thật của cá nhân, xử lý theo quy trình sự cố.
5. Nơi lưu đề xuất: kho riêng tư (Google Drive/SharePoint của tổ chức với phân quyền, hoặc private repo / object storage private bucket có mã hoá và audit log). Website chỉ nhận bản đã duyệt qua Payload Media/Documents với `rightsStatus` đã xác nhận.

Không thể tuyên bố an toàn hoàn toàn: history, branch và image cũ vẫn chứa tài liệu.
