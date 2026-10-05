# W5B4 — executed browser, accessibility, analytics and performance UAT

Status: PROVEN on the exact CI of the merged source heads listed in "CI evidence" (PR48 head, PR51 head and exact-main CI
`37357834196`, all verify + integration PASS). The suites are wired into the existing required CI step (`pnpm test:integration`,
job `integration`, real PostgreSQL service). This document does not claim customer sign-off, branded Edge/Safari, physical
devices, a real GA4 property, live customer accounts or hosted customer deployment: that evidence is absent and stays
`NOT_PROVEN` (see the end of this document).

BASE of the original W5B4 PR: `b67bc3b080a5ae09d21c37d19d1b8740dbece033` (main with W5B1/W5B2/W5B3 and the coordinator R3 changes, exact-main CI 37347589737 green).
Final source of this evidence (refreshed by W5C, #24): main `f363129eeb8b28cdcded76f8f81c9c6be9f94b13` (merge of PR #51), exact-main CI `37357834196`.
HEAD of each original PR is recorded in the PR (a commit cannot contain its own SHA). The earlier sections below are kept in
chronological order as history; the "CI evidence" section is the current proof.

## Repair after PR48 exact-main red (issue #49)

Evidence: PR48 head `7587cd94cbff6737b1b27d9c990f188592116087` was green (CI 37353251510: 272 unit / 349 integration
passed; trusted Reviewer 37353984012 PASS) and merged as main `95e6e88d82f15260daaa85e002f88a42c0a7363e`. The exact-main
CI 37354199189 then was red: verify passed 272 unit tests, integration 347 passed / 2 failed of 349 (Firefox desktop
`NS_BINDING_ABORTED`, WebKit desktop "navigation to '/' interrupted by another '/'"). PR48 head green does not prove main.
An earlier repair attempt (PR50, head `85845a255c951e82ac1d6d853dcc97143a595d04`) was closed unmerged: its `/gioi-thieu`
destination had no content wait, so generic assertions could match the stale home document. Its CI run 37355746008 had
verify PASS and integration still running at the time it was closed and eventually passed; it is not a failed head, and is
not recorded as a failed run.

| Problem | Cause | Repair |
| --- | --- | --- |
| `public IA` test failed on desktop Firefox/WebKit | The test reused ONE page for all 8 links: `goto('/')`, click a nav link, assert. The first nav item is `/`, already the current URL, so the generic URL/title/`main`/`h1` assertions passed on the old home document while a same-URL client navigation was still pending; the next iteration's `goto('/')` then raced it. The `afterEach` `about:blank` only ran after the whole loop | Each link gets a fresh page (`context.newPage()`), closed in `finally` before the next link, so no page navigates while an earlier navigation of it is pending. The real visitor click, exact `href`, 8 areas and 9 engine/size combinations are unchanged. Every destination now waits for its own content before the final assertions: a fixed heading and matching title where the route hard-codes one, a fixed landmark for other routes, and for the CMS-driven `/gioi-thieu` the published about-page title (`MARKERS.publicAbout`, synthetic fixture) as `h1`; the heading must also differ from the home one. No sleep, retry, ignored abort or weaker timeout. The race was detected from source; it was not reproduced locally |
| `pnpm build` used a POSIX `NEXT_PHASE=... ` prefix that fails under the Windows default `cmd` script shell | Shell-specific syntax in `package.json` | `build` is `node scripts/build.mjs`: it runs `payload generate:importmap` (with `NEXT_PHASE=phase-production-build` set for that child only, no database needed), aborts if it fails, then `next build` with the caller environment unchanged (runtime env stays fail-fast). Unit-tested in `tests/integration/support/build-launcher.test.ts` (sequencing, abort on failure, env scoping) |

Outcome (recorded after the fact; the PR could not contain its own SHA): PR51 (head `4530bbea80a494dd9214f0f9dadbc9384908e0b2`)
passed CI `37356370868` (278 unit / 355 integration tests, 12 files) and the trusted Reviewer `37357329591` (attempt 2), and merged
as main `f363129eeb8b28cdcded76f8f81c9c6be9f94b13`; the exact-main CI `37357834196` then passed verify and integration. The portable
Node build launcher and the fresh-page About heading poll are therefore on main. PR50 was closed unmerged (CI `37355746008`
eventually passed), so it is not a failed head; the source-readiness issue it exposed prompted PR51 proactively. A full
Windows production build was not run; the launcher is proven by its unit tests (6 checks) and by the required Linux CI.

## Repair after CI 37350286860 (second head `2887d4b`: integration 343 passed / 6 failed, 390.49 s)

Partial real evidence of that run (old failed head, passed sub-checks only; NOT proof for the new head): Chromium 153.0.8010.12,
Firefox 155.0, WebKit 26.6 at phone/tablet/desktop; axe impacts 0 at all 9 combinations; 4 Lighthouse runs performance 99-100,
accessibility/best-practices 100, LCP 447-1671 ms, CLS 0, transfer 163839-195374 bytes; browser suite 270938 ms (provisioning
50852 ms); 7 changed-area coverage files 87.5-100 %; schema drift UP and DOWN statement lists empty. The 6 failures were all
CMS flows (ADMIN and EDITOR on three engines):

| Group | Root cause | Repair |
| --- | --- | --- |
| ADMIN browser sign-in `401` | Fixture identity bug: the W5B2 bootstrap block races six first-register candidates on purpose and ANY candidate may win the advisory lock; the winner is read from SQL there, but the browser block hardcoded `synthetic-admin@example.invalid` | `browser-blocks.ts` reads the sole ADMIN from the owned disposable database after the bootstrap (asserting exactly one ADMIN) and signs in with that address and the shared synthetic password. Nothing is reseeded, deleted or reset; authentication, lockouts and the concurrency of the bootstrap test are unchanged |
| EDITOR: CSP violation `img-src https://www.gravatar.com/avatar/<hash>` | The admin looked up the signed-in user's hashed e-mail address at Gravatar (Payload 3.90.2 default `admin.avatar: 'gravatar'`), which the narrow CSP correctly blocks | `src/payload.config.ts` sets `admin.avatar: 'default'` (Payload's local icon): no external avatar lookup, no staff address hash leaves the deployment. The CSP is **not** widened. The flows assert no `gravatar.com` request is even attempted, and still assert no CSP violation, page error or hydration/CSP console error |
| Normal production build had an empty admin import map | The committed `src/app/(payload)/admin/importMap.js` is `{}` and the ordinary `pnpm build` was `next build`; only the HTTP test fixture ran `payload generate:importmap`, so CI tested a patched build the normal path did not produce | `package.json` `build` is now `NEXT_PHASE=phase-production-build payload generate:importmap && next build` (the existing build-phase switch of `resolvePayloadEnv` lets the generator load the config without a database, exactly as `next build` does). The HTTP suite now runs `pnpm run build`, i.e. the SAME ordinary path an operator and the `verify` job use, from the committed source. Nothing is left as an operator follow-up |

## Earlier repair after CI 37334173552 (first head `632880f`: integration 316 passed / 33 failed)

That run executed the whole matrix (Chromium 153, Firefox 155, WebKit 26.6 at phone/tablet/desktop), axe (0 blocking),
Lighthouse, changed-area coverage, media revocation and the budget check successfully. The 33 failures fell into five groups;
the repairs changed no threshold, matrix, privacy/rights check or business rule.

| Group | Root cause | Repair |
| --- | --- | --- |
| Primary navigation `expected '' not to be ''` | Test bug: after a client-side click the URL changes before the router commits the new document; the title was read while the framework had it momentarily empty. The links themselves were correct (`href` equals the IA path) | The test now asserts the real link target, then waits (polling, bounded) for URL, non-empty title, one `main` and an `h1` before reading. Empty titles still fail |
| Approved document missing on `/quy-trinh-minh-bach` | Test-order bug, not an app bug: the earlier W5B2 block (`security-blocks.ts`) deliberately revokes approval of the seeded approved PDF, after which the page correctly shows the empty state | New fixture command `uat-document` creates the browser UAT's own published document with an APPROVED PDF through the normal CMS path. The page, the rights gate and the W5B2 block are unchanged; the UNCONFIRMED "Hidden" document must still be absent |
| Request type `bao-gia` expected, `khao-sat` found | Test sequencing, not an app bug: an acknowledged submission (the honeypot case) resets the form to the default `khao-sat`, as the valid-submission test also asserts. The analytics test then submitted without choosing the type again | The test asserts the reset default, selects `bao-gia` as a visitor would, and the event must carry it. A third prefill value (`bao-gia`) was added to the prefill test; unknown/repeated values still fall back |
| ADMIN `waitForURL` timeout, EDITOR Lexical editor not found | Missing admin import map in the production build (see above) plus a `waitForURL` that waits for a load event a client-side transition never fires | Login asserts the `/api/users/login` response first, then polls the route; steps are named and a failure prints the URL and visible text of the page; the import map is now produced by the ordinary build |
| `NS_BINDING_ABORTED`, navigation interrupted by another navigation | A test finished while a client transition/prefetch of its page was in flight and the next test navigated the same page | Every navigation goes through one helper that awaits `domcontentloaded`; each test ends with the page on `about:blank`, so no navigation overlaps another. No retries, no sleeps |

## How it runs

Everything runs inside `pnpm test:integration`; no workflow file was changed.

* `tests/integration/http-smoke.test.ts` builds the app once with the ordinary `pnpm run build`, starts one `next start`
  against an invocation-owned disposable database (`bmsl_http_smoke_<12 hex>`, created and dropped by that file, never the
  shared `DATABASE_URL` database) and tears the server group down with `stopProcessGroup`. The W5B4 browser suite is
  registered from that file (`support/browser-blocks.ts`) so it reuses the same build, server and data: no second build.
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
pnpm test:integration     # provisions browsers, builds (pnpm build), serves, runs the matrix, axe, Lighthouse, coverage
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
| IA navigation | The 8 areas (Trang chủ, Giới thiệu, Dịch vụ, Dự án, Quy trình & Minh bạch, Kiến thức, Tuyển dụng, Liên hệ) are exactly the primary navigation links, each with the exact IA `href`, each reachable by clicking from the home page; each has a title, one `main`, an `h1` and is not a 404 |
| Keyboard | First Tab reaches the visible skip link; Enter moves to `#main` and focus continues after the header; phone/tablet: the menu `summary` opens on Enter, the first Tab reaches "Trang chủ", Space closes it; desktop: the 8 links are reached in order by Tab |
| Contact, valid | Durable row in PostgreSQL (`contact_leads`: request type, `consent_given=true`, `source_page`, UTM) before the page confirms; form resets; `?requestType=bao-gia` prefills |
| Contact, prefill | Only one known value prefills; unknown, repeated or missing falls back to `khao-sat` |
| Contact, no write | Invalid (blank name), no consent, honeypot and a server 500 each leave zero rows; the user sees the matching message; a bot is acknowledged but nothing is stored |
| Double submit | Double-click plus Enter while the request is pending: the button is disabled, exactly one request reaches the server, exactly one row |
| Drafts / private / media | Rendered DOM of 10 public pages contains none of the private markers or draft/legacy job slugs; draft projects and draft/legacy jobs return 404; an UNCONFIRMED image is not requestable from the browser; the UAT's approved document is listed and the UNCONFIRMED-file document is not |
| Media revocation (per engine) | A freshly APPROVED synthetic image loads in the browser (decoded, PNG bytes); after approval is revoked the page no longer renders it and its URL returns no image bytes |
| axe | `@axe-core/playwright` with WCAG 2.0/2.1 A and AA tags on 10 public routes (and the open mobile menu). Critical or serious violations fail; moderate/minor are counted and reported, never hidden |
| Analytics | See below |

Per engine at desktop size: ADMIN (the account that won the bootstrap, read from the database) and EDITOR sign in through
the real `/admin` UI; the login form hydrates under the real CSP; a DRAFT article is created in the Lexical rich-text
editor of the ordinary production build and saved (row is `draft`, not on the public list); ADMIN sees the lead inbox and
may read leads, EDITOR sees neither and cannot create users; no request to Gravatar, no CSP violation, no uncaught page
error, no hydration/CSP console error.

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
unit suite (V8 provider). CI 37350286860 (old failed head, passed check) measured 87.5-100 % for the 7 files. This is not
global coverage and no historical RED evidence is claimed.

## Schema drift check

`http-smoke.test.ts` runs `smoke-fixture.ts schema-drift`: the drizzle-kit generator calls used by `payload migrate:create`
(`generateDrizzleJson` of the live Payload schema vs the latest committed snapshot, UP and DOWN) with nothing written and the
database untouched. Both statement lists must be empty. This is the generator, not the `migrate:create` CLI itself. It
passed in CI 37334173552 and CI 37350286860 (statement lists empty).

## Dependencies and audit

Added with exact pins (`package.json` devDependencies): `playwright` 1.63.0, `@axe-core/playwright` 4.13.0,
`lighthouse` 13.5.0, `@vitest/coverage-v8` 3.2.7 (matches the installed vitest 3.2.7). `pnpm.overrides.undici = 7.29.1`
(was 7.29.0 through `payload`; the scoped remediation requested in the task; no Payload major upgrade). In the lockfile
no existing package changed version except `undici`; some peer-resolution suffixes now carry `@opentelemetry/api@1.9.1`
(an optional peer pulled in by Lighthouse).

Environment note: the builder shell mounts `pnpm-lock.yaml` read-only for pnpm (`pnpm install --lockfile-only` ends with
`EBUSY` on the final rename) and the default pnpm store is read-only. The lockfile on this branch was therefore
restored from the previously generated and reviewed head `2887d4b` with the editor tools (diff against that commit is
empty). No control was bypassed.

Independent exact-lock registry audit (coordinator), corrected by W5C: full lockfile 0 critical, 1 high, 3 moderate, 1 low;
`undici` 7.29.1 is patched. **Production-only** `pnpm audit`: 3 entries, 0 critical, 1 high, 1 moderate, 1 low. No
zero-vulnerability claim is made, and package presence is distinguished from exploitability below.

| Package | Severity | Installed through | Reachability (honest) |
| --- | --- | --- | --- |
| `braces` 3.0.3 | high | `@payloadcms/next > sass > chokidar > braces` (a production dependency path), and also the Vitest/dev tree | The vulnerable precondition is a deeply nested glob input. No publicly reachable path that feeds such input was demonstrated. That is **not** proof it is absent from the production bundle: no bundle or call-site analysis was done, so "never in the production bundle" is NOT claimed |
| `esbuild` 0.18.20 | moderate (production path) | `@payloadcms/db-postgres > drizzle-kit > @esbuild-kit/esm-loader > @esbuild-kit/core-utils > esbuild` | Migration/CLI tooling; the vulnerable dev-server mode is not run by this repo. Package present on the production path |
| `dompurify` 3.4.15 | low | `@payloadcms/next > @payloadcms/ui > @monaco-editor/react > monaco-editor > dompurify` | Staff-only admin editor. Exploitation needs the `IN_PLACE` option with a node-removing hook: reachability **NOT_PROVEN** either way; the fix needs a Payload bump |
| `vitest`, `@vitest/mocker` < 4.1.11 | moderate (full lock only) | `vitest` (dev dependency) | Test runner only; the fix is a major vitest upgrade, deliberately not applied in this handover slice |

No unsolicited major dependency upgrade was made. An independent security review of this change is required and has not been done by the author.

## CI budget

The `integration` job keeps `timeout-minutes: 20`. The browser work has its own assertion (<= 12 minutes from the start of
provisioning to the last Lighthouse run) in addition to the existing build and HTTP smoke. Measured timings are in the
evidence tables below.

## CI evidence (chronological; each row cites the exact run it comes from)

History of earlier, superseded heads (not proof for the current main): `632880f` (CI 37334173552: 316 passed / 33 failed),
`2887d4b` (CI 37350286860: integration 343 passed / 6 failed, 11 files, 390.49 s; all 6 failures CMS flows; the public matrix,
analytics, media, schema drift, axe, Lighthouse and coverage checks passed).

### PR48 head `7587cd94cbff6737b1b27d9c990f188592116087` — CI `37353251510` PASS, trusted Reviewer `37353984012` PASS

This head was green and merged as main `95e6e88d82f15260daaa85e002f88a42c0a7363e`, whose exact-main CI `37354199189` was RED
(2 of 349 integration tests, Firefox and WebKit desktop navigation lifecycle race; see "Repair after PR48 exact-main red").
A green PR head does not prove main; this row is the proof of that head only.

| Item | Value (`W5B4_REPORT`) |
| --- | --- |
| Tests | verify 272 unit; integration 349 of 349 passed across 11 files |
| Engines | Chromium 153.0.8010.12, Firefox 155.0, WebKit 26.6; 9 engine x size combinations |
| axe | 0 violations at every impact level, all 9 combinations |
| Lighthouse (perf/a11y/best/SEO, LCP) | mobile home 100/100/100/91, LCP 1662.744 ms; mobile contact 100/100/100/66, LCP 1659.897 ms; mobile project 78/100/100/91, LCP 1657.2003 ms, TBT 1029.39985 ms; desktop home 100/100/100/91, LCP 431.3212 ms |
| CLS / transfer | 0 everywhere; 163844-196118 bytes. Budgets unchanged: pass |
| Timing | browser suite 225733 ms (provisioning 61243 ms); whole integration 310.75 s |
| Coverage | 7 changed-area modules each >= 80 % |
| Schema drift | UP and DOWN statement lists empty |
| Admin flows | ADMIN and EDITOR through the real UI on all 3 engines: actual Lexical editor, role assertions, no Gravatar request: PASS |

### PR51 head `4530bbea80a494dd9214f0f9dadbc9384908e0b2` — CI `37356370868` PASS, trusted Reviewer `37357329591` (attempt 2) PASS

Merged as main `f363129eeb8b28cdcded76f8f81c9c6be9f94b13`. This is the latest repair proof: the engines are unchanged and the
whole matrix passed with the new portable launcher and fresh-page IA checks.

| Item | Value (`W5B4_REPORT`) |
| --- | --- |
| Tests | verify 278 unit; integration 355 passed across 12 files (includes the 6 new launcher unit checks) |
| Engines / matrix | unchanged (Chromium 153.0.8010.12, Firefox 155.0, WebKit 26.6); 9 combinations, axe 0 at every impact |
| Lighthouse (perf/a11y/best/SEO, LCP) | mobile home 98/100/100/100, LCP 2304.4545 ms; mobile contact 99/100/100/66, LCP 1660.0246 ms; mobile project 100/100/100/91, LCP 1662.7395 ms; desktop home 100/100/100/91, LCP 447.4607 ms |
| CLS / transfer | 0 everywhere; 163600-194541 bytes |
| Timing | browser suite 292531 ms (provisioning 52430 ms); whole integration 411.68 s |
| Checks | All CMS/admin/editor, analytics, media and IA matrix checks PASS |

### Exact main `f363129eeb8b28cdcded76f8f81c9c6be9f94b13` — CI `37357834196`

verify and integration PASS (recorded in the W5C task contract on 2026-10-05 UTC; the W5C builder could not fetch the run logs, so
the per-run `W5B4_REPORT` numbers of this run itself are not copied here: the figures above are those of the PR51 head run
`37356370868`, and main differs from that head only by the merge). Retrieve the main run's `W5B4_REPORT` from its log when a
final handover pack is assembled.

PR50 (closed unmerged, CI `37355746008` eventually PASS) is not a failed head: it is retained as history only.

Not claimed anywhere above: customer, live-account or physical-device evidence, and any full Windows production build.

## Input-dependent items that remain NOT_PROVEN

* Signed customer UAT; physical devices; branded Edge/Safari; screen readers.
* Real GA4 property delivery and Enhanced Measurement; Search Console; the cookie/consent policy and UI (owner decisions).
* Customer-confirmed contact, legal, media, project and job facts (everything stays UNCONFIRMED/draft; existing
  jobs migrated to `LEGACY-SOURCE` stay hidden until an operator reviews and confirms them, never auto-approved).
* Production hosting, DNS, HTTPS, WAF, off-site backup scheduling, highest-ADMIN transfer and delivered training: see the
  W5C handover matrix `docs/handover/uat-handover-matrix.md` (each item `NOT_PROVEN`).
* Raw upload signature checks are file-type identification, not PDF/malware scanning.
* A full Windows production build, and a production build on the real host. `payload generate:importmap` under the
  `NEXT_PHASE` build switch without a database is proven on the Linux CI runs cited above only.
* Reachability of the audited dependency findings (braces, DOMPurify): package presence is not exploitability, and no
  bundle/call-site analysis was done.
