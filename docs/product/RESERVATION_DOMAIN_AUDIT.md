# Auditoría base del dominio de reservas

Fecha de corte: 2026-08-05

## Resumen ejecutivo

El sistema no parte desde cero. Supabase ya contiene una base operacional amplia y Vercel tiene desplegados flujos recientes de calendario, logística y acciones unificadas.

La brecha principal es arquitectónica: el contrato central sigue orientado a alojamiento y las demás operaciones se conectan mediante tablas específicas. Para cumplir el canon, debe incorporarse una abstracción común de recursos reservables, asignaciones, capacidad, dependencias y conflictos.

## Evidencia verificada

### Núcleo de alojamiento

- `reservations`
- `rooms`
- `room_blocks`
- `guests`
- `payments`
- `reservation_history`
- `reservation_extras`
- `reservation_financial_adjustments`

`reservations` contiene datos de huésped, habitación, cama, check-in, check-out, estado, monto, fuente, tipo, llegada, salida, verificaciones y preferencias de housekeeping.

### Operación asociada

- `reservation_logistics`
- `reservation_activity_bookings`
- `reservation_room_readiness`
- `reservation_operational_exceptions`
- `guest_requests`
- `housekeeping_tasks`
- `tasks`
- `task_assignments`

La logística ya puede asociar reserva, dirección, modalidad, hub, hora ancla, vehículo, embarcación, conductor y responsable.

Las actividades ya pueden asociarse a una reserva con asistentes, precio, transporte requerido, ubicación de recogida y estado.

Housekeeping ya soporta reserva, habitación, programación, SLA, bloqueo, checklist, evidencia, inspección y puntuación de calidad.

### Recursos existentes

- `rooms`
- `vehicles`
- actividades y tipos de actividad
- tablas operativas de embarcaciones y personas referenciadas desde logística

No se verificó todavía una tabla genérica equivalente a `reservable_resources` ni una tabla común de asignaciones temporales entre reservas y cualquier tipo de recurso.

## Clasificación inicial

### Existente y reutilizable

- Identidad de reserva de alojamiento.
- Habitaciones y bloqueos.
- Pagos, extras y ajustes.
- Logística de llegada y salida.
- Actividades asociadas a reservas.
- Housekeeping y readiness.
- Tareas, asignaciones, evidencia e historial.
- Excepciones operacionales.
- Historial y eventos de booking.

### Parcialmente compatible

- `reservations`: sólido para estadías, pero no genérico para toda reserva operacional.
- `activities`: maneja eventos y capacidad, pero no asigna recursos comunes ni previene conflictos entre recursos.
- `tasks`: permite origen polimórfico mediante `source_type` y `source_id`, pero no define una dependencia formal común con reservas y subreservas.
- `reservation_logistics`: conecta vehículos y responsables, pero no se ha verificado prevención de solapamientos temporales.
- `room_blocks`: resuelve bloqueos de habitaciones, no bloqueos universales de recursos.

### Faltante o no verificado

- Catálogo común de tipos de reserva.
- Catálogo común de recursos reservables.
- Asignaciones temporales genéricas reserva–recurso.
- Capacidad compartida y consumo parcial.
- Bloqueos universales por recurso.
- Dependencias formales entre reservas.
- Plantillas operacionales que generen servicios y tareas.
- Restricción transaccional universal contra solapamientos.
- Contrato común para espacios, equipos, vehículos, embarcaciones y personas.
- Matriz completa de RLS y permisos del dominio unificado.

### Riesgo de duplicación

- Estados definidos como texto libre en varias tablas.
- Lógica de fechas separada entre reservas, actividades, logística, tareas y bloqueos.
- Posible duplicación de estados operacionales entre `tasks` y `housekeeping_tasks`.
- Posible duplicación de pagos entre `payments` e `invoice_payments`.
- Posible duplicación de eventos entre `booking_events`, `reservation_history` y `activity_logs`.

Estas duplicaciones deben verificarse antes de cualquier consolidación.

## Estado de implementación web

Se verificó un calendario mensual genérico en `app/activities-calendar/page.tsx`. Consulta `activities` y `activity_types`, agrupa por fecha y abre un formulario. Es una agenda de actividades, no el motor operacional común.

El historial reciente de Vercel muestra despliegues productivos READY para:

- calendario operacional unificado;
- acciones unificadas en calendario;
- integración de logística;
- editor y panel de control logístico;
- ventanas de turnaround;
- calendario de habitaciones como vista principal.

Esto indica que la base visual y operacional de Hospitalidad debe reutilizarse, no reemplazarse desde cero.

## Decisión de diseño

El camino recomendado es una transición incremental:

1. mantener `reservations` como raíz de compatibilidad para estadías;
2. introducir recursos reservables y asignaciones comunes;
3. mapear habitaciones al nuevo contrato primero;
4. extender el mismo contrato a vehículos, embarcaciones, espacios, actividades, equipos y personas;
5. mover disponibilidad y conflictos al núcleo común;
6. adaptar el calendario actual para agrupar cualquier tipo de recurso;
7. preservar tablas especializadas para detalles propios del dominio.

## Próximas verificaciones obligatorias

1. Foreign keys y constraints reales del dominio.
2. Índices y exclusiones contra solapamientos.
3. Estados distintos presentes en producción.
4. Conteos y calidad de registros por tabla.
5. RLS y grants de todas las tablas relevantes.
6. Código exacto del calendario principal de reservas.
7. APIs, server actions y componentes que escriben reservas.
8. Errores de runtime y comportamiento visual del despliegue productivo.

## Restricción

Esta auditoría no autoriza eliminar, renombrar o migrar datos productivos. Toda evolución estructural debe realizarse mediante migraciones versionadas, reversibles y verificadas.
