# BlackSwan OS Navigation Implementation Plan

## Objective

Reorganize BlackSwan around six stable areas — Today, Operations, People, Places & Assets, Finance, Network — while preserving every existing route, permission boundary, workflow, badge, deep link, and domain behavior. Santiago, Raimundo, and Tomas remain perspectives on one OS, not separate applications. Bed Booking remains the reference temporal interaction language.

## Non-negotiable regression contract

- No existing domain route is renamed or removed.
- `useEffectiveAccess()` and server-side authorization remain authoritative.
- Existing sidebar finance pending counts, language switching, search, logout, mobile behavior, admin gating, action gating, department gating, and sub-items remain functional.
- `/bookings/invoices` and all invoice/payment business logic remain behaviorally untouched; navigation may regroup links only.
- Existing Bed Booking interactions and E2E must remain green.
- Every stage must be independently deployable and leave all legacy pages directly reachable.

## Task 1 — Introduce a pure six-area navigation taxonomy with regression tests

**Create:** `lib/os/navigation.ts`  
**Create:** `tests/os-navigation.test.ts`  
**Modify:** `package.json`

Define a pure navigation model that contains no React, Supabase, or user-name logic:

```ts
export type OsAreaKey =
  | 'today'
  | 'operations'
  | 'people'
  | 'places-assets'
  | 'finance'
  | 'network'

export type OsNavItem = {
  key: string
  nameKey: string
  href: string
  area: OsAreaKey
  tipKey: string
  adminOnly?: boolean
  action?: string
  department?: string
  badge?: 'finance_pending'
  subItems?: Array<{ nameKey: string; href: string; icon: string }>
}

export type OsArea = {
  key: OsAreaKey
  labelKey: string
  descKey: string
  href: string
  items: OsNavItem[]
}

export function resolveAreaForPath(pathname: string): OsAreaKey | null
export function filterOsAreas(
  areas: OsArea[],
  access: { is_admin: boolean },
  can: (action: string) => boolean,
  canAccessDepartment: (department: string) => boolean,
): OsArea[]
```

Map current links without changing their hrefs. Minimum route assertions:

- Operations: `/bookings`, `/activities-calendar`, `/tasks`, `/checklists`, `/procurement`, `/maintenance`, `/issues`, `/bookings/requests`.
- People: `/employees` plus authorized people/member surfaces already exposed by the app.
- Places & Assets: `/property-management`, `/inventory`, `/energy`, `/map`, `/orchard`, `/vineyard`, `/cattle`, `/cattle-health`, `/combustibles`.
- Finance: `/budgets`, `/budgets/approvals`, `/budgets/documents`, `/budgets/reconciliation`, `/accounting`, `/bookings/invoices`.
- Network: `/os/discovery` and existing network/event-community OS surfaces.
- Today: `/os` as the additive OS home/hub.

Test first:

```bash
node --experimental-strip-types --test tests/os-navigation.test.ts
```

Expected initial result: FAIL because `lib/os/navigation.ts` does not exist.

Then implement the minimum taxonomy and filtering. Tests must verify exactly six area keys, path preservation, permission filtering, and absence of any Santiago/Raimundo/Tomas name-based branching.

Add `test:os-navigation` and append the test to `prebuild` without changing unrelated dependency versions.

Verification:

```bash
node --experimental-strip-types --test tests/os-navigation.test.ts
pnpm prebuild
```

Commit only this slice.

## Task 2 — Rewire the existing sidebar to render six areas without losing existing behavior

**Modify:** `components/sidebar.tsx`  
**Modify:** `lib/translations/shell.ts`  
**Test:** `tests/os-navigation.test.ts`

Replace the local module-centric `navigationGroups` declaration with the tested taxonomy from `lib/os/navigation.ts`. Keep the existing runtime behavior in `Sidebar`:

- `useEffectiveAccess()` stays unchanged and supplies `access`, `can`, `canAccessDepartment`.
- Existing finance pending count query/event listener stays unchanged.
- Existing route localization helpers stay compatible with `/en`, `/es`, `/de`.
- Existing search command, language switcher, user identity, logout, mobile overlay, active-route expansion, child sub-items, and badges stay intact.
- Admin and AI Ops remain secondary/permission-gated utilities rather than disappearing.
- Concierge remains reachable even as it becomes a global product affordance later.

Add shell translations in all three languages for:

```text
Today / Hoy / Heute
Operations / Operaciones / Betrieb
People / Personas / Personen
Places & Assets / Lugares y Activos / Orte & Anlagen
Finance / Finanzas / Finanzen
Network / Red / Netzwerk
```

Do not rename any existing translation keys needed by legacy pages.

Verification:

```bash
node --experimental-strip-types --test tests/os-navigation.test.ts
pnpm lint
pnpm build
```

Manually inspect the diff to ensure no invoice/payment implementation file changed.

Commit this slice.

## Task 3 — Turn `/os` into the additive Today command surface while preserving authorized module access

**Modify:** `components/os-home.tsx`  
**Modify:** `app/os/page.tsx` only if a small wrapper change is needed  
**Create:** `tests/os-home-contract.test.ts`  
**Modify:** `package.json`

Keep the current call to `${NEXT_PUBLIC_BLACK_SWAN_OPERATIONS_API_URL}/v1/os/navigation` as the server-authorized source of OS modules. Do not replace it with browser role inference.

Change `OsHome` from a flat card grid into a Today-oriented surface that:

- continues to expose every server-authorized item returned today;
- groups links through the six-area taxonomy when possible;
- presents role/member badges already returned by the API;
- degrades gracefully if a summary source fails;
- does not introduce any write path;
- keeps direct `/os/<workspace>` routes unchanged.

Use `?area=operations|people|places-assets|finance|network` to render lightweight area-hub views from the same component rather than creating a second parallel route tree. `/os` with no area remains Today.

The contract test should assert that `OsHome` still consumes `/v1/os/navigation` and that area selection is an additive presentation layer, not a route replacement.

Verification:

```bash
node --experimental-strip-types --test tests/os-home-contract.test.ts
pnpm prebuild
pnpm build
```

Do not change `app/page.tsx` yet; the root currently redirects to `/bookings`, so existing landing behavior remains unchanged during this stage.

Commit this slice.

## Task 4 — Add profile-sensitive ordering using access shapes, not names

**Modify:** `lib/os/navigation.ts`  
**Modify:** `components/sidebar.tsx` and/or `components/os-home.tsx` only as needed  
**Extend:** `tests/os-navigation.test.ts`

Add a pure ranking helper that accepts the existing effective access snapshot, not a person name:

```ts
export function rankAreasForAccess(
  areas: OsArea[],
  access: {
    is_admin: boolean
    role: string
    departments: string[]
    allowed_actions: string[]
  },
): OsArea[]
```

Use current permissions/departments to adjust secondary ordering and Today priorities while preserving the same six-area mental model. Create test fixtures representing three realistic access shapes corresponding to the existing Santiago, Raimundo, and Tomas perspectives, but do not encode their names in production code.

Tests must prove:

- all authorized perspectives resolve through the same taxonomy;
- unauthorized children disappear;
- areas with no authorized children can disappear;
- direct URLs are not rewritten by ranking;
- admin privileges do not become the default for other access shapes.

Verification:

```bash
node --experimental-strip-types --test tests/os-navigation.test.ts
pnpm prebuild
```

Commit this slice.

## Task 5 — Make Concierge/AI globally reachable with route context, without broadening permissions

**Create:** `lib/os/route-context.ts`  
**Create:** `tests/os-route-context.test.ts`  
**Modify:** `components/app-layout.tsx`  
**Modify:** `lib/translations/shell.ts`

Create a pure context builder:

```ts
export function buildOsRouteContext(pathname: string) {
  return {
    pathname,
    area: resolveAreaForPath(pathname),
  }
}
```

Add a small global shell affordance that links to the existing Concierge and, for users who already have admin/AI access, existing AI Ops. Pass current route context through query parameters such as `from` and `area`; do not add a new execution API and do not bypass existing page authorization.

Do not remove `app/concierge/page.tsx` or `app/ai-ops/page.tsx`; they remain canonical existing surfaces.

Verification:

```bash
node --experimental-strip-types --test tests/os-route-context.test.ts
pnpm lint
pnpm build
```

Commit this slice.

## Task 6 — Establish a reusable Bed Booking temporal foundation without changing Bed Booking behavior

**Create:** `lib/calendar/temporal-foundation.ts`  
**Create:** `tests/temporal-foundation.test.ts`  
**Modify:** `components/calendar/timeline-row.tsx` only to import/re-export proven shared constants/helpers  
**Do not rewrite:** `components/calendar/timeline-grid.tsx`

Start with the stable geometry already used by Bed Booking:

```ts
export const DAY_WIDTH = 96
export const LABEL_WIDTH = 272
export const ROW_HEIGHT = 44

export function temporalSpanGeometry(
  startsOn: string,
  endsOn: string,
  visibleDates: Date[],
): { left: number; width: number }
```

Write tests first that lock current geometry semantics. Refactor only enough for Bed Booking and a second consumer to share the same temporal language. No visual redesign of Bookings in this task.

Verification must include all booking regression gates:

```bash
node --experimental-strip-types --test tests/temporal-foundation.test.ts
pnpm test:booking
pnpm build
pnpm test:e2e:booking
```

If Booking E2E fails, stop and restore behavior before continuing.

Commit this slice.

## Task 7 — Convert Activities Calendar into the second Bed Booking-style temporal consumer while preserving CRUD

**Create:** `components/activities/activities-timeline.tsx`  
**Create:** `lib/activities/activities-timeline.ts`  
**Create:** `tests/activities-timeline.test.ts`  
**Modify:** `app/activities-calendar/page.tsx`

Keep the existing domain contract exactly:

- same `activities` table query;
- same `activity_types` query;
- same `ActivityFormDialog`;
- same create/edit/delete behavior;
- same search and type filters;
- same route `/activities-calendar`.

Move normalization/geometry to a pure helper. Use activity type as the initial timeline resource grouping because it already exists as a stable domain dimension. Keep date navigation and an optional compact upcoming list, but make the Bed Booking-style horizontal timeline the primary temporal view.

Test normalization first:

```ts
normalizeActivitiesForTimeline(activities, activityTypes, dates)
```

Assertions: correct row grouping, start/end span, single-day events, filtered events, and no mutation of source records.

Verification:

```bash
node --experimental-strip-types --test tests/activities-timeline.test.ts
pnpm test:booking
pnpm lint
pnpm build
pnpm test:e2e:booking
```

Commit this slice.

## Task 8 — Final compatibility gate before any integration to `main`

**Create:** `tests/os-compatibility.test.ts`  
**Modify:** `package.json` to include the compatibility test in `prebuild`

Create a regression inventory of critical routes and file boundaries. The test should assert that taxonomy hrefs remain the established URLs and that the six-area navigation does not require new domain endpoints.

Run the full verification set from the exact branch head:

```bash
pnpm prebuild
pnpm lint
pnpm build
pnpm test:e2e:booking
```

Then inspect changed files:

```bash
git diff --name-only main...HEAD
```

Hard stop if the implementation changed any invoice/payment business-logic surface, including payment/invoice migrations, payment RPC definitions, or the internals of `app/bookings/invoices/**`. A navigation configuration reference to the existing `/bookings/invoices` URL is allowed; its behavior is not.

Also verify that no existing child navigation item from the current sidebar disappeared without being intentionally mapped into one of the six areas or retained as Admin/global utility.

Only after all tests/build/E2E are green should the branch be eligible for direct fast-forward or another user-requested integration path. Do not create a PR unless explicitly requested.

## Delivery discipline

Implement tasks sequentially. Each task starts with a failing focused test, makes the smallest code change to pass, then runs the listed regression commands before committing. Do not combine calendar migration with navigation refactors in one commit. Do not alter domain APIs to make the shell easier to build. The navigation layer adapts to existing functionality; existing functionality does not adapt to the navigation layer.
