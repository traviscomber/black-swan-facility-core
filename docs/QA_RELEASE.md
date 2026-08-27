# QA y gate de release

**Baseline:** `f22330dec23ed396d195abbdb5e1f9ed2ea61ed7`

El objetivo de QA en BSFC no es obtener un número alto de tests: es demostrar que un cambio puede entrar a producción sin romper integridad, autorización ni workflows primarios.

## 1. Veredictos

Cada release material termina en un único veredicto:

- **PASS** — no quedan P0/P1 conocidos y todos los gates requeridos están verdes.
- **HOLD** — no hay P0 conocido, pero existe un gate pendiente/rojo/no confiable o un P1 abierto.
- **BLOCK** — existe P0 o evidencia de comportamiento inseguro.

Un build verde no transforma un HOLD en PASS.

---

## 2. Severidad

### P0 / BLOCK

- autorización/tenant/scope bypass;
- corrupción/pérdida de datos;
- doble booking silencioso;
- secreto expuesto;
- mutation crítica irreversible sin control;
- aplicación inutilizable para el flujo primario;
- migración peligrosa sin rollback viable.

### P1 / HOLD

- flujo primario roto;
- rol/locale/browser/mobile crítico roto;
- resultado financiero/operacional consecuencial incorrecto;
- CI requerido rojo o no confiable;
- producción/preview no verificable.

### P2

- degradación importante con workaround;
- localización/accesibilidad secundaria;
- inconsistencia de módulo no primario.

### P3

- polish/copy/edge case menor.

---

## 3. Gate automático del repositorio

### TypeScript

```bash
pnpm typecheck
```

Genera traducciones legacy y ejecuta `tsc --noEmit`.

### Build completo

```bash
pnpm build
```

El hook `prebuild` ejecuta previamente arquitectura y suites contractuales.

### OS gate

```bash
pnpm test:os
```

En la baseline de cierre el gate aprobó **67/67** tests.

El conjunto cubre:

- OS navigation;
- OS home/personas;
- Big Picture/Panorama;
- shell y route context;
- temporal foundation;
- activities timeline/calendar;
- compatibility;
- object OS;
- global command layer;
- operational scope security;
- mobile shell QA;
- IT Control Center y middleware gate.

### Inventory contracts

```bash
pnpm test:inventory
```

Incluye cycle count, custody, maintenance, asset audit, replenishment/receiving y sourcing contracts.

### Booking contracts

```bash
pnpm test:booking
```

Cubre reglas, drag, source policy y object contract.

### Booking browser E2E

```bash
pnpm test:e2e:booking
```

El harness levanta un servidor aislado y ejecuta Playwright. No usar mocks de éxito para afirmar que una integración productiva funciona.

---

## 4. GitHub Actions

Workflows observados:

### `booking-calendar-e2e.yml`

Ejecuta el browser gate de Booking en el entorno oficial de Playwright.

### `booking-calendar-e2e-status.yml`

Publica el estado específico de Booking y usa la misma base de contenedor para evitar falsos negativos por sandbox del runner.

### `map-performance-hardening.yml`

Protege el trabajo de performance/GIS.

Cuando un workflow falla, determinar primero si es producto, fixture, runner/container, navegador o bootstrap.

---

## 5. Hospitality — escenarios críticos

Cualquier cambio en Booking debe evaluar los escenarios que correspondan:

### Inventario y disponibilidad

- no overlap activo sobre la misma unidad/cama;
- room blocks;
- fecha de entrada/salida válida;
- multi-unit/bed inventory;
- source/channel policy.

### Calendario

- pointer move;
- undo;
- keyboard move;
- vertical swap;
- drag creation;
- resize cuando aplica;
- touch / long-press;
- rango/scroll/navegación.

### Lifecycle

- pre-arrival/readiness;
- check-in blockers;
- check-out blockers;
- housekeeping;
- handover;
- maintenance/incidents;
- logistics.

### Finanzas

- cargos/extras;
- invoice draft vs finalized;
- payment recording;
- balance/total reproducible;
- reversals/adjustments cuando aplica.

Un error visual del calendario que aplica una mutation incorrecta es como mínimo P1; un conflicto silencioso de inventario es P0.

---

## 6. Access/role testing

Para cambios de autorización probar al menos:

1. caso autorizado;
2. caso autenticado pero no autorizado;
3. usuario sin perfil activo cuando sea relevante;
4. scope de departamento;
5. scope de ubicación;
6. objeto con `location_id = NULL` frente a scope específico;
7. ruta directa escrita manualmente;
8. RPC directo bajo sesión no autorizada.

No basta con comprobar que el link desaparece del sidebar.

---

## 7. Localization

Idiomas soportados:

- EN
- ES
- DE

Verificar:

- prefijo de ruta;
- `<html lang>`;
- login;
- redirects y `next`;
- navegación mantiene locale;
- labels/aria-labels;
- mensajes de error;
- loading/empty/404;
- fechas/números cuando son locales;
- ausencia de copy fijo español en EN/DE.

`/deu` debe normalizarse intencionalmente a `/de` si se conserva soporte legacy.

---

## 8. Mobile, accessibility e interacción

Según superficie:

- sidebar/drawer móvil;
- back/navigation/logout con accessible names;
- keyboard focus y Escape;
- touch targets;
- no hover-only action;
- overflow en tablas/cards;
- command palette keyboard;
- shortcut no comprimido;
- diálogos con focus correcto.

El shell móvil mantiene el mark canónico `BSFC`.

---

## 9. Data integrity gate

Si una release toca schema o workflows persistidos, sumar queries directas.

Ejemplos:

### Booking

- active overlap pairs = 0;
- invalid reservation dates = 0;
- orphan reservation → room/bed = 0;
- orphan housekeeping/maintenance → reservation = 0;
- block conflicts no explicados = 0.

### Procurement

- request/PO/receipt/intake lineage consistente;
- no receipt item huérfano;
- no intake desconectado de recepción;
- approvals con actor/scope válido.

### Inventory

- movement/custody con asset válido;
- count/audit con location/session válida;
- retirement workflow consistente.

---

## 10. Deployment gate

Para promoción a producción:

1. SHA exacto conocido;
2. preview/build `READY`;
3. tests requeridos PASS;
4. compare con `main` sin divergencia inesperada;
5. promoción fast-forward;
6. production deployment del **mismo SHA**;
7. build log completo;
8. domain apunta al deployment;
9. smoke de flujo/ruta afectada;
10. runtime `error/fatal` limpio o errores explicados;
11. rollback conocido.

Un preview de un commit intermedio no sustituye al gate del SHA final.

---

## 11. Evidencia de cierre actual

Para la baseline `f22330d…` se verificó en el cierre técnico:

- `main` en el SHA esperado;
- Vercel production `dpl_EuizvxiBFrvqCMMLMEaEAzP55wLg` READY;
- `test:os` 67/67;
- TypeScript/build Next completos;
- smoke no autenticado/localizado EN/ES/DE;
- IT route protegida;
- runtime sin error/fatal observado en la ventana posterior;
- control plane healthy.

### Evidencia establecida previamente de Booking E2E

El browser gate de Booking fue estabilizado con Playwright 1.61.1 y contenedor oficial, cubriendo Chromium, Firefox, WebKit y touch. En cambios futuros de Booking se debe ejecutar de nuevo sobre el SHA candidato; esta documentación no convierte una corrida histórica en evidencia perpetua.

---

## 12. Lo que no se debe afirmar

No declarar como probado si no se ejecutó en el ciclo actual:

- “todos los usuarios funcionan”;
- “todas las páginas están visualmente perfectas”;
- “todas las integraciones externas están online”;
- “Procurement está usado end-to-end en producción”;
- “Leaked Password Protection está habilitado”;
- “no existen advisories de seguridad”.

La documentación separa implementación, test contractual y evidencia operacional real.

---

## 13. QA posterior al cierre

Después del cierre, priorizar:

- incidentes reales;
- regressions;
- datos inconsistentes;
- feedback de usuarios;
- performance observable;
- accesibilidad/locale encontrados en uso;
- advisories con mitigación segura.

No abrir una nueva fase de feature expansion sólo porque el gate está verde.

## 14. Definition of Done para futuros cambios

Un cambio material está “done” cuando:

- código/migración implementados;
- tests nuevos o existentes cubren el riesgo;
- build verde;
- acceso negativo probado cuando aplica;
- datos/integridad verificados cuando aplica;
- preview/production verificados;
- runtime revisado;
- documentación actualizada si cambia contrato, ruta, role, objeto o job;
- rollback conocido.

Sin esos elementos, el cambio puede estar implementado, pero no cerrado.