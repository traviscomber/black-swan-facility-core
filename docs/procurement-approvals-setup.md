# Procurement approvals setup

## Authorization model

Approval authority is stored in Supabase Auth `app_metadata`, not `user_metadata`.

Supported values:

```json
{
  "procurement_role": "approver",
  "procurement_approval_limit_clp": 5000000
}
```

Administrators use:

```json
{
  "procurement_role": "admin"
}
```

`admin` has no operational CLP limit in the approval function. Ordinary authenticated users have no approval authority.

## Assigning roles

Assign `app_metadata` only through a trusted administrative channel:

- Supabase Dashboard user administration; or
- a server-only process using the Supabase Admin API and the service-role key.

Never expose the service-role key in browser code or a `NEXT_PUBLIC_` environment variable.

After changing `app_metadata`, the user must refresh their session or sign out and sign in again so the JWT contains the new claims.

## Approval rules

- Only requests in `submitted` or `under_review` can be decided.
- Rejections require a note in the user interface.
- Approvals are blocked when the estimated CLP amount exceeds the approver limit.
- Decisions execute through `decide_procurement_request`; direct writes to the audit table are revoked.
- Every decision creates an immutable row in `procurement_approval_events`.
- Requesters cannot update submitted, approved, rejected or converted requests directly.

## Deployment order

1. Apply `20260720_create_procurement_requests.sql`.
2. Apply `20260720_add_procurement_approvals.sql`.
3. Assign at least one approver.
4. Refresh the approver session.
5. Validate `/procurement/requests` and `/procurement/approvals` in a Vercel preview.
6. Keep the pull request in draft until the correct Supabase project is confirmed.

## Important project check

The connected Supabase project named `blackswan` did not contain the existing `procurement_items` or `suppliers` tables during the audit. Do not apply these migrations there until the `NEXT_PUBLIC_SUPABASE_URL` used by the Vercel project is matched to the correct project reference.