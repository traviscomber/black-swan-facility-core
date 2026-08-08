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

Status: ACTIVE

Objective:

Make releases reproducible and make `HOLD/PASS` depend on current automated evidence rather than manual confidence.

Exit gates:

- [ ] GitHub Actions can start jobs again (external billing/spending blocker cleared).
- [ ] Booking-calendar E2E passes current `main` for required Chromium/WebKit/Firefox scenarios, including pointer move, keyboard, swap, creation, undo and touch where applicable.
- [ ] CI failures are separated into product, test, browser and infrastructure causes with artifacts/logs retained.
- [ ] Vercel production is `READY` for the same tested SHA and has no blocking recent runtime errors.
- [ ] Critical locale/auth smoke checks pass for `/en`, `/es`, `/de` and `/deu` normalization.

Stage 3 closes when the release gate can be evaluated deterministically. It does not require every P2/P3 test improvement.

---

## Stage 4 — Canonical data operations and observability

Status: PLANNED

Objective:

Turn the hardened schema into an operationally maintainable data system.

Scope:

- resolve the seven legacy `canonical_event_xls` reservation lineage cases through deterministic/candidate/manual-review workflow;
- define explicit ownership/reconciliation rules for guest identities without unsafe email/phone uniqueness assumptions;
- add data-quality checks for reservation scope, payment projections, orphaned references and import lineage;
- make reconciliation and health-check results observable without exposing global data to unauthorized roles;
- document canonical owners for shared facts (reservation, guest, payment, invoice, logistics, inventory movement, operational event).

Exit gates:

- [ ] no unresolved deterministic reconciliation case;
- [ ] manual-review cases remain explicit and traceable rather than silently guessed;
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

1. Execute Stage 3 release reliability; do not reopen Stage 2 without a new P0/P1.
2. Restore a runnable GitHub Actions E2E gate and isolate calendar failures by scenario/browser.
3. Require same-SHA CI + Vercel evidence before changing the global release verdict.
4. After Stage 3 closes, execute Stage 4 data operations and Stage 5 Hospitality completion in bounded blocks.
5. Only then expand systematically across other enterprise modules and AI.

## Current global release verdict

`HOLD`

Reason: Stage 2 data/security hardening is complete and no current P0 is known, but the required booking-calendar CI/E2E release evidence is not green and GitHub Actions has an external startup blocker. This verdict changes only with current evidence.
