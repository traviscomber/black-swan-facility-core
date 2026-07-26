# Roadmap de estabilización — 30 días

Fecha de inicio: 26-07-2026  
Horizonte máximo: 30 días  
Sistema: Black Swan Facility Core — Fundo Corcovado

## Objetivo

Cerrar las brechas críticas de seguridad, permisos, trazabilidad y confiabilidad operativa sin interrumpir reservas, finanzas, mantenimiento, compras, mapas ni la operación diaria.

## Estado de partida

- Las principales áreas operativas ya fueron revisadas y corregidas: dashboard, reservas, mantenimiento, compras, proveedores, propiedades, inventario, personas, tareas, ganadería, viñedo, energía, combustibles y mapas.
- Administración ya muestra el estado real de RLS, roles y auditoría.
- El endpoint de seed de reservas fue retirado.
- Las operaciones masivas de eliminación y cambio de estado de reservas fueron restringidas a administradores.
- Persisten RPC `SECURITY DEFINER` con ejecución demasiado amplia y políticas RLS permisivas en tablas sensibles.
- Existen cinco reservas `TEST_` en producción. No deben eliminarse sin autorización específica.

## Prioridades

1. Cerrar ejecución anónima de RPC críticos.
2. Endurecer RLS en datos personales y financieros.
3. Hacer confiables e inmutables las bitácoras.
4. Alinear permisos reales con roles `admin`, `approver`, `operator` y `viewer`.
5. Validar flujos completos por rol y dispositivo.
6. Eliminar datos de prueba únicamente con autorización explícita.

---

## Semana 1 — Contención crítica

### Entregables

- Verificar que todos los deployments pendientes estén en `READY`.
- Inventariar todos los RPC `SECURITY DEFINER`, sus propietarios, permisos `EXECUTE` y llamadas desde código.
- Preparar y revisar migración para:
  - revocar `EXECUTE` a `PUBLIC` y `anon` en `create_reservation_atomic`;
  - revocar `EXECUTE` a `PUBLIC` y `anon` en `execute_bulk_update`;
  - conservar únicamente los roles requeridos por los flujos reales.
- Auditar rutas destructivas o masivas adicionales:
  - reservas;
  - facturas;
  - pagos;
  - presupuestos;
  - inventario;
  - compras;
  - GIS/KMZ.
- Confirmar que `/admin` y todas sus rutas hijas están protegidas en servidor, no solo ocultas en navegación.
- Crear matriz inicial de permisos por módulo y acción.

### Criterio de cierre

- Ningún RPC crítico ejecutable por `anon` o `PUBLIC`.
- Ninguna operación destructiva masiva accesible fuera de `admin`.
- Deployments verificados en `READY`.

### Dependencia

La aplicación de migraciones requiere autorización explícita porque modifica permisos efectivos en producción.

---

## Semana 2 — Datos personales y financieros

### Entregables

- Endurecer RLS por fases en:
  - `guests`;
  - `reservations`;
  - `invoices`;
  - `invoice_payments`;
  - `payments`;
  - `leads`;
  - `messages`;
  - `budgets`.
- Separar permisos de lectura, creación, actualización y eliminación.
- Verificar compatibilidad con:
  - creación atómica de reservas;
  - generación de facturas;
  - extras de reserva;
  - reportes de ocupación e ingresos;
  - auto-fill de disponibilidad;
  - conciliación de pagos.
- Añadir pruebas negativas por rol:
  - anon no puede leer ni escribir datos sensibles;
  - viewer no puede modificar;
  - operator solo ejecuta acciones operativas permitidas;
  - approver conserva aprobaciones requeridas;
  - admin mantiene administración completa.
- Revisar exposición de datos personales en respuestas API y logs.

### Criterio de cierre

- Acceso anónimo eliminado en datos personales y financieros.
- Escritura limitada por función real.
- Flujos de reservas y facturación operativos después de la migración.

---

## Semana 3 — Auditoría, roles y trazabilidad

### Entregables

- Revisar tablas:
  - `approver_audit_log`;
  - `procurement_audit_log`;
  - `audit_actions`;
  - historiales y bitácoras operativas relacionadas.
- Impedir `UPDATE`, `DELETE` y `TRUNCATE` donde las bitácoras deban ser inmutables.
- Definir inserción controlada desde funciones, triggers o rutas autorizadas.
- Registrar acciones críticas:
  - borrado masivo;
  - cambio masivo de estado;
  - aprobación/rechazo;
  - cambios de permisos;
  - cambios de capas KMZ;
  - modificaciones financieras.
- Implementar matriz final de permisos en UI y servidor.
- Corregir rutas o componentes que dependan solo de visibilidad del sidebar.
- Añadir estados claros de acceso denegado y trazabilidad visible en Administración.

### Criterio de cierre

- Toda acción crítica deja rastro verificable.
- Las bitácoras no pueden ser alteradas por usuarios operativos.
- La UI coincide con los permisos reales del servidor y de Supabase.

---

## Semana 4 — Validación integral y cierre

### Entregables

- Ejecutar pruebas end-to-end por rol en desktop y móvil.
- Validar rutas principales:
  - dashboard;
  - reservas y hospitalidad;
  - mantenimiento e incidencias;
  - inventario y activos;
  - compras y proveedores;
  - propiedades e infraestructura;
  - personas y tareas;
  - ganadería;
  - viñedo y huerto;
  - energía y combustibles;
  - mapa y KMZ;
  - administración.
- Revisar errores de runtime y logs de Vercel de los últimos siete días.
- Corregir regresiones de permisos, carga, estados vacíos y formularios.
- Confirmar que no quedan mocks, métricas inventadas ni textos de seguridad desactualizados.
- Documentar:
  - matriz de permisos;
  - migraciones aplicadas;
  - rollback;
  - rutas críticas;
  - procedimientos de soporte.
- Decidir, con autorización explícita, si se eliminan las cinco reservas `TEST_`.

### Criterio de cierre

- Cero vulnerabilidades críticas conocidas en rutas y RPC revisados.
- Cero deployments en error.
- Flujos críticos validados por rol.
- Administración refleja datos reales y trazabilidad operativa.
- Lista final de riesgos residuales con prioridad y responsable.

---

## Backlog posterior al mes

Estos puntos no deben bloquear el cierre de 30 días:

- Sustituir MapLibre cargado desde CDN por dependencia versionada del proyecto.
- Mejorar automatización de pruebas de permisos en CI.
- Crear panel de salud de integraciones y jobs.
- Añadir retención y archivado formal de logs.
- Revisar rendimiento de consultas históricas y reportes extensos.
- Evaluar separación más fina de roles fuera de `procurement_role`.

## Indicadores de éxito

- 0 RPC críticos ejecutables por `anon` o `PUBLIC`.
- 0 tablas sensibles con políticas `ALL` sin restricción efectiva.
- 100% de rutas administrativas protegidas en servidor.
- 100% de operaciones críticas con registro de auditoría.
- 100% de deployments del periodo en `READY` o corregidos antes de continuar.
- 0 modificaciones de datos de producción no autorizadas.

## Regla de ejecución

Cada cambio debe seguir esta secuencia:

1. inspección de código y esquema real;
2. cambio pequeño y trazable;
3. migración únicamente cuando corresponda;
4. commit directo a `main`;
5. verificación del deployment correspondiente;
6. registro de impacto y riesgo residual.
