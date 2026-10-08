# W4 — Safe legacy migration and 47-URL redirect preservation

Operator and approval guide. Canonical sources: `docs/blueprint/01`–`04`, `06`, `07`. All legacy content is
`LEGACY-SOURCE`; every fact stays `UNCONFIRMED` until BMSL approves it.

## 1. What is in the repo

| File | Purpose |
|---|---|
| `src/migration/legacy-manifest.json` | Sanitized 47-entry manifest: legacy path, source type, inventory action, kind, proposed target, active target, target state, approval status. Also the 17 project names/slugs. No page text, contacts, media or personal data. |
| `src/migration/article-candidates.json` | Candidate/backlog queue (15 entries) with the approvals each still needs. `selectionApproved=false`, `migratedArticleCount=0`. |
| `src/migration/legacy.mjs` | Pure validation and redirect-rule builder (also used by `next.config.mjs`). |
| `src/migration/importer.ts`, `run-import.ts` | Importer and its CLI. |
| `next.config.mjs` | Serves the legacy redirects. An unsafe rule set fails the build. |

## 2. Runtime redirects

- 46 direct permanent redirects, status **301** (not 308). `/` is an identity HTTP 200 and is never a redirect source.
- Incoming `/slug/` and `/slug` both get the 301 directly. `skipTrailingSlashRedirect: true` is required: without it
  Next first answers `/slug/` with its own 308 to `/slug`, then applies the 301 (a chain).
  Consequence: `/x/` is now served like `/x` for other routes (no 308); canonical URLs and the sitemap stay slash-less.
- Destinations are canonical no-trailing-slash same-site paths. This deliberately differs from the trailing-slash
  proposal in `02-redirect-map.md` §1.3, because the current Next app serves slash-less URLs.
- Validation rejects: external URLs, schemes, protocol-relative targets, backslashes, control characters,
  query/fragment, encoded/dot/empty segments, `/admin`, `/api`, duplicate sources, self redirects, cycles and chains.

## 3. Fallback targets (provisional, not a confirmation)

A proposed detail target (project page, article category, service detail) is recorded in `proposedTarget`.
Until it is confirmed published, `activeTarget` is an existing public listing or singleton so no redirect dead-ends
and no draft content leaks:

| Legacy group | Proposed (unconfirmed) | Active now |
|---|---|---|
| 18 project sources (17 profiles) | `/du-an/<slug>` | `/du-an` |
| Articles and unapproved article categories | `/kien-thuc/<category>` | `/kien-thuc` |
| Service post / service category | `/dich-vu/quan-ly-van-hanh` | `/dich-vu` |
| About/contact/home/author | existing routes | same |

`/354-2/` is the company office and goes to `/gioi-thieu`, never `/du-an`.
`/category/kinh-doanh-bds/` stays an OWNER-DECISION and maps to `/kien-thuc`.

**Transition when a detail is published:** in the manifest set `targetState` to `published`, `activeTarget` equal
to `proposedTarget`, and add `publishedEvidence` (the issue/PR proving publication and approval). Run
`pnpm test`. Do not change a target to a detail page that is still draft: manifest tests fail it as a dead-end.

`publishedEvidence` is a text field. Setting it does **not** prove the content exists: the manifest tests only check
that it is non-empty. Before switching any entry away from its fallback, a real check is required that the target
is a **published** record in the target database and that `GET <target>` answers HTTP 200 on the running site
(the HTTP smoke test in §6 checks every `activeTarget`; add the new target to the manifest and run it).

## 4. Importer

```
pnpm migrate:legacy                                  # dry-run: report only
pnpm migrate:legacy --input /path/outside/repo.json  # dry-run with approved article input
pnpm migrate:legacy --write [--input ...]            # explicit write, draft only
```

- Local or staging only. Writes to a non-local host need `BMSL_IMPORT_ALLOW_STAGING=true`. Input files located
  inside this repository are refused.
- `NODE_ENV=production` is the optimized Node runtime of the web image, not a statement about the data, and is never
  changed to run an import. A write under it is accepted only with ALL of: `--write`, `BMSL_IMPORT_ALLOW_STAGING=true`,
  `BMSL_IMPORT_TARGET_ENV=dev` (or `staging`) and `BMSL_IMPORT_TARGET_ACK=<host>/<database>` matching the configured
  `DATABASE_URL` exactly (credentials/port are ignored and never logged). Absent, `production`, unknown or mismatched
  values are refused before Payload starts. A non-local dry-run under `NODE_ENV=production` needs the same declaration.
  The declaration is an operator attestation, not proof the database is dev. It authorizes one manual non-clobber
  import only, never startup/build/deploy seeding.
- Dry-run still starts Payload (migration-capable) and prints `MODE: DRY-RUN ... NOT read-only inventory`; use a SQL
  read-only role/transaction or a clone for live read-only inventory.
- Projects: 17 draft profiles from the manifest (name, slug, all legacy source URLs, `LEGACY-SOURCE`).
  Both Hoc vien Quoc phong sources are kept on one profile. No address, scale, operating date, service or image is set.
- Articles: only from external input. The root must be exactly `{ "articles": [...] }`; any other root key or a
  non-array `articles` aborts the whole run **before** Payload starts or any row is written. Each item needs
  `legacyUrl`, `title` and an `approval` object `{contentApproved: true, approvedBy, approvedAt}`; optional `slug`,
  `excerpt`, `paragraphs` (plain text), `publishedAt`, `categorySlug`. `legacyUrl` must be an article source of the
  inventory or one of the candidates listed in `article-candidates.json` (this includes #4 service and #31 About,
  the optional separate articles of blueprint 04). Other kinds (home, contact, project, category, author) are
  rejected. Importing a candidate as a draft article does not change its service/About redirect.
  `categorySlug` is linked only if that category already exists; no category is created or forced. Media, HTML
  and unknown keys are rejected; no media is downloaded or uploaded. Error messages and the report never echo raw input values.
- Idempotent by legacy source URL or canonical slug. Existing records are never modified, so manual edits,
  publication and approval state survive reruns. A slug held by an unrelated record is a **conflict** and untouched.
- The whole batch is planned before the first write. Slugs are reserved across the batch in input order: if two
  sources want the same slug the first is created and the second is a reported **conflict** (no database error).
  Dry-run and write reports are identical apart from `mode`.
- Report: created / skipped / conflicts / pending approvals / rejected input / `articleSelection`.
  `articleSelection` compares the approved articles in the batch with the initial handover acceptance of **at most
  10 articles**. That is a reporting threshold only; the CMS has no ceiling. `selectionApproved` is always `false`
  and no article is counted as migrated: the article selection stays UNCONFIRMED until BMSL approves it.
- The CLI aborts with exit code 1 on invalid input and always destroys Payload in a `finally`.

> **Seed pack (Issue #75):** the importer above stays as it is (approved-input articles, no media). Legacy text and
> authorized images now also exist as a version-controlled, offline seed pack with its own loader and rights review:
> see `docs/migration/w75-legacy-seed-pack.md`. It does not change the 47-entry manifest or any redirect rule.

## 5. Approval queue (owner actions)

1. Confirm project list and per-project facts (status, scale, address, operating date); B10, B3, B5, Himlam statuses.
2. Approve image rights per project and article; consent for people in images.
3. Decide article category names (max 5) and the 10 first articles; `#33` and `#42`/`#43` are OWNER-DECISION.
4. Provide approved article text through the external input format above.
5. Crawl the old site for URLs outside the sitemap (feeds, pagination, attachments, media).
6. Production cutover (DNS) remains a separate Task Contract.

## 6. PROVEN / NOT_PROVEN

### HTTP smoke test (`tests/integration/http-smoke.test.ts`)

Runs inside the existing CI step `pnpm test:integration` (no workflow change). It:

1. creates its own disposable database `bmsl_http_smoke_<12 hex>` next to the CI database (local host only) and drops
   only that database afterwards — the shared database is never reset;
2. applies the committed migrations, imports synthetic drafts (17 projects, 2 approved draft articles incl.
   candidate #4) and one published control project, all synthetic;
3. runs `payload generate:types`, then `next build`, so the production build type-checks the app and the test
   fixtures against the strict generated Payload types (a failure fails the tests; nothing is skipped);
4. starts `next start` and requests over HTTP: all 46 legacy sources with and without trailing slash (92 requests)
   must give one direct 301 to the manifest `activeTarget`; every distinct active target and `/` must return 200
   (no chain); the eight public IA routes (`/`, `/gioi-thieu`, `/dich-vu`, `/du-an`, `/kien-thuc`,
   `/quy-trinh-minh-bach`, `/lien-he`, `/tuyen-dung`) must return 200; the published control project must be listed
   (proof that pages read this database, because public reads degrade to empty states on failure); imported drafts
   must not appear in listings or sitemap and their detail pages must return 404.

Run locally with a disposable local PostgreSQL: `DATABASE_URL=postgresql://user:pass@localhost:5432/anydb pnpm test:integration`.
The test rebuilds `.next`. Browser/axe checks remain in W5B.

### Evidence

Earlier probe (not this test): a built `next start` **without a database** returned a direct 301 for all 92 legacy
requests, but the pages themselves returned 500. That proved the redirect rules only, not 200 targets.

The measured HTTP evidence with a configured database is the `integration` job of this PR's CI run (see the PR
tracking comment for run id and counts). It is not asserted by this document.

PROVEN (by tests in this PR, unit): 47/47 inventory coverage against `01-url-inventory.md`; 18 project sources → 17
profiles; root identity; 46 deterministic 301 rules without loops/chains/duplicates; unsafe-target rejection; Next
config shape; CLI/input guards; parser root-key validation, candidates #4/#31 only, no echo of raw values.

NOT_PROVEN until the CI integration run is green on the exact head: PostgreSQL importer behaviour (no writes on invalid
input, intra-batch conflicts, rerun preservation) and the HTTP assertions above. Never proven here: importer behaviour on
real WordPress data; content accuracy; image rights; article/category selection; outside-sitemap URLs; production
cutover. Write-mode import by an operator stays blocked until this repair is proven on main.
