# Black Swan OS Implementation Plan

Status: active
Baseline: `bc0958ce450cbf39057c10bf40bff3b9ee2d4ec8`
Primary application: Blackswan Facility Core
Production data platform: Supabase project `ruslvodmzqctkaafnpfx`

## Architecture decision

Blackswan Facility Core is the existing operational foundation of Black Swan OS. We will extend it rather than create a parallel application, database, or authorization system.

Target topology:

```text
Black Swan
├── blackswn.org                 Public story, projects, membership
└── os.blackswn.org              Black Swan OS
    └── Facility Core            Existing application and operational modules
```

The existing GitHub repository, Vercel project, Supabase project, route structure, and production data remain the source of truth unless a later migration is explicitly approved.

## Security foundation discovered

The database already contains a meaningful authorization model:

- `user_access_profiles`: canonical application role and active/disabled state.
- `user_operational_scopes`: department/location scoping.
- `booking_action_permissions`: role-to-action permissions, including critical/reason/approval metadata.
- `user_access_audit_log`: access-change audit trail.
- `current_app_role()`: resolves the effective application role.
- `can_app_action(action_key)`: resolves action permission.
- `can_access_operational_scope(department, location_id)`: resolves operational scope.
- `get_current_user_effective_access()`: returns role, actions, departments and locations.

This model must be extended, not replaced.

Supabase security advisors currently flag many authenticated `SECURITY DEFINER` RPCs. Inspection confirms that important examples such as finance approval, procurement decisions, payment recording, and reservation creation already enforce authentication, role/action checks, and/or operational scope checks inside the function body. Therefore the warnings are an audit queue, not proof that every flagged RPC is vulnerable.

Remaining security findings include:

1. Audit every externally executable `SECURITY DEFINER` RPC and classify it as `authenticated-safe`, `role-restricted`, `admin-only`, `internal-only`, or `refactor`.
2. Remove authenticated execution grants where an RPC should be internal-only.
3. Keep explicit authorization checks inside privileged RPCs even when UI access is restricted.
4. Review `document_sequences`, which has RLS enabled without a policy.
5. Review relocation of `btree_gist` out of `public` if migration risk is acceptable.
6. Enable leaked-password protection in Supabase Auth after compatibility review.
7. Eliminate legacy authorization drift between `user_access_profiles.role_key` and direct JWT `procurement_role` checks.

## Target identity model

Authentication answers who the user is. Authorization must independently answer what they can do and where they can do it.

```text
User
├── app role
├── OS entitlement
├── Facility entitlement
├── action permissions
└── operational scopes
    ├── department
    └── location
```

Initial role families:

- `admin`: full platform administration subject to audited controls.
- `operator`: operational Facility Core access according to action and location scope.
- `member`: Black Swan club/project access without implicit Facility Core operational access.
- additional specialist roles should be introduced only when required by real workflows.

A signed-in user must never gain operational access merely because they are authenticated or a Black Swan member.

## Target OS information architecture

```text
BLACK SWAN OS

TODAY

OPERATIONS
- Dashboard
- Calendar
- Hospitality
- Maintenance
- Inventory
- Purchasing
- People

LAND
- Properties
- Infrastructure
- Energy
- GIS

PRODUCTION
- Livestock
- Vineyard
- Orchard

INTELLIGENCE
- AI Ops
- Reports
- Knowledge

BLACK SWAN
- Projects
- Members
- Events
- Governance

SYSTEM
- Administration
- Permissions
- Audit
```

Existing routes and modules should be reused. This is an information-architecture and entitlement evolution, not a rewrite.

## Execution phases

### Phase 0 — Production baseline

- Keep `main` as production source of truth.
- Start OS work from the latest verified production commit.
- Record GitHub/Vercel/Supabase alignment before each implementation batch.
- Avoid stale preview branches.

Exit criterion: every implementation batch has a known production parent and rollback point.

### Phase 1 — Authorization hardening

- Inventory all public RPC grants.
- Inspect all `SECURITY DEFINER` bodies.
- Classify RPC exposure.
- Identify direct JWT-role checks and migrate toward the canonical access model.
- Verify RLS on access, finance, hospitality, inventory, procurement and people data.
- Add regression tests for unauthorized roles and out-of-scope locations.

Exit criterion: a member-level account cannot execute Facility Core mutations unless explicitly entitled.

### Phase 2 — Identity and entitlements

- Extend the existing access model with OS/Facility/module entitlements.
- Preserve `user_access_profiles`, operational scopes and action permissions.
- Add explicit member access without inheriting operator capabilities.
- Expose one canonical effective-access response to the frontend.
- Audit every access change.

Exit criterion: navigation and server/database authorization resolve from the same canonical access model.

### Phase 3 — OS shell

- Reorganize navigation into Operations, Land, Production, Intelligence, Black Swan and System.
- Keep current routes unless a route change provides measurable value.
- Add Black Swan OS identity to shell, metadata and authentication surfaces.
- Preserve `/en`, `/es`, `/de` locale routing.

Exit criterion: existing Facility Core workflows remain functional under the new shell.

### Phase 4 — OS domain

- Attach `os.blackswn.org` to the existing Vercel project.
- Update Supabase redirect URLs and authentication callbacks.
- Verify cookies, password reset, email links, logout and deep links.
- Keep the current production domain as a temporary fallback during migration.

Exit criterion: all supported auth flows work from `os.blackswn.org`.

### Phase 5 — Project registry and launcher

- Create a canonical Black Swan project registry.
- Start with Black Swan OS / Facility Core as the operational project.
- Add a global Projects launcher to the OS shell.
- Make project visibility entitlement-aware.

Exit criterion: users can move between Black Swan surfaces without duplicating project definitions.

### Phase 6 — blackswn.org integration

- Surface the project registry on the public Black Swan site.
- Provide `Open OS` for entitled authenticated users and `Sign in to open` otherwise.
- Keep authentication architecture simple for V1; do not introduce cross-domain SSO complexity until required.

Exit criterion: public project discovery and authenticated OS entry form one coherent flow.

### Phase 7 — Club modules

Introduce non-operational Black Swan modules only after Facility and member permissions are separated:

- Projects
- Members
- Events
- Knowledge
- Governance

Exit criterion: member workflows can run without exposing private operational Facility Core data.

### Phase 8 — Intelligence layer

Build Black Swan Intelligence over authorized canonical data:

- operations
- bookings
- assets
- people
- incidents
- projects
- governance
- finance
- facility health

Consequential AI actions must follow:

```text
AI recommendation
→ authorization check
→ human approval where consequential
→ deterministic write
→ audit log
```

No general-purpose agent receives unrestricted service-role mutation authority.

## First implementation batch

The first code/database batch after this document is approved by tests will focus on authorization consistency, not visual redesign:

1. Produce the full RPC exposure matrix from production metadata.
2. Trace all frontend/backend uses of `procurement_role`, `current_app_role`, `can_app_action`, and `get_current_user_effective_access`.
3. Select a small set of high-risk mutation RPCs for grant/authorization hardening.
4. Add tests proving operator/member/admin boundaries.
5. Resolve the hospitality priority constraint runtime error observed in production if it is still reproducible.
6. Re-run Supabase security advisors and Vercel runtime checks.

## Release gates

No phase is complete until:

- build passes;
- authorization regression checks pass;
- affected critical workflows are smoke-tested;
- Supabase advisor deltas are reviewed;
- Vercel runtime health is checked;
- production deployment is verified before the next phase begins.
