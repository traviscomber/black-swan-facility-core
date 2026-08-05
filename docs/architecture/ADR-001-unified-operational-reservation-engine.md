# ADR-001: Motor unificado de reservas operacionales

## Estado

Aceptado.

## Contexto

Blackswan Facility Core ya dispone de reservas de alojamiento, habitaciones, bloqueos, logística, actividades asociadas, tareas, housekeeping, pagos, readiness y excepciones operacionales. Sin embargo, estas capacidades están distribuidas entre dominios específicos y el contrato principal de `reservations` sigue centrado en alojamiento mediante `room_id`, `bed_id`, `check_in` y `check_out`.

El producto requiere representar bajo una misma lógica cualquier compromiso temporal que consuma capacidad o recursos: alojamiento, traslado, actividad, espacio, vehículo, embarcación, equipo, guía, conductor, personal o servicio.

## Decisión

Blackswan Facility Core evolucionará hacia un motor unificado de reservas operacionales.

El motor común será responsable de:

- identidad y ciclo de vida de la reserva;
- intervalo temporal y zona horaria;
- participantes y responsables;
- asignación de uno o más recursos;
- capacidad y disponibilidad;
- bloqueos y periodos fuera de servicio;
- prevención transaccional de solapamientos;
- servicios, tareas y dependencias generadas;
- cargos, pagos y trazabilidad financiera;
- eventos, historial y overrides auditables;
- conflictos y excepciones operacionales.

Los módulos especializados conservarán sus datos propios, pero se conectarán al núcleo mediante relaciones explícitas. No se duplicará la lógica de disponibilidad o conflicto en cada módulo.

## Estrategia de transición

1. Auditar el esquema y código actuales antes de crear tablas.
2. Mantener compatibilidad con `reservations`, `rooms`, `room_blocks`, `reservation_logistics`, `reservation_activity_bookings`, `housekeeping_tasks`, `tasks` y `payments`.
3. Introducir un contrato genérico de recursos reservables y asignaciones mediante migraciones versionadas.
4. Adaptar alojamiento primero, sin eliminar columnas existentes.
5. Incorporar traslados, actividades, espacios, equipos y personas progresivamente.
6. Migrar lectura y escritura por etapas, con verificaciones y rollback.
7. Eliminar contratos legados únicamente cuando no existan consumidores activos y haya evidencia de paridad.

## Invariantes

- No puede existir doble reserva silenciosa.
- El límite final del intervalo es exclusivo salvo regla explícita distinta.
- Toda modificación crítica es auditable.
- Los conflictos se detectan en base de datos o en una operación transaccional, no solo en interfaz.
- Las reglas determinísticas no dependen de IA.
- La disponibilidad se calcula desde recursos, asignaciones, capacidad y bloqueos reales.

## Consecuencias

### Positivas

- Un calendario único para toda la operación.
- Menor duplicación de reglas.
- Dependencias y tareas visibles desde la reserva principal.
- Capacidad de ampliar el sistema sin crear otro motor de calendario.
- Auditoría y prevención de conflictos consistentes.

### Costos y riesgos

- Migración progresiva de un dominio actualmente centrado en habitaciones.
- Necesidad de preservar compatibilidad con flujos productivos existentes.
- Mayor exigencia en restricciones, RLS, concurrencia y pruebas.
- Posible coexistencia temporal entre contratos nuevos y legados.

## Referencias

- `docs/product/RESERVATION_OPERATING_CANON.md`
- `docs/product/RESERVATION_DOMAIN_AUDIT.md`
