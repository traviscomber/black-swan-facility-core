# Runbook de operación, Cronos y recuperación

**Baseline:** `f22330dec23ed396d195abbdb5e1f9ed2ea61ed7`  
**Producción:** `https://blackswn.app`  
**Vercel project:** `v0-black-swan-facility-core`  
**Supabase project ref:** `ruslvodmzqctkaafnpfx`

Este runbook describe cómo observar, diagnosticar y recuperar BSFC sin inventar datos ni debilitar controles de seguridad.

## 1. Regla operacional

Antes de modificar código o datos, identificar la capa que falla:

1. dominio/DNS/edge;
2. deployment/build;
3. Next.js runtime;
4. Auth/proxy/access;
5. Supabase/RLS/RPC;
6. datos/integridad;
7. integración/job externo;
8. UI/cliente.

No corregir una capa sana para compensar otra defectuosa.

---

## 2. Snapshot de cierre

### Release productiva

- commit: `f22330dec23ed396d195abbdb5e1f9ed2ea61ed7`;
- deployment: `dpl_EuizvxiBFrvqCMMLMEaEAzP55wLg`;
- state: `READY`;
- target: production;
- domain: `blackswn.app`.

### Control plane

Snapshot tomado el 2026-08-27 durante cierre documental:

| Job | Schedule | Último resultado observado | Health | Due retries | Dead letters |
|---|---|---|---|---:|---:|
| `integration-job-supervisor` | `3,8,13,18,23,28,33,38,43,48,53,58 * * * *` | success | healthy | 0 | 0 |
| `operations-health-snapshot` | `*/15 * * * *` | success | healthy | 0 | 0 |

Los timestamps de última ejecución cambian; consultar estado live antes de diagnosticar.

---

## 3. IT Control Center

Ruta interna:

`/admin/it-control`

Usar como primera vista operativa cuando el usuario tenga `admin` o scope IT activo.

El panel debe mostrar evidencia live de:

- jobs registrados;
- schedule/actividad;
- freshness/último run;
- running count;
- retry count;
- dead-letter count;
- estado de RLS/policies resumido;
- perfiles de acceso resumidos;
- runs recientes.

No usar esta página para ejecutar acciones destructivas. Es read-only por diseño.

---

## 4. Estados de job

Usar etiquetas operacionales claras:

- `healthy` / HEALTHY — ejecuta dentro del intervalo esperado, sin deuda terminal.
- DEGRADED — ejecuta pero una fuente/parte del resultado está degradada.
- STALE — no existe run exitoso dentro de freshness esperada.
- FAILED — último resultado es fallo y requiere atención.
- DISABLED — job deshabilitado intencionalmente.

Un retry pendiente no es equivalente a dead letter. Una dead letter indica que la política de retry se agotó o el run terminó de forma terminal.

---

## 5. Consulta SQL de health

Consulta read-only canónica para diagnóstico de jobs:

```sql
select
  job_key,
  active,
  schedule,
  last_run_at,
  last_success_at,
  running_count,
  due_retry_count,
  dead_letter_count,
  health
from private.get_integration_job_health()
order by job_key;
```

No modificar el registry o pg_cron directamente durante diagnóstico inicial.

---

## 6. Jobs actuales

### `operations-health-snapshot`

Objetivo: capturar health operacional de forma read-only.

Schedule: cada 15 minutos.

Propiedad crítica: **no toma decisiones de negocio ni resuelve automáticamente excepciones operacionales**.

### `integration-job-supervisor`

Objetivo: supervisar ejecución/recovery según las reglas del control plane.

Schedule: minutos `3,8,13,...,58` de cada hora.

Propiedades:

- retries acotados;
- stale recovery controlado;
- dead-letter terminal;
- no transformar un job de observabilidad en automatización irreversible.

---

## 7. Triage de incidente

### A. Sitio no responde

1. comprobar `blackswn.app`;
2. revisar deployment productivo exacto en Vercel;
3. confirmar `READY`/alias;
4. revisar build logs;
5. revisar runtime `error`/`fatal`;
6. si el deployment nuevo es defectuoso, volver al último deployment READY conocido.

### B. Login loop / forbidden inesperado

1. confirmar locale/path;
2. confirmar usuario Auth activo;
3. revisar `user_access_profiles`;
4. revisar role/capability;
5. revisar scopes de departamento/ubicación;
6. revisar proxy requirement;
7. comprobar RLS/RPC;
8. no conceder admin temporal para “probar” salvo un procedimiento explícito y auditado.

### C. Booking inconsistente

Tratar como prioridad alta.

Verificar:

- fechas válidas;
- overlaps activos;
- bed/room;
- room blocks;
- source policy;
- estado de reserva;
- historial/approval/undo;
- housekeeping/maintenance lineage;
- payment/invoice si participa.

No corregir conflictos borrando historia.

### D. Stock/asset inconsistente

Verificar:

- asset canonical id;
- último movimiento;
- custody;
- location/warehouse;
- count/audit físico;
- receipt/intake lineage si vino de compra;
- maintenance/issue abierto.

### E. Procurement detenido

Identificar etapa exacta:

`request / sourcing / quote / comparison / approval / PO / receiving / intake`.

Revisar autorización antes de modificar estado. No saltar etapas escribiendo directamente en la tabla final para “destrabar” una compra.

### F. Job stale/failed

1. comprobar health;
2. leer run más reciente;
3. identificar trigger source/attempt/error_code;
4. comprobar si existe retry programado;
5. comprobar dead letter;
6. identificar source externo/dependencia;
7. sólo entonces decidir retry manual o código/configuración.

---

## 8. Deployment normal

Flujo recomendado:

1. branch desde `main` actual;
2. cambios pequeños;
3. preview automático;
4. typecheck/tests/build;
5. QA de superficies afectadas;
6. comparar `base=main` vs `head`;
7. exigir `behind_by = 0` para fast-forward limpio;
8. actualizar `main` sin force;
9. esperar deployment production exacto del nuevo SHA;
10. comprobar domain → deployment;
11. revisar runtime errors;
12. registrar SHA/deployment y cualquier excepción.

No declarar release por el estado de un preview intermedio.

---

## 9. Rollback

Rollback es una decisión operacional, no un nuevo desarrollo.

### Condiciones típicas

- P0/P1 confirmado en release nueva;
- auth/access roto para usuarios primarios;
- data corruption risk;
- Booking conflict regression;
- runtime fatal repetido sin mitigación segura.

### Procedimiento

1. detener promoción de cambios adicionales;
2. identificar último deployment productivo READY conocido;
3. confirmar SHA y compatibilidad de schema;
4. si la migración nueva fue sólo aditiva y backward-compatible, volver a deployment anterior puede ser suficiente;
5. si hubo cambio de schema no compatible, usar el rollback/forward-fix previsto por la migración — no improvisar DROP/DELETE;
6. verificar dominio, login, ruta primaria y runtime tras rollback;
7. conservar evidencia del incidente.

La baseline `dpl_EuizvxiBFrvqCMMLMEaEAzP55wLg` es el deployment de referencia de este documento, no una garantía de que siga siendo el mejor rollback en releases futuras.

---

## 10. Data integrity checks de Hospitalidad

Para una auditoría de release que toque Booking, incluir queries equivalentes a:

- reservas activas que solapan el mismo bed/unit;
- `check_out <= check_in`;
- reservation → room orphan;
- reservation → bed orphan;
- housekeeping → reservation orphan;
- maintenance → reservation orphan;
- room block conflicts.

El resultado esperado para integridad estructural es cero conflictos/orphans no explicados.

---

## 11. Security snapshot

Para cierre/hardening comprobar:

- RLS habilitado en tablas expuestas;
- tablas sin policy;
- policies demasiado amplias;
- grants de privileged RPCs;
- perfiles activos/deshabilitados;
- Auth users sin profile cuando sea relevante;
- security advisors;
- Leaked Password Protection.

No resolver advisories mediante policies permisivas o revocaciones masivas sin entender el workflow.

---

## 12. Observabilidad posterior a release

Después de un cambio material:

- revisar Vercel runtime errors/fatals;
- comprobar health de jobs;
- comprobar cambios de datos esperados;
- comprobar que no aumentan retries/dead letters;
- revisar logs de auditoría si hubo mutations;
- confirmar que usuarios primarios pueden completar el flujo real.

El mejor siguiente trabajo después del cierre es observar fricción real, no crear módulos especulativos.

---

## 13. Qué no automatizar por defecto

- aprobar compras;
- resolver excepciones financieras;
- borrar/archivar incidentes críticos;
- alterar reservas conflictivas;
- cerrar pagos/facturas;
- mover activos sin evidencia;
- cambiar roles/scopes;
- reprogramar jobs.

Estas acciones pueden automatizarse en el futuro sólo con contrato explícito, safeguards, audit y rollback.

---

## 14. Cambio de schedule

Antes de cambiar un cron:

1. documentar job key y owner;
2. documentar schedule anterior/nuevo;
3. explicitar timezone/interpretación;
4. verificar solapamiento y duración;
5. definir retry/stale threshold;
6. revisar impacto de carga/costo;
7. aplicar de forma versionada;
8. observar al menos una ejecución real;
9. confirmar `last_success_at`;
10. registrar rollback.

No cambiar el schedule sólo porque una ejecución manual funcionó.

---

## 15. Handoff operativo

El equipo que recibe BSFC debe conocer como mínimo:

- cómo identificar el SHA en producción;
- dónde mirar Vercel build/runtime;
- cómo abrir IT Control Center;
- cómo consultar health de Cronos;
- cómo distinguir access issue de RLS issue;
- cómo identificar el objeto canónico afectado;
- cómo hacer rollback sin perder datos;
- cuáles son los advisories aceptados temporalmente.

Mantener este runbook actualizado después de cualquier cambio de infraestructura, scheduler, deployment topology o modelo de autorización.