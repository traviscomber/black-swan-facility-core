# Blackswan Facility Core — Canonical Roadmap

Last updated: 2026-08-08

This file is the canonical execution roadmap for Blackswan Facility Core.

Historical audit, phase, fix and implementation reports remain useful evidence, but they do not define current priority or completion. When another planning document conflicts with this file, `ROADMAP.md` wins unless explicitly superseded.

## Operating rule: stages must end

We do not keep an audit or hardening phase open indefinitely.

A stage closes when its explicit exit gates are satisfied. Non-blocking findings discovered during closure are moved to a later stage or backlog. Only a new P0/P1 that violates a current exit gate can extend the stage.

Release verdicts remain separate from stage completion:

- `PASS`: all required release gates have current evidence.
- `HOLD`: no known P0, but a required release check is pending, failing or externally blocked.
- `BLOCK`: a P0 or unsafe integrity/security condition exists.

A stage may be completed while the overall product remains `HOLD` for an external or later-stage gate.

If an active stage is blocked exclusively by an external dependency that cannot be resolved from the repository or connected systems, mark it `BLOCKED EXTERNAL` and allow the next independent stage to run in parallel. If closure requires an explicit business/data decision or authorization that the engineering system cannot make safely, mark it `BLOCKED USER DECISION` and continue the next independent stage. Do not pretend a blocked stage is complete.

---

## Stage 0 — Baseline product and deployment

Status: COMPLETE

Outcome:

- production application exists and is deployed through Vercel;
- Supabase is the canonical operational database;
- GitHub `main` is the source branch;
- Hospitality reservation/calendar is the primary operational surface;
- canonical locales are English, Spanish and German (`/en`, `/es`, `/de`).

This stage is closed and must not be reopened for ordinary defects.

---

## Stage 1 — Hospitality foundation, localization and interaction architecture

Status: COMPLETE WITH RELEASE DEBT

Completed scope:

- core Hospitality reservation surfaces and supporting modules;
- localization architecture for `en/es/de` and `/deu -> /de` normalization;
- booking integrity protections including database-level conflict checks;
- calendar pointer/keyboard/touch E2E harness and isolated interaction cases;
- production runtime remains independently observable through Vercel.

Known release debt carried forward:

- booking-calendar E2E is not green;
- GitHub Actions is externally blocked from starting jobs by account billing/spending limits;
- pointer movement still requires a successful current-run E2E proof.

These items belong to Stage 3 and do not reopen Stage 1.

---

## Stage 2 — Data integrity, authorization and canonical ownership

Status: COMPLETE

Objective achieved:

Postgres/Supabase now acts as a deliberate product boundary with canonical ownership, database-level invariants for critical data, least-privilege authorization and preserved operational history.

### Completed and verified

- no `SECURITY DEFINER` function remains executable by `anon` in the audited `public` surface;
- no authenticated write policy remains literally open with `USING true` / `WITH CHECK true`;
- destructive reservation/financial FK chains were replaced with history-preserving behavior;
- reservation scope is normalized from `bed -> room -> location` for future writes;
- payments act as the monetary ledger and project `reservations.payment_status` automatically;
- critical Hospitality/Finance RPCs enforce action permissions and operational scope;
- rooms, beds, logistics, room blocks, approvals, Finance, Procurement, Inventory, Infrastructure, Fuel, Housekeeping, SOP execution and Cattle child writes were hardened;
- guest PII and message access are scope-aware when operational scopes are enabled;
- AI sessions/executions now have ownership for new records and child records inherit access;
- `canonical_event_xls` imports now have durable source-participant lineage for new reservations;
- a reconciliation queue exists for legacy imported reservations without automatic identity assignment;
- `operational_events` no longer exposes financial totals through a global authenticated read: the base-table read requires Finance/Procurement permission and Hospitality has a non-financial operational RPC;
- Stage 2 final hardening contract is versioned in `supabase/migrations/20260808022000_stage2_hardening_contract.sql`;
- deterministic role checks confirmed admin/approver permissions, operator restrictions and scoped-location allow/deny behavior.

Post-closure P1 fixes do not reopen Stage 2: booking-message creation is now booking-scope aware; operational tasks and child records inherit task scope; supplier approval uses the canonical `procurement.manage` permission and writes an audit event. `anon` executable `SECURITY DEFINER` functions remain at zero after these fixes.

### Exit gates

- [x] Security invariants.
- [x] Schema versioning.
- [x] Effective role matrix.
- [x] Mixed-data contract.

### Closure rule

Stage 2 is closed. Do not resume broad RLS/security fishing unless a new reproducible P0/P1 violates one of the completed invariants.

---

## Stage 3 — Release reliability and deterministic QA

Status: BLOCKED EXTERNAL

Objective:

Make releases reproducible and make `HOLD/PASS` depend on current automated evidence rather than manual confidence.

Current evidence:

- GitHub Actions refuses to start the calendar job because recent account payments failed or the Actions spending limit must be increased; the job has zero executed steps and no assigned runner;
- current production `main` deployment is `READY` in Vercel;
- no production runtime errors were found in the explicit last-one-hour Vercel query;
- unauthenticated locale/auth smoke passes for `/en/bookings`, `/es/bookings`, `/de/bookings` and legacy `/deu/bookings`.

Exit gates:

- [ ] **BLOCKED EXTERNAL:** GitHub Actions can start jobs again.
- [ ] **BLOCKED BY CI:** booking-calendar E2E passes current `main` for required Chromium/WebKit/Firefox scenarios.
- [ ] **BLOCKED BY CI:** current-run failures can be separated into product/test/browser/infrastructure causes with retained evidence.
- [ ] **PARTIAL:** Vercel is `READY` and recent runtime is clean; same-tested-SHA evidence waits for CI.
- [x] Critical unauthenticated locale/auth smoke passes for `/en`, `/es`, `/de` and `/deu` normalization.

Do not modify CI merely to work around account billing. Resume Stage 3 immediately when GitHub Actions can assign a runner again.

---

## Stage 4 — Canonical data operations and observability

Status: BLOCKED USER DECISION

Objective:

Turn the hardened schema into an operationally maintainable data system.

Completed in this stage:

- the legacy import reconciliation queue remains explicit: 2 deterministic, 3 candidate and 2 manual-review cases;
- `get_canonical_data_health(location_id)` is versioned and deployed as a read-only, repeatable health contract;
- the global current health report shows zero reservation-scope drift, zero invalid reservation dates, zero payment-projection drift and zero detached payments/invoices;
- scoped health access was tested: an allowed location succeeds, a different location is denied and a scoped user cannot request a global aggregate;
- known legacy import debt is reported as `warning`, not hidden as a false healthy state.

Exit gates:

- [ ] **BLOCKED USER DECISION:** resolve the 2 deterministic legacy identity/lineage cases. This writes canonical production identity links and requires explicit human authorization.
- [x] manual-review and candidate cases remain explicit and traceable rather than silently guessed.
- [x] canonical drift checks can run repeatedly and report zero/known exceptions.
- [x] data-health outputs respect role/scope boundaries.

Stage 4 is functionally complete except for the explicit production identity decision. Do not auto-link or merge legacy identities from names alone.

---

## Stage 5 — Hospitality operational completion

Status: COMPLETE WITH VERIFICATION DEBT

Objective achieved:

Hospitality now has canonical day-to-day workflows for reservations, check-in/out, financial state, Housekeeping, Hospitality requests, logistics and shift handovers without requiring direct SQL/table-state editing for the audited primary shift flows.

Completed in Stage 5:

- primary operations panel routes Housekeeping and Hospitality state changes through canonical RPCs;
- reservation confirmation and checkout route through `transition_reservation_status()` instead of direct client updates;
- direct manual editing of reservation `payment_status` was removed; payment status is ledger/folio-derived;
- legacy unbilled `canonical_event_xls` reservations without financial evidence project `not_required` rather than fake receivables;
- debt-free reservations can check out without an artificial invoice when no receivable exists;
- dedicated Housekeeping page uses canonical assignment/start/complete transitions;
- checkout Housekeeping synchronization uses the idempotent reservation lifecycle instead of creating a second ad-hoc `checkout_cleaning` task type;
- dedicated Hospitality Requests page uses canonical workflow states, requires assignment before execution/closure and no longer triggers a hardcoded WhatsApp side effect;
- booking message creation is scope-aware and delivery/inbound state remains controlled by the messaging workflow;
- reservation logistics has an auditable scoped lifecycle `draft -> planned -> confirmed -> completed` plus controlled cancellation;
- shift handovers have a complete auditable lifecycle with pending-item acknowledgement/resolution/carry-forward;
- handovers require a property/location, respect booking scope, and cannot mix reservation/logistics records from another property;
- the Handovers workspace is integrated into Bookings navigation with EN/ES/DE labels;
- structural property creation/update is restricted to admin/approver rather than any authenticated user.

Exit gates:

- [x] primary audited shift workflows can be completed without fallback spreadsheets/manual DB state changes.
- [x] database integrity prevents silent double booking and inventory conflict paths in audited canonical writes.
- [x] consequential audited shift writes have controlled success/failure paths and critical transitions emit audit state.
- [ ] **VERIFICATION DEBT / STAGE 3:** desktop and mobile primary workflows require current visual/interaction verification and booking-calendar multi-browser E2E.

Closure rule:

Stage 5 is closed for product/engineering scope. Visual, touch, keyboard and cross-browser proof remains release verification debt owned by Stage 3 and does not keep Hospitality implementation open indefinitely. A new reproducible P0/P1 in a primary Hospitality flow may reopen a bounded fix, not the whole stage.

---

## Stage 6 — Cross-domain operating-system consistency

Status: ACTIVE

Objective:

Apply the proven authorization, lifecycle, audit and UI patterns consistently across Maintenance, Inventory, Purchasing, Properties, People, Livestock, Vineyard, Energy, GIS and Administration.

First execution order:

1. establish canonical location relationships for Inventory/Procurement/Fuel where current models still use warehouse/display strings;
2. define explicit owner/lifecycle/audit contracts for the highest-frequency consequential writes;
3. eliminate direct client state mutation where a domain workflow requires controlled transitions;
4. align shared navigation, loading/empty/error states and role visibility using the existing application shell;
5. stop after each domain reaches its stated exit gate; do not repeat broad security fishing already closed in Stage 2.

Known model prerequisite: geographic scoping for Procurement/Inventory/Fuel requires stable canonical location relationships. Current `warehouses`, procurement delivery location and fuel location models do not all expose a `locations.id` FK, so do not emulate tenant/location isolation from display strings.

Exit gates:

- [ ] each active module has explicit canonical entities and ownership;
- [ ] each consequential write has a permission/lifecycle/audit contract;
- [ ] shared navigation, states and design patterns are consistent;
- [ ] no module introduces a weaker security pattern than the hardened core.

---

## Stage 7 — AI and automation safety layer

Status: PLANNED

Objective:

Make AI/agent capabilities useful without turning them into an unbounded privileged side channel.

Exit gates:

- [ ] AI session/execution ownership is complete for active records;
- [ ] consequential AI writes require explicit policy/human approval unless separately authorized;
- [ ] model/tool actions, sources and outcomes are auditable;
- [ ] context/artifacts cannot cross unauthorized user/scope boundaries;
- [ ] deterministic business rules remain outside model judgment.

---

## Stage 8 — Product differentiation and premium UX

Status: PLANNED

Objective:

Use the stable operating core to build differentiated workflows, decision support and a coherent premium interface.

Focus:

- operational intelligence driven by trustworthy canonical data;
- fewer clicks and faster high-frequency workflows;
- role-specific decision surfaces rather than generic dashboards;
- consistent design system, responsive behavior and accessibility;
- measurable operational value before decorative or speculative features.

---

## Current execution order

1. Execute Stage 6 domain-by-domain, starting with the location model required by Inventory/Procurement/Fuel.
2. Resume Stage 3 immediately when GitHub Actions can start jobs; require same-SHA CI + Vercel before changing release `HOLD`.
3. Close Stage 4 only after explicit authorization resolves the 2 deterministic production lineage cases.
4. Keep Stage 5 closed unless a new reproducible P0/P1 appears in a primary Hospitality workflow.
5. AI and differentiation remain later stages, not distractions from operating-system consistency.

## Current global release verdict

`HOLD`

Reason: Stage 2 and Stage 5 implementation scope are complete; Stage 4 health is controlled and known legacy identity cases are explicit; production deployment remains healthy. Release evidence is still blocked by GitHub Actions billing/spending and booking-calendar E2E plus current desktop/mobile interaction verification cannot run to completion.
