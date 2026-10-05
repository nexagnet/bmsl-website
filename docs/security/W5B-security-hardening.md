# W5B security hardening — implemented slice, evidence and open items

Status: PARTIAL. This document records what the W5B change set implements, how to configure it, and what is
explicitly not yet proven. It does not claim customer sign-off, live abuse protection or browser/device coverage.

## Implemented

| Area | Where | Test |
| --- | --- | --- |
| Security headers on every route (`nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `X-Frame-Options: DENY`, CSP with `frame-ancestors 'none'`, `Permissions-Policy`) | `src/lib/security-headers.mjs`, `next.config.mjs` | `src/lib/security-headers.test.ts`; real-server assertions in `tests/integration/http-smoke.test.ts` |
| HSTS only when `HSTS_ENABLED=true` (operator has verified HTTPS on the real domain; no `includeSubDomains`/`preload`) | same | same |
| GA4 origins in CSP only when `CSP_ALLOW_GA4=true`; no wildcard / broad `https:` source | same | same |
| `/admin` and `/api` stay `X-Robots-Tag: noindex, nofollow` | `next.config.mjs` | http-smoke |
| Contact endpoint: streaming byte cap (16 KiB, aborts mid-stream), `application/json` required, same-site check (`Sec-Fetch-Site` / `Origin` vs `Host`/`SITE_URL`; forwarded headers are never trusted), malformed/non-object JSON -> 400, backend init failure -> safe 503, persistence failure -> safe 500 | `src/lib/request-guard.ts`, `src/lib/contact-endpoint.ts` | `request-guard.test.ts`, `contact-endpoint.test.ts`, http-smoke |
| No PII in logs: persistence/notification failures log only `error.name` (DB error messages can embed submitted values) | `src/lib/contact-submission.ts` | `contact-endpoint.test.ts` |
| Fail-closed abuse bound: `CONTACT_RATE_LIMIT_MAX` (default 30) per `CONTACT_RATE_LIMIT_WINDOW_SECONDS` (default 600); `0` refuses everything | `src/lib/request-guard.ts` | `request-guard.test.ts` |
| `/lien-he?requestType=bao-gia\|khac\|khao-sat` prefills; unknown/empty/repeated values use `khao-sat` | `src/lib/request-type.ts`, `ContactForm.tsx` | `request-type.test.ts` (logic only; no browser run yet) |
| Uploads: explicit raster + PDF MIME list; `image/*` removed so `image/svg+xml` is rejected by Payload's MIME check | `src/collections/MediaAssets.ts` | `access.test.ts` (config assertion only) |

### Rate limiting is not production architecture
Lock-out trade-off: the single global bucket can be exhausted by any client, blocking legitimate leads until the
window rolls. Env values are capped (max 10000, window 86400 s). Real mitigation belongs at the edge/proxy.

The limiter is one in-memory global bucket per Node process. It bounds abuse of a single instance and nothing
more. It is not a multi-instance rate limit and is not keyed on client IP, because forwarded-IP headers are
attacker-controlled unless a trusted proxy is configured. Production abuse protection (edge/WAF/shared store) is an
operator/hosting decision and remains NOT_PROVEN.

## Operator requirements

* **Initial ADMIN bootstrap.** Payload's `/api/users/first-register` creates the first user (forced to `ADMIN` by the
  Users hook) with no authentication while the users table is empty. Create the first ADMIN on a private network
  (or before the site is publicly routable) and confirm a user exists before exposing the app. Credentials are
  chosen by the operator and are never committed. After initialisation Payload refuses `first-register`; this
  repository does not yet have an automated test for that and it is NOT_PROVEN.
* `HSTS_ENABLED=true` only after HTTPS is verified on the production domain.
* `CSP_ALLOW_GA4=true` only together with an approved GA4 property configured in the CMS.
* `SITE_URL` should be the public origin so the same-site check accepts the real domain behind a proxy.
* Next.js hydration and the Payload admin require inline scripts/styles; the CSP therefore keeps `'unsafe-inline'`
  for `script-src`/`style-src` (no nonce pipeline). Everything else is `'self'`.

## `pnpm audit --prod` (run 2026-10-05, pnpm 10.34.4)

13 findings (3 high, 6 moderate, 4 low), all transitive through Payload packages:

* `undici` 7.x < 7.29.1 via `payload>undici` (2 high, DoS / TLS option drop on specific undici client features).
  Fix is a Payload upgrade or an override; not applied here to avoid a disruptive unrelated upgrade. Reachability:
  undici is used for Payload's outbound fetches; the public endpoints do not accept WebSocket/decompression input
  into it, and no outbound proxy/BalancedPool is configured. Not proven unreachable.
* `braces` <= 3.0.3 (high, ReDoS) via `@payloadcms/next>sass>chokidar` — a file-watcher glob dependency used at
  build/dev time, not on request paths.
* `esbuild` <= 0.24.2 (moderate) via `drizzle-kit` — dev-server only.
* `dompurify` (low) via the admin's Monaco editor.

Remediation: track a Payload patch release that bumps `undici`, then re-run the audit. An independent security
review has NOT been performed.

## NOT_PROVEN / not implemented in this change set

* Playwright E2E, axe, Lighthouse, responsive and Chromium/Firefox/WebKit runs: **not implemented**. Nothing was
  executed. Branded Edge/Safari and physical Windows/macOS/iOS/Android devices remain unproven.
* Wiring a browser suite into `pnpm test:integration` needs browser provisioning (`playwright install`) inside the
  existing integration job; this has not been attempted. No `.github` change is needed if it is wired through the
  package script, but the job's 20-minute budget must be measured first.
* Integration DB-safety hardening of every existing suite (random disposable DB, reject non-disposable targets):
  only `http-smoke` already follows this pattern; the other suites still reset `DATABASE_URL` after a localhost
  check. Do not run them against any existing database.
* Anonymous REST `draft=true` / versions / depth / select probes, GraphQL route and playground availability,
  upload endpoint SVG/MIME spoofing over HTTP, `first-register` after initialisation: not tested over HTTP.
* Thumbnail/derived-image delivery: image optimisation stays disabled (`images.unoptimized`), so no responsive
  modern-format pipeline was added.
* JobPosting `datePosted`/location fields and migrations, LocalBusiness: not implemented.
* Source-status approval semantics for legacy published content: not reviewed.
* Real GA4 transport/event-name browser proof and consent grant/withdraw browser flows: not implemented.
* Integration assertions added to `tests/integration/http-smoke.test.ts` were written without a local PostgreSQL
  and are only proven once CI runs them.

## Remaining customer UAT checklist
Branded Safari/Edge, iOS/Android devices, Windows/macOS, signed BMSL UAT, real GA4 account and Enhanced
Measurement settings, production abuse protection, HTTPS/HSTS on the real domain.
