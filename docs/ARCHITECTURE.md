# Arquitectura de producción

**Baseline:** `f22330dec23ed396d195abbdb5e1f9ed2ea61ed7`

## 1. Stack

- Next.js `16.0.10` — App Router / server rendering.
- React `19.2.0`.
- TypeScript 5.
- Tailwind CSS 4 + componentes Radix/shadcn-style.
- Supabase/PostgreSQL — Auth, Data API, RLS, RPCs y pg_cron.
- Vercel — build/deploy/runtime.
- Playwright `1.61.1` — E2E de Booking.
- pnpm `10.28.0`.

El repositorio contiene paquetes `ai`/`@ai-sdk/react`, pero el prebuild ejecuta `scripts/check-no-ai-sdk.mjs` y la arquitectura de release no permite introducir imports de AI SDK sin una decisión explícita.

---

## 2. Capas

```text
Browser / Mobile
  ↓
Next.js App Router + Proxy/Middleware
  ↓
Server Components / Route Handlers / authorized client calls
  ↓
Supabase Auth + Data API + RPC
  ↓
PostgreSQL constraints / triggers / RLS / privileged workflows
  ↓
Canonical data + audit/events
```

Vercel ejecuta la capa Next.js. Supabase es la frontera de identidad/datos. La UI no se considera una frontera de seguridad.

---

## 3. Routing e i18n

`proxy.ts` maneja las rutas localizadas y acceso temprano.

Idiomas soportados:

- `en`
- `es`
- `de`

`deu` se conserva sólo como alias legacy y se normaliza a `de`.

El proxy:

- separa API de páginas;
- identifica rutas públicas;
- valida sesión para superficies internas;
- obtiene access/capabilities de servidor;
- valida requisitos de ruta;
- respeta `os_start_path` sólo si sigue autorizado;
- preserva locale en redirects;
- aplica un gate específico para IT Control Center coherente con admin-or-IT-scope.

La aplicación física no duplica carpetas por idioma; el locale se resuelve antes de reescribir a la ruta interna.

---

## 4. Operating System

`lib/os/navigation.ts` define una taxonomía única de seis áreas:

- today
- operations
- people
- places-assets
- finance
- network

La misma taxonomía se usa para distintas personas. `rankAreasForPersona`/ranking puede priorizar contenido, pero no crea permisos.

### Server-authorized navigation

Algunas entradas OS (`/os/discovery`, `/os/events`, etc.) se marcan `serverAuthorized` y no se incluyen en el filtrado estático de cliente. El servidor devuelve sólo lo autorizado.

### Panorama

`/os?view=panorama` agrega una visión de contexto basada en fuentes canónicas y capabilities. No debe evolucionar a “KPI theater”: si un indicador no tiene fuente reproducible, no pertenece al dashboard.

---

## 5. Autorización

### Niveles de capability

Orden jerárquico:

`view < operate < approve < admin`

`hasCapability()` acepta un nivel cuando el usuario posee ese nivel o uno superior dentro del mismo dominio.

### Capas de control

1. Auth session.
2. `user_access_profiles` activo.
3. role/capability.
4. `user_operational_scopes` cuando aplica.
5. RLS de tabla/vista.
6. validación de RPC/constraint para mutaciones sensibles.

No debe existir una ruta donde la autorización dependa únicamente de esconder un botón.

---

## 6. Supabase clients

### Browser client

Se usa para operaciones que pueden ejecutarse bajo sesión del usuario y RLS. Nunca debe recibir `service_role`.

### Server client

Se usa en Server Components/handlers que necesitan leer bajo la sesión/cookies del usuario, incluyendo el IT Control Center.

### Privileged RPCs

Algunos workflows requieren `SECURITY DEFINER`. Reglas obligatorias:

- `search_path` fijo;
- ACL explícita (`REVOKE`/`GRANT`);
- `auth.uid()`/perfil/role/scope validados dentro de la función;
- no usar privileged RPC como atajo para un error de RLS;
- auditar side effects y mantener rollback/compensación cuando corresponde.

---

## 7. Mutaciones críticas

BSFC evita mutations “free-form” para operaciones con integridad fuerte.

### Booking

Constraints/triggers/RPCs protegen:

- fechas;
- overlap;
- room blocks;
- inventario room/bed;
- move/resize/reassignment;
- approvals/undo cuando aplica;
- lifecycle check-in/check-out;
- finanzas y cierre de estadía.

### Inventory

Workflows protegen:

- movimientos;
- custody;
- cycle count;
- physical audit;
- replenishment;
- maintenance state;
- retirement.

### Procurement

Workflows protegen:

- sourcing;
- supplier/quote relationships;
- approvals;
- PO/receiving;
- receipt → inventory intake lineage.

---

## 8. Componentes de shell

El shell común vive en `AppLayout`/Sidebar y provee:

- navegación por capability;
- locale switcher;
- identidad/rol efectivo;
- logout;
- accesos globales;
- comando `⌘K` / `Ctrl+K`.

### Global command layer

El command palette:

- se monta una sola vez en shell autenticado;
- es read-only;
- ejecuta búsqueda sólo al abrir y con query mínima;
- debounced;
- consulta objetos canónicos bajo RLS;
- navega a Reservation, Room, Asset y Purchase;
- preserva locale.

---

## 9. UI states

Cada módulo debe contemplar, según aplique:

- loading;
- empty;
- success;
- error;
- disabled/forbidden;
- pending approval;
- degraded source.

Un error de una fuente secundaria no debe tumbar un cockpit primario si la operación puede degradarse de forma segura. Este patrón se usa, por ejemplo, en pulses financieros del OS.

---

## 10. Control plane

El control plane de operaciones está en PostgreSQL/Supabase:

- registry de jobs en schema privado;
- `integration_job_runs` como ejecución observable;
- pg_cron como scheduler;
- stale recovery/retries/dead letter con límites;
- health derivado;
- IT snapshot read-only.

Jobs verificados al cierre:

- `integration-job-supervisor` — cada 5 minutos desplazado al minuto 3/8/13/...;
- `operations-health-snapshot` — cada 15 minutos.

El scheduler no debe implementar decisiones de negocio irreversibles. La automatización actual se concentra en observabilidad y recovery controlado.

---

## 11. Deployments

### GitHub

`main` es la referencia de producción Git. Históricamente el flujo usado para cambios materiales es:

`branch → preview/build → QA/gate → compare → fast-forward main → production verification`

No usar force-push para una promoción normal.

### Vercel

Proyecto: `v0-black-swan-facility-core`.

Baseline productiva al cierre:

- SHA `f22330dec23ed396d195abbdb5e1f9ed2ea61ed7`
- deployment `dpl_EuizvxiBFrvqCMMLMEaEAzP55wLg`
- domain `blackswn.app`

El deployment anterior READY es parte del rollback operacional mientras siga disponible en Vercel.

---

## 12. CI y build

`pnpm run build` ejecuta primero `prebuild`.

Prebuild incluye:

- arquitectura AI check;
- TypeScript;
- inventory contracts;
- GIS/map contracts;
- notification contracts;
- booking rules/drag/source/object;
- discovery;
- access capabilities;
- OS gate.

Workflows GitHub observados:

- `booking-calendar-e2e.yml`
- `booking-calendar-e2e-status.yml`
- `map-performance-hardening.yml`

El E2E de Booking usa Playwright y un harness aislado habilitado por env; el harness no es una ruta pública productiva normal.

---

## 13. Boundaries no negociables

- No `service_role` en frontend.
- No autorización desde persona/UX solamente.
- No KPI ficticio.
- No inventario/reservas/pagos demo en producción.
- No mutation financiera o de inventario basada sólo en client validation.
- No policy RLS permisiva para “hacer que funcione”.
- No cron nuevo sin owner, schedule, health, idempotencia/retry policy y rollback.
- No duplicar objetos canónicos por conveniencia de pantalla.

## 14. Evolución de arquitectura

Toda modificación material debe actualizar este documento si cambia alguno de estos puntos:

- stack/runtime;
- routing/locales;
- taxonomía OS;
- roles/capabilities/scopes;
- objetos canónicos;
- control plane/schedules;
- CI/release gate;
- deployment topology.