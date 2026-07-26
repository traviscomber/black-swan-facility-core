# Roadmap de estabilización — 30 días

Fecha de inicio: 26-07-2026  
Horizonte máximo: 30 días  
Sistema: Black Swan Facility Core — Fundo Corcovado, Valdivia, Chile

## Objetivo

Cerrar las brechas críticas de seguridad, permisos, trazabilidad y confiabilidad operativa sin interrumpir reservas, finanzas, mantenimiento, compras, mapas ni la operación diaria. Mantener terminología, formatos de fecha, contexto tributario y moneda acordes a Chile; usar CLP cuando corresponda.

## Estado de ejecución

- [x] Retirar endpoint de seed de reservas en producción.
- [x] Restringir eliminación masiva de reservas a administradores.
- [x] Restringir cambio masivo de estado a administradores.
- [x] Clasificar políticas RLS amplias y exposición efectiva por rol.
- [x] Documentar dependencias de hospitalidad y finanzas.
- [x] Cerrar ejecución anónima de RPC críticos.
- [x] Endurecer primera fase RLS en datos personales y financieros.
- [x] Volver append-only nueve bitácoras operativas y administrativas.
- [x] Endurecer acceso inicial a GIS y KMZ.
- [x] Endurecer nueve tablas centrales de operaciones.
- [x] Endurecer cinco tablas auxiliares de hospitalidad, housekeeping, mantenimiento y asignaciones.
- [x] Endurecer seis tablas de infraestructura, documentos, fotografías, planos y embarcaciones.
- [x] Endurecer cuatro tablas de combustible, anomalías, resumen mensual y vehículos.
- [x] Endurecer once tablas de IA, sesiones, contexto y soberanía.
- [x] Endurecer seis tablas de catálogos, multimedia, ubicaciones y soporte.
- [x] Endurecer seis tablas de hospitalidad, habitaciones, tarifas y extras.
- [x] Endurecer doce tablas de costos, presupuestos, facturación auxiliar, incidencias y operaciones.
- [x] Endurecer `bulk_operations` y sus rutas con la lógica transaccional del módulo bed-booking.
- [x] Refactorizar el editor de facturas con marca Black Swan, CLP, fechas chilenas y trazabilidad desde reservas.
- [ ] Completar cobertura de acciones críticas y permisos por módulo.
- [ ] Validar flujos completos por rol y dispositivo.

## Estado actualizado

- Las principales áreas operativas ya fueron revisadas y corregidas: dashboard, reservas, mantenimiento, compras, proveedores, propiedades, inventario, personas, tareas, ganadería, viñedo, energía, combustibles y mapas.
- Administración muestra el estado real de RLS, roles y auditoría.
- Los 13 RPC `SECURITY DEFINER` fueron inventariados.
- Ningún RPC `SECURITY DEFINER` conserva ejecución para `anon` o `PUBLIC`.
- `execute_bulk_update` y `restore_bulk_operation_state` exigen rol `admin` dentro de la función.
- Ocho tablas sensibles ya no usan políticas `ALL`: `guests`, `reservations`, `invoices`, `invoice_payments`, `payments`, `leads`, `messages` y `budgets`.
- Estas ocho tablas no conservan privilegios para `anon`; `DELETE` queda limitado a `admin`.
- Nueve bitácoras ya no permiten acceso anónimo ni `UPDATE`, `DELETE` o `TRUNCATE` autenticado.
- `procurement_audit_log` conserva como escritores reales `start_procurement_quotation`, `build_procurement_comparison` y `approve_procurement_comparison`; las tres funciones mantienen validación interna de rol y ya no son ejecutables por `anon`.
- No se identificó un escritor activo para `approver_audit_log` en funciones de base de datos ni en el código indexado.
- `gis_overlays` y `operation_kmz_files` ya no permiten acceso anónimo ni `TRUNCATE`; usan políticas separadas y `DELETE` queda limitado a `admin`.
- `gis_overlays` conserva 5 registros y `operation_kmz_files` permanece sin registros; la migración no alteró filas.
- `activities`, `activity_attendees`, `activity_types`, `checklists`, `checklist_items`, `incidents`, `maintenance_tasks`, `task_assignments` y `task_comments` ya no permiten acceso anónimo ni `TRUNCATE`; usan políticas separadas y `DELETE` queda limitado a `admin`.
- Se preservaron 3 actividades y 12 tipos de actividad. Las otras siete tablas operativas revisadas permanecen sin registros.
- `hospitality_requests`, `housekeeping_schedules`, `housekeeping_tasks`, `maintenance_schedules` y `staff_assignments` ya no permiten acceso anónimo ni `TRUNCATE`; usan políticas separadas y `DELETE` queda limitado a `admin`.
- Las cinco tablas auxiliares revisadas permanecen sin registros; la migración no alteró filas.
- `infrastructure_asset_types`, `infrastructure_connections`, `infrastructure_documents`, `infrastructure_photos`, `infrastructure_plans` y `ports_boats` ya no permiten acceso anónimo ni `TRUNCATE`; usan políticas separadas y `DELETE` queda limitado a `admin`.
- Se preservaron 24 tipos de activo, 7 conexiones, 67 fotografías, 82 planos y 4 registros de puertos o embarcaciones. `infrastructure_documents` permanece sin registros.
- `fuel_consumption`, `fuel_consumption_anomalies`, `monthly_fuel_summary` y `vehicles` ya no permiten acceso anónimo ni `TRUNCATE`; usan políticas separadas y `DELETE` queda limitado a `admin`.
- `fuel_consumption_anomalies` conserva escritura limitada a `admin` y `approver`.
- Se preservaron 153 registros de consumo y 32 vehículos. Las tablas de anomalías y resumen mensual permanecen sin registros.
- `ai_agent_executions`, `ai_agents`, `ai_artifacts`, `ai_context`, `ai_events`, `ai_sessions`, `sovereignty_dependencies`, `sovereignty_layers`, `sovereignty_metrics`, `sovereignty_objectives` y `sovereignty_timeline` ya no permiten acceso anónimo ni `TRUNCATE`; usan políticas separadas y `DELETE` queda limitado a `admin`.
- Se preservaron 8 ejecuciones, 5 agentes, 3 artefactos, 10 eventos, 5 sesiones, 5 capas y 8 métricas. `ai_context`, dependencias, objetivos y cronología permanecen sin registros.
- `asset_categories`, `multimedia_assets`, `locations`, `kitchens`, `utilities` y `vineyard_equipment` ya no permiten acceso anónimo ni `TRUNCATE`; usan políticas separadas y `DELETE` queda limitado a `admin`.
- Se preservaron 12 categorías de activo, 1 recurso multimedia, 14 ubicaciones, 2 cocinas y 3 servicios. `vineyard_equipment` permanece sin registros.
- `beds`, `rooms`, `booking_settings`, `pricing_rules`, `booking_extras` y `reservation_extras` ya no permiten acceso anónimo ni `TRUNCATE`; usan políticas separadas y `DELETE` queda limitado a `admin`.
- Se preservaron 20 camas, 9 habitaciones y 1 configuración de reservas. Reglas de precio y extras permanecen sin registros.
- `budget_categories`, `budget_divisions`, `cost_actuals`, `cost_centers`, `invoice_templates`, `issue_categories`, `issue_label_assignments`, `issue_labels`, `issue_task_assignments`, `issue_types`, `monthly_operation_summary` y `operations` ya no permiten acceso anónimo ni `TRUNCATE`; usan políticas separadas y `DELETE` queda limitado a `admin`.
- Se preservaron 26 categorías presupuestarias, 7 divisiones, 4 centros de costo, 10 categorías de incidencia, 8 etiquetas y 20 tipos de incidencia. Costos reales, plantillas, asignaciones y resúmenes operativos permanecen sin registros.
- `bulk_operations` conserva 3 registros históricos y queda como bitácora de solo lectura para administradores. La escritura y restauración siguen exclusivamente por RPC con validación interna de rol.
- Las rutas bed-booking de comprobación de conflictos, ejecución masiva, historial y deshacer validan autenticación, rol administrador, UUID, fechas, estados y correspondencia entre selección y actualizaciones.
- La solución conserva el patrón BedBooking: prevalidación de disponibilidad, ejecución atómica, historial consultable y reversión trazable.
- El editor de facturas usa el mismo activo `/blackswan-logo.png` del encabezado de navegación, identifica a Black Swan y Fundo Corcovado, y ordena cliente, emisión, detalle, condiciones y totales.
- La facturación muestra CLP sin decimales mediante `formatClp`, fechas `es-CL` basadas en `America/Santiago`, teléfono `+56` y textos operativos en español.
- Las facturas nuevas deben originarse desde una reserva y delegar su creación al RPC `create_reservation_invoice`; el editor ya no escribe directamente desde el cliente a Supabase.
- La pantalla declara que el documento es de gestión interna y que su validez tributaria depende de la emisión en el sistema autorizado correspondiente.
- La tabla `invoices` permanece con 0 registros; el refactor no creó, alteró ni eliminó datos de producción.
- El sistema debe presentar fechas en formato chileno y montos financieros en CLP cuando corresponda; no se convertirán montos existentes sin autorización.
- Las tablas con política `ALL` amplia sin restricción efectiva bajaron a 2: ambas dirigidas a `PUBLIC`; no quedan políticas `ALL` amplias dirigidas a `authenticated`.
- `ai_operation_logs` conserva 8 registros y permanece append-only.
- Existen cinco reservas `TEST_` en producción. No deben eliminarse sin autorización específica sobre esos registros.

## Prioridades

1. Completar el flujo de facturas: generar exclusivamente desde reservas, endurecer `PATCH`/`DELETE`, validar estados y revisar impresión/PDF con formato Chile.
2. Auditar y endurecer `reviews` y `volunteers` para llevar las políticas `ALL` amplias a cero.
3. Revisar cada módulo contra su equivalente o patrón del sistema bed-booking antes de refactorizarlo.
4. Auditar operaciones destructivas restantes.
5. Conectar y verificar registro de acciones críticas reales.
6. Alinear permisos reales con `admin`, `approver` y usuarios autenticados.
7. Validar flujos completos por rol y dispositivo.
8. Verificar consistencia Chile: CLP, `es-CL`, fechas locales, textos tributarios y contexto Valdivia.
9. Eliminar datos de prueba únicamente con autorización específica.

---

## Semana 1 — Contención crítica

### Entregables

- [x] Verificar que los deployments anteriores estén en `READY`.
- [x] Inventariar todos los RPC `SECURITY DEFINER`, sus propietarios y permisos `EXECUTE`.
- [x] Revocar `EXECUTE` a `PUBLIC` y `anon` en `create_reservation_atomic`.
- [x] Revocar `EXECUTE` a `PUBLIC` y `anon` en `execute_bulk_update`.
- [x] Revocar ejecución anónima de validación, restauración masiva y funciones de compras expuestas.
- [x] Conservar ejecución autenticada solo en los RPC requeridos por los flujos actuales.
- [x] Exigir rol `admin` dentro de los RPC de actualización y restauración masiva.
- [ ] Auditar rutas destructivas o masivas de reservas, facturas, pagos, presupuestos, inventario y compras.
- [x] Auditar y endurecer operaciones destructivas de `gis_overlays` y `operation_kmz_files`.
- [x] Auditar y endurecer operaciones destructivas de nueve tablas centrales de actividades, incidencias, mantenimiento y tareas.
- [x] Auditar y endurecer operaciones destructivas de cinco tablas auxiliares de hospitalidad, housekeeping, mantenimiento y asignaciones.
- [x] Auditar y endurecer operaciones destructivas de seis tablas de infraestructura, documentos, fotografías, planos y embarcaciones.
- [x] Auditar y endurecer operaciones destructivas de cuatro tablas de combustible, anomalías, resumen mensual y vehículos.
- [x] Auditar y endurecer operaciones destructivas de once tablas de IA y soberanía.
- [x] Auditar y endurecer operaciones destructivas de seis tablas de catálogos, multimedia, ubicaciones y soporte.
- [x] Auditar y endurecer operaciones destructivas de seis tablas de hospitalidad, habitaciones, tarifas y extras.
- [x] Auditar y endurecer operaciones destructivas de doce tablas de costos, presupuestos, incidencias y operaciones.
- [x] Auditar y endurecer `bulk_operations`, historial, comprobación de conflictos, ejecución y deshacer del módulo bed-booking.
- [x] Confirmar que `/admin` y sus rutas hijas están protegidas en middleware.
- [ ] Completar matriz inicial de permisos por módulo y acción.

### Criterio de cierre

- [x] Ningún RPC crítico ejecutable por `anon` o `PUBLIC`.
- [ ] Ninguna operación destructiva masiva accesible fuera de `admin`.
- [x] Deployments verificados en `READY`.

---

## Semana 2 — Datos personales y financieros

### Entregables

- [x] Endurecer RLS en `guests`, `reservations`, `invoices`, `invoice_payments`, `payments`, `leads`, `messages` y `budgets`.
- [x] Separar permisos de lectura, creación, actualización y eliminación.
- [x] Eliminar privilegios `anon` en esas ocho tablas.
- [x] Limitar `DELETE` a `admin`.
- [x] Alinear las operaciones masivas de reservas con prevalidación de conflictos, RPC atómico, historial y deshacer del módulo bed-booking.
- [x] Refactorizar el editor de facturas con marca Black Swan, orden visual, CLP, `es-CL` y creación trazable desde reservas.
- [ ] Endurecer las rutas `PATCH` y `DELETE` de facturas con validación de campos, estados, montos CLP y rol administrativo para eliminación.
- [ ] Validar impresión y salida PDF de factura en desktop y móvil.
- [ ] Verificar creación atómica de reservas, facturación, extras, reportes, auto-fill y conciliación.
- [ ] Añadir pruebas negativas para usuario autenticado común, `approver`, `admin` y `service_role`.
- [ ] Revisar exposición de datos personales en respuestas API y logs.
- [ ] Validar que facturación, impuestos, fechas y montos usen criterios chilenos y CLP donde corresponda.

### Criterio de cierre

- [x] Acceso anónimo eliminado en datos personales y financieros revisados.
- [x] Escritura separada por operación; eliminación limitada a `admin`.
- [ ] Reservas y facturación verificadas después de las migraciones.

---

## Semana 3 — Auditoría, roles y trazabilidad

### Entregables

- [x] Revisar `audit_actions` y seis historiales operativos amplios.
- [x] Impedir `UPDATE`, `DELETE` y `TRUNCATE` en las siete bitácoras operativas revisadas.
- [x] Retirar acceso anónimo y conservar solo `SELECT` + `INSERT` autenticado en esas siete tablas.
- [x] Revisar en detalle `approver_audit_log` y `procurement_audit_log`.
- [x] Volver append-only ambas bitácoras de compras y retirar ejecución anónima de sus tres RPC escritores identificados.
- [ ] Restringir más la inserción de `approver_audit_log` cuando exista un escritor real identificado.
- [ ] Registrar borrados masivos, cambios de estado, aprobaciones, permisos, KMZ y modificaciones financieras.
- [ ] Implementar matriz final de permisos en UI, middleware, API y Supabase.
- [x] Actualizar Administración con estado verificable de nueve bitácoras append-only.
- [x] Actualizar Administración con el estado real de acceso GIS y KMZ.
- [x] Actualizar Administración con el estado real de las nueve tablas operativas endurecidas.
- [x] Actualizar Administración con el estado real de las cinco tablas auxiliares endurecidas.
- [x] Actualizar Administración con el estado real de las seis tablas de infraestructura endurecidas.
- [x] Actualizar Administración con el estado real de combustible y vehículos.
- [x] Actualizar Administración con el estado real de IA y soberanía.
- [x] Actualizar Administración con el estado real de catálogos, multimedia, ubicaciones y soporte.
- [x] Actualizar Administración con el estado real de hospitalidad, habitaciones, tarifas y extras.
- [x] Actualizar Administración con el estado real de costos, presupuestos, incidencias y operaciones.
- [x] Actualizar Administración con el estado real del historial y operaciones masivas bed-booking.

### Criterio de cierre

- [ ] Toda acción crítica deja rastro verificable.
- [x] Las nueve bitácoras revisadas no pueden ser alteradas ni borradas por usuarios operativos.
- [ ] La UI coincide con los permisos reales del servidor y Supabase en todos los módulos.

---

## Semana 4 — Validación integral y cierre

### Entregables

- [ ] Ejecutar pruebas por rol en desktop y móvil.
- [ ] Validar dashboard, reservas, mantenimiento, inventario, compras, propiedades, personas, ganadería, viñedo, energía, mapas y administración.
- [ ] Revisar errores de runtime y logs de Vercel de los últimos siete días.
- [ ] Corregir regresiones de permisos, carga, estados vacíos y formularios.
- [ ] Confirmar que no quedan mocks, métricas inventadas ni textos de seguridad desactualizados.
- [ ] Confirmar formato `es-CL`, CLP, fechas locales y terminología operativa chilena en pantallas críticas.
- [ ] Documentar permisos, migraciones, rollback, rutas críticas y soporte.
- [ ] Decidir específicamente si se eliminan las cinco reservas `TEST_`.

### Criterio de cierre

- Cero vulnerabilidades críticas conocidas en rutas y RPC revisados.
- Cero deployments en error.
- Flujos críticos validados por rol.
- Administración refleja datos reales y trazabilidad operativa.
- Riesgos residuales documentados con prioridad.

---

## Backlog posterior al mes

- Sustituir MapLibre cargado desde CDN por dependencia versionada.
- Mejorar automatización de pruebas de permisos en CI.
- Crear panel de salud de integraciones y jobs.
- Añadir retención y archivado formal de logs.
- Revisar rendimiento de consultas históricas y reportes extensos.
- Evaluar separación más fina de roles fuera de `procurement_role`.

## Indicadores de éxito

- [x] 0 RPC críticos ejecutables por `anon` o `PUBLIC`.
- [ ] 0 tablas sensibles con políticas `ALL` sin restricción efectiva.
- [x] 100% de rutas administrativas protegidas en servidor.
- [ ] 100% de operaciones críticas con registro de auditoría.
- [ ] 100% de deployments del periodo en `READY` o corregidos antes de continuar.
- [x] 0 modificaciones de datos de producción no autorizadas.
- [ ] 100% de pantallas financieras críticas verificadas para Chile, CLP y `es-CL`.

## Regla de ejecución

1. Inspección de código y esquema real.
2. Comparación con la lógica del módulo bed-booking equivalente o con su patrón de disponibilidad, atomicidad, trazabilidad y reversión.
3. Cambio pequeño y trazable.
4. Migración únicamente cuando corresponda.
5. Commit directo a `main`.
6. Verificación del deployment correspondiente.
7. Actualización de este roadmap.
8. Registro de impacto y riesgo residual.
9. Verificación explícita de contexto chileno en cambios financieros, fechas, impuestos y moneda.
