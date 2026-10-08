# Black Swan Facility Core — N3uralia Data Intelligence Adoption v1

Black Swan adopts the N3uralia Data Intelligence Contract v1 for hospitality, facility and operational AI.

## Canonical ownership

Reservations, rooms/beds, guests, approvals, operations, purchases, cattle/agricultural records and other business state remain owned by their current canonical tables/workflows.

AI orchestration, suggestions, inferred gaps and summaries are derived state only.

## First enforcement targets

1. `/api/ai/orchestrate`.
2. Concierge recommendations.
3. Booking/revenue suggestions before any mutation.
4. Operations planner recommendations.
5. Any automation that could trigger a purchase, notification or canonical booking change.

## Readiness requirements

Before consequential output:
- exact reservation/room/guest/entity identity;
- current booking/occupancy evidence;
- authorization and center-of-cost scope;
- source freshness;
- contradiction detection;
- missingness preserved;
- suggestion vs executed action clearly separated;
- human approval preserved where required.

Observe mode must not change booking or facility state. Enforcement should begin only on mutation-capable actions after preview QA.
