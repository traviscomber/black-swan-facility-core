# Roadmap de estabilización — 30 días

Fecha de inicio: 26-07-2026  
Horizonte máximo: 30 días  
Sistema: Black Swan Facility Core — Fundo Corcovado

## Objetivo

Cerrar las brechas críticas de seguridad, permisos, trazabilidad y confiabilidad operativa sin interrumpir reservas, finanzas, mantenimiento, compras, mapas ni la operación diaria.

## Estado de ejecución

- [x] Retirar endpoint de seed de reservas en producción.
- [x] Restringir eliminación masiva de reservas a administradores.
- [x] Restringir cambio masivo de estado a administradores.
- [x] Clasificar políticas RLS amplias y exposición efectiva por rol.
- [x] Documentar dependencias de hospitalidad y finanzas.
- [x] Cerrar ejecución anónima de RPC críticos.
- [x] Endurecer primera fase RLS en datos personales y financieros.
- [x] Volver append-only nueve bitácoras operativas y administrativas.
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
- Las tablas con política `ALL` amplia bajaron de 75 a 60: 52 dirigidas a `PUBLIC` y 8 a `authenticated`.
- `ai_operation_logs` conserva 8 registros; las otras ocho bitácoras revisadas permanecen sin registros.
- Existen cinco reservas `TEST_` en producción. No deben eliminarse sin autorización específica sobre esos registros.

## Prioridades

1. Auditar operaciones destructivas restantes.
2. Conectar y verificar registro de acciones críticas reales.
3. Continuar RLS en operaciones, GIS, energía, IA y módulos auxiliares.
4. Alinear permisos reales con `admin`, `approver` y usuarios autenticados.
5. Validar flujos completos por rol y dispositivo.
6. Eliminar datos de prueba únicamente con autorización específica.

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
- [ ] Auditar rutas destructivas o masivas de reservas, facturas, pagos, presupuestos, inventario, compras y GIS/KMZ.
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
- [ ] Verificar creación atómica de reservas, facturación, extras, reportes, auto-fill y conciliación.
- [ ] Añadir pruebas negativas para usuario autenticado común, `approver`, `admin` y `service_role`.
- [ ] Revisar exposición de datos personales en respuestas API y logs.

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

## Regla de ejecución

1. Inspección de código y esquema real.
2. Cambio pequeño y trazable.
3. Migración únicamente cuando corresponda.
4. Commit directo a `main`.
5. Verificación del deployment correspondiente.
6. Actualización de este roadmap.
7. Registro de impacto y riesgo residual.
