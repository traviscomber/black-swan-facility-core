# Orchard frontend layout audit — 2026-08-29

Status: **audit branch only — do not merge to `main` yet**.

Branch: `orchard/frontend-layout-audit`

## Scope checked

Shared shell and navigation plus the Orchard route families currently exposed by `OrchardNavigation`:

- Primary: Overview, Field, Game Plan, Work, Harvest, Orchard AI
- Planning: Crop Library, FAO Catalog, Crop Map, Auto-place, Seeds & Nursery
- Operations: Crops, Lifecycle, Care, Health, Soil, Equipment, Mobile App
- Performance: Commercial, Plan vs Actual, Decisions, Custom Charts, Notes & Insights, Season Summary, Traceability, Reports

The review is a source/layout-contract audit against `main` at the deployment containing `3c9dd09c8c454d0ce3a6ada2594004e43414e4e0`. Production requires authentication, so unauthenticated HTTP checks can validate deployment/runtime availability but cannot provide authenticated screenshot QA.

## P0 — build/runtime

- Current `main` deployment for `3c9dd09c` is READY.
- The earlier AI focus TypeScript failure was fixed before this audit and is not a current blocker.
- No merge should happen until the audit branch gets a clean preview deployment and authenticated visual QA.

## P1 — layout consistency

### 1. Navigation changes vertical position between modules

Two page-shell patterns coexist:

A. Custom-hero pages generally render `OrchardNavigation` first, then the page body/hero.

B. Pages using `PageHeader` generally render `PageHeader` first and `OrchardNavigation` second.

This means the core Orchard navigation moves above/below the hero/title depending on route. The final layout contract should be:

`App chrome → Orchard navigation → page identity/hero → content`

The navigation should not jump to a different vertical location when the user changes module.

### 2. Duplicate hero stacks

`PageHeader` automatically turns many Orchard routes into a photographic hero. Several of those same pages then render a second large photographic/visual hero in their body.

Confirmed duplicate stacks include:

- Game Plan
- Crops
- Seeds & Nursery
- Custom Charts
- Notes & Insights
- Season Summary
- Traceability
- Reports

This creates 500–700+ px of identity/hero material before the primary operational content on desktop and is especially expensive on mobile.

Target contract: **one dominant hero maximum per page**. If a module owns a richer contextual hero, the shared `PageHeader` should be compact for that route.

### 3. Content width is inconsistent

The strongest custom pages use `mx-auto w-full max-w-[1560px]` while several PageHeader-era pages use only `p-4 sm:p-8` and therefore expand across the entire available content area on ultrawide displays.

Target contract: `max-w-[1560px]` for standard Orchard workspaces, with explicit full-bleed exceptions only for spatial/canvas experiences.

### 4. Top spacing varies by shell generation

Current pages mix `pt-4`, `sm:pt-6`, `space-y-6`, `space-y-10`, and PageHeader-owned spacing. With the duplicated header/hero pattern this compounds into uneven first-content positions.

Target contract:

- 16 px mobile page gutter
- 24 px tablet
- 32 px desktop
- 24–32 px standard vertical section gap
- hero-to-first-content gap controlled once by the page frame

## P1 — responsive/mobile

### 5. Orchard navigation needs one predictable sticky behavior

The primary row horizontally scrolls on mobile, while grouped menus open as fixed-position panels. The shell should be tested and normalized around a sticky navigation row with dropdown panels constrained to the viewport height.

### 6. Dense operational grids need a shared mobile collapse rule

Several modules use 3–5 column metric or signal grids. They mostly collapse, but the breakpoint and card density vary. Standardize metrics as 2 columns on small screens and operational cards as 1 column until there is enough width for 2.

### 7. Sticky side panels assume a common top offset

Charts and Notes & Insights use sticky builders/side panels (`top-24`). This should be tied to the final navigation/header stack so sticky content never sits under navigation or leaves an unexplained gap.

## P2 — visual system consistency

### 8. Authored rounded/shadow styles conflict with Orchard brand CSS

The shared Orchard brand CSS deliberately removes rounded corners, shadows, and Tailwind gradient classes inside `main`, while several newer pages still author `rounded-2xl/3xl`, `shadow-2xl`, and similar styles. Runtime becomes square/flat, but the source communicates a different design system.

Choose one contract and make the source match it. Current Black Swan direction favors the square/flat contract.

### 9. Hero component ownership is split

There are now three hero systems:

- shared `PageHeader` Orchard hero
- bespoke photographic page heroes
- compact generic `PageHeader` on excluded routes

Keep the three capabilities, but make hero ownership explicit per route instead of implicit pathname behavior plus page-local hero markup.

### 10. AI-created record focus banner can stack above an already tall hero

Care, Health, Harvest and Commercial can now show the Orchard AI created-record focus layer. The component is useful, but on hero-heavy routes it can create another top-of-page layer. It should sit below the persistent navigation and above content, without introducing a third identity region.

## P2 — route observations

- **Overview**: strong custom hero, max-width shell; keep as reference for primary custom pages.
- **Field**: strong custom hero and responsive quick-action cards; keep as reference for field-first layouts.
- **Game Plan**: shared hero + selected-plan contextual hero; collapse to one dominant hero.
- **Work**: navigation-first structure; preserve.
- **Harvest**: compact/shared header behavior should be checked against its operational content; no second photographic shared hero because the route is excluded from Orchard auto-hero.
- **Orchard AI**: intentionally compact PageHeader; chat viewport is the primary surface. Keep identity chrome minimal.
- **Library / FAO / Crop Map / Auto-place**: shared hero is appropriate unless a page introduces another lead hero. Normalize nav placement and max width.
- **Seeds & Nursery**: shared photographic hero + a second 210px propagation hero. Use the propagation hero as the module hero and compact the shared header.
- **Crops**: confirmed shared operations hero + 340px operations hero. Must collapse to one.
- **Lifecycle / Care / Health / Soil / Equipment**: bespoke hero family is internally coherent; use it as the Operations reference pattern.
- **Mobile App**: verify against the same navigation/top-spacing contract while preserving mobile-first interaction density.
- **Commercial / Performance / Decisions**: bespoke premium family is coherent; normalize shell width/top spacing only.
- **Charts**: confirmed shared performance hero + 280px Visual Intelligence Studio hero. Must collapse to one.
- **Notes & Insights**: confirmed shared performance hero + 300px Farm Intelligence hero. Must collapse to one.
- **Season Summary**: confirmed shared performance hero + 320px operational-close hero. Must collapse to one.
- **Traceability**: confirmed shared performance hero + lineage hero. Must collapse to one.
- **Reports**: confirmed shared performance hero + reporting-layer hero. Must collapse to one.

## Proposed fix order on this branch

1. Establish one Orchard shell contract: navigation first, consistent max width/gutters.
2. Add explicit compact-vs-photographic mode to `PageHeader` rather than relying only on pathname inference.
3. Remove duplicate hero stacks on Game Plan, Crops, Nursery, Charts, Analytics, Season Summary, Traceability and Reports.
4. Normalize sticky top offsets after the final navigation height is known.
5. Normalize mobile metric grids and viewport-constrained group menus.
6. Remove source-level rounded/shadow classes where Orchard brand CSS intentionally neutralizes them.
7. Preview-deploy the branch and perform authenticated desktop + mobile visual QA before merge.

## Merge gate

Do **not** merge this branch to `main` until all of the following pass:

- preview build READY
- no horizontal overflow at 375 / 768 / 1440 widths
- navigation stays in the same structural position across every Orchard route
- maximum one dominant hero per route
- first operational action is visible without excessive scrolling
- sticky panels do not overlap navigation
- AI focus banner does not obscure hero or controls
- EN/ES labels do not cause navigation or card overflow
- authenticated route-by-route visual QA complete
