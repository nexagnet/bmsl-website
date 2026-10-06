# BMSL Website — Issue #64 UI Visual Refresh Evidence

This orphan branch hosts the retrievable Before and After visual evidence for **Pull Request #67** (linking **GitHub Issue #64**).

All screenshots were captured using automated Chromium (Playwright) against the public Next.js website across 4 standard viewports:
- **Desktop**: 1440 x 900
- **Tablet**: 768 x 1024
- **Mobile (standard)**: 390 x 844
- **Mobile (compact)**: 320 x 640

---

## 320px Mobile Screen Evidence & Proof of No Overflow

Verified with Playwright at viewport `320 x 640` (iPhone SE / compact mobile):
- `document.documentElement.scrollWidth <= document.documentElement.clientWidth` across all public pages (320px === 320px, 0 overflow).
- Header items (Wordmark, Menu disclosure, CTA button) fit on a single row without word wrapping, clipping, or overlapping.
- Mobile menu disclosure dropdown renders cleanly within 320px viewport without exceeding bounds.

### Detailed 320px Header Measurements:
- **Wordmark (`.wordmark`)**: left = 13.59px, right = 96.25px, width = 82.66px, height = 27.19px (single line, no break)
- **Menu Disclosure (`.mobile-menu summary`)**: left = 102.64px, right = 178.05px, width = 75.41px, height = 36.56px (single line, no break)
- **CTA Button (`.header-row .button`)**: left = 184.44px, right = 309.98px, width = 125.55px, height = 34.86px (single line, no break)
- **Gap Wordmark-to-Menu**: 6.39px (no overlap)
- **Gap Menu-to-Button**: 6.39px (no overlap)
- **Max Right Edge**: 309.98px <= 320px (10.02px padding margin, 0 horizontal overflow)
- **Dropdown Menu (`.mobile-menu[open] .nav-list`)**: left = 16px, right = 304px, width = 288px (centered overlay, 0 horizontal overflow)

| Element / Page | Viewport | Screenshot Link | scrollWidth / clientWidth | Result |
|---|---|---|---|---|
| **Header (Menu đóng)** | 320px | [View 320px Header Closed](screenshots/320px/header-320px-closed.png) | 320px / 320px | PASS (no wrap, no overlap) |
| **Header (Menu mở)** | 320px | [View 320px Header Open](screenshots/320px/header-320px-open.png) | 320px / 320px | PASS (dropdown width 288px) |
| **Liên hệ (`/lien-he`)** | 320px | [View 320px Contact](screenshots/320px/contact-320px.png) | 320px / 320px | PASS (unified rounded inputs) |
| **Trang chủ (`/`)** | 320px | [View 320px Home](screenshots/320px/home-320px.png) | 320px / 320px | PASS (no horizontal scroll) |
| **Dịch vụ (`/dich-vu`)** | 320px | [View 320px Services](screenshots/320px/services-320px.png) | 320px / 320px | PASS (no horizontal scroll) |
| **Dự án (`/du-an`)** | 320px | [View 320px Projects](screenshots/320px/projects-320px.png) | 320px / 320px | PASS (no horizontal scroll) |
| **Kiến thức (`/kien-thuc`)** | 320px | [View 320px Knowledge](screenshots/320px/knowledge-320px.png) | 320px / 320px | PASS (no horizontal scroll) |
| **Quy trình & Minh bạch (`/quy-trinh-minh-bach`)** | 320px | [View 320px Process](screenshots/320px/process-320px.png) | 320px / 320px | PASS (no horizontal scroll) |
| **Tuyển dụng (`/tuyen-dung`)** | 320px | [View 320px Careers](screenshots/320px/careers-320px.png) | 320px / 320px | PASS (no horizontal scroll) |

---

## Screenshot Comparison Matrix (Desktop 1440, Tablet 768, Mobile 390)

| Page / Route | Viewport | Before (Baseline) | After (Antigravity Refresh) | Content Status |
|---|---|---|---|---|
| **Trang chủ (`/`)** | Desktop (1440) | [View Before](screenshots/before/home-desktop.png) | [View After](screenshots/after/home-desktop.png) | Populated layout, clean hierarchy |
| **Trang chủ (`/`)** | Tablet (768) | [View Before](screenshots/before/home-tablet.png) | [View After](screenshots/after/home-tablet.png) | Responsive grid & survey banner |
| **Trang chủ (`/`)** | Mobile (390) | [View Before](screenshots/before/home-mobile.png) | [View After](screenshots/after/home-mobile.png) | Single column, touch-friendly CTA |
| **Dịch vụ (`/dich-vu`)** | Desktop (1440) | [View Before](screenshots/before/services-desktop.png) | [View After](screenshots/after/services-desktop.png) | Empty CMS state (synthetic dev) |
| **Dịch vụ (`/dich-vu`)** | Tablet (768) | [View Before](screenshots/before/services-tablet.png) | [View After](screenshots/after/services-tablet.png) | Empty CMS state (synthetic dev) |
| **Dịch vụ (`/dich-vu`)** | Mobile (390) | [View Before](screenshots/before/services-mobile.png) | [View After](screenshots/after/services-mobile.png) | Empty CMS state (synthetic dev) |
| **Dự án (`/du-an`)** | Desktop (1440) | [View Before](screenshots/before/projects-desktop.png) | [View After](screenshots/after/projects-desktop.png) | Empty CMS state (synthetic dev) |
| **Dự án (`/du-an`)** | Tablet (768) | [View Before](screenshots/before/projects-tablet.png) | [View After](screenshots/after/projects-tablet.png) | Empty CMS state (synthetic dev) |
| **Dự án (`/du-an`)** | Mobile (390) | [View Before](screenshots/before/projects-mobile.png) | [View After](screenshots/after/projects-mobile.png) | Empty CMS state (synthetic dev) |
| **Quy trình & Minh bạch (`/quy-trinh-minh-bach`)** | Desktop (1440) | [View Before](screenshots/before/process-desktop.png) | [View After](screenshots/after/process-desktop.png) | Empty CMS state (synthetic dev) |
| **Quy trình & Minh bạch (`/quy-trinh-minh-bach`)** | Tablet (768) | [View Before](screenshots/before/process-tablet.png) | [View After](screenshots/after/process-tablet.png) | Empty CMS state (synthetic dev) |
| **Quy trình & Minh bạch (`/quy-trinh-minh-bach`)** | Mobile (390) | [View Before](screenshots/before/process-mobile.png) | [View After](screenshots/after/process-mobile.png) | Empty CMS state (synthetic dev) |
| **Kiến thức (`/kien-thuc`)** | Desktop (1440) | [View Before](screenshots/before/knowledge-desktop.png) | [View After](screenshots/after/knowledge-desktop.png) | Empty CMS state (synthetic dev) |
| **Kiến thức (`/kien-thuc`)** | Tablet (768) | [View Before](screenshots/before/knowledge-tablet.png) | [View After](screenshots/after/knowledge-tablet.png) | Empty CMS state (synthetic dev) |
| **Kiến thức (`/kien-thuc`)** | Mobile (390) | [View Before](screenshots/before/knowledge-mobile.png) | [View After](screenshots/after/knowledge-mobile.png) | Empty CMS state (synthetic dev) |
| **Tuyển dụng (`/tuyen-dung`)** | Desktop (1440) | [View Before](screenshots/before/careers-desktop.png) | [View After](screenshots/after/careers-desktop.png) | Empty CMS state (synthetic dev) |
| **Tuyển dụng (`/tuyen-dung`)** | Tablet (768) | [View Before](screenshots/before/careers-tablet.png) | [View After](screenshots/after/careers-tablet.png) | Empty CMS state (synthetic dev) |
| **Tuyển dụng (`/tuyen-dung`)** | Mobile (390) | [View Before](screenshots/before/careers-mobile.png) | [View After](screenshots/after/careers-mobile.png) | Empty CMS state (synthetic dev) |
| **Liên hệ (`/lien-he`)** | Desktop (1440) | [View Before](screenshots/before/contact-desktop.png) | [View After](screenshots/after/contact-desktop.png) | ContactForm card container |
| **Liên hệ (`/lien-he`)** | Tablet (768) | [View Before](screenshots/before/contact-tablet.png) | [View After](screenshots/after/contact-tablet.png) | ContactForm card container |
| **Liên hệ (`/lien-he`)** | Mobile (390) | [View Before](screenshots/before/contact-mobile.png) | [View After](screenshots/after/contact-mobile.png) | Responsive input fields |
| **Menu Mobile mở** | Mobile (390) | [View Before](screenshots/before/nav-mobile.png) | [View After](screenshots/after/nav-mobile.png) | Floating dropdown card overlay |
