# Procurement integration foundation

## Objective

Extend the existing procurement module without replacing or altering its current purchase-order workflow.

## Existing system preserved

The following remain unchanged:

- `/procurement`
- `/procurement/analytics`
- `procurement_items`
- `suppliers`
- add, edit, delete and CSV export flows
- current status and priority values
- existing navigation and analytics

## Additive workflow

1. A business unit creates a procurement request.
2. The request is reviewed and approved.
3. Approved requests can later receive supplier quotations.
4. A selected quotation can later generate an existing `procurement_items` purchase order.
5. No purchase order is created automatically in this foundation phase.

## Foundation scope

- New `procurement_requests` table.
- New `/procurement/requests` route.
- Request intake with business justification, category, quantity, budget estimate, priority, required date, commune and delivery location.
- Independent lifecycle: `draft`, `submitted`, `under_review`, `approved`, `rejected`, `converted`.
- No changes to existing procurement tables.

## Chile and Los Rios data requirements

The request model includes:

- `region`, defaulting to `Los Ríos`.
- `commune`, defaulting to `Valdivia`.
- CLP estimated budget.
- delivery location and required date.

Future phases should add supplier RUT, tax-document validation, regional coverage, quotations, scoring, approvals, audit logs and controlled conversion into purchase orders.

## Safety constraints

- Schema migration is additive only.
- Existing records are not updated or deleted.
- The agent may recommend actions but cannot approve or create binding orders without a human action.
- Database migration must be applied before the new route is used.