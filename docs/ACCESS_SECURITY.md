# Acceso, autorización y seguridad

**Baseline:** `f22330dec23ed396d195abbdb5e1f9ed2ea61ed7`

Este documento describe el modelo de acceso de BSFC. No contiene credenciales, emails personales ni secretos.

## 1. Principio central

**Autenticación no es autorización.**

Una sesión válida sólo identifica al usuario. La posibilidad de ver o modificar un objeto depende de perfil activo, capabilities, scopes, RLS y, para operaciones sensibles, guards/RPCs de dominio.

La UI nunca es la frontera final de seguridad.

---

## 2. Capabilities

Niveles canónicos:

1. `view`
2. `operate`
3. `approve`
4. `admin`

El orden es jerárquico dentro del dominio: `admin` satisface `approve`, `operate` y `view`; `approve` satisface `operate` y `view`, etc.

Los dominios son independientes. Tener `admin`/`approve` en un dominio no debe conceder acceso implícito a otro salvo que la función de access canónica lo modele explícitamente.

---

## 3. Capas de identidad y acceso

### Auth user

Supabase Auth mantiene la identidad/sesión.

### Access profile

`user_access_profiles` mantiene el estado de acceso de aplicación, incluyendo role key, activación y preferencias de OS/start path.

Regla: Auth user sin perfil activo falla cerrado.

### Operational scopes

`user_operational_scopes` limita el alcance por departamento/ubicación cuando aplica.

Regla crítica: un scope de ubicación específico no autoriza un objeto con `location_id = NULL`.

### Employee/person context

La relación con employee/person permite presentar identidad organizacional y asignaciones. No es una primitiva de autorización por sí sola.

---

## 4. Roles relevantes de cierre

La producción al momento del snapshot documental tiene perfiles activos de tipo `admin` y `approver`. El sistema también maneja estados de acceso como `none`/`disabled` para fail-closed.

Snapshot de cierre:

- perfiles activos: 6;
- admins activos: 3;
- approvers activos: 3;
- usuarios con scope IT activo: 1.

Estos conteos son evidencia de fecha de cierre, no constantes del producto.

---

## 5. Route guards

`proxy.ts` evalúa sesión y requirements para rutas protegidas.

Ejemplos de familias con requirement explícito:

- Booking → capability `booking:view` o superior;
- operaciones/tasks/checklists → `operations:view`;
- people → `people:view`;
- map → `map:view`;
- procurement requests → `procurement:view`;
- otras superficies Procurement → nivel superior según la ruta;
- admin → `admin:admin` salvo excepciones explícitas y más específicas.

### IT Control Center

`/admin/it-control` es una excepción deliberada al admin-only genérico porque la política de producto es:

`is_admin OR active IT scope`

El middleware y el RPC implementan la misma regla. Un usuario no autorizado no obtiene acceso escribiendo la URL manualmente.

---

## 6. RLS

Snapshot de cierre:

- 218 tablas públicas;
- 218 con RLS habilitado;
- 0 con RLS deshabilitado;
- 3 sin policies directas.

Las tablas sin policies directas se mantienen fail-closed/controladas. **No crear SELECT/ALL policies permisivas para eliminar un advisory.**

RLS debe reflejar ownership/scope real. `TO authenticated` por sí solo no es autorización suficiente para datos sensibles.

---

## 7. SECURITY DEFINER

BSFC contiene funciones privilegiadas porque algunos workflows deben aplicar reglas atómicas por encima de RLS normal.

Checklist obligatorio para cada `SECURITY DEFINER`:

- necesidad documentada;
- `search_path` fijo;
- `REVOKE` de `PUBLIC`/`anon` cuando no corresponde;
- `GRANT EXECUTE` sólo a roles requeridos;
- validación interna de `auth.uid()`;
- perfil activo;
- role/action/scope;
- inputs validados;
- side effects auditables;
- no retorno de secretos ni información interna innecesaria.

Nunca agregar `SECURITY DEFINER` únicamente para “arreglar” un 403.

---

## 8. Browser/server boundary

### Permitido en browser

- publishable/anon Supabase key;
- session user;
- queries bajo RLS;
- command palette read-only;
- mutations específicamente autorizadas por políticas/RPCs.

### Prohibido en browser

- `service_role`;
- secret keys;
- autorización basada en `user_metadata` editable;
- lógica privilegiada que dependa de ocultación de UI;
- bypass de RLS.

---

## 9. Auditoría

Las acciones críticas deben dejar evidencia suficiente para reconstruir:

- actor;
- objeto;
- acción;
- timestamp;
- estado anterior/nuevo cuando corresponde;
- razón/approval/reference en workflows sensibles.

Bitácoras de auditoría y eventos operacionales deben ser append-only cuando representan hechos históricos. No habilitar DELETE/UPDATE genérico sobre logs para simplificar administración.

---

## 10. Seguridad de Hospitalidad

Escenarios P0/P1:

- doble booking silencioso;
- mover/resize/swap una reserva a inventario ocupado;
- saltar room block;
- modificar source externo no autorizado;
- check-in/check-out saltando blockers;
- payment/invoice con valores persistidos inconsistentes;
- pérdida de vínculo housekeeping/maintenance → reservation/room/bed;
- acceso a PII sin scope.

La base contiene guards de conflicto/integridad; el cliente no debe replicarlos como única protección.

---

## 11. Seguridad de Procurement e Inventory

- decisión/aprobación requiere role/action/scope;
- recepción e intake preservan lineage;
- movimientos/custodia de activo deben ser autorizados y auditables;
- retirement/cycle count/audit físico deben usar workflow canónico;
- un usuario no debe ampliar su scope mediante un objeto con ubicación faltante.

---

## 12. Portales públicos

Rutas públicas como `/auth/login`, `/guest-access` y `/event/[slug]` son superficies intencionales y limitadas.

Los flujos públicos deben:

- exponer el mínimo de datos;
- validar invite/passcode/token según contrato;
- no heredar privilegios de un usuario interno;
- no convertir SECURITY DEFINER en acceso anónimo genérico;
- respetar consentimiento/opt-in de Discovery.

---

## 13. IT Control Center

El RPC `get_it_control_center_snapshot()` entrega una proyección de operación y seguridad para usuarios autorizados.

Propiedades de cierre:

- read-only;
- server-consumed;
- auth required;
- perfil activo;
- admin OR IT scope;
- ACL explícita;
- no service role en página;
- telemetría resumida, no exposición indiscriminada de errores internos.

La página legacy `/admin/security` no debe volver a publicar métricas hardcodeadas; se conserva como compatibilidad hacia el control live.

---

## 14. Advisories conocidos

### Leaked Password Protection

**Estado:** pendiente. La protección de contraseñas filtradas de Supabase Auth continúa desactivada al cierre.

No marcar como resuelta hasta:

1. habilitar configuración de Auth;
2. verificar comportamiento;
3. registrar fecha/evidencia.

### `btree_gist` en public

Advisory conocido. No mover la extensión cerca de release sin revisar dependencias de constraints/índices.

### SECURITY DEFINER warnings

Se revisan por función. No ejecutar revocación masiva porque existen RPCs intencionales para workflows internos y portales controlados.

---

## 15. Checklist para cualquier cambio de acceso

Antes de mergear:

1. identificar actor/rol/persona afectados;
2. definir capability requerida;
3. definir scope de departamento/ubicación;
4. verificar proxy/route guard;
5. verificar RLS;
6. verificar RPC/constraint si hay mutation sensible;
7. probar caso permitido;
8. probar caso denegado;
9. comprobar que UI no filtra datos antes del redirect;
10. revisar logs/audit;
11. verificar que `service_role` no se introdujo al frontend.

## 16. Política de secretos

Nunca documentar en Git:

- passwords;
- service role/secret keys;
- JWTs;
- access tokens;
- cookies de sesión;
- passcodes de invitados;
- datos personales no necesarios.

Los nombres de variables de entorno sí pueden documentarse; sus valores secretos no.