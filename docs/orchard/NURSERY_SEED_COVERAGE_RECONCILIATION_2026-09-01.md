# Nursery & Direct-Seed Coverage Reconciliation — 2026-09-01

## Scope

Game Plan: `3bdcad00-b8e5-4f73-bb8b-fdea96da9262` (Black Swan 2026/27).

This note records the verified reconciliation between the Black Swan workbook, the current Supabase model, and the `Seeds & Nursery` implementation. It is intentionally non-destructive: no production planning rows, inventory, tasks, or schema are changed by this commit.

## Evidence hierarchy

For 2026/27 orchard planning, preserve these layers instead of flattening them:

1. `Codified Game Plan` — season planting plan and bed-equivalent quantities.
2. `Crop Chart` — primary Black Swan crop operating profile.
3. `Ds Chart` — direct-seeding equipment, calibration, density, and alternate configurations.
4. `Nursery & Transplant Chart` — propagation/container reference.
5. `Seeds` — secondary purchasing model; useful for purchasing assumptions but not a primary agronomic source.
6. Seed-lot labels/catalog values — lot-specific reference when available.
7. Nursery/field observations — observed execution and performance; these must never be overwritten by planning defaults.

## Confirmed current-state facts

### Season population

- 62 total 2026/27 successions in Supabase.
- 26 are direct-sow successions across 13 direct-sow crops.
- 36 are transplant successions.
- The previously reconciled Heirloom subset remains 32 plantings: 10 direct sow + 22 transplants.

### Direct-sow bed length import gap

Only 10/26 direct-sow successions currently contain `planned_bed_m` in Supabase. The remaining 16 are not source-data gaps: their bed-equivalent quantities exist in `Codified Game Plan` and should be recoverable with lineage preserved.

Do not backfill these production planning rows without explicit authorization.

### Current Nursery coverage defect

`app/orchard/nursery/page.tsx` calculates demand from `planned_plants`:

```ts
const estimatedSeeds = (item: Succession) => {
  const plants = item.planned_plants ?? 0
  const germination = item.germination_rate_pct && item.germination_rate_pct > 0
    ? item.germination_rate_pct
    : 100
  const perPlant = item.seeds_per_plant && item.seeds_per_plant > 0
    ? item.seeds_per_plant
    : 1
  return Math.ceil((plants * perPlant) / (germination / 100))
}
```

This has two consequences:

1. Direct-sow successions with `planned_plants = NULL` contribute zero demand to the Seed Coverage board.
2. Unknown germination silently becomes 100%, understating transplant seed demand.

The current Seed Coverage board therefore must not be interpreted as complete seed coverage for the whole Game Plan.

### Germination semantics

The workbook `Seeds` sheet contains `Porcentaje de germinación de acuerdo a catálogo` and uses 90% as a broad purchasing assumption. The same assumption is present in the 2025/26 and 2026/27 workbooks.

That 90% is not verified crop/cultivar truth and must not be written automatically into `orchard_crop_library` or `orchard_crop_successions`.

Current system layers should remain distinct:

- `orchard_crop_library.germination_rate_pct`: explicit agronomic planning/reference default only when supported.
- `orchard_cultivar_library.germination_rate_pct`: cultivar-specific reference only when supported.
- `orchard_crop_successions.germination_rate_pct`: applied planning snapshot/default.
- `orchard_seed_lots.germination_rate_pct`: supplier/catalog/lot-specific value.
- `orchard_nursery_batches.seeds_sown` + `emerged_count`: observed germination evidence.

For the 22 reconciled transplant plantings, the current NULL→100% behavior gives 7,430 planned seeds. Applying the workbook's 90% purchasing assumption would give 8,265, a difference of +835 seeds (+11.2%). This demonstrates material impact but does not justify promoting 90% to canonical crop truth.

### Nursery container reconciliation

The Heirloom container totals are reproducible from Black Swan planning logic and no longer represent an unexplained gap:

- 128-cell trays: 28
- 72-cell trays: 19
- 4-inch pots: 256
- 6-inch pots: 128
- open tray: 1

The Lebanese cucumber safety-factor source cell is anomalous/date-corrupted in the workbook. Preserve this anomaly rather than silently rewriting the source.

### Direct-seeding profiles

Confirmed workbook examples include:

- Arugula/Rucula: 115 g per 30 m; Six Row Seeder is the primary configuration. Jang 5 is an alternative configuration.
- Carrots: 14 g per 30 m.
- Peas: 400 g per 30 m; manual/by hand.
- Bush Beans: 190 g per 30 m.
- Potatoes: planted by hand; seeder/calibration is `N/A`, not missing.

Across seven non-conflicting direct-sow profiles in the current plan, 1,019.5 g of seed demand can already be derived from verified workbook rules. Mizuna remains unresolved because `Ds Chart` and `Crop Chart` disagree. Corn, Shallots, Daikon, and Potatoes require crop-specific units/logic rather than being forced into seed-count semantics.

## Why the existing inventory model cannot safely absorb DS demand

`orchard_seed_lots.quantity_seeds` and `orchard_seed_inventory_movements.quantity_delta` are integer seed-count concepts. Direct seeding is commonly planned in grams, while potatoes require seed-tuber logic.

Do not store grams or tubers in `quantity_seeds`. Doing so would create numerically valid but semantically false inventory.

## Target data contract

A safe implementation should introduce a first-class direct-seeding/propagation profile, or equivalent structured child model, with at least:

- `crop_library_id`
- optional `cultivar_library_id`
- `cycle_type`
- `seeding_method`
- `seeder_name`
- `rows_per_bed`
- `row_spacing_cm`
- `plant_spacing_cm` where meaningful
- `calibration_setting`
- `demand_value`
- `demand_unit` (`seed_count`, `g`, `kg`, `tuber_count`, etc.)
- `reference_bed_m` (normally 30 m for the workbook recipes)
- source workbook/sheet/row fields
- provenance type
- verification timestamp
- notes/conflict state

Inventory must likewise become unit-aware before direct-sow stock can be reconciled with demand. Nursery seed-count behavior should remain backward compatible.

No arithmetic should combine unlike units into a single total.

## Task-template implication

The earlier 68-vs-71 task discrepancy is not a counting error. `Crop Associated Task` combines implantation-time instructions and later dated work. The recommended canonical representation is:

- 32 implantation milestones for the reconciled Heirloom subset;
- contextual checklist items attached to sow/transplant milestones;
- 71 later dated tasks;
- 1 conditional/undated Storage Potato task (`Haulm topping`).

Do not instantiate workbook task rows directly as executed production tasks.

## Proposed rollout gates

1. **Planning lineage repair** — backfill the 16 missing direct-sow `planned_bed_m` values from `Codified Game Plan`, preserving source snapshots. Requires explicit production-data authorization.
2. **Unit-aware DS profile model** — add structured direct-seeding recipe fields/table. Requires explicit schema authorization.
3. **Unit-aware seed inventory** — preserve existing seed-count nursery flows and support grams/kg/tubers for DS. Requires explicit schema authorization.
4. **Coverage UI** — split coverage by compatible unit and clearly label nursery/transplant vs direct-sow demand.
5. **Germination UX** — distinguish planning reference, seed-lot/catalog germination, and observed batch germination. Never silently substitute 100% as if it were evidence.
6. **Task templates** — add Orchard-specific crop task templates before instantiating operational tasks.
7. **QA** — validate Supabase lineage, current Game Plan scoping, calculations, responsive UI, and production deployment before merge.

## Current release decision

**HOLD for production data/schema changes.**

The evidence is sufficient to design the fix, but production writes and schema migrations should not proceed until explicitly authorized. The current branch may safely carry documentation and implementation work that does not mutate production data.