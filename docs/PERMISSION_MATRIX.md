# Matriz de permisos

Fecha: 27-07-2026

Esta matriz resume las políticas RLS verificadas en Supabase para los módulos críticos.

| Recurso | authenticated | approver | admin | Observación |
|---|---|---|---|---|
| reservations | leer, crear, actualizar | igual | además eliminar | escritura amplia |
| room_blocks | leer, crear, actualizar, eliminar | igual | igual | eliminación demasiado amplia |
| guests | leer, crear, actualizar | igual | además eliminar | revisar datos personales |
| invoices | leer, crear, actualizar | igual | además eliminar | debe limitarse a roles financieros |
| invoice_payments | leer | leer, crear, actualizar | además eliminar | correcto |
| payments | leer | leer, crear, actualizar | además eliminar | correcto |
| budgets | leer | leer, crear, actualizar | además eliminar | correcto |
| procurement_requests | propias | lectura de aprobador | según flujo | validar RPC |
| procurement_purchase_orders | leer | leer, crear, actualizar | además eliminar | correcto |
| suppliers | sin acceso | leer, crear, actualizar | además eliminar | correcto |
| inventory_movements | leer, crear propios | igual | igual | append-only |
| tasks | sin acceso | gestión | gestión | separar eliminación |
| task_assignments | leer, crear, actualizar | igual | además eliminar | endurecer |
| task_comments | leer, crear, actualizar | igual | además eliminar | convertir a append-only |
| task_evidence | sin acceso | leer, crear, actualizar | además eliminar | revisar actualización |
| critical_action_audit_log | sin acceso | sin acceso | lectura | decidir acceso approver |
| employees | sin acceso | gestión | gestión | separar eliminación |
| volunteers | leer, crear, actualizar | igual | además eliminar | revisar datos personales |
| leads | leer, crear, actualizar | igual | además eliminar | revisar datos personales |
| messages | leer, crear, actualizar | igual | además eliminar | revisar datos personales |
| tablet_devices | lectura pública; actualización autenticada | igual | igual | política pública y auth.role() |

## Próximos cambios

1. Limitar eliminación de room_blocks a admin.
2. Reemplazar políticas públicas de tablet_devices y eliminar auth.role().
3. Limitar creación y actualización de invoices a admin y approver.
4. Convertir task_comments en append-only.
5. Separar políticas ALL en tasks y employees.
6. Revisar acceso a datos personales.
7. Añadir pruebas positivas y negativas por rol sin persistir datos.
