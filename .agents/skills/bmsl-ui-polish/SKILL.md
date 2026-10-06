---
name: bmsl-ui-polish
description: Improves only the visual presentation of the BMSL public Next.js website with premium responsive UI, CSS and presentation-only JSX. Use for Google Antigravity UI refresh and visual polish while preserving all CMS, contact form, permissions, analytics, SEO and business logic.
---

# BMSL public-website UI polish

## Mission and authoritative context

Improve visual craft, readability and trust for the public BMSL property-management website. This is a MANUAL Google Antigravity implementation of canonical GitHub Issue #64 (risk:R1); it is **not** an instruction to invoke Claude Autopilot.

Before editing: fetch GitHub live main and Issue #64; read AGENTS.md, CLAUDE.md, docs/blueprint/05-ia-wireframes.md and the actual public components. Existing GitHub governance outranks this skill. Start a new branch from latest verified main (do not work on main directly). Record BASE_SHA; re-check it before opening a PR.

## Scope whitelist: presentation only

- src/app/(frontend)/site.css: design tokens, typography, spacing, grids, visual states, responsive styles, decorative CSS, reduced-motion rules.
- src/components/SiteShell.tsx: CSS classes and inert presentation wrappers for header, navigation, footer and CTA; preserve exact existing links and hooks.
- src/components/blocks.tsx: presentation/markup for existing cards, breadcrumb, buttons, pager, CTA and empty states, without changing props, data access or mapping behavior.
- src/components/SingletonPage.tsx: presentation wrappers only, with existing CMS data and metadata untouched.
- src/components/ContactForm.tsx: classes, layout wrappers and styling only; **do not change hooks, event handler, validation, input names/attributes, state, status messages, consent, honeypot or analytics wiring.**
- src/app/(frontend)/**/page.tsx: only markup wrappers/classes/layout of already-fetched content; preserve server data fetches, conditional visibility, page metadata, URLs and CMS data selection.
- Optional new purely decorative/presentational components under src/components with no business data access or side effects.

Any path not in this allowlist is denied. Specific hard exclusions include .github/**, deploy/**, infra/**, tools/autopilot/**, .claude/**, .mcp.json, AGENTS.md, CLAUDE.md, .agents/** except this existing skill being read (do not modify it during UI implementation), docs/blueprint/**, src/lib/**, src/collections/**, src/globals/**, src/access/**, src/migration/**, src/migrations/**, src/seed/**, src/app/(payload)/**, any route.ts, src/components/AnalyticsProvider.tsx, src/payload.config.ts, package.json, pnpm-lock.yaml, next.config.mjs, Dockerfile, secrets, server code, tests that would weaken assertions.

## What does NOT count as visual-only

- Changing function signatures, calls, branching/conditional expressions, sorting, filtering, pagination, CMS queries, form payload/endpoint or any server/client state.
- Changing href/target of any menu item, Breadcrumb, pager, phone/Zalo, survey CTA; changing requestType value, form name, required/maxLength/type, honeypot, consent or aria-live semantics.
- Adding new dynamic widgets, client state, API calls, analytics events, dependencies, external scripts/fonts, images or CDNs.
- Modifying sitemap, metadata, robots/noindex, JSON-LD, SEO content or redirects.
- Editing Payload admin UI or authentication/RBAC, migrations or persistent data.
- Changing business claims/copy, adding fake project names/figures, fake testimonials, awards, photos, licenses, contact information or invented BMSL brand assets.
- Rewriting unit/integration tests or reducing their coverage/budgets to pass CI.

If a desirable redesign requires any of the above, STOP that part and log a separate proposal. Do not smuggle it into the visual PR.

## Visual art direction: polished, not fictional

- Target mood: premium, calm, credible Vietnamese corporate property operations; purposeful editorial hierarchy and a high-end B2B feel rather than generic colorful dashboard design.
- Real BMSL logo, color palette, brand font and photos are not approved yet. Keep a **provisional neutral palette** and centralize editable CSS tokens. BMSL text wordmark only; do not treat placeholder colors as official branding.
- Use a coherent display/body type scale (system/local fonts only), readable Vietnamese line height, restrained color accents, generous but controlled white space, alignment and consistent container widths.
- Make hero feel designed: disciplined headline width, eyebrow/overline only if factual and non-marketing, rhythm, prominent existing survey CTA. CSS backgrounds/shapes/lines are fine; avoid stock photos and fake numeric trust indicators.
- Refine shared UI: desktop/mobile navigation, visual current/hover/focus state, cards with equal-height rhythm, tasteful image treatment when authorized media exist, elegant CSS-only image-free fallback, CTA section, footer, breadcrumbs, category chips, pagination and readable article/detail text.
- Make form fields, consent, disabled, invalid, success and error states visually excellent without changing behavior.
- Avoid giant gradients, glassmorphism, parallax, distracting movement, unsupported icon packs or ad-like blocks.

## Non-negotiable accessibility and responsive contract

- Preserve all EIGHT public IA links, their href, existing native mobile details/summary behavior, keyboard order, skip-link and main#main.
- Preserve semantic landmark structure and accessible headings; never hide real content from assistive technology. Use aria-hidden only on truly decorative additions.
- Test widths 320, 390, 768, 1024 and 1440px, including long Vietnamese text and empty CMS states. No horizontal scrolling/clipped CTAs or overlay blocking input.
- Interactive targets comfortably touchable; focus visibly discernible; minimum WCAG AA contrast for ordinary text and controls.
- Respect prefers-reduced-motion; animations must be subtle and not gate content.
- Do not bypass rights-aware media behavior (notably do not swap existing Img for unapproved remote image or optimizer). Avoid CLS, font/network regressions.

## Procedure

1. Baseline: inspect site.css, SiteShell, blocks, SingletonPage, ContactForm, all 8 public route files; read issue #64. Note which pages have empty CMS states.
2. Capture BEFORE screenshots at desktop 1440, tablet 768, mobile 390 for at least Home, Services, Projects, Knowledge/Article, Contact and mobile menu. Use dev/synthetic data only and redact anything personal. If a browser or runtime is unavailable, say NOT_PROVEN instead of inventing screenshots.
3. Choose ONE coherent visual system and document it briefly (tokens, grid, typography, cards, CTAs, responsive breakpoints). Implement in small presentation-only patches; prioritize CSS-first.
4. Self-audit each modified .tsx line: existing data/conditions/hooks/attributes/analytics/URLs and wording remain byte-identical except presentation-only wrapper/className/ARIA on new decorative elements.
5. Check mobile navigation, header CTA, all pages with populated and empty states, focus, keyboard, high-zoom and long Vietnamese copy.
6. Run pnpm lint, pnpm typecheck, pnpm test, pnpm build; run pnpm test:integration if feasible. Do not claim local CI/browser proof if toolchain lacks PostgreSQL/browsers.
7. Capture matching AFTER screenshots; compare readability, contrast, overflow, responsiveness and performance. Run the existing Playwright/axe/Lighthouse matrix where possible. Never change existing thresholds or tests to mask regressions.
8. Confirm git diff --name-only is within whitelist, no protected/config/logic files, and changes are presentational. Update from current main if necessary and revalidate exact new HEAD.
9. Push the UI branch and open ONE PR against main linked to Issue #64. Include before/after desktop+mobile screenshot evidence, exact BASE_SHA, HEAD_SHA, touched files, test results, known limitations and explicit LOGIC_UNCHANGED assessment.
10. Leave PR unmerged. ChatGPT coordinator will independently inspect exact-head CI, Reviewer and visual diff; if failed/requested changes, repair the SAME PR. No Antigravity merge or production deploy.

## Done means

The same business website, same URL hierarchy, same CMS and contact interactions, same publication/access/rights/analytics rules, with a noticeably more refined and accessible visual presentation across all public areas. No claims about customer branding being final or deployed. Exact-head CI and reviewer evidence are required before coordinator merge.
