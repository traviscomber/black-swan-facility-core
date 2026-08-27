# Modelo de datos y objetos canónicos

Este documento describe las entidades que deben considerarse canónicas al mantener Blackswan Facility Core. No reemplaza el schema SQL ni las migraciones; sirve como mapa de ownership y relaciones para evitar duplicar conceptos en nuevas features.

**Baseline:** `f22330dec23ed396d195abbdb5e1f9ed2ea61ed7`.

## 1. Regla de diseño

BSFC es **object-centered**: las pantallas y workflows deben converger en objetos operacionales identificables, con historial y relaciones explícitas.

Objetos principales:

- Reservation
- Guest
- Room / Bed
- Asset
- Work
- Purchase
- Invoice / Payment
- Stock / Inventory
- Person / Access Profile
- Location
- Event / Participant

Antes de crear una tabla o un concepto nuevo se debe preguntar si el dato ya pertenece a uno de estos objetos o a su historial.

---

## 2. Reservation

### Ruta canónica

`/bookings/reservations/[id]`

### Entidades relacionadas

- `reservations`
- `guests`
- `rooms`
- `beds`
- `room_blocks`
- actividades de reserva
- housekeeping vinculado
- maintenance/issues vinculados
- logística/pre-arrival
- cargos, extras, pagos y facturas
- documentos/timeline/audit

### Invariantes

- `check_out > check_in`;
- estadías y conflictos usan intervalos half-open;
- una reserva activa no puede solaparse silenciosamente sobre la misma cama/unidad;
- los room blocks activos participan en availability;
- cambios de inventario de habitación/cama deben mantener integridad referencial;
- housekeeping/maintenance creados desde una reserva deben conservar lineage a la reserva/unidad correcta;
- source/channel no es un string decorativo: determina política de mutación/importación.

### Ciclo operacional

La reserva conecta cotización/creación, pre-arrival, check-in, estadía, servicios, incidencias, housekeeping, checkout y cierre financiero. Los pasos que cambian inventario, estado o dinero deben ejecutarse mediante contratos/RPCs que validen el estado actual, no por updates libres desde UI.

---

## 3. Guest

### Superficie

`/bookings/guests`

El huésped es una identidad canónica reutilizable por reservas/eventos cuando corresponde. Datos de contacto y PII deben mantenerse detrás de autorización real; no duplicar perfiles sólo para resolver diferencias de UI.

Principios:

- PII scoped;
- company/contact/source/notes son contexto, no permisos;
- relación con eventos/discovery debe respetar opt-in y reglas de privacidad;
- importaciones deben reconciliar identidades en lugar de multiplicar registros silenciosamente.

---

## 4. Room / Bed

### Ruta canónica Room

`/bookings/rooms/[id]`

Room/Bed representan inventario físico de Hospitalidad. Availability se deriva del inventario y de restricciones reales; no de un KPI precalculado sin lineage.

Relacionados:

- rooms
- beds
- locations/property
- room blocks
- reservations
- housekeeping
- maintenance/issues
- estado operacional de habitación

Los cambios de estado de limpieza/disponibilidad deben ocurrir a través del workflow autorizado correspondiente.

---

## 5. Asset

### Ruta canónica

`/inventory/[id]`

### Entidades relacionadas verificadas

- `assets`
- `inventory_movements`
- `maintenance_tasks`
- `issues`
- `inventory_asset_custodies`
- `warehouse_locations`

### Ciclo

Un Asset puede tener ubicación, custodia, movimiento, auditoría física, mantenimiento, incidencia y retiro/estado operacional. La página objeto debe ser el punto de reunión de ese contexto.

No crear un segundo “asset master” para una feature local. Las superficies legacy/auxiliares deben converger hacia el Asset canónico o quedar explícitamente justificadas.

---

## 6. Stock / Inventory

### Entrada

`/inventory`

### Flujos principales

- catálogo/categorías;
- warehouse/location;
- movement/custody;
- cycle count;
- physical audit;
- replenishment;
- intake desde Procurement;
- relación con costo/centro de costo cuando aplica.

### Flujo de reposición esperado

`Stock bajo → Comprar → Aprobar → En camino → Recibir → Disponible / Stock listo`

Cada transición debe dejar evidencia suficiente para explicar por qué el stock cambió y desde qué documento/recepción provino.

---

## 7. Purchase / Procurement Request

### Ruta canónica

`/procurement/requests/[id]`

### Cadena canónica

`procurement_requests`
→ quotation rounds
→ quotation requests
→ supplier quotes
→ comparisons
→ approvals
→ purchase orders
→ receipts
→ receipt items
→ inventory intake

El objeto Purchase/Request no termina en la aprobación. Debe poder seguirse hasta la recepción y el impacto real en inventario.

Reglas:

- aprobación y decisión deben respetar role/scope;
- recepción debe preservar lineage a PO/request;
- intake no debe crear stock desconectado del receipt;
- logs de procurement son evidencia y no deben reescribirse como estado editable.

---

## 8. Work

“Work” es una capa conceptual común, no una tabla única obligatoria. En BSFC aparece mediante:

- Tasks
- Maintenance Tasks
- Issues
- Housekeeping
- Checklists/SOP executions
- guest/hospitality requests

El OS presenta trabajo unificado por contexto, pero conserva el objeto de origen y su autorización de dominio.

Principios:

- siempre mantener `source`/lineage cuando el trabajo nace de otro módulo;
- assignment no sustituye permiso;
- cerrar trabajo sensible puede requerir assignee, evidencia o aprobación;
- historial/eventos operacionales deben ser append-only cuando representan auditoría.

---

## 9. Invoice / Payment

Las superficies financieras conectan Hospitalidad y Finance sin mezclar visibilidad con autorización.

Entidades relevantes incluyen:

- invoices
- invoice lines/charges según workflow
- `invoice_payments` como relación canónica de pagos de factura
- documentos financieros y approval state
- budget/reconciliation/posting context

Principios:

- valores monetarios finales deben ser reproducibles desde datos persistidos;
- draft no debe interpretarse como documento finalizado;
- payment/settlement debe usar workflow explícito;
- no mostrar “pagado”, “saldo”, “ROI” o similares calculados de forma ficticia;
- números/correlativos de documentos se generan con contratos autorizados, no en cliente.

---

## 10. Person / Access Profile

La persona/employee y la identidad de Auth están relacionadas pero tienen responsabilidades distintas.

Capas:

1. usuario Supabase Auth;
2. `user_access_profiles` — rol, activo/inactivo, persona OS, start path;
3. employee/person — contexto organizacional;
4. `user_operational_scopes` — departamentos/ubicaciones permitidos;
5. capabilities/actions efectivas — autorización funcional.

Invariante: un employee existente no concede acceso por existir; un Auth user sin perfil activo debe fallar cerrado.

---

## 11. Location

Location es una dimensión transversal usada por Hospitality, Inventory, Maintenance, Procurement y otros dominios físicos.

Regla crítica: un scope específico de ubicación **no** autoriza objetos cuyo `location_id` sea NULL. La ausencia de ubicación nunca debe convertirse en acceso global accidental.

---

## 12. Event / Network / Discovery

Network conecta:

- events;
- event providers;
- guest/event portals;
- participants;
- member/guest/discovery relationships;
- front door;
- education.

Los flujos públicos son explícitos y tokenizados cuando aplica. Discovery no debe transformar datos de huésped/evento en exposición pública sin opt-in/contrato de privacidad.

---

## 13. Operational Event / Timeline

Los eventos operacionales permiten reconstruir qué ocurrió alrededor de objetos y workflows. Deben preferirse eventos/timelines con lineage a estados sintéticos que intenten resumir todo en un score.

Cuando una bitácora se usa como evidencia:

- append-only;
- actor/tiempo/objeto identificables;
- no DELETE/UPDATE genérico desde cliente;
- acciones privilegiadas auditables.

---

## 14. Control plane

El control plane de integraciones usa:

- registry privado de jobs;
- `integration_job_runs` para ejecuciones;
- health derivado por funciones privadas/controladas;
- pg_cron para schedules;
- retries/dead letters acotados.

`integration_job_runs` no debe abrirse con una policy amplia sólo para facilitar dashboards. El IT Control Center obtiene una proyección read-only autorizada mediante RPC.

---

## 15. Qué no hacer

- No crear duplicados de Reservation, Asset, Purchase o Person para una pantalla específica.
- No usar `user_metadata` como autoridad de permisos.
- No escribir en tablas de historial para “corregir” el pasado; registrar un evento correctivo.
- No crear stock sin receipt/intake lineage cuando proviene de compras.
- No inferir disponibilidad de Booking únicamente desde UI.
- No mezclar datos demo con producción.
- No usar métricas sintéticas como reemplazo de datos canónicos.

## 16. Fuente de verdad

La verdad final vive en:

1. migraciones/schema PostgreSQL;
2. constraints/triggers/RPCs;
3. RLS y perfiles/scopes;
4. objetos/rutas canónicas;
5. eventos/auditoría;
6. documentación de cierre como mapa explicativo.

Si este documento contradice una migración actual, la migración y el comportamiento verificado prevalecen y este documento debe actualizarse.