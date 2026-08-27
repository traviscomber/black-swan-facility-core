# Mapa completo de secciones y rutas

Este documento describe las secciones existentes en el árbol `app/` de Blackswan Facility Core y distingue entre navegación primaria, superficies secundarias, administración, acceso público y APIs.

**Baseline:** `f22330dec23ed396d195abbdb5e1f9ed2ea61ed7`.

> Regla de lectura: que una ruta exista en `app/` no significa que esté visible para todos ni que aparezca en el sidebar. La navegación primaria se filtra por capabilities; las rutas protegidas vuelven a validar sesión/acceso en servidor y la base aplica RLS/scopes.

## 1. Convención de locale

La UI pública/interna usa prefijos de idioma:

- `/en/...`
- `/es/...`
- `/de/...`

El middleware normaliza el prefijo antes de resolver la ruta interna. El legacy `/deu/...` se normaliza intencionalmente a `/de/...`.

Los ejemplos siguientes muestran la **ruta interna**. En navegador normalmente aparecerán con el prefijo de locale.

---

## 2. Operating System — estructura primaria

La experiencia principal se organiza en seis áreas estables.

| Área | Hub | Función |
|---|---|---|
| Hoy | `/os` | Prioridades, decisiones y trabajo del día; también soporta `?view=panorama`. |
| Operaciones | `/os?area=operations` | Hospitalidad, actividades, trabajo, procurement, mantenimiento e incidencias. |
| Personas | `/os?area=people` | Personas, empleados y responsabilidades. |
| Lugares y Activos | `/os?area=places-assets` | Propiedad, inventario, mapa y dominios físicos/productivos. |
| Finanzas | `/os?area=finance` | Presupuesto, documentos, aprobaciones, conciliación, contabilidad y facturación. |
| Red | `/os?area=network` | Discovery, eventos, proveedores, front door y educación. |

### Hoy / Panorama

- `/os` — desktop operativo adaptado a perfil/persona.
- `/os?view=panorama` — Big Picture/Panorama; evidencia canónica y objetos accionables, no scoring sintético.
- `/os/audit` — superficie de auditoría OS existente.
- `/os/imports` — superficie de importaciones OS existente.
- `/os/intercompany` — superficie intercompany existente.
- `/os/orchard-kitchen` — superficie combinada orchard/kitchen existente.

---

## 3. Operaciones

### 3.1 Hospitalidad / Booking

**Entrada primaria:** `/bookings`

`/bookings` es el cockpit de reservas y calendario. El árbol del módulo contiene las siguientes superficies:

| Ruta/familia | Uso |
|---|---|
| `/bookings` | Calendario/cockpit principal de Hospitalidad. |
| `/bookings/calendar` | Superficie de calendario. |
| `/bookings/reservations` | Catálogo y objeto Reservation; objeto canónico en `/bookings/reservations/[id]`. |
| `/bookings/rooms` | Catálogo y objeto Room; objeto canónico en `/bookings/rooms/[id]`. |
| `/bookings/guests` | Huéspedes/perfiles asociados a estadías. |
| `/bookings/blocks` | Bloqueos de habitaciones/unidades y disponibilidad. |
| `/bookings/activities` | Actividades asociadas a Hospitalidad. |
| `/bookings/charges` | Cargos de estadía/folio. |
| `/bookings/extras` | Extras/servicios adicionales. |
| `/bookings/payments` | Pagos de Hospitalidad. |
| `/bookings/invoices` | Facturas y acceso financiero de Hospitalidad. |
| `/bookings/documents` | Documentos operacionales de reserva. |
| `/bookings/quotes` | Cotización/quote de Hospitalidad. |
| `/bookings/rates` | Tarifas. |
| `/bookings/revenue` | Superficie de revenue. |
| `/bookings/reports` | Reportería de Booking. |
| `/bookings/requests` | Solicitudes de huésped; entrada utilizada por el OS. |
| `/bookings/housekeeping` | Housekeeping en contexto de Hospitalidad. |
| `/bookings/handovers` | Handover/cambio de turno y continuidad operacional. |
| `/bookings/operations` | Operaciones de Hospitalidad. |
| `/bookings/facilities` | Contexto de instalaciones para Hospitalidad. |
| `/bookings/audit` | Auditoría del dominio Booking. |
| `/bookings/e2e-harness` | Harness técnico; sólo debe habilitarse bajo configuración E2E. |

**Invariantes:** no doble booking silencioso, room blocks respetados, intervalos half-open, mutaciones sensibles validadas y source policy fail-closed.

### 3.2 Actividades

- `/activities-calendar` — calendario de actividades/experiencias operativas.

### 3.3 Tasks y Checklists

- `/tasks` — trabajo/tareas operacionales.
- `/checklists` — checklists ejecutables.

### 3.4 Procurement

**Entrada:** `/procurement`

Subsecciones existentes:

- `/procurement/requests` — solicitudes; objeto canónico `/procurement/requests/[id]`.
- `/procurement/sourcing` — sourcing/cotizaciones.
- `/procurement/approvals` — decisiones/aprobaciones.
- `/procurement/receiving` — recepción.
- `/procurement/suppliers` — proveedores en contexto Procurement.
- `/procurement/analytics` — analítica del módulo.

La cadena canónica de negocio es `request → sourcing/quotes → comparison → approval → PO → receipt → inventory intake`.

### 3.5 Maintenance e Issues

- `/maintenance` — trabajo de mantenimiento.
- `/issues` — incidencias/solicitudes de facility y excepciones.

### 3.6 Operaciones auxiliares existentes

Estas familias existen en el árbol de aplicación, aunque no todas forman parte del menú primario actual:

- `/operations`
- `/housekeeping`
- `/guest-requests`
- `/kitchen`

Se deben conservar como superficies compatibles mientras no exista una decisión explícita de deprecación.

---

## 4. Personas

### Navegación primaria

- `/employees` — empleados/personas operativas.
- `/os/people` — vista OS server-authorized de Personas.

### Superficies secundarias existentes

- `/hr` — superficie de RR.HH. existente.
- `/volunteers` — voluntariado.

La identidad de empleado aporta contexto, pero el acceso efectivo se resuelve desde perfiles/capabilities/scopes, no desde el nombre de la persona.

---

## 5. Lugares y Activos

### 5.1 Property Management

- `/property-management` — operación de propiedad/instalaciones.
- `/infrastructure` — infraestructura.
- `/assets` — superficie de activos existente fuera del objeto canónico de Inventory.

### 5.2 Inventory

**Entrada primaria:** `/inventory`

Subsecciones observadas en el árbol del módulo:

- `/inventory/[id]` — objeto canónico Asset.
- `/inventory/categories` — categorías.
- `/inventory/cost-centers` — centros de costo de inventario.
- `/inventory/counts` — conteos/cycle counts.
- `/inventory/audits` — auditorías físicas.
- `/inventory/audit-logs` — bitácoras de auditoría.
- `/inventory/intake` — ingreso/intake.
- `/inventory/replenishment` — reposición.

El objeto Asset conecta movimientos, custodia, mantenimiento e incidencias en contexto canónico.

### 5.3 Mapa / GIS

- `/map` — mapa operativo/GIS; ruta primaria cuando existe capability de mapa.
- `/map-lab` — superficie técnica/experimental de mapa existente; no confundir con la ruta productiva primaria.

### 5.4 Energía

- `/energy` — entrada primaria desde Lugares y Activos.
- `/energy-dashboard` — superficie adicional existente.
- `/energy-reports` — reportes de energía.
- `/victron-setup` — configuración/soporte Victron.

### 5.5 Combustibles y flota

- `/combustibles` — ruta primaria del dominio fuel.
- `/fuel-consumption` — consumo de combustible.
- `/fleet` — flota.
- `/ports-boats` — puertos/embarcaciones.

### 5.6 Orchard

- `/orchard`
- `/orchard/crops`
- `/orchard/care`
- `/orchard/harvest`
- `/orchard/pests`
- `/orchard/soil`
- `/orchard/equipment`

### 5.7 Vineyard

- `/vineyard`
- `/vineyard/photos`
- `/vineyard/crops`
- `/vineyard/harvest`
- `/vineyard/pests`

El árbol de la aplicación también contiene superficies Vineyard adicionales; el sidebar canónico expone las rutas anteriores como navegación estable.

### 5.8 Cattle

- `/cattle` — dashboard/operación de ganado.
- `/cattle-health` — salud animal.

---

## 6. Finanzas

### 6.1 Budget

**Entrada primaria:** `/budgets`

Subsecciones existentes:

- `/budgets/approvals`
- `/budgets/documents`
- `/budgets/reconciliation`
- `/budgets/reports`

### 6.2 Accounting

- `/accounting` — workspace contable.

### 6.3 Invoices

- `/bookings/invoices` — entrada de facturación de Hospitalidad dentro del área Finanzas.

La visibilidad de una ruta financiera no implica permiso de mutación. Las acciones financieras se vuelven a evaluar mediante capabilities/acciones efectivas y RLS.

---

## 7. Red / Network

Las siguientes son superficies server-authorized del OS:

- `/os/discovery` — Discovery.
- `/os/events` — Eventos.
- `/os/event-providers` — proveedores de eventos.
- `/os/front-door` — front door/acceso.
- `/os/education` — educación.

Superficies complementarias existentes:

- `/events` — módulo de eventos.
- `/event/[slug]` — portal/evento por slug.
- `/guest-access` — acceso de invitados.

Los portales guest/event son excepciones controladas a la regla general de autenticación interna; cada flujo debe mantener token/passcode/invite y ACL propios cuando corresponda.

---

## 8. Herramientas globales

### Concierge

- `/concierge` — superficie Concierge; sólo aparece cuando el usuario posee capacidad operativa de Hospitalidad.

### AI Ops

- `/ai-ops` — superficie administrativa AI Ops.

### Sovereignty

- `/sovereignty`
- subrutas de sovereignty existentes, incluyendo coach/layers según el árbol de aplicación.

### SOP

- `/sop`
- `/sop/[id]`
- `/sop/new`

SOP representa procedimientos ejecutables; no sustituye a Tasks ni a la autorización de acciones de dominio.

### Integration docs

- `/integration-docs` — superficie de documentación/integraciones existente en la aplicación.

---

## 9. Administración

**Entrada:** `/admin`

Familias actuales:

| Ruta | Uso |
|---|---|
| `/admin` | Overview administrativo con conteos live autorizados. |
| `/admin/access` | Gestión de acceso, perfiles, roles y scopes. |
| `/admin/asset-types` | Catálogo administrativo de tipos de activo. |
| `/admin/issue-types` | Catálogo administrativo de tipos de incidencia. |
| `/admin/locations` | Catálogo/gestión de ubicaciones. |
| `/admin/procurement-users` | Administración específica de usuarios Procurement existente. |
| `/admin/audit` | Auditoría administrativa. |
| `/admin/it-control` | IT Control Center live/read-only. |
| `/admin/security` | Alias/compatibilidad hacia el control live; no debe reintroducir KPI estático. |

### IT Control Center

`/admin/it-control` consume `get_it_control_center_snapshot()` desde servidor. La política es:

- usuario autenticado;
- perfil activo;
- `admin` **o** scope operacional IT activo;
- snapshot read-only;
- sin `service_role` en cliente;
- sin exponer mensajes de error internos de jobs como telemetría irrestricta.

---

## 10. Auth, root y estados globales

- `/` — entrada que resuelve locale y start path autorizado.
- `/auth/login` — login.
- `error.tsx` — error boundary de aplicación.
- `loading.tsx` y loading states de módulos — estados de carga.
- `not-found.tsx` — 404 localizado.

El start path de usuario se respeta sólo si la capability requerida para esa ruta sigue siendo válida; en caso contrario se usa un fallback seguro al OS.

---

## 11. API / integraciones de aplicación

El árbol `/api` está separado de las secciones UI. Las familias de API existentes en la baseline son:

- `/api/alerts`
- `/api/bookings`
- `/api/cattle`
- `/api/concierge`
- `/api/finance`
- `/api/fuel-consumption`
- `/api/guest-access`
- `/api/guest-requests`
- `/api/infrastructure`
- `/api/operations`
- `/api/send-whatsapp`
- `/api/send-whatsapp-notification`
- `/api/sovereignty`
- `/api/upload`
- `/api/vineyard`

Regla: el API no es una vía para saltar la autorización de UI. Los endpoints protegidos deben validar sesión/capability y la base mantiene RLS/constraints/RPC guards.

---

## 12. Rutas físicas existentes fuera del menú primario

Para cierre y mantenimiento, el árbol `app/` incluye estas familias además de la navegación OS primaria:

`/accounting`, `/activities-calendar`, `/admin`, `/ai-ops`, `/assets`, `/auth`, `/bookings`, `/budgets`, `/cattle`, `/cattle-health`, `/checklists`, `/combustibles`, `/concierge`, `/employees`, `/energy`, `/energy-dashboard`, `/energy-reports`, `/event`, `/events`, `/fleet`, `/fuel-consumption`, `/guest-access`, `/guest-requests`, `/housekeeping`, `/hr`, `/infrastructure`, `/integration-docs`, `/inventory`, `/issues`, `/kitchen`, `/maintenance`, `/map`, `/map-lab`, `/operations`, `/orchard`, `/os`, `/ports-boats`, `/procurement`, `/property-management`, `/sop`, `/sovereignty`, `/suppliers`, `/tasks`, `/victron-setup`, `/vineyard`, `/volunteers` y `/api`.

Este inventario debe ser actualizado cuando se agregue, fusione o depreque una familia de rutas.