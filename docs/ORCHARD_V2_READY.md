# Orchard V2 — Ready-to-Incorporate Lane

Status: PREPARED, NOT ACTIVE IN V1

This branch is the parking lane for Orchard improvements that are useful but are not required for the current V1 delivery.

## Boundary

V1 may continue to receive only bounded hardening fixes that correct an existing defect without expanding product scope: localization leaks, responsive/layout defects, broken navigation, regressions, data-integrity defects, accessibility defects and release blockers.

V2 contains product/UX expansion, deeper intelligence, denser decision support and non-essential restructuring. V2 work must not be merged to `main` merely because it is ready.

## Prepared V2 candidates

### P28 — Plan vs real hierarchy

Problem observed: the current Performance / Plan vs real surface repeats the same operational metrics in a compact strip and again in a large card matrix.

Prepared direction:
- keep one canonical compact metric band;
- remove redundant large summary cards;
- move the operator directly into temporal plan-vs-real comparison;
- preserve current canonical queries, crop/succession lineage and observed-vs-planned semantics;
- no fabricated KPI or performance score.

### P29 — Decision cockpit density

Problem observed: the Decisions surface uses an overly tall metric matrix before the actionable decision queue.

Prepared direction:
- compress the summary into one compact signal band;
- keep severity and decision counts visible;
- bring concrete decision objects higher in the viewport;
- preserve current rules, traceability, canonical sources and permissions;
- no automatic decision execution.

## Incorporation contract

Before any V2 item is merged into V1/main:

1. Rebase the V2 work onto the current `main` after all V1 hardening is complete.
2. Keep each V2 capability in an isolated PR with a clear rollback boundary.
3. Do not add or reinterpret agronomic facts to make the UI look complete.
4. Preserve canonical RLS, permissions, source lineage and planning/observed-state separation.
5. Pass the current full test suite and Vercel preview build.
6. Perform authenticated visual QA on production-equivalent routes at desktop and intermediate/tablet widths.
7. Merge only after an explicit decision to include that V2 capability.

## Activation model

Preferred integration order:

1. P28 Plan vs real hierarchy.
2. P29 Decision cockpit density.
3. Any additional V2 intelligence/automation work only after those surfaces remain stable.

If a V2 capability becomes larger than a visual/presentation change, introduce it behind an explicit disabled-by-default feature boundary before merging. Do not expose unfinished V2 surfaces in production navigation.

## Current V1 rule

Do not move P28/P29 into `main` during V1 delivery. Keep them ready here so they can be incorporated later with a bounded rebase + PR instead of being redesigned from scratch.
