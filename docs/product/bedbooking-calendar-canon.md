# Canon de producto: calendario de reservas

## Decisión

El calendario de `black-swan-facility-core` debe tomar como referencia funcional principal la experiencia de calendario de BedBooking.

La referencia es de comportamiento, jerarquía e interacción. No implica copiar marca, textos, activos visuales, código propietario ni elementos protegidos. La interfaz final debe conservar la identidad visual y el contexto operativo de Fundo Corcovado.

## Fuente de verdad

Referencia principal:

- Producto y calendario de BedBooking.
- Centro de ayuda oficial de BedBooking para calendario, reservas, bloqueos, unidades de alojamiento, colores, resumen diario y disponibilidad.
- Evidencia visual obtenida directamente del producto autenticado, cuando el propietario facilite acceso de forma segura.

Cuando exista diferencia entre una interpretación interna y el comportamiento comprobado de BedBooking, prevalece el comportamiento comprobado, salvo que contradiga una necesidad operativa documentada de Fundo Corcovado.

## Principios canónicos

1. El calendario es la superficie operativa principal para consultar y modificar disponibilidad.
2. Las unidades se muestran en filas y el tiempo en columnas.
3. Una unidad puede representar habitación, cama u otra unidad vendible.
4. Las reservas se representan como bloques continuos sobre el rango de fechas.
5. Mover, redimensionar y crear deben sentirse como partes de un único sistema de interacción.
6. La interacción debe funcionar con mouse, touch y lápiz mediante Pointer Events.
7. El usuario debe ver una previsualización antes de confirmar cualquier cambio.
8. Los conflictos con reservas o bloqueos deben mostrarse antes del commit.
9. Las operaciones deben ser atómicas y revertirse visualmente si el servidor las rechaza.
10. El scroll automático debe funcionar horizontal y verticalmente durante interacciones largas.
11. La apertura del detalle, la selección múltiple y la edición física no deben competir entre sí.
12. Los estados de reserva y bloqueo deben distinguirse con claridad, sin depender solo del color.
13. El calendario debe mantener una densidad operativa alta sin sacrificar legibilidad.
14. Desktop y móvil deben conservar el mismo modelo mental, adaptando controles y áreas táctiles.
15. La implementación debe conservar datos reales, reglas de disponibilidad y terminología de Fundo Corcovado.

## Comportamientos requeridos

### Crear

- Arrastrar sobre espacio libre crea una selección temporal.
- La selección se ajusta por días completos.
- La previsualización indica rango y disponibilidad.
- Soltar abre el flujo de creación con cama y fechas preseleccionadas.

### Mover

- Arrastrar una reserva permite cambiar de cama y, cuando corresponda, desplazar fechas.
- La posición original permanece identificable durante la interacción.
- El destino válido se destaca.
- Un destino inválido muestra el tipo de conflicto.
- El movimiento se confirma mediante una operación atómica del servidor.

### Redimensionar

- Los extremos de una reserva permiten cambiar check-in o check-out.
- La estancia mínima es de una noche.
- La previsualización muestra las fechas propuestas.
- La operación no se confirma si existe conflicto.

### Abrir y seleccionar

- Un clic o toque abre la reserva cuando no existe una interacción física activa.
- La selección múltiple usa un control explícito o modificador de teclado.
- Los controles de selección y resize no deben disparar la apertura del detalle.

### Navegación

- La fila de encabezado y la columna de unidades permanecen visibles durante scroll.
- El calendario permite avanzar, retroceder y volver a hoy.
- Durante drag o resize, acercarse a un borde activa autoscroll progresivo.

## Arquitectura objetivo

```text
app/bookings/calendar/
  calendar-types.ts
  calendar-geometry.ts
  use-calendar-interaction.ts
  use-calendar-autoscroll.ts
  use-calendar-availability.ts
  use-flip-animation.ts

components/bookings/calendar/
  reservation-block.tsx
  reservation-preview.tsx
  timeline-row.tsx
  timeline-grid.tsx
  creation-selection.tsx
```

El estado de interacción debe usar una única máquina discriminada:

```ts
type CalendarInteraction =
  | "move"
  | "resize-start"
  | "resize-end"
  | "create"
```

No se considera canónico mantener HTML Drag and Drop junto con Pointer Events como modelos paralelos.

## Criterios de aceptación

Una fase solo se considera terminada cuando:

- compila sin errores;
- fue probada con mouse y touch cuando sea posible;
- no permite sobreposición silenciosa;
- muestra preview de disponibilidad;
- conserva rollback visual y de datos;
- no duplica implementaciones de bloques;
- mantiene estados de carga, error, vacío y confirmación;
- conserva la identidad visual de Fundo Corcovado;
- fue verificada en el despliegue correspondiente.

## Uso de acceso autenticado

El acceso autenticado a BedBooking puede utilizarse para observar comportamientos que no estén documentados públicamente, como microinteracciones, menús contextuales, drag, resize, selección, respuesta móvil y estados de conflicto.

Las credenciales no deben compartirse por chat ni guardarse en el repositorio. El acceso debe realizarse mediante un mecanismo seguro y temporal. No se copiarán datos privados, huéspedes, tarifas ni información comercial de la cuenta de referencia.

## Límites

BedBooking es referencia funcional, no dependencia técnica. El sistema de Fundo Corcovado debe seguir usando su propia arquitectura, Supabase, permisos, datos y reglas operativas.
