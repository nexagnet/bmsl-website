# BMSL Website — Agent Contract

## Product boundary

This repository is the standalone implementation of the BMSL corporate website.
It is not a Nexagnet tenant application and must not import platform runtime packages or share the Nexagnet database.

## Business invariants

- Website v1 must work without BMSL AI.
- Public IA has 8 areas: Trang chủ, Giới thiệu, Dịch vụ, Dự án, Quy trình & Minh bạch, Kiến thức & tin tức, Tuyển dụng, Liên hệ.
- Contracted service structure: quản lý vận hành, bảo vệ, vệ sinh, PCCC.
- CMS minimum roles: ADMIN and EDITOR.
- PostgreSQL is business truth for website content and ContactLead.
- ContactLead must be durably persisted before notification side effects.
- Legacy migration universe is 47 URLs from the W0 blueprint; no source URL may silently disappear.
- Unconfirmed BMSL contact, project status, legal claims, statistics, testimonials, pricing, recruitment facts and media rights must remain UNCONFIRMED/draft until owner/customer confirmation.
- Do not publish invented customer facts.
- Do not commit raw contracts, production credentials, PII exports or private customer artifacts.

## Engineering governance

- GitHub Issue = Task Contract.
- Claude implements; it does not invent consequential business rules.
- GitHub live state, exact HEAD SHA and CI are evidence.
- Protected/control-plane paths are R3: .github/**, deploy/**, infra/**, tools/autopilot/**, .claude/**, .mcp.json, AGENTS.md, CLAUDE.md.
- R2 work may be implemented/reviewed/repaired automatically but is never auto-merged.
- Production, DNS, customer production data/credentials and secrets remain human-gated.
- See docs/blueprint/ for the canonical sanitized W0 design.
