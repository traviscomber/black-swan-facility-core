# Auditoría Técnica — Preparación para Fase C (Revenue & Optimization)
**Fecha:** 2026-07-24  
**Scope:** Modelo de datos, RPCs, API routes, componentes React del dominio bookings  
**Preparado para:** Implementación de C1→C5

---

## 1. INVENTARIO DE TABLAS DEL DOMINIO BOOKINGS

### Tablas core (revenue-relevant)

| Tabla | Filas | Estado | Observaciones |
|---|---|---|---|
| `reservations` | 7 | PRODUCTION | Fuente primaria de revenue. Tiene `total_amount`, `check_in/check_out`, `status`, `bed_id`, `room_id`, `location_id` |
| `rooms` | 9 | PRODUCTION | `rate_per_night`, `location_id`, `capacity`, `max_guests`, `status`. FK a `locations` |
| `beds` | 20 | PRODUCTION | 20 camas en 9 rooms. `is_available`, `room_id`. Denominador de ocupacion |
| `locations` | 14 | PRODUCTION | 14 ubicaciones activas. `name`, `is_active`, `facility_type` |
| `pricing_rules` | 0 | VACIA | Tabla existe, constraints validos, index existe. Cero reglas de precios creadas |
| `booking_settings` | 1 | OK | `currency=CLP`, `lodging_tax_rate=0`, `service_fee=0`. Singleton |
| `room_blocks` | 0 | VACIA | Tabla existe con indexes GIST y BTREE. Sin bloqueos activos |
| `booking_extras` | 0 | VACIA | Extras del catalogo no configurados |
| `reservation_extras` | 0 | VACIA | Ninguna reserva tiene extras linkeados |
| `invoices` | 0 | VACIA | No hay facturas emitidas |
| `invoice_payments` | 0 | VACIA | Tabla de pagos parciales de facturas, vacia |
| `payments` | 0 | VACIA | Tabla de pagos de reservas, vacia |
| `bulk_operations` | 3 | OK | 3 operaciones bulk almacenadas (Fase B) |
| `guests` | 4 | OK | Solo 4 guests registrados. `vip_status` disponible |

### Schema de las tablas clave

#### `reservations` — fuente de verdad para revenue
```
id uuid, room_id uuid, guest_name text, guest_email text, guest_phone text,
check_in date NOT NULL, check_out date NOT NULL,
status text DEFAULT 'confirmed',   -- confirmed | checked_in | checked_out | cancelled | void | no_show
num_guests integer DEFAULT 1,
special_requests text, total_amount numeric,
bed_id uuid, guest_id uuid, bedbooking_ref text,
payment_status text DEFAULT 'pending',   -- pending | partial | paid
source text DEFAULT 'direct',
booking_type text DEFAULT 'BED',
location_id uuid
```
GAP: No existe `check_in_time` / `check_out_time` (solo fechas). Para Fase D housekeeping esto es limitante.

#### `rooms`
```
id uuid, room_number text UNIQUE, room_type text,
capacity integer NOT NULL DEFAULT 2, status text DEFAULT 'clean',
location text,        -- texto libre legacy, NO ES FK
location_id uuid,     -- FK real a locations — usar este
amenities ARRAY, rate_per_night numeric, notes text,
max_guests integer DEFAULT 2, floor text, bed_type text
```
GAP: `location text` (campo legacy libre) coexiste con `location_id uuid`. El quote engine usa `location_id` correctamente.

#### `pricing_rules`
```
id uuid, room_id uuid,   -- NULL = aplica a todos los rooms
season_name text, start_date date NOT NULL, end_date date NOT NULL,
rate_multiplier numeric DEFAULT 1.0,
min_stay integer DEFAULT 1
```
ESTADO: Tabla completamente vacía. El quote engine ya la consume. C2 puede crear reglas sin migración adicional.

---

## 2. INVENTARIO DE RPCs

### RPCs del dominio bookings

| RPC | Estado | Uso en Fase C |
|---|---|---|
| `get_occupancy_heatmap(start_date, end_date, location_id?)` | EXISTE EN PROD | C1 — primaria, ya funcionando |
| `get_booking_inventory_events(start_date, end_date, location_id?)` | EXISTE EN PROD | C3 gap detection, C2 overlay |
| `calculate_booking_quote(check_in, check_out, guests, room_id?, extras?)` | EXISTE EN PROD | C2 pricing preview, C4 smart suggestions |
| `is_booking_inventory_available(bed_id, room_id, location_id, check_in, check_out, exclude?)` | EXISTE EN PROD | C4 validar slot antes de sugerir |
| `create_reservation_atomic(bed_id, guest_name, ...) -> jsonb` | EXISTE EN PROD | C5 auto-fill (reemplazar insert directo) |
| `resize_booking_reservation(id, check_in, check_out)` | EXISTE EN PROD | C4 extend gaps |
| `execute_bulk_update(updates, operation_type)` | EXISTE EN PROD | C5 bulk auto-fill |
| `check_bulk_conflicts(updates)` | EXISTE EN PROD | C4, C5 pre-validation |

### Output de `get_occupancy_heatmap`
```
day date, location_id uuid, location_name text,
total_beds integer, occupied_beds integer, blocked_beds integer,
available_beds integer, occupancy_pct numeric,
revenue numeric, avg_rate numeric
```
NOTA: El RPC agrega por (day, location), NO por (day, bed). Para heatmap per-bed se necesita variante.

### Output de `get_booking_inventory_events`
```
event_id uuid, event_type text, bed_id uuid, room_id uuid, location_id uuid,
starts_on date, ends_on date, status text, label text, guest_name text,
block_type text, source text, total_amount numeric
```
USO EN C3: Retorna rangos completos. La lógica de "espacio vacío entre eventos" vive en React o en un RPC dedicado.

---

## 3. INVENTARIO DE API ROUTES

### Routes del dominio revenue/bookings

| Route | Method | Estado |
|---|---|---|
| `GET /api/bookings/revenue/occupancy` | GET | IMPLEMENTADA — thin proxy a `get_occupancy_heatmap`. Max 90 días |
| `POST /api/bookings/revenue/auto-fill-gap` | POST | DEFECTUOSA — ver gaps críticos |
| `POST /api/bookings/quote` | POST | EXISTE — proxy a `calculate_booking_quote` |
| `GET/POST /api/bookings/invoices` | CRUD | EXISTE |
| `GET /api/bookings/reservations` | GET | EXISTE |
| `POST /api/bookings/bulk/execute` | POST | EXISTE — Fase B |
| `GET /api/bookings/bulk/check-conflicts` | GET | EXISTE — Fase B |

### Gap crítico en `auto-fill-gap`
```typescript
// PROBLEMA 1: No usa create_reservation_atomic — bypasea trigger de validación
// PROBLEMA 2: guest_name hardcodeado a "[GAP FILLER]"
// PROBLEMA 3: num_guests=0 (puede fallar en validaciones futuras)
// PROBLEMA 4: No hay check de disponibilidad previo
const { data, error } = await supabase.from("reservations").insert([{
  bed_id,
  check_in,
  check_out,
  guest_name: "[GAP FILLER]",  // hardcoded
  num_guests: 0,               // 0 guests
  total_amount: totalAmount,
  status: "confirmed",
}])
```
ACCION REQUERIDA C5: Reescribir para usar `create_reservation_atomic`.

---

## 4. INVENTARIO DE PÁGINAS Y COMPONENTES

### Páginas en `/app/bookings/`

| Ruta | Estado | Notas |
|---|---|---|
| `/bookings` (calendario) | COMPLETA | Fases A+B |
| `/bookings/reports` | COMPLETA | Dashboard con stats + OccupancyHeatmap integrado |
| `/bookings/reports` (OccupancyHeatmap) | COMPLETA | C1 completamente funcional |
| `/bookings/rates` | EXISTE | Gestión de `pricing_rules` — vacías |
| `/bookings/blocks` | EXISTE | Gestión de `room_blocks` — vacíos |
| `/bookings/invoices` | EXISTE | Lista de facturas — vacías |
| `/bookings/guests` | EXISTE | CRM de guests — 4 registros |
| `/bookings/extras` | EXISTE | Catálogo de extras — vacío |
| `/bookings/quotes` | EXISTE | Cotizador con `calculate_booking_quote` |
| `/bookings/housekeeping` | EXISTE | Legacy — NO usa schema Phase D |

### Componente `OccupancyHeatmap` — arquitectura interna (C1 COMPLETO)
```
OccupancyHeatmap (occupancy-heatmap.tsx)
├── KpiCards — 4 KPIs: ocupacion%, revenue total, tarifa avg/noche, camas totales + pico
├── Controls — month nav (prev/next) + location filter select + refresh button
├── HeatmapGrid — CSS grid: cols=days(28-31), rows=locations activas
│   ├── HeatmapCell — color por occupancy_pct via occupancyColor(), hover → tooltip state
│   └── Totals row — revenue/día en fila inferior
├── HeatmapLegend — escala 0→100% con 6 colores
└── HeatmapTooltip — fixed position, ocupacion%, beds, revenue, avg_rate, fecha formato ES
```
C1 VEREDICTO: No requiere trabajo adicional.

### Nav layout — 15 tabs
```
Calendar → Operaciones → Housekeeping → Bloqueos → Cotizador → Tarifas →
Extras → Cargos → Auditoría → Huéspedes → Pagos → Facturas → Facilities → Rooms → Reportes
```
"Reportes" está en tab 15. El heatmap ya está integrado ahí.

---

## 5. ANÁLISIS DE ÍNDICES DE PERFORMANCE

### Índices críticos para los RPCs de revenue

| Index | Tabla | Columnas | Cubre |
|---|---|---|---|
| `reservations_quote_availability_idx` | reservations | `(room_id, check_in, check_out, status)` | C1, C2, C3 |
| `idx_reservations_bed_dates` | reservations | `(bed_id, check_in, check_out)` partial | C1, C3 |
| `idx_reservations_location_id` | reservations | `location_id` | C1 filter |
| `room_blocks_quote_availability_idx` | room_blocks | `(room_id, start_date, end_date, status)` | C1 |
| `room_blocks_no_active_overlap` | room_blocks | GiST daterange | overlap prevention |
| `pricing_rules_quote_lookup_idx` | pricing_rules | `(room_id, start_date, end_date)` | C2 |
| `idx_beds_room_id` | beds | `room_id` | C1 join |
| `idx_rooms_location_id` | rooms | `location_id` | C1 join |

VEREDICTO: Todos los índices necesarios para C1-C3 ya existen. No se requieren índices adicionales con 7 reservaciones.

Índice candidato para futuro (no urgente ahora):
```sql
-- Para C3 gap detection a nivel bed cuando reservations > 1000:
CREATE INDEX CONCURRENTLY idx_reservations_bed_checkin_checkout
  ON reservations (bed_id, check_in, check_out);
```

---

## 6. GAPS Y RIESGOS IDENTIFICADOS

### GAP 1 — `pricing_rules` vacía (impacto C2)
C2 (pricing overlay) mostrará tarifas base pero sin reglas de temporada no hay overlay visual útil.
Mitigación: Seedear reglas de ejemplo desde `/bookings/rates`. No requiere migración.

### GAP 2 — `payment_status` no sincronizado con `payments`
`reservations.payment_status` existe pero la tabla `payments` tiene 0 filas. No hay trigger de sync.
Impacto C1: No bloquea — el heatmap usa `total_amount` (monto comprometido, correcto).
Impacto C4/C5: Relevante si se quieren filtrar reservas por estado de pago.

### GAP 3 — `reservation_extras` vacía
Los extras del catálogo no se adjuntan a reservas reales. El revenue del heatmap puede estar subvalorado si extras no se incluyen en `total_amount`.
No bloquea C1. Documentar limitación en tooltip.

### GAP 4 — `auto-fill-gap` bypasea validaciones atómicas (BLOCKER para C5)
Ver análisis en sección 3. Debe reescribirse antes de implementar C5.

### GAP 5 — No existe RPC de gap detection (impacto C3/C4)
Para C3 MVP, el gap detection puede vivir en React sobre datos de `get_booking_inventory_events`.
Para C4 a escala, recomendar RPC con `LEAD()` window function.

### GAP 6 — Phase D migration NO ejecutada en producción
La migración `20260725000000_phase_d_operations.sql` fue escrita pero NO ejecutada.
Tablas `housekeeping_schedules` y `maintenance_schedules` NO existen en el schema live.
ACCION: Ejecutar en Supabase antes de construir UI de Phase D.

### GAP 7 — N+1 queries en `reports/page.tsx`
11+ queries separadas por carga de página (loop de 6 meses + múltiples queries paralelas).
No bloquea con 7 reservas. Optimizar cuando reservations > 500 con un RPC consolidado.

---

## 7. ESTADO DE IMPLEMENTACIÓN POR FEATURE

| Feature | Migración | API Route | Componente React | Estado |
|---|---|---|---|---|
| C1 — Occupancy Heatmap | OK (RPC existe) | OK | OK | COMPLETO |
| C2 — Pricing Overlay | N/A (usa pricing_rules existente) | Reusar /api/bookings/quote | NO EXISTE | PENDIENTE |
| C3 — Gap Detector | N/A (React sobre eventos existentes) | Reusar get_booking_inventory_events | NO EXISTE | PENDIENTE |
| C4 — Smart Suggestions | Nuevo RPC get_gaps_with_suggestions | NO EXISTE | NO EXISTE | PENDIENTE |
| C5 — Auto-Fill Gaps | N/A (usa create_reservation_atomic) | DEFECTUOSA (fix requerido) | NO EXISTE | PARCIAL/DEFECTUOSO |

---

## 8. PLAN TÉCNICO POR FEATURE

### C2 — Pricing Overlay

Objetivo: Mostrar en el calendario qué temporadas/multiplicadores aplican en cada fecha.

Datos disponibles: `pricing_rules` table (vacía pero estructura ok) + `calculate_booking_quote` RPC.

Construir:
1. Componente `PricingOverlay` superpuesto al header del calendario
2. Leer `pricing_rules WHERE start_date <= fecha <= end_date`
3. Dialog de crear/editar reglas (complementa `/bookings/rates`)
4. Nueva API: `GET /api/bookings/revenue/pricing-rules?start=&end=&room_id=`

Migración: 0 nuevas tablas, 0 nuevas columnas.

---

### C3 — Gap Detector

Objetivo: Listar huecos entre reservaciones consecutivas para el mismo bed.

Algoritmo React (sobre datos existentes):
```typescript
// 1. Llamar get_booking_inventory_events(start, end, location_id)
// 2. Agrupar por bed_id
// 3. Para cada bed, ordenar eventos por starts_on
// 4. Comparar ends_on[i] con starts_on[i+1]
// 5. Si gap >= min_gap_days → hueco optimizable

interface Gap {
  bed_id: string
  room_id: string
  location_name: string
  gap_start: string    // = ends_on del evento anterior
  gap_end: string      // = starts_on del evento siguiente
  gap_days: number
  before_guest: string
  after_guest: string
  potential_revenue: number  // gap_days * rooms.rate_per_night
}
```

No requiere migración ni API nueva.

---

### C4 — Smart Suggestions

Objetivo: Para cada gap de C3, sugerir "Crear reserva aquí — X noches, $Y revenue potencial."

Componente: `GapSuggestionCard` con botón "Ver disponibilidad" → llama `calculate_booking_quote`.

RPC recomendado para escala:
```sql
-- get_gaps_with_suggestions(p_start_date, p_end_date, p_location_id, p_min_gap_days)
-- Usa LEAD() window function sobre reservaciones ordenadas por bed/fecha
-- Retorna: bed_id, gap_start, gap_end, gap_days, potential_revenue, room_rate
```

Migración: 1 nuevo RPC (no tablas nuevas).

---

### C5 — Auto-Fill Gaps

Objetivo: Desde sugerencia C4, confirmar → crear reserva bloqueadora.

Fix requerido en API:
```typescript
// Reemplazar insert directo por:
const { data } = await supabase.rpc('create_reservation_atomic', {
  p_bed_id: bed_id,
  p_guest_name: guest_name || 'Bloqueo interno',
  p_check_in: check_in,
  p_check_out: check_out,
  p_total_amount: estimated_revenue,
  p_status: 'confirmed'
})
```

UI: Modal de confirmación (fechas, noches, revenue estimado, bed/room) + botón "Confirmar".

---

## 9. ORDEN DE IMPLEMENTACIÓN RECOMENDADO

```
C1 — COMPLETO

C2 (independiente, puede ir en paralelo con C3)
C3 → C4 → C5 (dependencia lineal)
```

Secuencia sugerida:
1. C3 + C2 en paralelo — C3 es React puro (rápido), C2 requiere UI de overlay
2. C4 — depende de C3 para tener gaps identificados
3. C5 — depende de C4 (UI) + fix del API defectuoso

---

## 10. DECISIONES ARQUITECTÓNICAS CONFIRMADAS

| Decisión | Veredicto |
|---|---|
| occupancy_snapshots table | NO — 7 reservaciones, RPC en tiempo real es suficiente hasta ~5000 |
| Gap detection en React vs SQL | React para C3 MVP; SQL LEAD() para C4 si escala |
| pricing_rules carga | Lazy, solo al renderizar overlay |
| Phase D tables | PENDIENTE de ejecutar migración en Supabase prod |
| get_occupancy_heatmap RPC | CONFIRMADO en producción |
| auto-fill-gap route | REESCRIBIR antes de C5 con create_reservation_atomic |

---

## 11. RESUMEN EJECUTIVO

Listo para Fase C sin trabajo adicional:
- C1 Heatmap — 100% completo (RPC + API + componente React + integrado en /bookings/reports)
- Todos los índices necesarios para C1-C3 existen
- get_booking_inventory_events disponible para C3 sin migración
- calculate_booking_quote disponible para C2/C4 sin migración
- create_reservation_atomic disponible para fix de C5

Requiere trabajo antes de construir:
- Corregir auto-fill-gap API (C5 blocker)
- Crear RPC get_gaps_with_suggestions (C4 optional optimization)
- Seedear pricing_rules para que C2 muestre datos reales

No bloquea C pero debe monitorearse:
- Phase D migration pendiente de ejecutar en Supabase
- N+1 queries en reports/page.tsx (optimizar cuando reservations > 500)
- reservation_extras vacía (revenue underreported si extras no se linkean)
