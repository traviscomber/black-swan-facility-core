# Blackswan Facility Core — Canonical Roadmap

Last updated: 2026-08-07

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

If an active stage is blocked exclusively by an external dependency that cannot be resolved from the repository or connected systems, mark it `BLOCKED EXTERNAL` and allow the next independent stage to run in parallel. Do not pretend the blocked stage is complete, and do not change the release verdict until its gates pass.

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
- Stage 2 final hardening contract is versioned in `supabase/migrations/20260808022000_stage2_hardening_contract.sql`; exact production execution provenance remains in `supabase_migrations.schema_migrations`;
- deterministic role checks confirmed admin/approver permissions, operator restrictions and scoped-location allow/deny behavior across Booking, Finance, Procurement and Housekeeping.

### Exit gates

- [x] **Security invariants:** `anon SECURITY DEFINER = 0`, open authenticated writes = 0, no known P0 authorization bypass.
- [x] **Schema versioning:** Stage 2 final-state contract and drift sentinels are versioned in GitHub; production migration provenance remains queryable from Supabase migration history.
- [x] **Effective role matrix:** deterministic checks passed for `admin`, `approver`, simulated `operator` and a transient scoped-user scenario; the simulation left zero persisted scope rows and restored the original role.
- [x] **Mixed-data contract:** `operational_events` financial totals are restricted to Finance/Procurement readers; Hospitality reads a dedicated non-financial projection through `get_operational_events_operational()`.

### Closure rule

Stage 2 is closed. Do not resume broad RLS/security fishing unless a new reproducible P0/P1 violates one of the completed invariants. Legacy reconciliation, data observability and non-blocking catalog/read refinements move to later stages.

---

## Stage 3 — Release reliability and deterministic QA

Status: BLOCKED EXTERNAL

Objective:

Make releases reproducible and make `HOLD/PASS` depend on current automated evidence rather than manual confidence.

Current evidence:

- GitHub Actions refuses to start the calendar job because recent account payments failed or the Actions spending limit must be increased; the job has zero executed steps and no assigned runner;
- current `main` deployment `baba65cf16569377da2c965309a5ccc2638d46e7` is `READY` in Vercel;
- no production runtime errors were found in the explicit last-one-hour Vercel query;
- unauthenticated locale/auth smoke passes for `/en/bookings`, `/es/bookings`, `/de/bookings` and legacy `/deu/bookings`, which normalizes to the German auth flow.

Exit gates:

- [ ] **BLOCKED EXTERNAL:** GitHub Actions can start jobs again after the account billing/spending condition is cleared.
- [ ] **BLOCKED BY CI:** Booking-calendar E2E passes current `main` for required Chromium/WebKit/Firefox scenarios, including pointer move, keyboard, swap, creation, undo and touch where applicable.
- [ ] **BLOCKED BY CI:** current-run CI failures can be separated into product, test, browser and infrastructure causes with artifacts/logs retained.
- [ ] **PARTIAL:** Vercel production is `READY` and recent runtime is clean; same-tested-SHA evidence remains impossible until CI can run.
- [x] Critical unauthenticated locale/auth smoke passes for `/en`, `/es`, `/de` and `/deu` normalization on the current production deployment.

Stage 3 remains open and the global release verdict remains `HOLD`. Do not modify CI merely to work around account billing. Resume Stage 3 immediately when GitHub Actions can assign a runner again.

---

## Stage 4 — Canonical data operations and observability

Status: ACTIVE IN PARALLEL

Objective:

Turn the hardened schema into an operationally maintainable data system while Stage 3 waits on its external CI dependency.

Scope:

- resolve the seven legacy `canonical_event_xls` reservation lineage cases through deterministic/candidate/manual-review workflow;
- define explicit ownership/reconciliation rules for guest identities without unsafe email/phone uniqueness assumptions;
- add data-quality checks for reservation scope, payment projections, orphaned references and import lineage;
- make reconciliation and health-check results observable without exposing global data to unauthorized roles;
- document canonical owners for shared facts (reservation, guest, payment, invoice, logistics, inventory movement, operational event).

Exit gates:

- [ ] no unresolved deterministic reconciliation case; production identity links require explicit human authorization and are never inferred silently;
- [x] manual-review and candidate cases are explicit and traceable in the reconciliation queue rather than silently guessed;
- [ ] canonical drift checks can run repeatedly and report zero/known exceptions;
- [ ] data-health outputs respect role/scope boundaries.

---

## Stage 5 — Hospitality operational completion

Status: PLANNED

Objective:

Finish Hospitality as a reliable day-to-day operating surface rather than continue backend hardening indefinitely.

Priority scope:

- reservation calendar reliability and speed;
- availability, blocks, move/resize/swap/create/undo;
- check-in/check-out and exception handling;
- payments, charges, invoices and financial adjustments;
- housekeeping, requests, logistics and handovers;
- mobile/touch and keyboard workflows;
- role-aware and locale-consistent UX.

Exit gates:

- [ ] primary shift workflows can be completed without fallback spreadsheets/manual DB work;
- [ ] no silent double booking or inventory conflict path;
- [ ] consequential writes provide clear success/failure/audit state;
- [ ] desktop and mobile primary workflows receive current visual/interaction verification.

---

## Stage 6 — Cross-domain operating-system consistency

Status: PLANNED

Objective:

Apply the proven authorization, lifecycle, audit and UI patterns consistently across Maintenance, Inventory, Purchasing, Properties, People, Livestock, Vineyard, Energy, GIS and Administration.

This is not a mandate to rewrite every module. Work by business-critical workflow and reuse shared contracts.

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

1. Keep Stage 3 `BLOCKED EXTERNAL` until GitHub billing/spending allows a runner to start; do not rewrite CI around that condition.
2. Execute the independent Stage 4 observability/drift gates in bounded blocks without changing canonical production identities automatically.
3. Resume Stage 3 immediately when Actions starts jobs and require same-SHA CI + Vercel evidence before changing the release verdict.
4. After Stage 3 and Stage 4 close, execute Stage 5 Hospitality completion.
5. Only then expand systematically across other enterprise modules and AI.

## Current global release verdict

`HOLD`

Reason: Stage 2 data/security hardening is complete and no current P0 is known, but Stage 3 release evidence is externally blocked by GitHub Actions account billing/spending. Production deployment health and locale/auth smoke are currently verified, but booking-calendar E2E cannot run. This verdict changes only with current evidence.
