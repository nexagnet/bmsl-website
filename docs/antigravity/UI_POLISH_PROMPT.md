# Antigravity handoff — BMSL visual refresh (copy into Antigravity)

Repo: https://github.com/nexagnet/bmsl-website
Canonical implementation Issue: https://github.com/nexagnet/bmsl-website/issues/64
Workspace Skill: .agents/skills/bmsl-ui-polish/SKILL.md

## COPY/PASTE PROMPT

Bạn là Google Antigravity, chuyên gia UI/UX và Frontend có mắt thẩm mỹ tốt. Hãy nâng cấp **chỉ giao diện public** của website BMSL thành trải nghiệm B2B quản lý vận hành bất động sản hiện đại, sang trọng, đáng tin cậy, mạch lạc, dễ dùng trên desktop và mobile. Tôi mong đợi khác biệt thị giác đáng kể nhưng tuyệt đối không thay đổi logic.

1. Clone/mở repo nexagnet/bmsl-website. Fetch live main; đọc toàn bộ Issue #64, AGENTS.md, CLAUDE.md, docs/blueprint/05-ia-wireframes.md, rồi đọc và kích hoạt workspace skill /bmsl-ui-polish từ .agents/skills/bmsl-ui-polish/SKILL.md. Tạo branch ui/issue-64-antigravity-polish từ main mới nhất; KHÔNG sửa trực tiếp main.
2. Trước khi code, chụp ảnh/khảo sát giao diện các trang public hiện có trên desktop và mobile bằng browser nếu môi trường hỗ trợ. Nhận diện các vấn đề về visual hierarchy, hero, khoảng trắng, typography, layout, card, CTA, nav, footer, form và responsive.
3. Thiết kế một visual system thống nhất: premium corporate, neutral palette có accent vừa phải, hệ token CSS tập trung, heading có chất lượng editorial, grid/cards rõ nhịp, khối CTA nổi bật, navigation gọn; hiệu ứng tinh tế, không lòe loẹt. Thương hiệu BMSL chính thức chưa được cấp: KHÔNG bịa logo, màu thương hiệu chính thức, ảnh dự án, số liệu, thành tích, chứng nhận, khách hàng hay lời cam kết. Chỉ dùng ảnh CMS đã APPROVED; khi thiếu ảnh cần empty state đẹp chứ không tạo ảnh giả.
4. Chỉ được sửa CSS và JSX có tính trình bày trong allowlist của Issue #64 và skill. GIỮ NGUYÊN mọi API, xử lý dữ liệu, fetch CMS, slug/URL, 8 mục menu, CTA, submit form và consent, anti-spam, trạng thái lead, analytics, RBAC, media rights, SEO/metadata, sitemap, redirects, điều kiện published/draft. Không thêm package, script/font/ảnh từ bên ngoài, không sửa .github, workflow, deploy, config, DB, package.json hay lockfile. Không sửa Payload admin.
5. Ưu tiên: Trang chủ hero + 4 dịch vụ + dự án + bài viết + CTA; header và mobile menu; thẻ Dịch vụ/Dự án/Bài viết/Tuyển dụng; chi tiết nội dung/breadcrumb; trang Liên hệ/form; footer và trạng thái khi CMS chưa có nội dung. Trên ContactForm chỉ thay class/layout, tuyệt đối không sửa event handler, validation, field name/required/maxlength, submit state, honeypot và role=status.
6. Đảm bảo mobile 320/390, tablet 768, desktop 1024/1440; font tiếng Việt đẹp/dễ đọc, WCAG AA contrast, focus visible, tab/Enter/Space, skip link, prefers-reduced-motion, không horizontal overflow/CLS. Chú ý 8 mục IA và menu details/summary đang được kiểm bằng browser tests.
7. Chạy pnpm lint, pnpm typecheck, pnpm test, pnpm build và pnpm test:integration khi đủ môi trường; không sửa test/giảm ngưỡng để được xanh. Chụp ảnh before/after desktop + mobile cho các trang quan trọng. Nếu chưa chạy được browser/PostgreSQL, ghi rõ NOT_PROVEN.
8. Tự kiểm git diff file-by-file: mọi sửa đổi TSX chỉ nằm ở wrapper/className/presentation; không đổi biểu thức data/logic, business copy, props/handlers, API, href, form attributes. Commit, push branch và mở 1 PR về main với 'Closes #64', ghi BASE_SHA, HEAD_SHA, changed files, before/after screenshots, test evidence và giới hạn còn lại.
9. KHÔNG tự merge, KHÔNG deploy production. Khi PR xong, bàn giao URL PR cho ChatGPT coordinator. ChatGPT sẽ review độc lập diff, đúng HEAD CI, Reviewer, rồi merge R1 nếu đạt; nếu chưa đạt, Antigravity sửa trên CHÍNH PR đó.

Mục tiêu cuối: người xem cảm nhận đây là website doanh nghiệp chuyên nghiệp, cao cấp; toàn bộ nghiệp vụ và hành vi web vẫn giữ nguyên.

## End prompt
