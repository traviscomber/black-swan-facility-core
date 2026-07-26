# Roadmap de estabilización — 30 días

Fecha de inicio: 26-07-2026  
Horizonte máximo: 30 días  
Sistema: Black Swan Facility Core — Fundo Corcovado, Valdivia, Chile

## Objetivo

Cerrar brechas críticas de seguridad, permisos, trazabilidad y confiabilidad operativa sin interrumpir reservas, finanzas, mantenimiento, compras, mapas ni la operación diaria. Mantener terminología chilena, fechas `es-CL`, zona `America/Santiago` y CLP cuando corresponda.

## Estado de ejecución

- [x] Retirar endpoint de seed de reservas en producción.
- [x] Restringir operaciones masivas de reservas a administradores.
- [x] Inventariar y cerrar ejecución anónima de RPC críticos.
- [x] Endurecer RLS en datos personales, financieros y operativos.
- [x] Volver append-only nueve bitácoras operativas y administrativas.
- [x] Endurecer GIS, KMZ, infraestructura, energía, combustibles, IA, catálogos y hospitalidad.
- [x] Alinear operaciones masivas con el patrón bed-booking: prevalidación, atomicidad, historial y deshacer.
- [x] Refactorizar facturas con logo Black Swan, CLP, fechas chilenas, impresión A4 y creación desde reservas.
- [x] Incorporar prevalidación de facturación de solo lectura.
- [x] Llevar políticas RLS `ALL` amplias sin restricción efectiva a cero.
- [ ] Completar cobertura de acciones críticas y permisos por módulo.
- [ ] Validar flujos completos por rol y dispositivo.

## Estado verificado

- Los 13 RPC `SECURITY DEFINER` fueron inventariados; ninguno conserva `EXECUTE` para `anon` o `PUBLIC`.
- `execute_bulk_update` y `restore_bulk_operation_state` verifican rol `admin` dentro del RPC.
- Las tablas sensibles y operativas revisadas usan políticas separadas por operación y no permiten `TRUNCATE` a usuarios autenticados.
- `DELETE` queda limitado a `admin` en los módulos endurecidos.
- Nueve bitácoras son append-only y no permiten alteración o borrado por usuarios operativos.
- `bulk_operations` conserva 3 registros históricos y solo puede escribirse o restaurarse mediante RPC controlado.
- El módulo de facturas exige sesión, valida UUID, fechas, estados y montos CLP, y limita creación/edición a `admin` y `approver`; eliminación solo para `admin` y bloqueada cuando existen pagos.
- El editor de facturas usa `/blackswan-logo.png`, identifica Black Swan y Fundo Corcovado, muestra CLP sin decimales y fechas chilenas, y genera salida A4 limpia para impresión/PDF.
- `GET /api/bookings/invoices/preview` valida reserva, huésped, habitación, extras, fechas, duplicados e importes antes de habilitar creación.
- La tabla `invoices` permanece con 0 registros. No se crearon ni alteraron facturas durante el refactor.
- Producción contiene 7 reservas confirmadas; 5 tienen prefijo `TEST_`. Ninguna fue modificada.
- Una reserva histórica no TEST presenta salida anterior a entrada y queda bloqueada por la prevalidación.
- `reviews` permanece con 0 registros.
- `volunteers` conserva 1 registro.
- `reviews` y `volunteers` ya no permiten acceso `anon`, `TRUNCATE` ni políticas `ALL` amplias.
- Ambas tablas conservan lectura, creación y actualización para usuarios autenticados; la eliminación exige `admin`.
- Conteo verificado de políticas `ALL` amplias sin restricción efectiva: **0**.
- No se modificaron filas de producción durante el endurecimiento de `reviews` y `volunteers`.

## Prioridades

1. Auditar operaciones destructivas restantes en pagos, presupuestos, inventario y compras.
2. Conectar y verificar registro de acciones críticas reales: anulaciones, pagos, cambios financieros, permisos y borrados.
3. Completar matriz de permisos para `admin`, `approver` y usuario autenticado en UI, API y Supabase.
4. Validar por rol los módulos críticos en desktop y móvil.
5. Validar visualmente impresión/PDF con una factura controlada fuera de producción o con autorización explícita sobre una reserva `TEST_`.
6. Revisar exposición de datos personales en respuestas API y logs.
7. Confirmar consistencia Chile: CLP, `es-CL`, zona local, textos tributarios y contexto Valdivia.
8. Eliminar datos de prueba únicamente con autorización específica.

## Semana 1 — Contención crítica

- [x] Verificar deployments anteriores en `READY`.
- [x] Cerrar ejecución anónima de RPC críticos.
- [x] Proteger rutas administrativas en servidor.
- [x] Endurecer operaciones masivas de reservas.
- [x] Endurecer consulta, creación, edición y eliminación de facturas.
- [ ] Completar auditoría de operaciones destructivas en pagos, presupuestos, inventario y compras.
- [ ] Completar matriz inicial de permisos por módulo y acción.

### Criterio de cierre

- [x] Ningún RPC crítico ejecutable por `anon` o `PUBLIC`.
- [ ] Ninguna operación destructiva masiva accesible fuera de `admin`.
- [x] Deployments funcionales verificados en `READY`.

## Semana 2 — Datos personales y financieros

- [x] Endurecer RLS en `guests`, `reservations`, `invoices`, `invoice_payments`, `payments`, `leads`, `messages` y `budgets`.
- [x] Separar lectura, creación, actualización y eliminación.
- [x] Eliminar privilegios `anon` en tablas sensibles revisadas.
- [x] Limitar `DELETE` a `admin`.
- [x] Refactorizar facturación para Chile y Black Swan.
- [x] Implementar impresión/PDF A4.
- [x] Implementar prevalidación de facturación.
- [x] Endurecer `reviews` y `volunteers` y llevar políticas `ALL` amplias a cero.
- [ ] Validar visualmente impresión/PDF con una factura controlada.
- [ ] Añadir pruebas negativas por rol.
- [ ] Revisar exposición de datos personales en API y logs.

### Criterio de cierre

- [x] Acceso anónimo eliminado en datos sensibles revisados.
- [x] Escritura separada por operación; eliminación limitada a `admin`.
- [x] Cero políticas `ALL` amplias sin restricción efectiva.
- [ ] Reservas y facturación verificadas con pruebas controladas.

## Semana 3 — Auditoría, roles y trazabilidad

- [x] Revisar historiales y volver append-only nueve bitácoras.
- [x] Retirar acceso anónimo a bitácoras y RPC escritores identificados.
- [ ] Restringir inserción de `approver_audit_log` cuando exista un escritor real identificado.
- [ ] Registrar borrados masivos, cambios de estado, aprobaciones, permisos, KMZ y modificaciones financieras.
- [ ] Implementar matriz final de permisos en UI, middleware, API y Supabase.

### Criterio de cierre

- [ ] Toda acción crítica deja rastro verificable.
- [x] Las nueve bitácoras revisadas no pueden ser alteradas ni borradas por usuarios operativos.
- [ ] La UI coincide con los permisos reales del servidor y Supabase en todos los módulos.

## Semana 4 — Validación integral y cierre

- [ ] Ejecutar pruebas por rol en desktop y móvil.
- [ ] Validar dashboard, reservas, mantenimiento, inventario, compras, propiedades, personas, ganadería, viñedo, energía, mapas y administración.
- [ ] Revisar errores de runtime y logs de Vercel de los últimos siete días.
- [ ] Corregir regresiones de permisos, carga, estados vacíos y formularios.
- [ ] Confirmar que no quedan mocks, métricas inventadas ni textos desactualizados.
- [ ] Confirmar formato `es-CL`, CLP, fechas locales y terminología chilena en pantallas críticas.
- [ ] Documentar permisos, migraciones, rollback, rutas críticas y soporte.
- [ ] Decidir específicamente si se eliminan las cinco reservas `TEST_`.

## Indicadores de éxito

- [x] 0 RPC críticos ejecutables por `anon` o `PUBLIC`.
- [x] 0 tablas con políticas `ALL` amplias sin restricción efectiva.
- [x] 100% de rutas administrativas protegidas en servidor.
- [ ] 100% de operaciones críticas con registro de auditoría.
- [ ] 100% de flujos críticos verificados por rol y dispositivo.
- [x] 0 modificaciones de datos de producción no autorizadas.
- [ ] 100% de pantallas financieras críticas verificadas para Chile, CLP y `es-CL`.

## Regla de ejecución

1. Inspección de código y esquema real.
2. Comparación con el patrón bed-booking equivalente antes de refactorizar.
3. Cambio pequeño y trazable.
4. DDL únicamente mediante migración.
5. Commit directo a `main`.
6. Verificación del deployment correspondiente.
7. Actualización inmediata de este roadmap en commit separado.
8. Registro de impacto, datos preservados y riesgo residual.
9. Verificación explícita de contexto chileno en cambios financieros, fechas, impuestos y moneda.
