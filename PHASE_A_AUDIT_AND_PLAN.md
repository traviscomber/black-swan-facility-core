# PHASE A Audit & Implementation Plan
## Blackswan Facility Core - Calendar UX

---

## Estado Actual (Auditoría Completa)

### ✅ Funcionalidades Existentes

#### 1. Calendar Timeline
- Ubicación: `/app/bookings/calendar/page.tsx`
- Estado: **COMPLETO Y FUNCIONAL**
- Características:
  - Vista de múltiples camas simultáneamente
  - Rango configurable de días (default 14)
  - Filtros por ubicación, estado, búsqueda
  - Navegación por fecha (anterior/siguiente)
  - Sincronización real-time con Supabase

#### 2. Drag & Drop de Reservas
- Ubicación: `/components/resizable-reservation-block.tsx`
- Estado: **COMPLETO PERO NECESITA MEJORAS**
- Características existentes:
  - Drag horizontal (entre camas)
  - Drag vertical (sin función aún)
  - Resize desde extremo izquierdo (start)
  - Resize desde extremo derecho (end)
  - Move/drag del bloque completo
  - Preview visual durante drag (verde/rojo según disponibilidad)
  - Validación local de conflictos

#### 3. Autoscroll Horizontal
- Estado: **COMPLETAMENTE IMPLEMENTADO**
- Funciona durante: drag, resize, move
- Sin problemas detectados

#### 4. Validación de Conflictos
- Estado: **FUNCIONAL**
- Método: Verificación local contra reservaciones y bloqueos
- Feedback: Color verde (disponible) / rojo (conflicto)

#### 5. RPC Atómico
- Función: `resize_booking_reservation(p_reservation_id, p_check_in, p_check_out)`
- Estado: **FUNCIONAL**
- Garantías: Rollback automático si falla

#### 6. Rollback Optimista
- Estado: **IMPLEMENTADO**
- Comportamiento: Revierte cambios visuales si la operación falla

#### 7. Real-time Updates
- Canales Supabase: `reservations`, `room_blocks`
- Estado: **ACTIVO**
- Trigger: Reload automático al detectar cambios

---

## ❌ Funcionalidades Faltantes en Fase A

### A2: Autoscroll Vertical ⚠️ **CRÍTICO**
**Estado**: NO IMPLEMENTADO
**Ubicación de cambio**: `/components/resizable-reservation-block.tsx`

**Requisitos**:
- Detectar proximidad al borde superior/inferior (64-80px)
- Scroll automático cuando:
  - Se arrastra una reserva verticalmente entre camas
  - Se redimensiona una reserva
  - El puntero está cerca del borde
- Implementación:
  - Usar `requestAnimationFrame` (NO setInterval)
  - Velocidad progresiva: 4 px/frame (mínimo) → 20 px/frame (máximo)
  - Detener en: `dragend`, `drop`, `pointerup`, `pointercancel`, desmontaje
  - Combinar correctamente con autoscroll horizontal existente

**Impacto**: Imposible mover reservas a camas fuera del viewport sin autoscroll vertical

---

### A3: Animaciones FLIP ⚠️ **RECOMENDADO**
**Estado**: NO IMPLEMENTADO
**Ubicación de cambio**: 
- `/components/resizable-reservation-block.tsx` (animaciones de resize/move)
- `/app/bookings/calendar/page.tsx` (cambios de estructura)

**Requisitos**:
- Animar:
  - Mover reserva entre camas (cambio de posición Y)
  - Cambios optimistas de posición X
  - Cambios de ancho al redimensionar
  - Rollback si operación falla
  - Confirmación final
- Implementación:
  - Duración: 180-260ms (preferencia: 220ms)
  - Usar `transform` y `opacity` (NO cambiar layout)
  - Evitar layout thrashing
  - Respetar `prefers-reduced-motion`
  - No introducir nuevas librerías
- Resultado: Transiciones suaves, no "saltarían" visualmente

---

### A4: Resize Táctil para iPad ⚠️ **RECOMENDADO**
**Estado**: PARCIALMENTE IMPLEMENTADO (mouse/trackpad only)
**Ubicación de cambio**: `/components/resizable-reservation-block.tsx`

**Requisitos**:
- Handles más grandes para touch:
  - Área interactiva: 28-36px (vs 12px actual)
  - NO alterar la apariencia desktop
  - Usar CSS dinámico si es necesario
- Usar Pointer Events (no Touch Events):
  - `pointerdown` / `pointermove` / `pointerup`
  - Captura: `setPointerCapture(pointerId)`
  - Solo durante manipulación
- Control de scroll:
  - `touch-action: none` SOLO en los handles
  - NO bloquear scroll fuera de handles
  - NO bloquear scroll horizontal del calendario
- Feedback visual:
  - Hover state en desktop
  - Active state al tocar
  - Indicador visual del handle activo
- Validaciones:
  - Mínimo 1 noche (igual que mouse)
  - Validación de conflictos igual
  - Ambos extremos (izquierdo y derecho)

**Impacto**: iPad/tablet completamente inutilizable sin esto

---

## Checklist de Validación (Fase A)

### Interacciones Básicas
- [ ] Drag horizontal (mouse)
- [ ] Drag vertical (mouse)
- [ ] Drag diagonal (mouse)
- [ ] Resize desde extremo izquierdo (mouse)
- [ ] Resize desde extremo derecho (mouse)
- [ ] Resize con autoscroll vertical + horizontal simultáneo (mouse)

### Dispositivos & Input
- [ ] Mouse (Windows/Mac)
- [ ] Trackpad (Mac)
- [ ] Touch (iPad, pantalla táctil)
- [ ] iPad viewport (1024x768+)

### Comportamiento Correcto
- [ ] Cancelación funciona (ESC, pointercancel)
- [ ] Rollback funciona (error en API)
- [ ] Conflicto con bloqueo muestra rojo
- [ ] Conflicto con reserva muestra rojo
- [ ] Disponibilidad muestra verde
- [ ] Selección NO abre detalle

### Visual & Performance
- [ ] Animaciones suaves (60fps, no laggy)
- [ ] prefers-reduced-motion respetado
- [ ] Handles visibles en todos los navegadores
- [ ] Sin parpadeos durante drag/resize

### Técnico
- [ ] `pnpm exec tsc --noEmit` sin errores
- [ ] `pnpm run build` sin errores
- [ ] Tests existentes pasan
- [ ] Console sin warnings/errors
- [ ] Real-time sigue funcionando
- [ ] Filtros siguen funcionando
- [ ] Métricas correctas

---

## Próximos Pasos (Orden Obligatorio)

1. ✅ **Auditoría** (COMPLETADO)
2. 🔄 **Implementar A2** (Autoscroll Vertical)
3. 🔄 **Implementar A3** (Animaciones FLIP)
4. 🔄 **Implementar A4** (Resize Táctil)
5. 🔄 **Validar Fase A** (Testing completo)
6. 🔄 **Commit**: `feat: complete calendar interaction ux`
7. ⏳ **Iniciar Fase B** (Operaciones Masivas)

---

## Notas Importantes

- **NO romper**: Drag horizontal, resize, RPC atómico, rollback, filtros, real-time
- **Mantener**: Validación de conflictos, preview visual, estados de reserva
- **NO usar**: Nuevas librerías (a menos que ya exista en package.json)
- **Respetar**: `prefers-reduced-motion`, accesibilidad, mobile-first
