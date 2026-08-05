# Canon de Reservas Operacionales

## Autoridad

Este documento define el criterio funcional obligatorio para desarrollar Blackswan Facility Core. Ante contradicciones entre una pantalla, una implementación previa o documentación histórica, este canon prevalece hasta que una nueva decisión arquitectónica versionada lo reemplace.

## Identidad del producto

Blackswan Facility Core es el sistema operativo integral de Fundo Corcovado. Hospitalidad, traslados, actividades, alimentación, housekeeping, mantenimiento, logística, compras, inventario, espacios, vehículos, equipos y personas forman una sola operación coordinada.

El sistema no debe evolucionar como una colección de módulos aislados.

## Principio central

Toda actividad que comprometa tiempo, capacidad, espacio, personal o recursos debe poder administrarse mediante un motor común de reservas operacionales.

BedBooking es la referencia funcional para velocidad visual, ocupación y manipulación de reservas. Blackswan Facility Core debe conservar su propia marca, interfaz, código y alcance, extendiendo ese modelo a toda la operación.

## Reserva operacional

Una reserva operacional es un compromiso planificado que ocupa uno o más recursos durante un periodo y que puede generar participantes, servicios, tareas, dependencias, costos, pagos y responsabilidades.

Puede corresponder a alojamiento, traslado, vehículo, embarcación, espacio, actividad, experiencia, alimentación, evento, equipo, maquinaria, guía, conductor, personal, servicio interno o mantenimiento planificado.

## Cadena operacional

Reserva principal
→ participantes o huéspedes
→ servicios asociados
→ recursos reservados
→ tareas operacionales
→ responsables
→ dependencias
→ costos y pagos
→ seguimiento
→ cierre y auditoría

Una reserva principal puede generar subreservas y tareas. Una estadía, por ejemplo, puede generar alojamiento, traslado de llegada, preparación de habitación, alimentación, actividades, asignación de guía y vehículo, requerimientos de inventario, traslado de salida y cobro de extras.

## Superficie principal

La superficie principal debe ser un calendario operacional inspirado funcionalmente en BedBooking:

- 80–90% de la pantalla para el calendario;
- barra superior de una sola fila con métricas operacionales reales;
- panel lateral derecho con el detalle de la reserva seleccionada;
- panel inferior plegable con tareas operacionales del día.

La pantalla debe permitir entender en segundos:

- quién está, llega o sale;
- qué actividad ocurre;
- qué recurso está ocupado;
- quién es responsable;
- qué falta;
- qué conflicto existe;
- qué acción viene después.

## Unidad común de planificación

Las filas del calendario pueden representar alojamientos, habitaciones, camas, vehículos, embarcaciones, espacios, actividades, equipos, personas, servicios u otros recursos configurables.

Las vistas podrán agruparse por categoría, ubicación, operación, responsable o tipo de recurso.

## Reglas obligatorias

1. No se permiten reservas activas superpuestas sobre un mismo recurso o sobre una capacidad agotada.
2. Ningún conflicto puede ocurrir silenciosamente.
3. Check-out y término de reserva son límites exclusivos, salvo definición explícita distinta.
4. Toda modificación relevante debe registrar actor, fecha, razón y valores anteriores.
5. Las subreservas, servicios y tareas deben conservar relación con la reserva principal.
6. Toda tarea debe tener estado, fecha, prioridad y responsable cuando corresponda.
7. Los recursos deben soportar capacidad, disponibilidad, bloqueos y periodos fuera de servicio.
8. Los estados y transiciones deben ser explícitos y auditables.
9. Los totales financieros deben reproducirse desde tarifas, extras, impuestos, descuentos y pagos.
10. Las operaciones críticas deben ser transaccionales, idempotentes o recuperables.
11. La interfaz debe mostrar datos reales y estados honestos; nunca métricas inventadas.
12. Las reglas de disponibilidad y conflicto son determinísticas y no dependen de IA.
13. El producto debe funcionar en escritorio y en dispositivos usados en terreno.
14. Los overrides manuales deben registrar actor, motivo y timestamp.
15. Nunca se permite doble reserva silenciosa.

## Estados mínimos

Reservas: solicitud, provisional, confirmada, en preparación, lista, en curso, completada, cancelada, no presentada, bloqueada y con conflicto.

Tareas: pendiente, asignada, en curso, bloqueada, completada y cancelada.

Los estados válidos definitivos deben alinearse con el esquema real antes de migrar o modificar datos.

## Relación entre módulos

Los módulos aportan especialización, pero no reemplazan el motor común:

- Hospitalidad: huéspedes, alojamientos y estadías.
- Traslados: rutas, pasajeros, conductores y vehículos.
- Actividades: experiencias, capacidad, guías y equipamiento.
- Housekeeping: limpieza, lavandería y preparación.
- Mantenimiento: incidencias y recursos fuera de servicio.
- Inventario: consumibles y equipos requeridos.
- Compras: faltantes y abastecimiento.
- Personas: responsables, turnos y disponibilidad.
- Finanzas operacionales: tarifas, extras, pagos y costos.

## Criterio de aceptación

Una función debe ayudar a responder al menos una pregunta operacional:

- ¿Qué está reservado?
- ¿Para quién?
- ¿Cuándo y dónde?
- ¿Qué recurso utiliza?
- ¿Quién es responsable?
- ¿De qué depende?
- ¿Existe un conflicto?
- ¿Qué falta?
- ¿Qué acción sigue?
- ¿Cuál es su estado operacional o financiero?

Si no mejora alguna de estas decisiones, debe justificarse antes de incorporarse.
