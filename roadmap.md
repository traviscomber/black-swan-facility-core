# Roadmap de estabilización — 30 días

Fecha de inicio: 26-07-2026  
Sistema: Black Swan Facility Core — Fundo Corcovado, Valdivia, Chile

## Objetivo

Cerrar brechas críticas de seguridad, permisos, trazabilidad y confiabilidad operativa sin interrumpir reservas, finanzas, mantenimiento, compras, mapas ni la operación diaria. Mantener terminología chilena, fechas `es-CL`, zona `America/Santiago` y CLP cuando corresponda.

## Estado de ejecución

- [x] Retirar endpoint de seed de reservas en producción.
- [x] Restringir operaciones masivas de reservas a administradores.
- [x] Inventariar y cerrar ejecución anónima de RPC críticos.
- [x] Endurecer RLS en datos personales, financieros y operativos.
- [x] Volver append-only nueve bitácoras operativas y administrativas.
- [x] Alinear operaciones masivas con prevalidación, atomicidad, historial y deshacer.
- [x] Refactorizar facturas para Black Swan y Chile, con impresión A4 y prevalidación.
- [x] Llevar políticas RLS `ALL` amplias sin restricción efectiva a cero.
- [x] Ampliar tareas para trabajadores y voluntarios en todas las áreas.
- [x] Conectar tareas con hospitalidad, housekeeping, mantenimiento, ganadería e incidencias.
- [x] Añadir evidencia, comentarios y envío manual por WhatsApp Web.
- [x] Mostrar estado, responsables y acceso directo de la tarea vinculada en los módulos de origen.
- [x] Preparar una interfaz desacoplada de notificaciones para WhatsApp Web y futura GreenAPI.
- [ ] Completar cobertura de acciones críticas y permisos por módulo.
- [ ] Validar flujos completos por rol y dispositivo.

## Estado verificado

- Los 13 RPC `SECURITY DEFINER` inventariados no conservan `EXECUTE` para `anon` o `PUBLIC`.
- `execute_bulk_update` y `restore_bulk_operation_state` verifican rol `admin` dentro del RPC.
- Las tablas sensibles revisadas usan políticas separadas por operación; `DELETE` queda limitado a `admin`.
- Nueve bitácoras son append-only.
- `bulk_operations` conserva 3 registros históricos y solo se modifica mediante RPC controlado.
- Facturación exige sesión, valida UUID, fechas, estados y montos CLP; creación/edición requiere `admin` o `approver` y eliminación requiere `admin`.
- El editor de facturas usa el logo Black Swan, CLP sin decimales, fechas chilenas y salida A4 limpia.
- Producción conserva 7 reservas confirmadas; 5 tienen prefijo `TEST_`. Ninguna fue modificada.
- `reviews` permanece con 0 registros; `volunteers` conserva 1 registro.
- Conteo de políticas `ALL` amplias sin restricción efectiva: **0**.
- `/tasks` admite trabajadores y voluntarios, área, categoría, duración, manejo animal, seguridad y referencia de origen.
- Las tareas se crean y editan mediante RPC atómicos con validación interna de rol.
- El índice de origen impide más de una tarea abierta para el mismo registro.
- Hospitalidad, housekeeping, mantenimiento, ganadería e incidencias pueden crear tareas precompletadas.
- Los módulos de origen muestran estado de la tarea vinculada, responsables y acceso directo a `/tasks?selected=<id>`.
- `/tasks` abre automáticamente el detalle solicitado y selecciona la pestaña correspondiente a su estado.
- `task_evidence` usa almacenamiento privado y URL firmada temporal; imágenes y PDF hasta 10 MB.
- `task_comments` registra autor y fecha; WhatsApp Web abre mensajes precompletados y no envía automáticamente.
- `lib/notifications/task-notification.ts` centraliza normalización de teléfonos chilenos, construcción de mensajes y selección de proveedor.
- El proveedor activo sigue siendo `whatsapp_web`, en modo manual y con confirmación humana.
- `greenapi` está modelado como proveedor futuro, pero falla de forma explícita mientras no existan credenciales, endpoint y reglas aprobadas; no se introdujeron secretos ni envíos automáticos.
- Producción mantiene 20 trabajadores, 1 voluntario, 0 tareas, 0 asignaciones, 0 comentarios y 0 evidencias. No se modificaron filas operativas en este bloque.

## Prioridades

1. Conectar el botón actual de WhatsApp a la abstracción común y añadir pruebas unitarias del mensaje y normalización chilena.
2. Probar creación, edición, evidencia, comentarios y cambios de estado con datos controlados.
3. Auditar operaciones destructivas restantes en pagos, presupuestos, inventario y compras.
4. Registrar acciones críticas reales: anulaciones, pagos, cambios financieros, permisos y borrados.
5. Completar matriz de permisos para `admin`, `approver` y usuario autenticado.
6. Validar módulos críticos por rol en desktop y móvil.
7. Validar visualmente impresión/PDF con una factura controlada y autorización explícita.
8. Revisar exposición de datos personales en respuestas API y logs.
9. Confirmar consistencia Chile: CLP, `es-CL`, zona local y terminología tributaria.
10. Eliminar datos de prueba únicamente con autorización específica.

## Semana 1 — Contención crítica

- [x] Verificar deployments en `READY`.
- [x] Cerrar ejecución anónima de RPC críticos.
- [x] Proteger rutas administrativas en servidor.
- [x] Endurecer operaciones masivas de reservas y facturas.
- [ ] Completar auditoría destructiva en pagos, presupuestos, inventario y compras.
- [ ] Completar matriz inicial de permisos por módulo y acción.

## Semana 2 — Datos personales y financieros

- [x] Endurecer RLS en huéspedes, reservas, facturas, pagos, leads, mensajes y presupuestos.
- [x] Separar lectura, creación, actualización y eliminación.
- [x] Eliminar acceso anónimo y limitar eliminación a `admin`.
- [x] Implementar facturación chilena, impresión A4 y prevalidación.
- [x] Endurecer `reviews` y `volunteers`.
- [ ] Validar impresión/PDF con una factura controlada.
- [ ] Añadir pruebas negativas por rol.
- [ ] Revisar exposición de datos personales.

## Semana 3 — Auditoría, roles y trazabilidad

- [x] Volver append-only nueve bitácoras.
- [x] Permitir tareas para trabajadores y voluntarios con creación y edición atómicas.
- [x] Añadir catálogo operacional para todas las áreas principales.
- [x] Conectar tareas desde hospitalidad, housekeeping, mantenimiento, ganadería e incidencias.
- [x] Añadir evidencia, comentarios y WhatsApp Web.
- [x] Mostrar progreso y responsables de tareas en los módulos de origen.
- [x] Preparar interfaz de proveedor para GreenAPI sin activar envío automático.
- [ ] Integrar GreenAPI cuando existan credenciales y reglas aprobadas.
- [ ] Registrar acciones críticas y completar matriz final de permisos.

## Semana 4 — Validación integral y cierre

- [ ] Ejecutar pruebas por rol en desktop y móvil.
- [ ] Validar dashboard, reservas, mantenimiento, inventario, compras, propiedades, personas, ganadería, viñedo, energía, mapas y administración.
- [ ] Revisar errores de runtime y logs de Vercel de los últimos siete días.
- [ ] Corregir regresiones de permisos, carga, estados vacíos y formularios.
- [ ] Confirmar que no quedan mocks, métricas inventadas ni textos desactualizados.
- [ ] Confirmar formato `es-CL`, CLP y fechas locales.
- [ ] Documentar permisos, migraciones, rollback, rutas críticas y soporte.
- [ ] Decidir específicamente si se eliminan las cinco reservas `TEST_`.

## Indicadores de éxito

- [x] 0 RPC críticos ejecutables por `anon` o `PUBLIC`.
- [x] 0 tablas con políticas `ALL` amplias sin restricción efectiva.
- [x] 100% de rutas administrativas protegidas en servidor.
- [x] 0 modificaciones de datos de producción no autorizadas.
- [ ] 100% de operaciones críticas con registro de auditoría.
- [ ] 100% de flujos críticos verificados por rol y dispositivo.
- [ ] 100% de pantallas financieras críticas verificadas para Chile.

## Regla de ejecución

1. Inspección de código y esquema real.
2. Comparación con el patrón bed-booking equivalente.
3. Cambio pequeño y trazable.
4. DDL únicamente mediante migración.
5. Commit directo a `main`.
6. Verificación del deployment.
7. Actualización inmediata de este roadmap en commit separado.
8. Registro de impacto, datos preservados y riesgo residual.
