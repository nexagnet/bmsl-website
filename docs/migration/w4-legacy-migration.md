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

## 4. Importer

```
pnpm migrate:legacy                                  # dry-run: report only
pnpm migrate:legacy --input /path/outside/repo.json  # dry-run with approved article input
pnpm migrate:legacy --write [--input ...]            # explicit write, draft only
```

- Local or staging only. Writes are refused when `NODE_ENV=production`, or when the database host is not
  local unless `BMSL_IMPORT_ALLOW_STAGING=true`. Input files located inside this repository are refused.
- Projects: 17 draft profiles from the manifest (name, slug, all legacy source URLs, `LEGACY-SOURCE`).
  Both Hoc vien Quoc phong sources are kept on one profile. No address, scale, operating date, service or image is set.
- Articles: only from external input. Each item needs `legacyUrl` (an article source in the inventory), `title` and
  an `approval` object `{contentApproved: true, approvedBy, approvedAt}`; optional `slug`, `excerpt`, `paragraphs`
  (plain text), `publishedAt`, `categorySlug`. `categorySlug` is linked only if that category already exists in the CMS;
  no category is ever created or forced. Media, HTML and unknown keys are rejected; no media is downloaded or uploaded.
- Idempotent by legacy source URL or canonical slug. Existing records are never modified, so manual edits,
  publication and approval state survive reruns. A slug held by an unrelated record is a **conflict** and untouched.
- Report: created / skipped / conflicts / pending approvals / rejected input.

## 5. Approval queue (owner actions)

1. Confirm project list and per-project facts (status, scale, address, operating date); B10, B3, B5, Himlam statuses.
2. Approve image rights per project and article; consent for people in images.
3. Decide article category names (max 5) and the 10 first articles; `#33` and `#42`/`#43` are OWNER-DECISION.
4. Provide approved article text through the external input format above.
5. Crawl the old site for URLs outside the sitemap (feeds, pagination, attachments, media).
6. Production cutover (DNS) remains a separate Task Contract.

## 6. PROVEN / NOT_PROVEN

PROVEN (by tests in this PR): 47/47 inventory coverage against `01-url-inventory.md`; 18 project sources → 17 profiles;
root identity; 46 deterministic 301 rules without loops/chains/duplicates; unsafe-target rejection; Next config shape;
CLI/input guards. Also observed on a built `next start` without a database: all 92 legacy slash/no-slash requests
returned a direct 301 to the manifest `activeTarget`.

NOT_PROVEN: HTTP 200 of the redirect targets and draft non-leak against a live database in this environment;
importer behaviour on real WordPress data; content accuracy; image rights; article/category selection;
outside-sitemap URLs; production cutover.
