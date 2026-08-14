# Black Swan Operations Worker

Cloudflare control plane for the non-payment Black Swan OS workspaces requested by Ed.

## Scope

This Worker exposes canonical, authenticated workspace read models and controlled RPC actions for:

- People Graph: Members, Member presence, Guests beneath Members.
- Member-driven Events.
- Event-derived Education.
- Orchard & Kitchen costs and responsibilities.
- External event service providers and engagements.
- Foundation Sales & Marketing publication workflow.
- Santi employee/inventory canonical import staging, review and apply.
- Intercompany draft-rule configuration.
- Audit Center.
- Canonical role-aware Black Swan OS navigation.

Payment and bank-provider activation are intentionally outside this Worker's scope and can be connected later through the existing banking provider layer.

## Security model

The frontend sends its existing Supabase access token to the Worker. The Worker validates the session with Supabase Auth and calls dedicated Postgres RPC boundaries with that same user token.

No Supabase service-role key is used by this Worker.

Authorization remains server-side in canonical functions such as `current_app_role()`, `can_access_legal_entity()`, `member_auth_links`, and workspace-specific guards. UI menus must not infer access from JWT `app_metadata`.

## Cloudflare configuration

Configure outside GitHub:

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `API_VERSION=v1`
- `ENVIRONMENT=development|preview|production`

Do not commit provider credentials, employee source files, intercompany agreements, or private HR/accounting source documents.

## Frontend configuration

Set:

- `NEXT_PUBLIC_BLACK_SWAN_OPERATIONS_API_URL=<deployed Worker origin>`

The canonical OS entry route is `/os`. It loads its modules from `GET /v1/os/navigation`, so unauthorized modules are not rendered by the application.

## Main API

Read-only:

- `GET /v1/health`
- `GET /v1/os/navigation`
- `GET /v1/os/workspaces/:workspace`
- `GET /v1/os/references/:workspace`

Controlled actions:

- `POST /v1/os/actions/member-presence`
- `POST /v1/os/actions/guest-invitation`
- `POST /v1/os/actions/event`
- `POST /v1/os/actions/education-material`
- `POST /v1/os/actions/education-review`
- `POST /v1/os/actions/orchard-kitchen-cost`
- `POST /v1/os/actions/orchard-kitchen-responsibility`
- `POST /v1/os/actions/event-provider`
- `POST /v1/os/actions/event-provider-engagement`
- `POST /v1/os/actions/publication-draft`
- `POST /v1/os/actions/publication-review`
- `POST /v1/os/actions/import-stage`
- `POST /v1/os/actions/import-resolve`
- `POST /v1/os/actions/import-review`
- `POST /v1/os/actions/import-apply`
- `POST /v1/os/actions/intercompany-rule`

## External inputs still required

The code is deliberately unable to invent these inputs:

1. Santi's canonical employee master and inventory master files.
2. Approved intercompany agreement/commercial terms, including Infra -> Corporacion lease terms and tax treatment.
3. Payment/bank credentials, deferred by product decision.

## Promotion sequence

Before production database migration:

1. Apply the complete migration chain to a non-production Supabase branch/database.
2. Run all regression migrations successfully.
3. Load controlled sample/canonical source data.
4. Verify Admin, Member, Staff and restricted-access behavior.
5. Deploy/configure the Operations Worker.
6. Configure `NEXT_PUBLIC_BLACK_SWAN_OPERATIONS_API_URL` in the frontend environment.
7. Promote migrations to production only after the non-production gate passes.
