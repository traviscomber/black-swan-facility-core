# Phase 1 RLS hardening plan

Verified against production on 2026-07-26. This document is a migration plan only. No database policy, privilege, role, or production record has been changed.

## Scope

The first phase covers tables with personal, communication, reservation, payment, invoice, or budget information:

- `guests`
- `reservations`
- `invoices`
- `invoice_payments`
- `payments`
- `leads`
- `messages`
- `budgets`

## Production context

| Table | Rows | Current broad access | Sensitive content | Confirmed dependencies |
|---|---:|---|---|---|
| `guests` | 4 | authenticated ALL | name, email, phone, address, notes | referenced by `reservations.guest_id` |
| `reservations` | 7 | authenticated ALL | guest contact data, dates, requests, amounts | `guests`, `rooms`, `beds`, `locations`; nine operational triggers |
| `invoices` | 0 | authenticated ALL | customer identity, line items, taxes, totals | `reservations`, `employees` |
| `invoice_payments` | 0 | authenticated ALL | amount, method, transaction, operator | `invoices`, `employees` |
| `payments` | 0 | authenticated ALL | amount, method, status, transaction | `reservations` |
| `leads` | 0 | public ALL | phone, name, requested dates, preferences, notes | optional conversion to `reservations` |
| `messages` | 0 | public ALL | phone, message text, intent, sentiment | `leads`, `reservations` |
| `budgets` | 25 | public ALL | budgeted amount, actual amount, variance, notes | `budget_divisions`, `budget_categories` |

## Required access model before migration

The application currently distinguishes these identities through `app_metadata.procurement_role` and route middleware:

- `admin`
- `approver`
- authenticated account without an internal role
- anonymous client

Hospitality-specific roles do not currently exist. Phase 1 therefore must avoid pretending that procurement roles are hospitality roles. The safest initial boundary is:

1. Remove anonymous direct table access from personal and financial tables.
2. Keep authenticated read/write temporarily where the existing application requires it.
3. Remove destructive privileges that are not required by normal application flows, especially `TRUNCATE` and direct `REFERENCES`/`TRIGGER` grants.
4. Introduce narrower hospitality roles only after the actual operators and workflows are confirmed.

## Proposed migration sequence

### Migration 1A — remove anonymous exposure

Candidate tables:

- `leads`
- `messages`
- `budgets`

Actions:

- revoke table privileges from `anon`;
- drop policies assigned to `public` that use unconditional `true`;
- add authenticated policies matching the current application behavior;
- retain service-role access for server integrations;
- verify that no public form or webhook writes directly with the anon key before applying.

This migration must not be applied until all lead/message ingestion routes and external integrations are identified.

### Migration 1B — protect personal hospitality data

Candidate tables:

- `guests`
- `reservations`

Actions:

- preserve authenticated access required by the current booking interface;
- replace single `ALL` policies with separate `SELECT`, `INSERT`, `UPDATE`, and narrowly justified `DELETE` policies;
- do not alter the nine reservation triggers;
- test reservation creation, room/bed conflict validation, editing, cancellation, and checkout cleaning creation.

### Migration 1C — protect financial records

Candidate tables:

- `invoices`
- `invoice_payments`
- `payments`
- `budgets`

Actions:

- separate read from write;
- restrict invoice/payment writes to an approved internal role or server-side operation;
- prohibit anonymous access;
- decide whether deletion should be disabled in favor of void/cancel states;
- keep employee foreign-key behavior unchanged.

## Test matrix required for every migration

| Identity | SELECT | INSERT | UPDATE | DELETE | Expected result |
|---|---|---|---|---|---|
| anonymous | test | test | test | test | no access to personal or financial tables |
| authenticated without role | test | test | test | test | only explicitly required operational actions |
| approver | test | test | test | test | no implied hospitality access unless intentionally granted |
| admin | test | test | test | test | approved administrative access only |
| service role | test | test | test | test | server integrations continue working |

## Functional regression checklist

- booking calendar loads existing seven reservations;
- guest selection and reservation creation continue working;
- reservation overlap and integrity triggers still execute;
- checkout can still create housekeeping work where configured;
- invoice and payment screens handle their current empty state;
- lead and message ingestion is tested through its real integration path;
- budget screens load all 25 records and preserve division/category relationships;
- no client receives private guest or communication data without authentication.

## Blockers before applying a migration

- Identify every code path and external integration that writes to `leads` and `messages`.
- Confirm which staff roles require hospitality and financial write access.
- Decide whether invoice/payment deletion is valid or should be replaced by reversal/void workflows.
- Test the migration in an isolated Supabase branch or equivalent staging database.
- Obtain explicit approval to change production RLS and grants.
