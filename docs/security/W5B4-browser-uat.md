# W5B4 — executed browser, accessibility, analytics and performance UAT

Status: IMPLEMENTED, CI EVIDENCE PENDING. The suites below are committed and wired into the existing required CI step
(`pnpm test:integration`, job `integration`, real PostgreSQL service). A committed-but-unexecuted suite does not pass:
the numbers in "CI evidence" are filled in only from the CI run of the PR head. This document does not claim customer
sign-off, branded Edge/Safari, physical devices, a real GA4 property or hosted customer deployment.

BASE: `a229c88ac5ed31e2b345f0cd18417a0059a9c4f2` (main with W5B1/W5B2/W5B3, exact-main CI 37328478241 green).
HEAD: the head commit of the PR that carries this change (a commit cannot contain its own SHA; the PR records it).

## How it runs

Everything runs inside `pnpm test:integration`; no workflow file was changed.

* `tests/integration/http-smoke.test.ts` already builds the app once, starts one `next start` against an
  invocation-owned disposable database (`bmsl_http_smoke_<12 hex>`, created and dropped by that file, never the shared
  `DATABASE_URL` database) and tears the server group down with `stopProcessGroup`. The W5B4 browser suite is registered
  from that file (`support/browser-blocks.ts`) so it reuses the same build, server and data: no second build.
* Browser provisioning: `pnpm exec playwright install --with-deps chromium firefox webkit` (documented Playwright
  installer, system libraries included; the CI runner has `sudo`). It runs as an invocation-owned process group
  (`runInGroup`) with a 10 minute cap. Failure fails the suite; there is no skip path.
* Browsers are launched from the vitest worker and closed in `afterAll` (Playwright waits for each browser process to
  exit). Fixture subprocesses and the server keep the existing process-group teardown before the database is dropped.
* `tests/integration/coverage-changed-area.test.ts` runs the unit suite with the V8 coverage provider in a clean-environment
  subprocess (no database, no secrets) and checks the per-file floor below.
* `tests/integration/support/browser-policy.ts` holds the pure rules (axe blocking impacts, Lighthouse budgets, coverage
  floor, analytics event/parameter allow-list). `browser-policy.test.ts` unit-tests them in `pnpm test` and in the
  integration run.

Reproduce locally (needs PostgreSQL and `DATABASE_URL` of an administrative database; the suite creates and drops its own):

```
pnpm install --frozen-lockfile
pnpm test                 # unit, includes browser-policy.test.ts
pnpm test:integration     # provisions browsers, builds, serves, runs the matrix, axe, Lighthouse, coverage
```

Reports: a `W5B4_REPORT {json}` line plus a markdown table are written to the test log and, when running in GitHub
Actions, appended to the job step summary; `test-results/w5b4/` (git-ignored) holds the same data. No private data is in them.

## Engine and size matrix (actual engines only)

| Engine | Source | Sizes (viewport only, no device or touch emulation) |
| --- | --- | --- |
| Chromium | Playwright 1.63.0 | phone 390x844, tablet 820x1180, desktop 1366x900 |
| Firefox | Playwright 1.63.0 | same |
| WebKit | Playwright 1.63.0 | same |

Phone and tablet use the native-disclosure menu, desktop (>= 1024 px) the inline navigation, so both navigation
patterns are exercised. Every one of the 9 engine x size combinations runs the tests below; the final "execution budget"
test fails if any combination did not run (no silent skip).

Not proven by this matrix: branded Microsoft Edge, Safari on macOS/iOS, Chrome on Android, physical Windows/macOS/iOS/
Android devices, real touch, assistive technology (screen readers), or any signed customer UAT.

## What is asserted

Per combination (`support/browser-blocks.ts`):

| Area | Assertion |
| --- | --- |
| IA navigation | The 8 areas (Trang chủ, Giới thiệu, Dịch vụ, Dự án, Quy trình & Minh bạch, Kiến thức, Tuyển dụng, Liên hệ) are exactly the primary navigation links, each reachable by clicking from the home page; each has a title and `main` and is not a 404 |
| Keyboard | First Tab reaches the visible skip link; Enter moves to `#main` and focus continues after the header; phone/tablet: the menu `summary` opens on Enter, the first Tab reaches "Trang chủ", Space closes it; desktop: the 8 links are reached in order by Tab |
| Contact, valid | Durable row in PostgreSQL (`contact_leads`: request type, `consent_given=true`, `source_page`, UTM) before the page confirms; form resets; `?requestType=bao-gia` prefills |
| Contact, prefill | Only one known value prefills; unknown, repeated or missing falls back to `khao-sat` |
| Contact, no write | Invalid (blank name), no consent, honeypot and a server 500 each leave zero rows; the user sees the matching message; a bot is acknowledged but nothing is stored |
| Double submit | Double-click plus Enter while the request is pending: the button is disabled, exactly one request reaches the server, exactly one row |
| Drafts / private / media | Rendered DOM of 10 public pages contains none of the private markers or draft/legacy job slugs; draft projects and draft/legacy jobs return 404; an UNCONFIRMED image is not requestable from the browser; the approved document is listed |
| Media revocation (per engine) | A freshly APPROVED synthetic image loads in the browser (decoded, PNG bytes); after approval is revoked the page no longer renders it and its URL returns no image bytes |
| axe | `@axe-core/playwright` with WCAG 2.0/2.1 A and AA tags on 10 public routes (and the open mobile menu). Critical or serious violations fail; moderate/minor are counted and reported, never hidden |
| Analytics | See below |

Per engine at desktop size: ADMIN and EDITOR sign in through the real `/admin` UI; the login form hydrates under the
real CSP; a DRAFT article is created in the Lexical rich-text editor and saved (row is `draft`, not on the public list);
ADMIN sees the lead inbox and may read leads, EDITOR sees neither and cannot create users; no CSP violation, no
uncaught page error, no hydration/CSP console error.

### Analytics (mocked transport, not GA4 delivery)

The real `gtag` wiring runs in the browser (published settings enable analytics with the synthetic id `G-ABC123DEF4`,
a synthetic hotline and Zalo). Requests to Google hosts are intercepted and answered by a local stub, so the script
`gtag/js` is requested exactly once after consent and nothing is ever collected. Asserted: no consent => no library
load, no `dataLayer`, no Google request; consent => `page_view`; `purchase`/`page_view` custom events send nothing;
extra parameters (`email`, `phone`) are stripped; exactly the four names `phone_click`, `zalo_click`, `form_submit`,
`document_download` occur with only `link_location`, `request_type`, `document_id`, `page_location`, `page_referrer`;
`page_location` has no query/fragment and `page_referrer` is the bare origin even when the visit carried
`utm_source`, an email query and a referrer with a token; invalid, no-consent, honeypot and failed submissions emit no
`form_submit`, success emits one only after the row exists; withdrawal sets `ga-disable-<id>` and queues nothing (not
even the allowed events); regrant resumes; `document_download` carries the document id.

`CSP_ALLOW_GA4=true` is set for the build and server of the test run so the intercepted script is permitted by the CSP.
Production keeps the default (GA4 origins disallowed) unless the operator sets it.

Not proven: delivery to a real GA4 property, the property's Enhanced Measurement setting (must be reviewed by the
account owner; automatic downloads/outbound clicks there could duplicate or bypass the site's consent gate), Search
Console, or the consent policy itself (owner decision). No real GA4 account is enabled.

## Performance (Lighthouse, measured)

Chromium via Lighthouse 13.5.0 (simulated throttling). Runs: `/`, `/lien-he`, a published project page on mobile, and
`/` on the desktop preset. Declared budgets (`LIGHTHOUSE_BUDGET`): accessibility >= 0.90, best-practices >= 0.80,
performance >= 0.50, LCP <= 4000 ms, CLS <= 0.10, total transfer <= 1.5 MB. A missing measurement fails. The actual
scores of each run are printed next to the budgets; no grade is asserted beyond them. SEO is reported but not
budgeted (`/lien-he` is a published noindex page by design).

## Changed-area coverage

The modules the browser UAT drives (`analytics.ts`, `contact-submission.ts`, `contact-endpoint.ts`, `request-type.ts`,
`request-guard.ts`, `security-headers.mjs`, `site-settings.ts`) must each reach 80 % lines and statements under the
unit suite (V8 provider). Local scratch-copy measurement while developing (not the CI run): analytics 94.73,
contact-endpoint 87.5, contact-submission 97.33, request-guard 100, request-type 100, security-headers 100,
site-settings 97.14 (lines = statements). This is not global coverage and no historical RED evidence is claimed.

## Schema drift check

`http-smoke.test.ts` runs `smoke-fixture.ts schema-drift`: the drizzle-kit generator calls used by `payload migrate:create`
(`generateDrizzleJson` of the live Payload schema vs the latest committed snapshot, UP and DOWN) with nothing written and the
database untouched. Both statement lists must be empty. This is the generator, not the `migrate:create` CLI itself, and
it is only proven when the CI run executes it.

## Dependencies and audit

Added with exact pins (`package.json` devDependencies): `playwright` 1.63.0, `@axe-core/playwright` 4.13.0,
`lighthouse` 13.5.0, `@vitest/coverage-v8` 3.2.7 (matches the installed vitest 3.2.7). `pnpm.overrides.undici = 7.29.1`
(was 7.29.0 through `payload`; the scoped remediation requested in the task; no Payload major upgrade). In the lockfile
no existing package changed version except `undici`; some peer-resolution suffixes now carry `@opentelemetry/api@1.9.1`
(an optional peer pulled in by Lighthouse). `pnpm install --frozen-lockfile` succeeds on a copy of this tree.

Environment note: the builder shell mounts `pnpm-lock.yaml` read-only and the default pnpm store is read-only, so
`pnpm add` failed there with `EROFS`/`EBUSY` (also with the sandbox disabled). The lockfile was therefore generated by
pnpm in a scratch directory and applied with the editor tools; the applied file is byte-identical (SHA-256) to the
pnpm-generated one. No control was bypassed.

`pnpm audit` on the resulting lockfile (pnpm 10.34.4, 2026-10-05): 5 advisories (1 high, 3 moderate, 1 low), none in the
new packages and none for `undici` any more:

| Package | Severity | Path | Reachability (honest) |
| --- | --- | --- | --- |
| `braces` <= 3.0.3 | high | `vitest > vite > sass > chokidar` | test/dev tooling only, never in the production bundle; ReDoS needs attacker-chosen glob input to a dev watcher |
| `esbuild` <= 0.24.2 | moderate | `@payloadcms/db-postgres > drizzle-kit > @esbuild-kit/*` | migration CLI tooling; the vulnerable dev-server mode is not run |
| `vitest`, `@vitest/mocker` < 4.1.11 | moderate | `vitest` | test runner only; the fix is a major vitest upgrade, not applied in this slice |
| `dompurify` 3.4.13-3.4.15 | low | `@payloadcms/ui > @monaco-editor/react > monaco-editor` | bundled in the staff-only admin; exploitation needs the `IN_PLACE` option with a node-removing hook, which was not verified absent in Monaco: NOT_PROVEN unreachable; fix needs a Payload bump |

An independent security review of this change is required and has not been done by the author.

## CI budget

The `integration` job keeps `timeout-minutes: 20`. The browser work has its own assertion (<= 12 minutes from the start of
provisioning to the last Lighthouse run) in addition to the existing build and HTTP smoke (~90 s measured before this
slice). Provisioning, browser, axe, Lighthouse and coverage durations are printed in the report; actual CI timings go
in the evidence table below.

## CI evidence (to be filled from the CI run of the PR head; empty values are not claimed)

| Item | Value |
| --- | --- |
| PR head SHA / CI run | PENDING |
| `pnpm test` / `pnpm test:integration` test counts | PENDING |
| Provisioning / browser suite / total job time | PENDING |
| Engines and versions (from `W5B4_REPORT`) | PENDING |
| axe violations by impact per combination | PENDING |
| Lighthouse scores per run | PENDING |
| Changed-area coverage per file | PENDING |
| Schema drift result | PENDING |

## Input-dependent items that remain NOT_PROVEN

* Signed customer UAT; physical devices; branded Edge/Safari; screen readers.
* Real GA4 property delivery and Enhanced Measurement; Search Console; the cookie/consent policy and UI (owner decisions).
* Customer-confirmed contact, legal, media, project and job facts (everything stays UNCONFIRMED/draft; existing
  jobs migrated to `LEGACY-SOURCE` stay hidden until an operator reviews and confirms them, never auto-approved).
* Production hosting, DNS, HTTPS, WAF, backups, highest-ADMIN transfer and delivered training (W5C #24).
* Raw upload signature checks are file-type identification, not PDF/malware scanning.
