# Blackswan Facility Core

**Operational management platform for Fundo Corcovado — hospitality, facilities, finance, procurement, field operations and administration in one system.**

[![Production](https://img.shields.io/badge/Production-READY-1f8f4e?style=for-the-badge)](https://blackswn.app)
[![Vercel](https://img.shields.io/badge/Deployed_on-Vercel-black?style=for-the-badge&logo=vercel)](https://vercel.com/travis-projects-c14a785a/v0-black-swan-facility-core)
[![Next.js](https://img.shields.io/badge/Next.js-16-black?style=for-the-badge&logo=next.js)](https://nextjs.org/)
[![Supabase](https://img.shields.io/badge/Supabase-PostgreSQL-3FCF8E?style=for-the-badge&logo=supabase&logoColor=white)](https://supabase.com/)

> **Current state — 13 August 2026:** the application is deployed to production and the latest `main` deployment is `READY` on Vercel. Blackswan Facility Core is an actively developed operational system, not a prototype. Remaining QA/security review items are tracked separately and do not represent the breadth of functionality already implemented.

## What Blackswan Facility Core is

Blackswan Facility Core (BFCS) is the operational system of record being built for **Fundo Corcovado, Valdivia**. It connects daily hospitality work, rooms and guests, maintenance, inventory, finance, procurement, people, agriculture, livestock, energy, GIS and administrative controls against one authenticated PostgreSQL-backed application.

The product is designed around four principles:

- **one operational source of truth** instead of disconnected spreadsheets and dashboards;
- **real workflows** with assignments, status transitions, evidence and audit history;
- **role and location-aware access** rather than unrestricted CRUD screens;
- **field usability** across desktop, tablet and mobile operational contexts.

## Platform at a glance

| Area | Implemented capabilities |
| --- | --- |
| Hospitality | Booking calendar, stays, room/bed inventory, arrivals, check-in/check-out, guest profiles, requests, concierge, extras, invoices, payments, logistics, activities and booking events |
| Housekeeping | Checkout/stayover workflows, room readiness, assignments, mobile task execution, checklists, evidence upload, inspections and guest-access states |
| Finance | Budget model, finance documents, approval queue, reconciliation, historical imports, invoice/payment state, financial adjustments and canonical postings |
| Procurement | Purchase requests, suppliers, approval workflow, RFQ/quotation structures, supplier comparison, purchase orders, receipts and inventory intake |
| Facilities | Maintenance work orders, incidents/issues, assets, infrastructure, property management, checklists and operational tasks |
| Inventory | Warehouses, locations, asset registry, stock intake, movements, assignments, QR support and retirement workflow structures |
| People & Operations | Employees, volunteers, task assignments, comments, evidence, status history, operational scopes and shift/operational workflows |
| Agriculture | Orchard and vineyard operations, crops, care, harvest, pests, soil/amendments, equipment and analytics structures |
| Livestock | Cattle registry, health/biometric structures, alerts, treatment plans, body-condition history and feeding recommendations |
| Energy & Fuel | Energy management surfaces, vehicles, fuel consumption, validation, anomaly tracking and operational classifications |
| GIS | Infrastructure/property map, coordinates, KMZ/KML overlays, connections and field-operation mapping support |
| AI & Automation | AI operations area, agent/session/event/artifact structures, operational automation hooks and human-controlled workflows |
| Administration | Role/access profiles, scoped permissions, audit logs, catalogs, configuration, issue types, locations and system administration |

## Feature map

### Hospitality & reservations

The Hospitality workspace is currently the most mature end-to-end domain in BFCS.

- visual booking/calendar workspace;
- room and bed inventory;
- whole-location and individual-bed booking modes;
- reservation create/update workflows;
- drag/move/swap booking operations with controlled database contracts;
- undo support for booking changes;
- guest profiles and stay history context;
- arrival state and arrival-time tracking;
- guided check-in workflow;
- check-out validation;
- room readiness and operational room state separation;
- booking extras and scheduled services;
- reservation activities;
- transport and logistics planning;
- guest requests and hospitality task flow;
- daily operations inside the booking workspace;
- Santiago hospitality quick-task sets;
- chronological stay detail and request visibility;
- booking event timeline;
- invoice and payment integration;
- reservation folio/financial state;
- booking communication records and message templates.

### Guest access & concierge

BFCS includes a guest-facing operational request path in addition to internal staff workflows.

- global guest QR access;
- tablet-compatible guest request experience;
- active-guest selection;
- hospitality request submission;
- request category, priority and status handling;
- concierge workspace;
- request assignment and follow-up;
- source lineage back to originating guest/issue context where available.

### Housekeeping

Housekeeping is integrated with reservation and room state rather than maintained as a separate checklist app.

- checkout-generated housekeeping lifecycle;
- stayover housekeeping lifecycle;
- room readiness state transitions;
- task assignment;
- service scheduling and due times;
- guest access states such as do-not-disturb/reschedule;
- mobile housekeeping task execution;
- task checklist completion;
- evidence/photo upload by operators;
- inspection workflow;
- verification fields and quality scoring structures;
- completion/resolution notes;
- lost-and-found structures;
- linen inventory/movement structures.

### Finance & budgets

Finance is structured around controlled approval and posting rather than dashboard-only reporting.

- annual/monthly budget structure;
- budget divisions and categories;
- imported budget source lineage;
- finance document inbox/queue;
- document classification and mapping status;
- historical workbook-derived cost-center mapping;
- finance approval/rejection paths;
- reconciliation views/workflows;
- supplier-linked finance documents;
- invoice generation and lifecycle;
- reservation payments;
- payment reversal support;
- reservation financial adjustments;
- canonical financial posting structures;
- document sequencing;
- source-to-posting traceability;
- finance pending-work indicator in navigation.

### Procurement & suppliers

The procurement domain supports the full pre-purchase data model and the operational path toward receiving inventory.

- supplier directory;
- supplier approval state;
- purchase/procurement requests;
- category, priority, budget and required-date fields;
- location-aware purchasing;
- human approval events;
- configured approvers and approval limits;
- quotation rounds;
- RFQ request structures;
- supplier quote capture;
- quote itemization;
- supplier comparison/recommendation structures;
- purchase order structures;
- receiving/receipt records;
- discrepancy and damaged/incorrect receipt handling;
- inventory intake workflow;
- asset vs consumable intake;
- procurement audit log;
- automation policy and agent-run structures;
- controlled outbound-message queue structures.

### Inventory & assets

- canonical asset registry;
- asset code, class, category and status;
- warehouse and warehouse-location structure;
- serial number, brand and model tracking;
- purchase metadata;
- location and assignment data;
- QR data/QR URL support;
- photos, manuals and documents;
- asset movement history;
- receipt/transfer/assignment/return/retirement movements;
- stock-item structures for consumables;
- stock movement ledger structures;
- minimum-stock support;
- cost-center linkage;
- asset retirement request workflow;
- asset linkage to maintenance work.

### Maintenance & incidents

- maintenance work-order registry;
- preventive and corrective work context;
- asset-linked maintenance;
- infrastructure-linked maintenance;
- vehicle-linked maintenance;
- room/reservation-linked maintenance;
- scheduled start/end and target dates;
- assignment to employees;
- priority and extended work states;
- blocked-work tracking;
- checklist/evidence fields;
- maintenance weekly view;
- quick work-order creation;
- filters for state, priority and unassigned work;
- incident/issue reporting;
- issue priority/severity/status;
- photo evidence;
- issue labels;
- linkage from issues to operational tasks;
- direct navigation between issues and maintenance.

### Operational tasks, evidence & SOPs

- general operational task registry;
- priority and due dates;
- operational area/category metadata;
- employee and volunteer assignment;
- comments;
- status history;
- evidence attachments;
- source linkage from hospitality, maintenance, housekeeping and issues;
- SOP procedure registry;
- versioned SOP definitions;
- ordered SOP steps;
- required evidence/approval flags;
- SOP executions;
- execution-step state;
- operational-document linkage;
- task/SOP traceability.

### Property & infrastructure

- property-management workspace;
- infrastructure registry;
- categories, description and operational status;
- latitude/longitude;
- installation and inspection dates;
- specifications and notes;
- infrastructure photos/documents;
- inspections and corrective-action structures;
- infrastructure connection lines for GIS visualization;
- maintenance and issue linkage to infrastructure.

### GIS, map & field operations

- map workspace;
- latitude/longitude-backed operational records;
- KMZ/KML overlay metadata;
- overlay visibility, opacity and ordering;
- infrastructure map connections;
- vehicle/field-operation structures;
- operation distance, duration and area fields;
- KMZ attachment structures for operations;
- mapped property/infrastructure context.

### People, access & administration

- employee directory;
- volunteer registry;
- user access profiles;
- admin / approver / operator role model;
- operational location/department scopes;
- action-level permission checks;
- administration workspace;
- access-management screens;
- audit screens;
- location, asset-type and issue-type administration;
- critical action audit log;
- user-access audit log;
- immutable/append-oriented operational audit structures;
- authenticated sign-in/sign-out flows;
- role-aware navigation that hides inaccessible modules.

### Orchard

- orchard overview;
- plot registry;
- crops;
- planting and expected harvest dates;
- care logs;
- watering/fertilizing/weeding/pruning/pest-control activities;
- harvest records;
- quality/storage metadata;
- pest and disease logs;
- treatment effectiveness;
- soil amendments;
- orchard equipment;
- yield and sustainability analytics structures.

### Vineyard

- vineyard overview;
- plots and vines;
- crop/vine metadata;
- vineyard photos surface;
- harvest records;
- Brix, pH, quality and yield fields;
- care logs;
- pruning/fertilizer/irrigation context;
- pest/disease logs;
- soil amendment structures;
- equipment registry;
- annual vineyard analytics structures.

### Cattle & animal health

- cattle overview;
- animal registry structure;
- breed/gender/birth/acquisition metadata;
- biometric/lab record structures;
- health alerts;
- alert severity and recommendations;
- treatment plans;
- dosage/frequency/outcome structures;
- body-condition and weight history;
- seasonal feeding recommendation structures;
- cattle business-plan data structures.

### Energy, vehicles & fuel

- energy-management workspace;
- vehicle registry;
- road vehicles, machinery, drones and other operational classes;
- classification workflow/status;
- maintenance-tracking flag;
- fuel-tracking flag;
- fuel consumption registry;
- liters, type, cost and odometer fields;
- source/evidence metadata;
- verification/rejection workflow;
- validation-event structures;
- anomaly detection/confirmation structures;
- location linkage;
- monthly summary structures.

### Activities & calendars

- operational activities;
- activity type/category structures;
- start/end dates and times;
- capacity and attendee counts;
- recurring activity metadata;
- attendee registry;
- reservation-linked activity bookings;
- transport-required flag;
- activity logs;
- dedicated activities calendar surface.

### AI operations & automation foundations

BFCS contains an AI/automation layer designed to remain subordinate to canonical operational data and human controls.

- AI operations workspace;
- AI agent registry;
- execution records;
- sessions;
- events;
- context records;
- generated artifact structures;
- operation logs;
- procurement automation policy structures;
- agent-run and outbox structures;
- human review/approval fields in operational workflows.

## Access model

Navigation and workflows are dynamically restricted by effective access.

Current platform concepts include:

- `admin`, `approver` and `operator` access profiles;
- department-level access checks;
- location/operational scopes;
- action-level permissions for booking, hospitality, finance, procurement, inventory, maintenance and fuel operations;
- server/database authorization on sensitive transitions;
- RLS on production operational tables;
- controlled `SECURITY DEFINER` RPC contracts where elevated database operations are required.

The sidebar itself is permission-aware, so users see only modules they are authorized to operate.

## Data architecture

```text
┌───────────────────────────────────────────────┐
│ Next.js 16 / React 19 application            │
│ desktop · tablet · mobile operational UI     │
└───────────────────────┬───────────────────────┘
                        │
                        ▼
┌───────────────────────────────────────────────┐
│ Supabase Auth                                 │
│ users · roles · operational scopes            │
└───────────────────────┬───────────────────────┘
                        │
                        ▼
┌───────────────────────────────────────────────┐
│ PostgreSQL / Supabase                         │
│                                               │
│ canonical transactional tables               │
│ RLS + scoped authorization                    │
│ RPC workflow contracts                        │
│ triggers + state validation                   │
│ operational history + audit                   │
│ derived projections/views                     │
└───────────────────────┬───────────────────────┘
                        │
                        ▼
┌───────────────────────────────────────────────┐
│ Vercel production                             │
│ blackswn.app                                  │
└───────────────────────────────────────────────┘
```

### Canonical-data rules

1. PostgreSQL owns canonical operational state.
2. Business-critical transitions are validated beyond the UI where workflow contracts exist.
3. Derived dashboards and projections do not become competing sources of truth.
4. Financial reservation status derives from canonical financial records.
5. Booking inventory mutations are concurrency-aware.
6. Sensitive actions use explicit role/action checks plus operational scope where applicable.
7. Trigger-only/internal functions are not public application APIs.
8. Historical imports preserve source lineage instead of silently rewriting the past.

## Technology stack

- **Next.js 16**
- **React 19**
- **TypeScript 5**
- **Supabase** — PostgreSQL, Auth, RLS, RPCs
- **Tailwind CSS 4**
- **Radix UI**
- **Leaflet + Mapbox toGeoJSON** for mapping/KMZ workflows
- **Vercel** production hosting and analytics
- **Playwright** browser E2E
- **Node test runner** for deterministic domain tests
- **pnpm 10**
- **i18n foundations** with English, Spanish and German route/navigation support

## Production & deployment

- **Production application:** https://blackswn.app
- **Vercel project:** `v0-black-swan-facility-core`
- **Git branch:** `main`
- **Supabase project:** `ruslvodmzqctkaafnpfx`
- **Latest verified Vercel state:** `READY`

Application changes on `main` are deployed through Vercel. Database migrations are versioned under `supabase/migrations/`; a migration being present in Git does not by itself prove production application, so database state is verified independently when changes depend on it.

## Repository structure

```text
app/                  Next.js routes and operational modules
components/           shared UI and operational components
lib/                  domain logic, access rules and Supabase clients
scripts/              build, operational and E2E utilities
supabase/migrations/  versioned PostgreSQL / RLS / RPC migrations
tests/                deterministic booking/task tests
.github/               GitHub Actions workflows
```

## Development

```bash
pnpm install
pnpm dev
```

Production validation commands:

```bash
pnpm lint
pnpm test:booking
pnpm test:notifications
pnpm test:e2e:booking
pnpm build
```

`pnpm build` runs the task-notification and booking rule/drag/source-policy tests before the Next.js production build.

## Reliability and security

The project has already received extensive authorization and data-integrity hardening, including:

- scoped reservation creation/update paths;
- room/bed write authorization;
- concurrency-aware booking integrity;
- authorization on booking move/swap/undo operations;
- controlled check-in/check-out transitions;
- finance approval/rejection authorization;
- restricted privileged views/RPC access;
- room-readiness state validation;
- hospitality-request workflow validation;
- location-aware booking/payment/message controls;
- protection against fabricated inbound communication state from normal authenticated clients;
- audit logging for critical operational actions.

## QA status

The application is **production-deployed and operationally substantial**, while formal release verification continues as an independent engineering gate.

The booking calendar has deterministic unit/domain tests plus a Playwright multi-browser harness. The last documented full E2E gate was not considered complete because CI execution was blocked by external GitHub Actions billing/spending limits after earlier interaction failures were identified. This README therefore distinguishes two things clearly:

- **Product status:** deployed, functional and actively used/developed across many operational domains.
- **Formal QA gate:** still tracked until the complete browser matrix can execute and pass under CI.

A pending QA gate should not be confused with the project being an unfinished prototype.

## Current engineering focus

Current work is incremental hardening and operational completion, including:

- mobile-first housekeeping execution;
- hospitality daily-operations refinement;
- maintenance/incidents alignment;
- continued role/scope verification;
- broader end-to-end validation across remaining operational modules.

## Development rules

- work from the latest production-aligned `main` state;
- keep commits small and domain-specific;
- never substitute mock data for canonical production evidence;
- do not weaken RLS or integrity rules merely to make UI/tests pass;
- preserve canonical IDs and source lineage;
- verify application, database and deployment state independently;
- treat financial and booking state transitions as controlled operational contracts;
- keep dangerous/destructive operations explicit and auditable.

---

**Blackswan Facility Core is a unified operational platform for Fundo Corcovado: hospitality, facilities, finance, field operations and administration backed by canonical data, explicit authorization and traceable workflows.**
