# Blackswan Facility Core

Enterprise operating system for facility, hospitality, finance and field operations.

[![Deployed on Vercel](https://img.shields.io/badge/Production-Vercel-black?style=for-the-badge&logo=vercel)](https://vercel.com/travis-projects-c14a785a/v0-black-swan-facility-core)

## Current status

**Updated:** 2026-08-08  
**Branch:** `main`  
**Application deployment:** READY on Vercel  
**Release gate:** **HOLD** — production builds are healthy, but the mandatory booking-calendar multi-browser E2E gate is still pending because GitHub Actions is externally blocked by billing/spending limits.

Blackswan Facility Core has moved well beyond the original v0 prototype. The current system combines application workflows, canonical PostgreSQL state, authorization, operational automation and audited financial/hospitality processes.

## Product scope

The platform is being developed as one operational system rather than a collection of disconnected dashboards. Current implemented surfaces and domain work include:

- **Hospitality & Reservations** — reservation calendar, room/bed inventory, check-in/check-out, guest profiles, requests, logistics, activities, extras, payments and booking events.
- **Housekeeping** — task lifecycle, assignments, room readiness, guest-access states, inspection and automatic checkout/stayover workflows.
- **Finance & Budgets** — finance documents, approvals, historical imports/mapping, budget structure, reservation folios, invoices, payments, adjustments and canonical financial postings.
- **Procurement & Inventory** — supplier approval, purchasing, receipts, inventory intake and asset operations.
- **Operational Tasks & SOPs** — task assignment, evidence, comments, SOP execution and operational-document linkage.
- **Facilities & Field Operations** — maintenance and broader operational modules including people, assets, agriculture/livestock, energy, GIS and administration surfaces already present in the repository.

## Architecture

```text
Next.js / React application
        |
        | authenticated application contracts
        v
Supabase Auth + PostgreSQL
        |
        +-- canonical transactional tables
        +-- RLS and operational scope authorization
        +-- SECURITY DEFINER RPC contracts
        +-- triggers and state-machine validation
        +-- audit/event history
        +-- derived operational projections/views
        |
        v
Vercel production deployment
```

### Technology stack

- Next.js 16
- React 19
- TypeScript
- Supabase / PostgreSQL / Auth / RLS
- Tailwind CSS 4 + Radix UI
- Vercel
- Playwright for booking-calendar browser E2E
- Node test runner for booking rules, drag logic, source policy and task notifications
- pnpm 10

## Canonical data principles

The current data architecture follows several rules that are now enforced progressively across the system:

1. PostgreSQL owns canonical operational state.
2. Core business transitions are validated in the database, not only in UI code.
3. Derived views, projections and status summaries are not treated as competing sources of truth.
4. Financial reservation status is derived from the canonical financial ledger/folio state.
5. Booking inventory changes are concurrency-aware and must not silently double-book rooms or beds.
6. Sensitive write paths use explicit action/role checks plus operational location scope where applicable.
7. Trigger-only/internal functions are not intended to be public application APIs.
8. Application code should use canonical RPC/state transitions where a workflow contract exists instead of bypassing it with arbitrary direct updates.

## Hospitality state

Hospitality is currently the most hardened operational domain.

Implemented and verified at database/code level:

- scoped reservation create/update policies;
- room and bed write authorization by Hospitality scope;
- advisory-lock/concurrency-aware reservation integrity checks;
- booking-change, drag, swap and undo RPCs with authorization controls;
- guided check-in controls;
- reservation payment scope and finance permission checks;
- canonical Housekeeping transitions and room-readiness lifecycle;
- canonical Hospitality Request workflow with assignment requirements;
- checkout financial-close validation;
- debt-free reservations can check out without an artificial final invoice when no receivable exists;
- automatic checkout/stayover housekeeping lifecycle;
- operational logistics authorization and scope controls;
- booking-message creation scoped to the reservation location;
- authenticated users cannot fabricate inbound messages or delivery-state transitions.

The Hospitality Requests UI now uses `update_hospitality_request(...)` rather than directly mutating the table for workflow transitions. Invalid UI-only status values and a previously hardcoded WhatsApp side effect were removed.

## Finance state

Finance has been moved toward a canonical approval/posting model:

- finance approval/rejection RPCs require explicit finance authorization;
- imported finance documents are separated from canonical posted financial state;
- unbilled imported records do not automatically become reservation receivables;
- reservation payment status is treated as a projection of canonical financial records;
- Finance queue/read views use invoker security rather than privileged view execution;
- anonymous execution was removed from privileged Finance RPCs;
- historical workbook imports preserve source lineage and reconciliation information.

## Security hardening completed

Recent hardening work includes:

- removal of anonymous execution from privileged Hospitality and Finance `SECURITY DEFINER` RPCs;
- zero known anonymous-executable `SECURITY DEFINER` functions after the last completed ACL cleanup verification;
- location/scope validation added to reservation creation, walk-ins, room state changes, check-in and reservation payments;
- trigger-only functions restricted away from normal authenticated API execution;
- Hospitality and Finance privileged views restricted to read-only access where appropriate;
- sensitive guest-profile updates restricted to authorized roles and operational access paths;
- bulk reservation mutation/restore RPCs verified to require authenticated admin role;
- `record_booking_message(...)` now validates Booking scope and restricts authenticated callers to outbound/internal draft or queued messages;
- inbound communication ingestion and delivery-state changes are reserved for controlled messaging workflows/service operations.

Migration `20260808050000_scope_booking_message_creation.sql` is versioned in GitHub and has been applied and verified in production Supabase.

## Database items still under review

The current data/security audit is intentionally not marked complete. Remaining items include:

- review of remaining authenticated `SECURITY DEFINER` RPCs by actual mutation impact and application usage;
- confirmation of the intended default semantics for `user_operational_scopes` before changing its current allow-when-unassigned behavior;
- `document_sequences` has RLS enabled with no direct table policies; sequence allocation is intentionally mediated by privileged code and still needs final contract documentation;
- `btree_gist` remains installed in `public` and should not be moved without dependency analysis;
- Supabase leaked-password protection remains an external Auth configuration warning.

The reservation date constraint (`check_out > check_in`) has already been validated in production.

## QA and release status

The project is **not declared production-complete**.

Current Qalito release verdict: **HOLD**.

Why:

- Vercel production deployments are currently building successfully and latest application commits are `READY`.
- The booking calendar has deterministic unit-level tests and a dedicated Playwright E2E harness.
- The last executable multi-browser calendar run exposed pointer/interaction failures in Chromium/Firefox/WebKit/touch scenarios.
- Subsequent test isolation/instrumentation changes cannot currently execute because GitHub Actions jobs are being rejected before runner startup by the repository billing/spending limit.

The release gate returns to evaluation once CI can execute the calendar matrix again. A pending CI gate is not considered a PASS.

## Tests and commands

```bash
pnpm install
pnpm dev
pnpm build
pnpm lint
pnpm test:booking
pnpm test:notifications
pnpm test:e2e:booking
```

`pnpm build` runs the core task-notification and booking rule/drag/source-policy tests before the Next.js production build.

## Repository structure

```text
app/                  Next.js routes and operational modules
components/           shared UI and product components
lib/                  domain logic, Supabase clients and shared utilities
scripts/              operational/build/E2E scripts
supabase/migrations/  versioned PostgreSQL/RLS/RPC migrations
tests/                deterministic unit/domain tests
.github/               GitHub Actions workflows
```

The repository also contains historical audit/implementation documents. Some older documents describe conditions that have since been fixed or superseded; **live code, current Supabase state and this README are the preferred current references**.

## Deployment

Application changes on `main` deploy through Vercel.

- Vercel project: `v0-black-swan-facility-core`
- Production application: `https://blackswn.app`
- Supabase project ref: `ruslvodmzqctkaafnpfx`

Database migrations are versioned under `supabase/migrations/`. A migration being present in Git does **not** by itself prove it has been applied to production; live Supabase state must be verified separately.

## Development rules

- Work from the latest production-aligned `main` state.
- Keep commits small and domain-specific.
- Never use simulated production data as canonical evidence.
- Do not weaken RLS, authorization or integrity rules to satisfy UI/tests.
- Do not modify production rows merely to make a demo pass.
- Preserve canonical IDs and source lineage during imports/migrations.
- Verify database migrations, application contracts and deployment independently.
- Never claim a workflow is complete solely because the build passes.

## Immediate next work

1. Continue the authenticated `SECURITY DEFINER` mutation audit, prioritizing cross-scope and privilege-escalation risk.
2. Resolve the intended provisioning/default behavior of `user_operational_scopes` before tightening its fallback semantics.
3. Restore GitHub Actions execution/billing and rerun the complete booking-calendar Playwright matrix.
4. Continue Stage 5 Hospitality operational completion while preserving canonical DB workflows.
5. Only after those gates are verified, reconsider the Qalito release verdict.

---

Blackswan Facility Core is being treated as an operational system of record: canonical data first, explicit authorization, traceable workflows, controlled state transitions and evidence-based release decisions.
