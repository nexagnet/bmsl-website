# ADR 0001 — Next.js + Payload + PostgreSQL foundation

Status: accepted (W1A bootstrap)

## Context

`docs/blueprint/06-technical-blueprint.md` proposes a single Next.js App Router + TypeScript application
with an embedded CMS on PostgreSQL, and requires the CMS choice to be re-verified at W1
(roles, commercial license, maintenance, Postgres support). `docs/blueprint/07-open-questions.md`
holds the open business questions; none are decided here.

## Decision

- Next.js **16.3.8** (Active LTS) with App Router and TypeScript.
- Payload **3.90.2** (`payload`, `@payloadcms/next`, `@payloadcms/richtext-lexical`) embedded in the Next app.
- `@payloadcms/db-postgres` (Drizzle / node-postgres), configured from `DATABASE_URL`.
- pnpm 10.34.4 with a committed `pnpm-lock.yaml`.

## Evidence (coordinator source pack, 2026-10-05)

- Next.js 16.3.8 Active LTS and security release: https://nextjs.org/blog
- Payload 3.90.2 current stable: https://github.com/payloadcms/payload/releases
- Payload is MIT, open source and self-hostable: https://payloadcms.com/get-started
- Payload installation supports Next.js 16.2.6+ and Postgres: https://payloadcms.com/docs/getting-started/installation
- Official Postgres adapter: https://payloadcms.com/docs/database/postgres

Installation check: these versions resolve together on pnpm 10.34.4 without peer conflicts.

## Consequences

- One codebase and one deploy for site and CMS; PostgreSQL stays the business truth.
- The site does not depend on BMSL AI or on nexagnet-platform.
- Only a `users` auth collection exists. ADMIN/EDITOR roles, ContactLead and content entities are out of scope
  and need their own task contracts.
