# Black Swan Facility Core

> **Facility & Hospitality OS**

[Black Swan Facility Core](https://blackswn.app) is the operating system for a complex hospitality/facility environment. It connects reservations, people, assets, inventory, procurement, maintenance, finance, events and administration through shared canonical objects rather than disconnected modules.

<p align="center"><strong>Reservation · Asset · Purchase · Work · Finance</strong></p>

---

## Product thesis

A facility is not a collection of dashboards. A reservation affects rooms, guests, housekeeping, activities, charges and payments. A purchase can become inventory. An asset can create maintenance work. A maintenance event can affect budget, safety and availability.

Black Swan models those relationships directly.

```text
REAL FACILITY
     │
     ├──── Reservation / Guest
     ├──── Person / Team
     ├──── Asset / Inventory
     ├──── Purchase / Supplier
     ├──── Work / Maintenance
     ├──── Budget / Finance
     └──── Event / Network
              │
              ▼
        shared operational truth
              │
              ▼
      action + evidence + audit
```

---

## Operating areas

| Area | What it connects |
|---|---|
| **Hospitality** | Reservations, rooms, guests, activities, charges, payments and housekeeping |
| **Operations** | Tasks, checklists, handovers, issues and daily execution |
| **People** | Employees, responsibilities and organizational context |
| **Places & Assets** | Property, inventory, maintenance, orchard, vineyard, cattle, energy and fuel contexts |
| **Procurement** | Requests, sourcing, approvals, suppliers, purchase orders and receiving |
| **Finance** | Budgets, approvals, documents, reconciliation, accounting and invoices |
| **Network & Events** | Discovery, events, providers, front-door and education workflows |
| **Administration** | Roles, permissions, system controls and operational configuration |

---

## Canonical chains

### Reservation

`Reservation → Room → Guest → Activity → Charge → Payment → Invoice`

### Procurement

`Request → Quotes → Comparison → Approval → Purchase Order → Receipt → Inventory`

### Assets & work

`Asset → Issue → Maintenance / Work → Evidence → Closure`

### Finance

`Budget → Commitment → Document → Reconciliation → Accounting evidence`

These chains are intentionally cross-functional. The same object should not acquire multiple conflicting identities because it crossed a module boundary.

---

## Integrity rules

- no silent double booking;
- room blocks and availability constraints are enforced at the authoritative layer;
- critical mutations are protected server-side;
- roles/capabilities and data scopes are not granted by UI visibility alone;
- row-level data boundaries remain explicit;
- operational records retain history and provenance;
- missing information is not fabricated to make dashboards appear complete;
- automation must leave evidence of what it changed and why.

---

## Product architecture

The system uses a Next.js/React/TypeScript application layer with PostgreSQL/Supabase as the canonical operational data store, server-side authorization, row-level security, scheduled control-plane work and deployment/release gates.

The public repository documents the architecture and operating model. Deployment credentials, private facility data and sensitive operational evidence are intentionally excluded.

---

## Documentation

The repository includes detailed system documentation:

| Document | Purpose |
|---|---|
| [`docs/CLOSURE_2026-08-27.md`](docs/CLOSURE_2026-08-27.md) | Verified closure baseline and known exceptions |
| [`docs/SITE_SECTIONS.md`](docs/SITE_SECTIONS.md) | Route and surface inventory |
| [`docs/DATA_MODEL.md`](docs/DATA_MODEL.md) | Canonical objects and ownership |
| [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) | Application/data/control-plane architecture |
| [`docs/ACCESS_SECURITY.md`](docs/ACCESS_SECURITY.md) | Authorization, scopes and RLS boundaries |
| [`docs/OPERATIONS_RUNBOOK.md`](docs/OPERATIONS_RUNBOOK.md) | Operations, recovery and rollback |
| [`docs/QA_RELEASE.md`](docs/QA_RELEASE.md) | QA and release-gate model |

Historical project documentation remains part of the engineering record. Current behavior, migrations and closure documentation take precedence when historical notes conflict.

---

## Product principles

1. **One facility, one operational model.**
2. **Canonical objects before dashboard convenience.**
3. **Authorization is enforced by the system, not presentation.**
4. **Integrity rules fail closed where the operation is consequential.**
5. **Evidence and history survive automation.**
6. **Operational intelligence should lead to executable work.**

---

## Product

**Black Swan Facility Core — Facility & Hospitality OS**  
[blackswn.app](https://blackswn.app)
