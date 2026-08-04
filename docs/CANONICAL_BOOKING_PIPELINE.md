# Canonical Booking Pipeline

This document is the source of truth for the booking, arrival, stay, departure, and room-readiness lifecycle in Black Swan Facility Core.

## Core rule

Every operational action originates from a reservation, is executed from `/bookings`, and remains linked to the same stay through `reservation_id` whenever the data model supports it.

Room commercial availability, guest arrival, and physical room condition are separate state machines and must never be collapsed into one field.

## State domains

### Reservation lifecycle: `reservations.status`

- `pending`: draft or unconfirmed booking.
- `confirmed`: accepted booking with inventory reserved.
- `checked_in`: active stay.
- `checked_out`: completed stay.
- `cancelled`: cancelled booking.
- `no_show`: guest did not arrive.
- `void`: administratively voided record.

Legacy aliases `checked-in`, `checked-out`, `canceled`, and `voided` remain accepted at the application boundary only.

### Arrival lifecycle: `reservations.arrival_status`

- `not_arrived`: no arrival action recorded.
- `expected`: arrival preparation is active.
- `arrived`: guest is physically present.
- `waiting_for_room`: guest arrived before the room was ready.
- `ready_for_checkin`: all arrival prerequisites are satisfied.
- `checked_in`: check-in completed.
- `departed`: check-out completed.
- `no_show`: arrival closed as no-show.

### Physical room lifecycle: `rooms.operational_status`

- `ready`: available for guest arrival.
- `dirty`: requires cleaning.
- `cleaning`: cleaning in progress.
- `clean_pending_inspection`: cleaning completed; inspection pending.
- `inspected`: inspection completed; may be checked in.
- `occupied`: guest is currently staying.
- `out_of_service`: temporarily unavailable for operational reasons.
- `out_of_inventory`: removed from sellable inventory.

## Canonical pipeline

### 1. Booking creation

The system records guest, property, room or bed, dates, occupancy, source, rate, payment state, and special requirements.

Required validations:

- date integrity;
- room or bed capacity;
- overlapping reservations;
- room blocks;
- active inventory;
- authorization.

### 2. Confirmation

Transition:

`pending -> confirmed`

On confirmation, the reservation becomes the operational parent for all related work.

The system should schedule or expose:

- room preparation;
- pre-arrival cleaning when required;
- room inspection;
- amenities;
- transport;
- activities;
- Hospitality requests;
- payment reminders;
- pre-arrival communications.

### 3. Pre-arrival preparation

The normal room sequence is:

`dirty -> cleaning -> clean_pending_inspection -> inspected -> ready`

This sequence must complete before the planned arrival time. A guest arrival must not be the trigger for normal cleaning.

The calendar must highlight any arrival whose room remains `dirty`, `cleaning`, `clean_pending_inspection`, `out_of_service`, or `out_of_inventory` near the target check-in time.

### 4. Arrival control

Normal path:

`confirmed/not_arrived -> confirmed/expected -> confirmed/ready_for_checkin`

Exception path:

`confirmed/arrived -> confirmed/waiting_for_room`

The waiting queue exists only for early arrivals or failed preparation. It is not the default workflow.

### 5. Check-in

Check-in requires:

- reservation in an active confirmed state;
- room in `ready` or `inspected`;
- arrival state `ready_for_checkin`;
- identity and guest details reviewed;
- payment or guarantee reviewed;
- occupancy confirmed;
- access or keys prepared;
- special alerts acknowledged.

Transition:

`confirmed/ready_for_checkin -> checked_in/checked_in`

Room transition:

`ready|inspected -> occupied`

### 6. Active stay

All stay operations remain attached to the reservation:

- Hospitality;
- Housekeeping;
- restaurant, bar, minibar, laundry, transport, and activities;
- maintenance and incidents;
- guest and internal messages;
- notes and preferences;
- payments and charges.

Operational tasks require status, responsible person, priority, target time, SLA, and completion evidence when applicable.

### 7. Guest requests

Canonical task sequence:

`pending -> assigned -> in_progress -> completed`

A request may create a linked task, incident, maintenance action, charge, or guest communication without losing the original request record.

### 8. In-stay Housekeeping

Supported service patterns include:

- daily cleaning;
- scheduled cleaning;
- linen replacement;
- turndown;
- replenishment;
- do-not-disturb;
- declined cleaning;
- inspection.

### 9. Guest folio

The canonical balance is:

`lodging + services + taxes - discounts - payments = outstanding balance`

`reservations.total_amount` must not become the sole source of truth once the folio lifecycle is implemented.

### 10. Departure preparation

Before check-out, the system reviews:

- open balance;
- unposted consumption;
- open guest requests;
- damage or incidents;
- departure transport;
- access closure;
- final account.

### 11. Check-out

Transition:

`checked_in -> checked_out`

Arrival transition:

`checked_in -> departed`

Room transition:

`occupied -> dirty`

Automatic effects:

- create one idempotent turnover task;
- close or escalate open stay operations;
- calculate final balance;
- close physical access;
- register an immutable history event;
- prepare post-stay communication.

### 12. Post-check-out room recovery

`dirty -> cleaning -> clean_pending_inspection -> inspected -> ready`

The room returns to operational inventory only after inspection.

### 13. Post-stay

- final statement;
- survey or thank-you message;
- reusable guest preferences;
- unresolved incident follow-up;
- financial reconciliation;
- operational closure.

## Transition invariants

- A closed reservation cannot silently return to an active state.
- Check-in cannot bypass arrival readiness.
- Check-out requires an active checked-in stay.
- Room readiness is independent from commercial room status.
- Normal cleaning must occur before arrival.
- The waiting queue is an exception.
- Every automation must be idempotent.
- Every material transition must be attributable and auditable.

## Implementation rule

New UI, APIs, RPCs, triggers, background jobs, and integrations must use this document and `lib/booking-pipeline.ts` as the canonical contract. Divergent status strings or transition rules are defects.
