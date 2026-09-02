# Orchard visual audit — Heirloom reference

Audit date: 2026-09-02
Reference farm/session: BS · season Aug 2026–Jul 2027
Purpose: extract visual/interaction patterns that improve Black Swan Orchard without copying Heirloom data semantics or inventing operational values.

## Audit method

Authenticated Heirloom screens inspected directly:

- Dashboard
- Crops
- Game Plan / Planting Calendar
- Crop Map
- Seeds & Transplants
- Nursery
- Harvests
- Tasks / List
- Tasks / Week Board
- Tasks / Workload Graph
- Farm Map

Black Swan implementation must preserve Corcovado canonical data, workbook provenance and Supabase lineage. Heirloom is a visual/product benchmark only.

## System-level findings

### 1. Heirloom gives each operational screen one dominant surface

The strongest screens do not use a wall of cards. They use one dominant surface:

- Planting Calendar → continuous season timeline.
- Tasks List → dense operational table.
- Week Board → seven day columns.
- Workload Graph → one large stacked weekly chart.
- Seeds & Transplants → one procurement table.
- Nursery → one capacity table plus a small capacity visualization.
- Harvests → one wide weekly projection matrix.
- Crop Map → one full-canvas planning surface.

Cards are mainly justified for dashboard widgets or crop catalog selection.

**Black Swan rule:** one screen = one primary operational surface. Secondary metrics should support it, not compete with it.

### 2. Navigation is workflow-first

Heirloom keeps the season workflow together:

Crops → Game Plan → Crop Map → Seeds & Transplants → Nursery → Harvests → Tasks.

Tasks then exposes three purpose-specific views:

- List
- Week Board
- Workload Graph

**Black Swan rule:** preserve a small primary Orchard workflow and place reference/admin tools behind secondary navigation.

### 3. Time is the main visual axis

Heirloom repeatedly uses time as the organizing dimension:

- months + ISO weeks in Game Plan;
- day columns in Week Board;
- weeks 1–52 in Workload Graph;
- weekly columns in Harvests.

**Black Swan rule:** use the season timeline as the shared visual grammar across planting, work, capacity and harvest.

### 4. Dense tables replace decorative cards

Seeds, task list, nursery containers and harvest projections use compact rows and explicit columns. Crop imagery is small and contextual.

**Black Swan rule:** operational rows should generally be 44–56 px high, with sticky headers where useful. Avoid large cards for crop records, seed rows, tasks or harvest windows.

### 5. Color is data, not decoration

Heirloom uses crop-specific colors in planting timelines and small crop imagery in tables. Teal/green is reserved mostly for active navigation and primary actions.

**Black Swan rule:** green remains the Orchard action/accent color; data series use a bounded palette by phase/category. Do not turn every state green.

## Screen-by-screen audit

### Dashboard

Observed patterns:

- preset selector (for example weekly operation);
- configurable/reorderable widgets;
- daily tasks widget with weather and completion progress;
- weekly weather;
- estimated income by month;
- crop distribution;
- notes.

What to adopt:

- compact configurable operational modules;
- charts only where there is real source data;
- daily task panel should be action-first.

What not to copy:

- oversized onboarding/promotional panel after setup;
- widgets that repeat the same information already available in a primary cockpit.

### Crops

Observed patterns:

- visual crop catalog with stylized crop art;
- search, filters and sort;
- crop card is a selector/creator, not an operational status card;
- existing planting count appears on selected crops.

What to adopt:

- imagery is appropriate in Library/Crop selection only;
- keep operational pages image-light.

### Game Plan / Planting Calendar

This is Heirloom’s strongest visual pattern.

Observed structure:

- months and week numbers in a sticky horizontal header;
- crop group header;
- crop summary inline: planting count, bed length, projected yield, estimated income;
- one sub-row per succession;
- continuous colored bars spanning propagation/field/harvest timing;
- search, crop visibility, filters and succession controls;
- collapse/expand crop groups;
- season selector always visible.

What Black Swan should adopt:

- field plan 32 as default operational scope;
- crop group + succession rows;
- phase bars on a continuous season axis;
- crop-level inline summary;
- sticky crop column and sticky time header;
- visual distinction between sowing, field and harvest phases;
- full-plan 66 remains an explicit alternate view.

Black Swan advantage to preserve:

- exact provenance and distinction between Corcovado canonical data and external benchmark.

### Crop Map

Observed patterns:

- almost full-screen canvas;
- floating mode controls rather than permanent panels;
- zoom/fit controls at the edge;
- compact assignment progress indicator;
- time grid drawn inside physical block geometry.

What Black Swan should adopt:

- canvas-first workspace;
- contextual panels open on demand;
- persistent compact progress: assigned / total;
- capacity/conflict visualization integrated into geometry.

What to improve beyond Heirloom:

- avoid an empty-canvas feeling;
- show canonical plot/block identity, current date occupancy and upcoming occupancy clearly;
- preserve geometry confidence/provenance.

### Seeds & Transplants

Observed patterns:

- Seeds / Transplants tabs;
- compact searchable table;
- columns: crop, cultivar, first nursery sow, first planting, weight, seed count, order status;
- order status is directly actionable per row;
- export is secondary.

What Black Swan should adopt:

- table-first procurement cockpit;
- separate planning demand from physical lot inventory;
- explicit evidence state when germination is unknown;
- native DS units must remain grams/tubers/count and never be coerced into seed count.

### Nursery

Observed patterns:

- physical usable nursery-area setting;
- capacity/usage indicator;
- Containers / Current Plantings tabs;
- container table: maximum projected usage, total usage, currently in use;
- capacity is the visual question, not decorative seedling cards.

What Black Swan should adopt:

- capacity first;
- projected container demand table;
- actual batches separate from projections;
- observed germination derived only from actual batch emergence.

Current Black Swan constraint:

- 0 seed lots and 0 nursery batches. Therefore actual occupancy must remain empty/zero and projections must be clearly labeled as plan/reference.

### Harvests

Observed patterns:

- Sales Channels / Season Harvests / Weekly Harvests tabs;
- large weekly matrix;
- crops in rows, weeks in columns;
- projected quantity and projected income separated;
- totals retained at right/bottom;
- filters, channel selector and export.

What Black Swan should adopt:

- weekly harvest availability matrix;
- projected vs actual always visually separated;
- exact crop_succession_id lineage for actual harvests;
- never combine incompatible units.

### Tasks — List

Observed patterns:

- season/week modes;
- dense table with date, task, type, crop, planting amount, location;
- assignee/completion controls at row edge;
- search/filter/export/add-task actions.

What Black Swan should adopt:

- planning references should be table-first;
- operational tasks should show assignee, location, status and source;
- task creation remains explicit, never automatic from workbook dates.

### Tasks — Week Board

Observed patterns:

- day columns across the week;
- day/date/weather at top of each column;
- estimated workload per day;
- compact task blocks;
- week navigation, filters, display options and add-task.

What Black Swan should adopt:

- week board is the execution surface once real tasks exist;
- weather can support planning but must not replace task truth;
- no fake workload hours before estimated_minutes exist.

Current Black Swan constraint:

- 0 Orchard operational tasks currently exist, so Week Board should not synthesize hours from planning references.

### Tasks — Workload Graph

Observed patterns:

- season total hours;
- average per week;
- peak week;
- peak-period staffing;
- large stacked weekly bar chart by task category;
- clear note that harvest workload is estimated.

What Black Swan should adopt now:

- large weekly chart, but use **planned action counts** and/or **planned bed-m events** until real task durations exist;
- once operational tasks carry estimated_minutes, expose a separate real workload-hours view.

Do not show hours today because Black Swan has 0 Orchard tasks with estimated_minutes.

## Black Swan visual priorities

### P1 — immediate

1. Game Plan remains calendar-first.
2. Add a graphical Season Pulse to the Game Plan overview.
3. Add Planned Workload Graph to Calendar & Tasks using source-backed action counts, not invented hours.
4. Add temporal Capacity Curve (occupied bed-m vs 800 bed-m).
5. Make Seeds/Nursery table-first and projection-vs-actual explicit.
6. Make Harvest week-matrix the principal analytical view.

### P2 — next

7. Convert Crop Map into a more canvas-dominant workspace with contextual controls.
8. Reduce visual weight of reference pages (Objectives, Written Plan, Crop Chart) so operational views dominate navigation.
9. Use crop illustrations only for crop selection/library, not daily operations.

## Design rules for implementation

- One primary surface per page.
- Timeline/grid/table/chart before cards.
- Sticky headers and sticky first column for wide operational grids.
- Preserve desktop density, but provide stacked/table alternatives below tablet widths.
- Every chart title must state whether it is planned, projected, observed or actual.
- Never chart a quantity that the source does not support.
- Never infer task hours from workbook action count.
- Never infer nursery occupancy from projected containers.
- Never infer actual harvest from planned windows.
- External Heirloom values remain benchmarks, never canonical replacements.

## Current data reality used by this audit

- 32 physically reconciled successions.
- 0 Orchard operational tasks.
- 0 Orchard tasks with estimated_minutes.
- 0 seed lots.
- 0 nursery batches.
- 0 current-plan harvest records.

Therefore the next graphics should emphasize **plan shape, timing, capacity and evidence coverage**, while clearly reserving actual/observed charts for when field data exists.
