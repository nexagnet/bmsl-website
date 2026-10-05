# W5B security hardening — implemented slice, evidence and open items

Status: PARTIAL. This document records what the W5B change set implements, how to configure it, and what is
explicitly not yet proven. It does not claim customer sign-off, live abuse protection or browser/device coverage.

## Implemented (W5A/W5B1)

| Area | Where | Test |
| --- | --- | --- |
| Security headers on every route (`nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `X-Frame-Options: DENY`, CSP with `frame-ancestors 'none'`, `Permissions-Policy`) | `src/lib/security-headers.mjs`, `next.config.mjs` | `src/lib/security-headers.test.ts`; real-server assertions in `tests/integration/http-smoke.test.ts` |
| HSTS only when `HSTS_ENABLED=true` (operator has verified HTTPS on the real domain; no `includeSubDomains`/`preload`) | same | same |
| GA4 origins in CSP only when `CSP_ALLOW_GA4=true`; no wildcard / broad `https:` source | same | same |
| `/admin` and `/api` stay `X-Robots-Tag: noindex, nofollow` | `next.config.mjs` | http-smoke |
| Contact endpoint: streaming byte cap (16 KiB), `application/json` required, same-site check, malformed JSON -> 400, backend init failure -> safe 503, persistence failure -> safe 500 | `src/lib/request-guard.ts`, `src/lib/contact-endpoint.ts` | `request-guard.test.ts`, `contact-endpoint.test.ts`, http-smoke |
| No PII in logs: persistence/notification failures log only `error.name` | `src/lib/contact-submission.ts` | `contact-endpoint.test.ts` |
| Fail-closed abuse bound: `CONTACT_RATE_LIMIT_MAX` (default 30) per `CONTACT_RATE_LIMIT_WINDOW_SECONDS` (default 600) | `src/lib/request-guard.ts` | `request-guard.test.ts` |

The in-memory limiter is one global bucket per Node process. It bounds abuse of a single instance and is not a
multi-instance or per-IP limit (forwarded-IP headers are attacker-controlled). Production abuse protection
(edge/WAF/shared store) is an operator/hosting decision and remains NOT_PROVEN.

## W5B2 — CMS, disposable database and HTTP security

Status: implemented. No PostgreSQL/Docker exists in the builder sandbox, so every integration suite is proven only by
the required CI job (`pnpm test:integration` against the CI PostgreSQL service). Browser/axe/Lighthouse remain successor
contracts (#36/#37).

| Area | Where | Test |
| --- | --- | --- |
| `pnpm test:integration` creates one random invocation-owned database (`bmsl_it_<16 hex>`) before any suite; workers refuse any other target; teardown drops only what setup created, after PostgreSQL reports no session, never `WITH (FORCE)` | `vitest.integration.config.ts`, `tests/integration/global-setup.ts`, `support/worker-guard.ts`, `support/disposable-db.ts`, `support/db-lifecycle.ts` | `support/disposable-db.test.ts` (also in `pnpm test`), `db-lifecycle.test.ts` (real PostgreSQL negative ownership) |
| Ownership is recorded only after a successful `CREATE DATABASE`; a valid-looking name, local host or an already-existing database is never droppable | `createOwnedDatabase` / `dropDisposableDatabase` | same |
| Every spawned fixture/build/generate/revoke command runs as an invocation-owned process group (`runInGroup`): on timeout, failure or success the whole group is killed and its pipes awaited before DROP | `support/db-lifecycle.ts`, `http-smoke.test.ts` | `db-lifecycle.test.ts` (executed: descendant holding a PostgreSQL session is gone after timeout/failure/clean exit, unrelated invocation DB still present) |
| Initial ADMIN over HTTP needs `INITIAL_ADMIN_BOOTSTRAP_TOKEN` (>= 32 chars, operator generated, no default) sent as `x-bootstrap-token`; a PostgreSQL advisory lock serialises concurrent first accounts; once any user exists an unauthenticated HTTP create is refused; the local API (operator CLI/seed) still bootstraps | `src/lib/bootstrap.ts`, `src/collections/Users.ts` | `bootstrap.test.ts`; HTTP: `support/security-blocks.ts` |
| Canonical Origin check compares scheme+host+port with `SITE_URL` and the explicit comma-separated `TRUSTED_ORIGINS`; `Host` and `X-Forwarded-*` are never origins | `src/lib/request-guard.ts` | `request-guard.test.ts`; HTTP origin block |
| GraphQL disabled (`graphQL.disable`); no GraphQL/playground route exists | `src/payload.config.ts` | HTTP: 404 for GET/HEAD/POST on `/api/graphql*` and the playground |
| Upload: 10 MB cap, explicit MIME list, and a strict policy where file extension, declared MIME type and magic bytes must agree on PNG/JPEG/GIF/WebP/AVIF/PDF; SVG, HTML, scripts, double extensions and any mismatch are rejected with HTTP 400 before anything is stored | `src/lib/upload-policy.ts`, `src/collections/MediaAssets.ts` | `upload-policy.test.ts`; HTTP upload block (no row and no file on disk for every rejected case) |
| Internal provenance (`media-assets.source`, `projects.legacyUrls`, `articles.legacyUrl`) is staff-read only | collections | HTTP anonymous probes and staff positive controls |
| Project publication gate: ANY project (summary-only, services-only, name-only, facts) needs `sourceStatus=CONFIRMED` to be published; the same rule applies when rendering and at the anonymous REST read access, so stored unconfirmed data stays hidden; the 17 legacy profiles stay drafts | `src/lib/publish-gate.ts`, `src/collections/content.ts`, `public-content.ts` | `publish-gate.test.ts`, `public-content.test.ts`, `cms.test.ts`, HTTP gate block (incl. stored data downgraded by SQL) |
| Slugs must be lowercase ASCII words with single hyphens; rich-text links render only for http(s)/mailto/tel or same-site paths | `shared.ts`, `safeLinkHref` | `public-content.test.ts`, `cms.test.ts`, HTTP slug test |
| Rights revocation: warm approved GET, then revoke; GET/HEAD/conditional/range requests return no bytes and no 304; Next optimizer stays disabled | existing W5A media access (preserved) | HTTP rights block |

### Limits of the upload checks (what they do not prove)
The upload policy identifies a file by extension, declared MIME type and magic-byte signature, and the PDF check only
confirms a structurally plausible PDF. This is file-type identification. It is not antivirus or malware scanning and not
complete PDF validation. An approved PDF can still contain active constructs (for example JavaScript actions, launch or
embedded-file entries), so this document does not claim that stored files have no executable content. Only
staff-uploaded, rights-APPROVED files are served publicly; any malware scanning or PDF sanitising is an operator/hosting
decision and remains NOT_PROVEN.

### Editing old unconfirmed published projects
The project publication gate evaluates the stored document overlaid with the incoming change. A project that was already
published while `sourceStatus` is not `CONFIRMED` (data stored before the gate existed) therefore cannot be saved
again, even as a draft edit, because the stored record is still published. Safe workaround for staff: first set the
project to draft (unpublish) so the record stops being public, make the draft edits, and publish again only after the
source has confirmed it and `sourceStatus` is set to `CONFIRMED`. Do not set `CONFIRMED` just to unblock editing.

### Field-level access and empty-array placeholders
Where a field is hidden by field access, Payload removes the value. For an array field (`legacyUrls`) the response may
carry an empty array instead of omitting the key, so the HTTP tests assert that no entries, marker or legacy host
appear, rather than property absence. Staff positive controls read the real values.

### GraphQL and OPTIONS
GraphQL is disabled: GET, HEAD and POST on `/api/graphql*` and the playground return 404 with no schema or data.
Payload's catch-all REST route answers `OPTIONS` for every `/api/*` path as a generic preflight (HTTP 200 for paths that
do not exist), so OPTIONS is not expected to return 404. The test proves that the OPTIONS answer for the GraphQL paths
has no GraphQL execution, data or introspection and is identical to the preflight of a path that never existed.

### Versions
Payload's collection versions endpoint is `/api/<collection>/versions?where[parent][equals]=<id>` (globals:
`/api/globals/<slug>/versions`), not `/:id/versions`. Staff (ADMIN and EDITOR) must read the private draft marker there,
anonymous requests must not.

Operator configuration: `INITIAL_ADMIN_BOOTSTRAP_TOKEN`, `TRUSTED_ORIGINS` (full origins), `SITE_URL` (canonical origin;
when unset only `http://localhost:3000` is trusted). Create the first ADMIN with the token on a private network or
through the local API, then unset the token. Behind a proxy set `SITE_URL`/`TRUSTED_ORIGINS`, otherwise browser form
posts are refused with 403. The admin UI "create first user" screen cannot bootstrap over HTTP anymore.

## Operator requirements

* `HSTS_ENABLED=true` only after HTTPS is verified on the production domain.
* `CSP_ALLOW_GA4=true` only together with an approved GA4 property configured in the CMS.
* Next.js hydration and the Payload admin require inline scripts/styles; the CSP keeps `'unsafe-inline'` for
  `script-src`/`style-src` (no nonce pipeline). Everything else is `'self'`.

## `pnpm audit --prod` (run 2026-10-05, pnpm 10.34.4)

13 findings (3 high, 6 moderate, 4 low, 0 critical), all transitive through Payload packages. Not a zero-vulnerability
claim.

* `undici` 7.29.0 via `payload>undici` (2 high: unrequested WebSocket subprotocol DoS, dropped TLS connect options;
  moderate/low retry/dump/cache interceptor and decompression findings). Reachability: the site code never uses undici
  directly, its WebSocket client, BalancedPool, proxy/retry/dump/cache interceptors or custom TLS client options.
  Payload only uses it for its own outbound fetch (`safeFetch`, for example upload-from-URL, which anonymous users cannot
  reach and which this site does not configure). No anonymous request reaches it as configured; this is an independent
  read-only analysis, NOT a proof of unreachability. The scoped fix is a `pnpm.overrides` entry `undici: 7.30.0`
  (compatible patch >= 7.29.1). It was NOT applied: the builder sandbox asks for approval before writing
  `pnpm-lock.yaml`/the pnpm store and an override without a regenerated lockfile fails the frozen-lockfile CI install.
  The sandbox control was not bypassed. A networked run (coordinator) must add the override, run `pnpm install` and
  `pnpm audit --prod`.
* `braces` <= 3.0.3 (high ReDoS) via `@payloadcms/next>sass>chokidar`: build/dev file watcher only, no request path; no
  patched release exists. Tracked separately.
* `esbuild` <= 0.24.2 (moderate, dev server only) via `drizzle-kit`; `dompurify` (low) via the admin Monaco editor.

The independent coordinator security review has not been performed by the builder.

## NOT_PROVEN / not implemented

* Playwright E2E, axe, Lighthouse, responsive and Chromium/Firefox/WebKit runs (successor #36/#37). Branded Edge/Safari
  and physical devices remain unproven.
* Thumbnail/derived-image delivery: image optimisation stays disabled (`images.unoptimized`); no rights-aware
  responsive pipeline exists.
* LocalBusiness: stays absent until BMSL explicitly confirms an address.
* Antivirus/malware scanning and complete PDF validation of uploads: not implemented (see "Limits of the upload checks").
* The `undici` patch (above) remains open, blocked by the Action sandbox's lockfile write control; to be applied in a
  later permitted run. No zero-vulnerability claim is made.
* No real recruitment content exists: customer job facts are not provided, so any job stays draft/UNCONFIRMED.

## W5B3 — optional confirmed recruitment facts

`job-postings` gained optional operator-entered fields: `datePosted`, `jobLocation` (`streetAddress`,
`addressLocality`, `addressRegion`, `postalCode`, `addressCountry` as ISO 3166-1 alpha-2) and `sourceStatus`
(`LEGACY-SOURCE` default, or `CONFIRMED`), added by migration `20261005_150000_job_confirmed_facts`. The job detail page
emits `JobPosting` JSON-LD only for a published job with `sourceStatus=CONFIRMED`, a valid `datePosted`, a locality and
a country, plus title and description. The date is never taken from `createdAt`, no location or country is assumed and
nothing is invented; any missing or unconfirmed input emits no JobPosting. Draft jobs stay hidden by the existing
published-only read boundary. Evidence: `src/lib/seo-structured.test.ts` (unit), `tests/integration/payload.test.ts`
(migration up on PostgreSQL) and `tests/integration/http-smoke.test.ts` (real HTTP), the last two proven only by CI.
* Real GA4 transport and consent browser flows: not implemented.
* Every integration assertion above is proven only once CI runs it against PostgreSQL.

## Remaining customer UAT checklist
Branded Safari/Edge, iOS/Android devices, Windows/macOS, signed BMSL UAT, real GA4 account and Enhanced Measurement
settings, production abuse protection, HTTPS/HSTS on the real domain.
