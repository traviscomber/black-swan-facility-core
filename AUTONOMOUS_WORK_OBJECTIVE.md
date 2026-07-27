# Objetivo de trabajo autónomo

## Misión

Completar el roadmap de estabilización de Black Swan Facility Core de forma autónoma, incremental y verificable, sin interrumpir la operación real del Fundo Corcovado ni modificar datos de producción sin autorización específica.

## Alcance prioritario

1. Completar la matriz de permisos para `admin`, `approver` y usuario autenticado.
2. Ejecutar pruebas negativas por rol en operaciones financieras, administrativas y operativas.
3. Revisar exposición de datos personales en API, logs y pantallas.
4. Validar flujos críticos por módulo, rol y dispositivo.
5. Revisar errores de runtime y logs de Vercel de los últimos siete días.
6. Corregir regresiones, estados vacíos, formularios y enlaces rotos.
7. Confirmar consistencia Chile: CLP, `es-CL`, `America/Santiago` y terminología tributaria.
8. Documentar permisos, migraciones, rollback, rutas críticas y soporte.
9. Validar impresión/PDF de facturas únicamente con autorización explícita para crear datos controlados.
10. Integrar GreenAPI únicamente cuando existan credenciales, consentimiento, plantillas y reglas aprobadas.

## Modo de ejecución

- Continuar sin solicitar confirmación entre bloques cuando el siguiente paso sea seguro, reversible y no altere datos reales.
- Leer el código afectado antes de editarlo.
- Consultar el esquema y los datos reales antes de asumir campos, estados o permisos.
- Realizar cambios pequeños y trazables.
- Usar migraciones para cualquier DDL.
- Ejecutar pruebas y consultas de verificación después de cada cambio.
- Hacer commit directo a `main` por bloque coherente.
- Verificar que el deployment de Vercel llegue a `READY`.
- Actualizar `roadmap.md` en un commit separado.
- Registrar exactamente qué cambió, qué datos se preservaron y qué riesgo permanece.

## Límites obligatorios

- No modificar reservas, pagos, facturas, tareas, inventario, compras, personas ni otros registros reales sin autorización explícita.
- No eliminar las cinco reservas `TEST_` sin autorización específica.
- No enviar WhatsApp automáticamente.
- No activar GreenAPI ni guardar credenciales provisionales.
- No exponer secretos, service-role keys, tokens ni datos personales.
- No inventar métricas, estados, personas, activos, ubicaciones o montos.
- Detenerse y pedir autorización cuando una prueba requiera persistir datos, enviar comunicaciones, eliminar registros o alterar comportamiento operacional irreversible.

## Criterios de cierre

El objetivo se considera completado cuando:

- La matriz de permisos está documentada y verificada por rol.
- Las operaciones críticas cuentan con pruebas positivas y negativas.
- Los módulos principales han sido revisados en desktop y móvil.
- No quedan errores críticos de runtime sin resolver.
- Las pantallas financieras críticas usan formatos y terminología correctos para Chile.
- Las rutas, permisos, migraciones y procedimientos de rollback están documentados.
- `roadmap.md` no mantiene pendientes técnicos salvo decisiones externas o integraciones que dependan de credenciales o autorización del usuario.
