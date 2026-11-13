# BMSL Website

Standalone website implementation for **Công ty Cổ phần Quản lý Dịch vụ Bất động sản Bình Minh Sông Lô (BMSL)**.

## Repository boundary

- This repository contains the BMSL Website implementation.
- It is independent from `nexagnet/nexagnet-platform` runtime and databases.
- The website must operate without BMSL AI.
- Do not commit customer-private contracts, credentials, PII exports, or unapproved customer artifacts.

## Canonical coordination source

Architecture and migration blueprint were established in `nexagnet/nexagnet-platform` Issue #424 / PR #425.
Control-plane provisioning is coordinated by `nexagnet/nexagnet-platform` Issue #441.

Application work starts only after the repository control-plane pilot is proven.

## Người/AI mới vào dự án

Đọc [`docs/handover/00-tong-quan-du-an.md`](docs/handover/00-tong-quan-du-an.md) trước, sau đó [`docs/handover/01-trang-thai-va-ton-dong.md`](docs/handover/01-trang-thai-va-ton-dong.md).
