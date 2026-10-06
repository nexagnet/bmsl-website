# Logo BMSL — nguồn gốc và cách dùng (Issue #74)

Logo chính thức trên website mới là **logo đang dùng trên website cũ** `https://binhminhsonglo.vn/` (chủ sở hữu yêu cầu
dùng lại tài sản gốc). Không có logo nào được tạo mới hoặc sinh bằng AI.

## Vì sao đây là logo đúng

Trang chủ website cũ (WordPress 6.7.1, quan sát 2026-10-06) hiển thị logo ở khối `header-left` bằng đúng file này, và
khai báo favicon từ cùng tác phẩm:

| Vai trò trên website cũ | URL gốc | SHA-256 | Kích thước |
| --- | --- | --- | --- |
| Logo header (`<div class="logo"><img …>`) — **file được dùng làm nguồn** | `https://binhminhsonglo.vn/wp-content/uploads/2024/12/cropped-z6077272220597_ba8b22e6d84520ba7fa091a645810802.jpg` | `fa5394373d932c1868ab95470d14b4dc312b169905ab67335df9ec54f6e5bfd3` | 1076×1076 JPEG |
| Favicon 192 (`<link rel="icon" sizes="192x192">`) | `…/2024/12/cropped-cropped-z6077272220597_ba8b22e6d84520ba7fa091a645810802-192x192.jpg` | `8febbd5311ba47cd66ad0c7426a934838addb8865e743453775568c181f414c1` | 192×192 JPEG |
| Apple touch icon (`<link rel="apple-touch-icon">`) | `…/2024/12/cropped-cropped-z6077272220597_ba8b22e6d84520ba7fa091a645810802-180x180.jpg` | `73f6806d1174f8c16118c3ccbac5c083495863e7c2d54b4c4578949736924e2f` | 180×180 JPEG |

Ứng viên còn lại trong Issue, **không dùng làm nguồn**:

* `…/2024/12/logo-bmsl.jpg` (SHA-256 `4dc3ca526bfc7876fe1cb470ed2352c73030ebe538fccf80e312ac51b117bbce`, 1080×1080): cùng
  tác phẩm nhưng trên website cũ chỉ là ảnh đại diện (thumbnail) của bài "Giới thiệu tổng quan", không phải logo của
  header. Kiểm tra bằng mắt: hình và chữ giống file header. Vì vậy không có nhập nhằng về *nhận diện* logo; chỉ chọn file
  thực sự được site dùng làm nhận diện.
* `…/2025/07/Logo-Dong-Do.jpg`: logo đối tác, không dùng.

Logo gồm biểu tượng toà nhà + vòng cung xanh, chữ "BÌNH MINH - SÔNG LÔ" và khẩu hiệu "Hợp lực để phát triển".

## Tệp trong repository

| Tệp | Nội dung | SHA-256 | Kích thước |
| --- | --- | --- | --- |
| `src/assets/brand/bmsl-logo.jpg` | Logo header/footer | `320882307b7342f0f21f78acd4946c5632183729b026283650c655422141e5d7` | 640×508, 35 985 byte |
| `src/app/(frontend)/icon.jpg` | Favicon — **nguyên byte** file 192×192 của website cũ | `8febbd53…414c1` | 192×192 |
| `src/app/(frontend)/apple-icon.jpg` | Apple touch icon — **nguyên byte** file 180×180 của website cũ | `73f6806d…24e2f` | 180×180 |

`bmsl-logo.jpg` được tạo từ file header 1076×1076 chỉ bằng hai thao tác kỹ thuật, **không vẽ lại hay chỉnh sửa hình**:

1. **Cắt lề trắng** (mọi điểm ảnh có kênh nhỏ nhất ≥ 235 được coi là nền trắng), chừa 24 px quanh hình. Vùng cắt:
   `left=56 top=151 width=958 height=760` (nội dung nằm trong x 80–990, y 175–887). Tỷ lệ của hình không đổi.
2. **Thu nhỏ** về chiều rộng 640 px và lưu JPEG mozjpeg chất lượng 90 (sharp 0.35.5).

Lý do cắt lề: logo gốc là hình vuông có lề trắng lớn; nếu giữ nguyên, ở chiều cao header khoảng 50–60 px biểu tượng chỉ
còn khoảng 35 px. Nếu BMSL muốn bản không cắt, thay file này bằng bản thu nhỏ 1:1 mà không cần sửa mã (Next đọc kích thước
từ file; chỉ cần cập nhật hash trong `src/lib/brand-logo.test.ts`).

## Cách hiển thị

* Header và footer dùng `next/image` với import tĩnh từ `src/assets/brand/bmsl-logo.jpg` (Next đóng gói vào
  `/_next/static/media/…`, không phụ thuộc WordPress khi chạy).
* **Không đặt trong `public/`**: `Dockerfile` hiện chỉ `COPY` `src`, `scripts`, `next.config.mjs` và `tsconfig.json`, nên
  `public/` sẽ không có trong image production (logo sẽ 404). Import tĩnh và favicon theo quy ước `icon.*` của App Router
  đi cùng `src/`, không cần sửa Dockerfile. Đây là điểm khác với gợi ý `public/` trong Task Contract.
* `alt` = "BMSL — Bình Minh Sông Lô" (chữ có trong logo). Liên kết trang chủ có `aria-label` "BMSL — Bình Minh Sông Lô —
  Trang chủ". Không có wordmark chữ đặt cạnh logo (tránh lặp tên).
* Logo là JPEG nền trắng nên ở footer tối được đặt trên một tấm nền trắng bo góc.
* Favicon nằm trong `(frontend)`, nên chỉ áp dụng cho website công khai; trang `/admin` giữ biểu tượng của Payload.
* `src/types-images.d.ts` chỉ tham chiếu kiểu ảnh của Next để `pnpm typecheck` chạy được trên checkout sạch (CI chạy
  `typecheck` trước `build`, lúc `next-env.d.ts` — bị gitignore — chưa tồn tại).

## Quyền sử dụng

Đây là nhận diện của chính BMSL và chủ sở hữu đã yêu cầu dùng lại. Repository chỉ ghi nhận **lời yêu cầu đó**; tình trạng
bản quyền/đăng ký nhãn hiệu của logo **chưa được kiểm chứng độc lập** (`NOT_PROVEN`). Không dùng logo đối tác hay ảnh bên
thứ ba khác.

## Kiểm chứng

```bash
pnpm exec vitest run src/lib/brand-logo.test.ts   # hash/kích thước tệp, header/footer, 8 điều hướng
pnpm test:integration                             # http-smoke: logo + favicon được phục vụ, không có binhminhsonglo.vn
```

Ảnh chụp từ bản build production chạy với PostgreSQL cục bộ (dữ liệu tổng hợp) nằm ở `docs/brand/screenshots/`:
`header-{320,390,768,1024,1440}.png`, `menu-open-{320,390}.png`, `footer-{320,390,1440}.png`. Đo bằng Playwright: không tràn
ngang ở 320/390/768/1024/1440, ảnh logo tải được (640×508), vùng chạm liên kết logo ≥ 44 px ở ≤768 px, thứ tự Tab: "Bỏ qua điều
hướng" → logo. Ở 1024 px thanh điều hướng xuống hai dòng vì 8 mục + CTA không vừa một hàng; logo mới hẹp hơn wordmark cũ nên
không làm tình trạng này xấu đi (chưa chụp đối chứng "trước": `NOT_PROVEN`).
