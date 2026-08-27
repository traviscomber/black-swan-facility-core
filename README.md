# Blackswan Facility Core (BSFC)

Operating system interno para la operación de Blackswan Facility: Hospitalidad, trabajo operacional, personas, activos, inventario, procurement, finanzas, red/eventos y administración.

**Producción:** https://blackswn.app  
**Release documentada:** `f22330dec23ed396d195abbdb5e1f9ed2ea61ed7`  
**Deployment de referencia:** `dpl_EuizvxiBFrvqCMMLMEaEAzP55wLg` — `READY`  
**Cierre documental:** 2026-08-27

> Este README es el índice ejecutivo. La documentación detallada vive en `docs/` y debe actualizarse cuando cambien contratos, rutas, roles, objetos canónicos, jobs o arquitectura.

## Estado

La fase de construcción principal está cerrada. La baseline productiva fue verificada con:

- Next.js production build completo;
- TypeScript limpio;
- `test:os` 67/67;
- smoke de rutas/locales EN, ES y DE;
- autorización del IT Control Center probada;
- RLS habilitado en 218/218 tablas públicas observadas al cierre;
- control plane con sus dos jobs activos en estado `healthy`, sin retries vencidos ni dead letters en el snapshot de cierre.

A partir de esta baseline, el criterio es **operar, observar y corregir evidencia real**. No agregar funcionalidades especulativas ni datos simulados para llenar dashboards.

## Documentación de cierre

| Documento | Contenido |
|---|---|
| [`docs/CLOSURE_2026-08-27.md`](docs/CLOSURE_2026-08-27.md) | Dossier de cierre, baseline productiva, estado verificado, excepciones y política post-cierre. |
| [`docs/SITE_SECTIONS.md`](docs/SITE_SECTIONS.md) | Inventario completo de secciones, rutas primarias, secundarias, públicas, administrativas y API. |
| [`docs/DATA_MODEL.md`](docs/DATA_MODEL.md) | Objetos canónicos, ownership y cadenas Reservation/Asset/Purchase/Work/Finance. |
| [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) | Next.js/Supabase/Vercel, routing, OS, server/client boundaries, control plane y CI. |
| [`docs/ACCESS_SECURITY.md`](docs/ACCESS_SECURITY.md) | Auth, capabilities, roles, scopes, RLS, SECURITY DEFINER y advisories conocidos. |
| [`docs/OPERATIONS_RUNBOOK.md`](docs/OPERATIONS_RUNBOOK.md) | Operación diaria, Cronos, troubleshooting, release, rollback y recovery. |
| [`docs/QA_RELEASE.md`](docs/QA_RELEASE.md) | Gate PASS/HOLD/BLOCK, suites, Booking E2E, integrity checks y Definition of Done. |

Documentación histórica específica (calendar, procurement, security, etc.) se conserva en el repositorio como evidencia de evolución. Cuando exista contradicción, prevalecen el comportamiento verificado, las migraciones actuales y los documentos de cierre anteriores.

## Operating System

La navegación principal usa seis áreas canónicas:

1. **Hoy** — `/os`
2. **Operaciones** — Hospitalidad, actividades, tasks, checklists, procurement, maintenance e issues
3. **Personas** — empleados y contexto organizacional
4. **Lugares y Activos** — property, inventory, mapa, energía, orchard, vineyard, cattle y fuel
5. **Finanzas** — budget, approvals, documents, reconciliation, accounting e invoices
6. **Red** — Discovery, events, event providers, front door y education

La persona/UX puede priorizar áreas, pero **no otorga permisos**. La autorización real usa capabilities, scopes, route guards, RLS y workflows/RPCs de dominio.

## Secciones principales

### Hospitalidad

Entrada: `/bookings`

Incluye calendario, reservations, rooms, guests, blocks, activities, charges, extras, payments, invoices, documents, quotes, rates, reports, requests, housekeeping, handovers y operations.

Objetos canónicos:

- Reservation → `/bookings/reservations/[id]`
- Room → `/bookings/rooms/[id]`

Invariantes: sin double booking silencioso, room blocks respetados, intervalos half-open, source policy fail-closed y mutations críticas protegidas en backend/base.

### Inventory / Assets

Entrada: `/inventory`

Incluye asset object, categorías, conteos, auditorías, intake, replenishment, movement/custody y vínculos con maintenance/issues.

Objeto canónico:

- Asset → `/inventory/[id]`

### Procurement

Entrada: `/procurement`

Submódulos principales: requests, sourcing, approvals, receiving, suppliers y analytics.

Objeto canónico:

- Purchase/Request → `/procurement/requests/[id]`

Cadena:

`request → sourcing/quotes → comparison → approval → purchase order → receipt → inventory intake`

### Finanzas

Entradas principales:

- `/budgets`
- `/budgets/approvals`
- `/budgets/documents`
- `/budgets/reconciliation`
- `/accounting`
- `/bookings/invoices`

No mostrar métricas financieras inventadas. Totales/estado deben provenir de datos canónicos reproducibles.

### Administración / IT

- `/admin`
- `/admin/access`
- `/admin/audit`
- `/admin/locations`
- `/admin/asset-types`
- `/admin/issue-types`
- `/admin/procurement-users`
- `/admin/it-control`

El IT Control Center es read-only y usa telemetría live. Su política es usuario autenticado con perfil activo y `admin` **o** scope IT activo.

El mapa detallado de todas las familias físicas de `app/` está en [`docs/SITE_SECTIONS.md`](docs/SITE_SECTIONS.md).

## Objetos canónicos

BSFC es object-centered. Antes de introducir nuevos modelos revisar si el dato pertenece a:

- Reservation / Guest / Room
- Asset / Stock
- Purchase
- Work (Tasks / Maintenance / Issues / Housekeeping)
- Invoice / Payment
- Person / Access Profile
- Location
- Event / Network

El command palette global `⌘K`/`Ctrl+K` es read-only y navega a objetos autorizados bajo RLS.

## Arquitectura

```text
Browser
  ↓
Next.js 16 App Router + proxy/access
  ↓
Server Components / Route Handlers / RLS-backed client calls
  ↓
Supabase Auth + RPC + Data API
  ↓
PostgreSQL RLS + constraints + triggers + canonical workflows
  ↓
Audit / operational events / control plane
```

Stack principal:

- Next.js `16.0.10`
- React `19.2.0`
- TypeScript
- Tailwind CSS 4
- Supabase JS `2.87.1` + `@supabase/ssr`
- PostgreSQL / pg_cron
- Vercel
- Playwright `1.61.1`
- pnpm `10.28.0`

El prebuild prohíbe introducir imports del AI SDK sin una decisión arquitectónica explícita.

## Acceso y seguridad

Capability levels:

`view < operate < approve < admin`

Capas de control:

1. Supabase Auth
2. perfil activo
3. capability/role
4. operational scope
5. RLS
6. RPC/constraint para mutations críticas

Reglas:

- nunca `service_role` en frontend;
- no usar `user_metadata` como autoridad de acceso;
- usuario sin perfil activo falla cerrado;
- scope específico de ubicación no autoriza `location_id = NULL`;
- `SECURITY DEFINER` requiere ACL y validación interna;
- logs/audit relevantes son append-only;
- no crear policies permisivas sólo para eliminar warnings.

Advisories conocidos de cierre:

- Supabase Auth Leaked Password Protection continúa pendiente;
- `btree_gist` en public requiere análisis antes de mover;
- funciones `SECURITY DEFINER` se auditan individualmente, no con revocación masiva.

Detalles: [`docs/ACCESS_SECURITY.md`](docs/ACCESS_SECURITY.md).

## Control plane / Cronos

Jobs observados al cierre:

| Job | Schedule |
|---|---|
| `operations-health-snapshot` | `*/15 * * * *` |
| `integration-job-supervisor` | `3,8,13,18,23,28,33,38,43,48,53,58 * * * *` |

El snapshot es read-only. El supervisor implementa recovery/retry acotado; no resuelve automáticamente decisiones de negocio.

Runbook: [`docs/OPERATIONS_RUNBOOK.md`](docs/OPERATIONS_RUNBOOK.md).

## Locales

Locales soportados:

- `/en`
- `/es`
- `/de`

`/deu` es alias legacy hacia `/de`.

El locale se preserva en navegación/redirects y la autorización se evalúa sobre la ruta interna normalizada.

## Desarrollo local

Requisitos:

- Node.js compatible con Next.js 16
- pnpm `10.28.0`
- proyecto Supabase configurado

Instalación:

```bash
pnpm install
pnpm dev
```

Variables necesarias dependen del entorno. Como mínimo la aplicación usa las variables públicas de conexión Supabase requeridas por los clientes Next.js. **No guardar valores secretos en Git.**

## Comandos de calidad

```bash
pnpm typecheck
pnpm test:inventory
pnpm test:booking
pnpm test:os
pnpm test:e2e:booking
pnpm build
```

`pnpm build` ejecuta `prebuild`, que incluye los checks contractuales relevantes antes del build Next.js.

Workflows GitHub:

- `.github/workflows/booking-calendar-e2e.yml`
- `.github/workflows/booking-calendar-e2e-status.yml`
- `.github/workflows/map-performance-hardening.yml`

## Release

Flujo recomendado:

```text
branch
→ preview
→ tests/build
→ QA
→ compare con main
→ fast-forward main
→ production deployment del mismo SHA
→ smoke + runtime logs
→ PASS/HOLD/BLOCK
```

No declarar PASS mientras exista un gate requerido pendiente o rojo.

La guía completa está en [`docs/QA_RELEASE.md`](docs/QA_RELEASE.md).

## Datos y migraciones

La historia de schema vive en `supabase/migrations/`.

Reglas de mantenimiento:

- cambios de schema versionados;
- verificar RLS/grants/RPCs;
- no sembrar datos demo en producción;
- no borrar historia para corregir una inconsistencia;
- preservar lineage entre Procurement → Receiving → Inventory;
- preservar Reservation → Room/Bed → Housekeeping/Maintenance;
- mantener objetos canónicos estables.

Modelo conceptual: [`docs/DATA_MODEL.md`](docs/DATA_MODEL.md).

## Política post-cierre

El sistema debe evolucionar desde evidencia operacional real:

- bugs reproducidos;
- incidentes;
- feedback de usuarios;
- nuevas obligaciones de negocio;
- problemas de rendimiento/seguridad demostrados.

No abrir nuevas superficies por defecto. Preferir cambios pequeños, reversibles, verificables y documentados.

## Source of truth

En caso de discrepancia, el orden de autoridad es:

1. comportamiento productivo verificado;
2. migraciones/constraints/RLS/RPC actuales;
3. código de `main`;
4. documentación de cierre;
5. documentación histórica.

Cualquier cambio material debe actualizar la documentación correspondiente en el mismo release.