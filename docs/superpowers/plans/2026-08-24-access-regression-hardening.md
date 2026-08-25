# BlackSwan Access & Regression Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Align BlackSwan navigation, route access, RPC/RLS enforcement, People privacy, Map/GIS security, and browser regression coverage around one canonical capability model without changing Finance behavior.

**Architecture:** Keep `public.user_access_profiles` and `public.current_app_role()` as the role authority, then expose a capability-oriented route/access snapshot that the shell and server guards consume. Sensitive read models such as People Graph must shape payloads server-side, and browser-direct data such as Map/GIS must be protected by RLS. Browser E2E verifies representative Santiago/Raimundo/Tomas perspectives and Operations workflows while existing Booking E2E remains the baseline.

**Tech Stack:** Next.js 16, React 19, TypeScript 5, Supabase/Postgres RLS + RPC, Cloudflare Worker operations API, Node 22 test runner with `--experimental-strip-types`, Playwright 1.61.1, pnpm 10.28.0.

**Spec:** `docs/superpowers/specs/2026-08-24-access-regression-hardening-design.md`

## Global Constraints

- `public.user_access_profiles` and `public.current_app_role()` remain the canonical identity/role authority.
- Do not introduce authorization based on Santiago, Raimundo, Tomas, display names, JWT `app_metadata`, employee email, or employee title.
- Navigation hiding is never the security boundary; RPC/RLS/server enforcement remains mandatory.
- A normal Member may see the basic Member directory but not other Members' private presence, guests, invitation windows, guest state, or private hosting linkage.
- Discovery behavior is regression-only; do not redesign it.
- Finance, invoice/payment lifecycle, financial RPCs, and financial workflows are functionally frozen; only regression assertions may be added.
- Existing routes and six-area OS taxonomy remain unchanged.
- Booking E2E must remain 13/13 before merge.
- Never weaken production authorization to make E2E easier.

---

## File Structure

- `supabase/migrations/20260825*_access_capability_snapshot.sql` — capability snapshot and route-view semantics derived from existing canonical role/profile data.
- `supabase/migrations/20260825*_people_graph_privacy.sql` — server-side People Graph payload shaping for member vs operator/admin.
- `supabase/migrations/20260825*_map_gis_rls_hardening.sql` — explicit RLS enablement and policies for Map/GIS tables if the audit finds gaps.
- `lib/access/capabilities.ts` — pure TypeScript capability types/helpers shared by navigation and route tests.
- `lib/os/navigation.ts` — consume explicit view capabilities instead of write capability proxies.
- `proxy.ts` — fail-closed route guards based on canonical route-access snapshot.
- `cloudflare/workers/operations/src/index.ts` — keep workspace calls thin; map canonical forbidden RPC failures to 403 and preserve Discovery gates.
- `tests/access-capabilities.test.ts` — pure capability derivation/semantics tests.
- `tests/os-navigation.test.ts` — navigation view-vs-operate regression coverage.
- `tests/route-access-contract.test.ts` — proxy route matrix contract.
- `tests/people-graph-privacy.test.ts` — SQL/RPC contract assertions for payload shaping.
- `tests/map-gis-security.test.ts` — migration/policy contract assertions.
- `tests/discovery-privacy-regression.test.ts` — Discovery invariant checks.
- `tests/e2e/access-profiles.e2e.ts` — representative profile navigation/direct-route tests.
- `tests/e2e/activities.e2e.ts`, `tests/e2e/tasks.e2e.ts`, `tests/e2e/checklists.e2e.ts` — browser Operations coverage.
- `scripts/run-access-e2e.mjs`, `scripts/run-operations-e2e.mjs` — deterministic browser runners matching the existing Booking runner pattern.
- `package.json` — add hardening test scripts and include pure contracts in `prebuild`.

---

### Task 1: Canonical capability vocabulary and pure tests

**Files:**
- Create: `lib/access/capabilities.ts`
- Create: `tests/access-capabilities.test.ts`
- Modify: `package.json`

**Interfaces:**
- Produces: `CapabilityLevel = "view" | "operate" | "approve" | "admin"`
- Produces: `DomainCapability = { domain: string; levels: CapabilityLevel[] }`
- Produces: `RouteCapability = { route: string; domain: string; required: CapabilityLevel }`
- Produces: `hasCapability(capabilities, domain, required): boolean`
- Produces: `normalizeCapabilitySnapshot(input): CanonicalCapabilitySnapshot`

- [ ] **Step 1: Write the failing pure capability tests**

Create `tests/access-capabilities.test.ts` with assertions that capability levels are monotonic (`admin` implies approve/operate/view; `approve` implies operate/view; `operate` implies view), unknown domains fail closed, and malformed snapshots normalize to no access.

```ts
import assert from 'node:assert/strict'
import test from 'node:test'
import { hasCapability, normalizeCapabilitySnapshot } from '../lib/access/capabilities.ts'

test('capability levels are monotonic and unknown domains fail closed', () => {
  const snapshot = normalizeCapabilitySnapshot({ domains: { people: ['admin'], booking: ['view'] } })
  assert.equal(hasCapability(snapshot, 'people', 'view'), true)
  assert.equal(hasCapability(snapshot, 'people', 'operate'), true)
  assert.equal(hasCapability(snapshot, 'people', 'approve'), true)
  assert.equal(hasCapability(snapshot, 'people', 'admin'), true)
  assert.equal(hasCapability(snapshot, 'booking', 'view'), true)
  assert.equal(hasCapability(snapshot, 'booking', 'operate'), false)
  assert.equal(hasCapability(snapshot, 'unknown', 'view'), false)
})

test('malformed snapshots fail closed', () => {
  const snapshot = normalizeCapabilitySnapshot({ domains: { people: ['bogus'] } })
  assert.equal(hasCapability(snapshot, 'people', 'view'), false)
})
```

- [ ] **Step 2: Run the test and verify RED**

Run:

```bash
node --experimental-strip-types --test tests/access-capabilities.test.ts
```

Expected: FAIL because `lib/access/capabilities.ts` does not exist.

- [ ] **Step 3: Implement the minimal pure helper**

Implement ordered levels and strict input filtering in `lib/access/capabilities.ts`. Do not infer roles or person names here; this file only interprets a capability snapshot.

- [ ] **Step 4: Re-run and verify GREEN**

Run the same Node test command; expected 2/2 pass.

- [ ] **Step 5: Add the test to `prebuild`**

Add `node --experimental-strip-types --test tests/access-capabilities.test.ts` before `pnpm test:os` in `package.json`.

- [ ] **Step 6: Commit**

```bash
git add lib/access/capabilities.ts tests/access-capabilities.test.ts package.json
git commit -m "test: define canonical capability semantics"
```

---

### Task 2: Canonical route-access snapshot from Supabase

**Files:**
- Create: `supabase/migrations/20260825090000_expand_canonical_route_access.sql`
- Create: `tests/route-access-contract.test.ts`
- Modify: `package.json`

**Interfaces:**
- Consumes: `CapabilityLevel` semantics from Task 1.
- Produces RPC: `public.get_current_route_access()` returning `{ role_key, is_admin, can_approve_procurement, capabilities }`.
- `capabilities` shape: JSON object keyed by domain with arrays containing only `view|operate|approve|admin`.

- [ ] **Step 1: Write the failing contract test**

Assert the migration derives from `public.current_app_role()`, emits a `capabilities` object, does not inspect JWT `app_metadata`, names, employee email, or employee title, and revokes public execution.

```ts
const sql = readFileSync(new URL('../supabase/migrations/20260825090000_expand_canonical_route_access.sql', import.meta.url), 'utf8')
assert.match(sql, /current_app_role\(\)/)
assert.match(sql, /'capabilities'/)
assert.doesNotMatch(sql, /app_metadata|employees\s+e|full_name|lower\(coalesce\(e\.email/i)
assert.match(sql, /revoke all on function public\.get_current_route_access\(\) from public/i)
```

- [ ] **Step 2: Run and verify RED**

```bash
node --experimental-strip-types --test tests/route-access-contract.test.ts
```

Expected: FAIL because the migration does not exist.

- [ ] **Step 3: Implement the migration minimally**

Replace `get_current_route_access()` with a backward-compatible JSON response retaining `role_key`, `is_admin`, and `can_approve_procurement`, plus domain capabilities derived only from canonical role/profile/legal-entity/department access helpers that already exist. Do not copy legacy Finance employee/email authorization helpers.

At minimum, represent domains used by the new OS shell: `booking`, `operations`, `people`, `places_assets`, `finance`, `network`, `admin`, `procurement`, `maintenance`, `inventory`, `orchard`, `vineyard`, `cattle`, `fuel`, `map`.

- [ ] **Step 4: Run contract tests and prebuild subset**

```bash
node --experimental-strip-types --test tests/access-capabilities.test.ts tests/route-access-contract.test.ts
pnpm test:os
```

Expected: all pass.

- [ ] **Step 5: Add route contract to `prebuild` and commit**

```bash
git add supabase/migrations/20260825090000_expand_canonical_route_access.sql tests/route-access-contract.test.ts package.json
git commit -m "feat: expose canonical route capability snapshot"
```

---

### Task 3: Make OS navigation consume view capabilities

**Files:**
- Modify: `lib/os/navigation.ts`
- Modify: `components/app-sidebar.tsx`
- Modify: `tests/os-navigation.test.ts`

**Interfaces:**
- Consumes: `CanonicalCapabilitySnapshot` and `hasCapability()` from Task 1.
- Produces: each `OsNavItem` has an explicit `viewDomain` instead of using write actions as a proxy for visibility.
- Existing `action`/`department` metadata may remain for operational controls but must not be the sole visibility gate.

- [ ] **Step 1: Add failing navigation tests**

Add cases proving a user with `booking:view` but not `booking:operate` still sees Bookings, a user without `map:view` does not see Map, and server-authorized OS modules remain excluded from static client filtering.

- [ ] **Step 2: Run RED**

```bash
pnpm test:os-navigation
```

Expected: the new read-only visibility assertions fail against current `booking.modify`/department filtering.

- [ ] **Step 3: Implement explicit view-domain filtering**

Add `viewDomain` to each relevant nav item and update `filterOsAreas` to accept the normalized capability snapshot. Preserve six-area ordering/ranking and current routes. Keep server-authorized items hidden until server navigation data authorizes them.

- [ ] **Step 4: Update sidebar integration**

Convert the server route-access payload to `CanonicalCapabilitySnapshot` and pass it to `filterOsAreas`. Existing badges and secondary links must remain unchanged.

- [ ] **Step 5: Run GREEN**

```bash
pnpm test:os-navigation
pnpm test:os
```

Expected: pass.

- [ ] **Step 6: Commit**

```bash
git add lib/os/navigation.ts components/app-sidebar.tsx tests/os-navigation.test.ts
git commit -m "feat: drive OS navigation from view capabilities"
```

---

### Task 4: Align direct route guards with canonical capabilities

**Files:**
- Modify: `proxy.ts`
- Modify: `tests/route-access-contract.test.ts`

**Interfaces:**
- Consumes RPC payload from Task 2.
- Produces deterministic page behavior: forbidden protected page redirects to the nearest allowed OS area or `/`; API requests continue to return 401/403.

- [ ] **Step 1: Extend failing route contract tests**

Assert explicit route families map to view capabilities: `/bookings`→`booking:view`, `/employees` and `/os/people`→`people:view`, `/map`→`map:view`, `/activities-calendar|/tasks|/checklists`→`operations:view`, `/admin`→`admin:admin`. Assert localized requests are normalized before checks.

- [ ] **Step 2: Run RED**

```bash
node --experimental-strip-types --test tests/route-access-contract.test.ts
```

- [ ] **Step 3: Implement pure route requirement mapping in `proxy.ts`**

Add a small route-to-capability resolver adjacent to existing `isAdminPath`/`isProcurementPath`. Parse the RPC `capabilities` object and fail closed if the snapshot is missing or malformed for a route that has an explicit requirement. Preserve existing Admin and Procurement semantics for backward compatibility while migrating them to the same capability check.

- [ ] **Step 4: Verify auth behavior contracts**

Ensure unauthenticated API = 401, forbidden API = 403, forbidden page = redirect, and inability to resolve route-access data cannot grant access.

- [ ] **Step 5: Run tests**

```bash
node --experimental-strip-types --test tests/route-access-contract.test.ts
pnpm test:os
```

- [ ] **Step 6: Commit**

```bash
git add proxy.ts tests/route-access-contract.test.ts
git commit -m "feat: align route guards with canonical capabilities"
```

---

### Task 5: Harden People Graph privacy server-side

**Files:**
- Create: `supabase/migrations/20260825100000_harden_people_graph_privacy.sql`
- Create: `tests/people-graph-privacy.test.ts`
- Modify: `package.json`

**Interfaces:**
- Produces: `get_people_graph_workspace()` returns directory-safe rows to ordinary Members and full guest/presence details only to users with People `operate`/`admin` authority.
- Ordinary Members may retain their own self-service guest/presence details.

- [ ] **Step 1: Write failing privacy contract tests**

Assert the new migration distinguishes directory-safe output from operational output and does not rely on React column hiding. Assert sensitive keys (`guests`, `guest_name`, `valid_from`, `valid_until`, `can_enter_now`, cross-member `on_ground`) are gated server-side.

- [ ] **Step 2: Run RED**

```bash
node --experimental-strip-types --test tests/people-graph-privacy.test.ts
```

- [ ] **Step 3: Implement server-side payload shaping**

Rewrite `get_people_graph_workspace()` so it first determines the current member id and whether the caller has People operate/admin authority. For an ordinary Member, return directory-safe fields for all visible Members, and include sensitive guest/presence detail only on the caller's own row. For operator/admin, preserve current full operational payload.

- [ ] **Step 4: Preserve summary privacy**

Do not leak sensitive aggregate counts to ordinary Members if those counts reveal private guest/presence activity. Return only directory-safe summary fields for that audience.

- [ ] **Step 5: Run tests and OS contracts**

```bash
node --experimental-strip-types --test tests/people-graph-privacy.test.ts
pnpm test:os
```

- [ ] **Step 6: Add to `prebuild` and commit**

```bash
git add supabase/migrations/20260825100000_harden_people_graph_privacy.sql tests/people-graph-privacy.test.ts package.json
git commit -m "fix: protect People Graph private presence and guest data"
```

---

### Task 6: Audit and harden Map/GIS RLS

**Files:**
- Create: `tests/map-gis-security.test.ts`
- Create only if required by failing audit: `supabase/migrations/20260825110000_harden_map_gis_rls.sql`
- Modify: `package.json`

**Interfaces:**
- Covers tables: `infrastructure_plans`, `infrastructure_connections`, `gis_overlays` and any storage/file policy referenced by `gis_overlays.file_url`.
- Required read authority: intended Places & Assets/Map view capability or equivalent existing legal-entity view helper.
- Required writes: stricter operate/admin authority.

- [ ] **Step 1: Inventory current RLS definitions using repository migrations**

Search migrations for all three tables, `enable row level security`, select/update/insert/delete policies, and any storage bucket policies used by GIS overlays. Record exact existing policy names in the test fixture comments.

- [ ] **Step 2: Write the executable contract test**

`tests/map-gis-security.test.ts` must fail if any sensitive table lacks RLS enablement, has an unconditional authenticated `using (true)` read, permits writes with only generic authenticated status, or exposes a storage object path without a matching authorization policy.

- [ ] **Step 3: Run the audit test**

```bash
node --experimental-strip-types --test tests/map-gis-security.test.ts
```

Expected: either GREEN if existing policies are already correct, or RED with the exact missing/overbroad policy name/table.

- [ ] **Step 4: If RED, add the minimal migration**

Enable RLS where missing; replace broad policies with existing legal-entity/Map capability checks; separate SELECT from INSERT/UPDATE/DELETE; keep service-role behavior unaffected. Do not alter Map UI data shape.

- [ ] **Step 5: Run GREEN and commit**

```bash
node --experimental-strip-types --test tests/map-gis-security.test.ts
```

Commit the test alone if no migration was needed; otherwise commit test + migration together.

---

### Task 7: Preserve Discovery privacy and Worker 403 behavior

**Files:**
- Create: `tests/discovery-privacy-regression.test.ts`
- Modify if required by failing test: `cloudflare/workers/operations/src/index.ts`
- Modify: `package.json`

**Interfaces:**
- Preserve `can_use_discovery()`/`get_discovery_navigation_entitlement` gating.
- Preserve incognito identity hiding until mutual interest.
- Worker must translate forbidden RPC outcomes to HTTP 403.

- [ ] **Step 1: Write regression tests against migration and worker source**

Assert Discovery workspace uses `can_use_discovery()`, incognito counterpart fields become null/private before mutual state, Worker calls navigation entitlement before Concierge proposal/evaluation where required, and forbidden RPC errors map to 403.

- [ ] **Step 2: Run tests**

```bash
node --experimental-strip-types --test tests/discovery-privacy-regression.test.ts
```

Expected: preferably GREEN. If RED, fix only the regression uncovered; do not redesign Discovery.

- [ ] **Step 3: Add to `prebuild` and commit**

Commit tests and only necessary Worker corrections.

---

### Task 8: Representative profile browser E2E

**Files:**
- Create: `tests/e2e/access-profiles.e2e.ts`
- Create: `scripts/run-access-e2e.mjs`
- Modify: `package.json`

**Interfaces:**
- Uses isolated deterministic fixtures representing the capability sets of Santiago, Raimundo, and Tomas; production authorization remains capability-based.
- Test harness must not bypass route/RPC checks in production code.

- [ ] **Step 1: Follow the existing Booking E2E runner pattern**

The runner starts Next with an explicit E2E-only environment flag and deterministic fixture backend/session setup. It must fail if the flag is enabled in production mode without the test runner.

- [ ] **Step 2: Add failing browser cases**

For each representative perspective, assert expected area/module visibility, one allowed direct route, one forbidden direct route, and that Today/OS navigation does not expose a server-authorized module denied to that fixture.

Do not encode production access logic as `if name === "Santiago"`; fixture names are labels only, and each fixture must declare capabilities.

- [ ] **Step 3: Run RED**

```bash
pnpm test:e2e:access
```

Expected: fails until the E2E harness and route/session fixtures are wired.

- [ ] **Step 4: Implement the smallest isolated E2E harness needed**

Reuse real sidebar/proxy/capability code. Mock only external identity/data setup at a dedicated test boundary; do not mock `hasCapability` or route requirement logic.

- [ ] **Step 5: Run GREEN across Chromium first, then configured cross-browser set**

```bash
pnpm test:e2e:access
```

- [ ] **Step 6: Commit**

```bash
git add tests/e2e/access-profiles.e2e.ts scripts/run-access-e2e.mjs package.json
git commit -m "test: cover representative access profiles end to end"
```

---

### Task 9: Activities, Tasks, and Checklists browser E2E

**Files:**
- Create: `tests/e2e/activities.e2e.ts`
- Create: `tests/e2e/tasks.e2e.ts`
- Create: `tests/e2e/checklists.e2e.ts`
- Create: `scripts/run-operations-e2e.mjs`
- Modify: `package.json`

**Interfaces:**
- Uses real current domain UI behavior.
- Tests both successful authorized actions and at least one server-rejected unauthorized write per domain.
- Activities temporal behavior must remain consistent with the existing Bed Booking language already adopted by the app.

- [ ] **Step 1: Add Activities E2E cases**

Cover open calendar, create on a date, edit, reschedule where current UI supports it, and delete/cancel. Add a read-only fixture case where write controls are unavailable and a direct write attempt is rejected by the server/test boundary.

- [ ] **Step 2: Add Tasks E2E cases**

Cover list/open, create, status/assignment update according to existing UI, and forbidden write rejection.

- [ ] **Step 3: Add Checklists E2E cases**

Cover open, current create/start/complete lifecycle, direct route visibility, and forbidden mutation rejection.

- [ ] **Step 4: Implement runner and run RED→GREEN**

```bash
pnpm test:e2e:operations
```

Do not alter domain behavior merely to make a test convenient; if a flow is unavailable, test the actual supported lifecycle described by the existing UI/code.

- [ ] **Step 5: Commit**

```bash
git add tests/e2e/activities.e2e.ts tests/e2e/tasks.e2e.ts tests/e2e/checklists.e2e.ts scripts/run-operations-e2e.mjs package.json
git commit -m "test: add Operations browser regression coverage"
```

---

### Task 10: Full regression gate and Finance freeze verification

**Files:**
- Modify: `tests/os-compatibility.test.ts`
- Modify: `package.json`
- No Finance production files may be modified.

**Interfaces:**
- Produces final required verification commands.
- Protects critical Finance route continuity without changing Finance implementation.

- [ ] **Step 1: Extend compatibility contract**

Assert critical existing routes remain present, including `/budgets`, `/accounting`, and `/bookings/invoices`, and assert the hardening branch has not changed known Finance production paths/RPC migration files relative to the base commit except test-only references.

- [ ] **Step 2: Run complete pure/prebuild suite**

```bash
pnpm prebuild
```

Expected: PASS.

- [ ] **Step 3: Run production build**

```bash
pnpm build
```

Expected: PASS.

- [ ] **Step 4: Run Booking reference suite**

```bash
pnpm test:e2e:booking
```

Expected: 13/13 PASS.

- [ ] **Step 5: Run access E2E**

```bash
pnpm test:e2e:access
```

Expected: all PASS.

- [ ] **Step 6: Run Operations E2E**

```bash
pnpm test:e2e:operations
```

Expected: all PASS.

- [ ] **Step 7: Compare branch against base and inspect forbidden scope**

```bash
git diff --name-only <base-main-sha>...HEAD
```

Expected: no invoice/payment implementation, Finance RPC behavior, or unrelated domain rewrite files. If such a file appears, inspect and remove the unrelated change before proceeding.

- [ ] **Step 8: Final commit**

```bash
git add tests/os-compatibility.test.ts package.json
git commit -m "test: enforce access hardening regression gate"
```

---

## Self-Review

- Spec coverage: canonical authority → Tasks 1-4; People privacy → Task 5; Map/GIS RLS → Task 6; Discovery regression → Task 7; profile E2E → Task 8; Operations E2E → Task 9; Booking/Finance/build regression → Task 10.
- Placeholder scan: no `TBD`, `TODO`, "implement later", or undefined future interfaces are required by the plan.
- Type consistency: `CanonicalCapabilitySnapshot` and `hasCapability(snapshot, domain, required)` are introduced in Task 1 and consumed consistently by Tasks 3-4. SQL snapshot shape in Task 2 matches that TypeScript interpretation.
- Scope check: although this hardening spans several subsystems, each task produces an independently reviewable/testable security or regression deliverable, and the final gate can reject any one without requiring a broad rewrite.
