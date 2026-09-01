# Orchard / Heirloom parity field study — 2026-09-01

This document captures the authenticated Heirloom workflow observed for the Black Swan / Fundo Corcovado season and translates it into Black Swan Facility Core product requirements.

## Source-of-truth rule

Heirloom observations in this document are **reference product behavior**, not current Black Swan Core operational truth. Current operational facts must continue to come from Supabase. The reference dataset must never silently overwrite Core records.

## Farm settings observed

- Farm: `BS`
- Country / currency: Chile / CLP
- Address: Black Swan Farm, Fundo Corcovado, Valdivia, Región de Los Ríos, Chile
- Coordinates: `-39.699435, -73.205363`
- Season: Aug 2026 – Jul 2027
- Measurement: metric
- Temperature: Celsius
- Planting quantity unit: **bed meter**
- Standard bed: **76 cm × 30 m**
- Standard path: **46 cm**
- Last hard frost: 29 Aug 2026
- Last light frost: 24 Sep 2026

## Physical farm model observed

- Farm area: `Farm Area 1`
- Field block: `Orchard BlackSwan Campo`
- Beds: **18**
- Bed length: **30 m** each
- Instantaneous physical bed-meter capacity: **540 bed m**

The field block was assigned to the farm area and visible on the Crop Map.

## Eight-step product journey

1. Map Your Farm
2. Choose a favorite crop
3. Create Your Game Plan
4. Organize Your Crop Map
5. Project Your Financial Forecasts
6. Review Your Data Charts
7. Check Your Seed Inventory
8. Manage Your Workload

Observed onboarding behavior is event-based. Visiting a module alone does not necessarily mark a step complete. Example: assigning one real planting to a bed advanced Crop Map from 6/8 to 7/8. Creating an ad-hoc task alone did not advance 7/8 to 8/8, so the final workload completion trigger remains unverified.

## Crop Map behavior observed

The Crop Map exposes a right-side `Assign plantings (x / N)` panel.

- Plantings are grouped by crop.
- Each crop expands into generations.
- Each generation exposes the planting window and required **bed meters**.
- A planting is dragged one at a time onto a physical bed.
- Partial bed occupation is valid: Arugula Gen #1 required 9 bed m and was successfully assigned to bed 17 of a 30 m bed.
- The observed queue changed from `0/32` to `1/32` after the assignment.

### Reference queue captured

The authenticated reference queue contained **32 plantings** requesting **744 bed m** in total. Peak concurrent demand was **678 bed m on 2026-11-26**, exceeding the 540 bed-m instantaneous physical capacity by **138 bed m**.

This is an important product behavior: the planner must be able to surface spatial/temporal over-capacity instead of treating a whole bed as occupied whenever any partial bed-meter amount is used.

## Workload behavior observed

Tasks exposes three operating views:

- List
- Week Board
- My Workload Graph

An ad-hoc task includes:

- task name
- estimated minutes
- assignee
- date
- notes
- recurrence

A real test task `Review Crop Map capacity` was created for 01 Sep 2026 with 30 minutes and no assignee. Task creation was successful but did not by itself close the final onboarding step.

## AI Assistant behavior observed

Heirloom exposes an in-app AI Assistant. Its own scope statement says it answers questions about using the application and currently does not answer general farming questions.

Black Swan Core should preserve a stronger version of this model:

- factual answers grounded only in authorized Core data;
- product-use guidance can use this parity study as reference behavior;
- reference values must be labelled as reference and must never override current Supabase rows;
- write operations remain proposal + explicit approval;
- agronomic/safety-sensitive treatment advice remains out of scope.

## Current Core parity gaps identified

### 1. The journey is fragmented

Core already has Game Plan, Crop Map, forecasts, charts, seed/nursery, workload and Orchard AI, but the user does not currently get one coherent eight-step onboarding journey with live completion state.

### 2. Physical data is not synchronized

At the time of this study, production Core had no active physical Orchard beds while Heirloom had 18 × 30 m. The current 2026/27 Core Game Plan also has more successions than the 32-item Heirloom assignment queue. This must be reconciled explicitly; neither side should be silently treated as the other's authoritative dataset.

### 3. Allocation semantics are whole-bed, not bed-meter capacity

`orchard_bed_allocations` currently stores bed, dates, area and plants, but no explicit bed-meter quantity. Its overlap exclusion constraint blocks any two date-overlapping allocations on the same bed, even when their combined bed-meter requirement would fit inside that bed.

The auto-placement RPC also treats any overlapping allocation as making the entire bed unavailable.

Exact parity therefore requires an explicit planned/allocated bed-meter quantity and a capacity guard that allows concurrent partial allocations only while the total bed meters used on each date remain within the physical bed length. No explicit longitudinal offset was observed in Heirloom, so offset coordinates are intentionally not part of this parity contract.

### 4. Crop Map UX must become crop-led and bed-meter-capacity-aware

Required target behavior:

- grouped crop drawer;
- expandable generations;
- planting date range + bed-meter requirement;
- one-at-a-time drag onto a bed;
- field block rendered as physical bed sequence;
- visible bed-meter occupancy through time, without inventing an unobserved within-bed coordinate;
- live `assigned / total` count;
- capacity shortfall warning before bulk placement.

### 5. Workload views need Heirloom-simple presentation

Core already contains richer accountable-work logic. The target is not to remove it, but to present the default operator experience as List / Week Board / Workload Graph while preserving auditability, task ownership and AI-proposal controls underneath.

## Implementation sequence

1. Codify this field study as reference knowledge and tests.
2. Add an eight-step Getting Started route driven by live Core data.
3. Expose parity knowledge to Orchard AI as product-use reference only.
4. Build bed-meter capacity schema + conflict model in a migration; do not apply to production until explicitly authorized.
5. Rebuild Crop Map assignment UX on top of bed-meter capacity semantics.
6. Reframe workload default views into List / Week Board / Workload Graph.
7. Reconcile the canonical physical block and Heirloom/Core planting counts before any production allocation import.
