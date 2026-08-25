# BlackSwan Access & Regression Hardening

## Goal

Make BlackSwan authorization coherent across navigation, routes, RPCs, and RLS while preserving existing functionality and avoiding unrelated domain rewrites.

The redesign must support the existing personalized perspectives for Santiago, Raimundo, and Tomas without hard-coding authorization by person name. The same six-area BlackSwan OS remains the shared information architecture; each user sees and can operate only the capabilities granted by the canonical access model.

## Canonical Authorization Source

`public.user_access_profiles` and `public.current_app_role()` remain the canonical identity/role authority.

The application must not introduce a second competing role source. JWT `app_metadata`, employee title strings, display names, or hard-coded person names are not new authorization sources.

Historical domain helpers that still use legacy employee/email/title checks may remain untouched when outside this project's scope, but they must be documented as authorization debt and must not be copied into new authorization code.

## Capability Model

Introduce or formalize a canonical capability matrix with four operation classes:

- `view`: may read and navigate to a domain/workspace.
- `operate`: may create or modify normal operational records.
- `approve`: may perform approval/review decisions where the domain supports them.
- `admin`: may perform privileged configuration or broad administrative actions.

The exact capability keys may remain domain-specific, but every major route/module must be able to answer the same questions consistently: can this user view it, operate it, approve it, or administer it?

The matrix should be derived from existing canonical role/profile data and existing legal-entity/department permissions rather than from the identity of Santiago, Raimundo, or Tomas.

## One Enforcement Model, Multiple Layers

Authorization remains defense in depth:

1. Navigation and hubs use the canonical capabilities to decide what to show.
2. Route/server guards use the same capability semantics for protected routes.
3. API/RPC handlers enforce the capability again before returning or mutating sensitive data.
4. RLS remains the final data boundary for tables exposed through Supabase.

Hiding a menu item is never considered authorization.

A direct URL must not grant access that the navigation would deny unless the product explicitly supports a hidden but authorized deep-link workflow.

## Personalized Perspectives

Santiago, Raimundo, and Tomas continue to use one BlackSwan OS.

Personalization may alter:

- visible areas/modules according to capabilities;
- ordering and priority;
- badges and pending counts;
- Today composition;
- default landing surfaces.

Personalization must not alter the meaning of permissions. No code path may say "if user is Santiago/Raimundo/Tomas" to grant security-sensitive access.

Tests should use representative fixtures/profiles corresponding to those three known perspectives, while asserting capabilities rather than names.

## People Graph Privacy

### Member directory access

A normal active Member of BS Corporacion may view the basic Member directory where product policy allows network visibility.

The basic directory may include only fields intentionally considered directory-safe, such as:

- member id/public identifier;
- name;
- active/inactive network status where appropriate;
- non-sensitive public/network profile fields explicitly approved for directory use.

### Sensitive people data

A normal Member must not receive private presence or guest information belonging to other Members.

Sensitive fields include, at minimum:

- on-ground/live presence of another Member when not explicitly public;
- another Member's guest invitations;
- guest names and guest identifiers;
- invitation validity windows;
- guest check-in/entry state;
- reservation/event linkage that reveals private hosting activity;
- operational notes.

The full operational People Graph remains available only to users with appropriate `operate` or `admin` capability for the relevant People/Corporacion domain.

A Member may still receive their own sensitive presence/guest data where required for self-service workflows.

### Server-side shaping

Privacy must be enforced when the read model is built, not only by hiding columns in React.

Preferred implementation: return role/capability-shaped data from the People workspace/RPC so unauthorized fields never reach the browser.

## OS Navigation and Route Alignment

The six-area taxonomy remains:

1. Today
2. Operations
3. People
4. Places & Assets
5. Finance
6. Network

`lib/os/navigation.ts` should become a consumer of canonical capabilities rather than the place where security semantics are invented.

A module should not require a write capability merely to appear when a legitimate read-only experience exists. For example, `booking.modify` should not be treated as equivalent to "may view Bookings" if the backend supports read-only booking access.

Each route/module should have an explicit view capability and optional operate/approve/admin capabilities.

Server-authorized OS modules remain server-authorized, but the response should map into the same capability vocabulary used by the rest of the shell.

## Route Guards

The existing proxy already enforces authentication and has special handling for Admin and Procurement. This project should extend route guard semantics only where an explicit domain capability exists and doing so will not duplicate or conflict with RLS/RPC authority.

Goals:

- direct navigation to a forbidden area returns a deterministic redirect or 403 behavior;
- route guards fail closed when the canonical access snapshot cannot be resolved;
- route guards do not fall back to JWT `app_metadata`;
- localized routes preserve equivalent enforcement;
- API routes continue to return proper 401/403 responses rather than UI redirects.

The proxy should consume a canonical route-access snapshot capable of representing more than only `is_admin` and procurement approval.

## Map / GIS Security Audit

`/map` currently reads `infrastructure_plans`, `infrastructure_connections`, and `gis_overlays` directly from Supabase in the browser.

Because direct browser reads depend on RLS, this project must explicitly audit those tables before declaring Map safe.

Required checks:

- RLS enabled on every sensitive Map/GIS table;
- authenticated read policies require the intended Places/Assets view capability or legal-entity access;
- write/update policies are stricter than read where appropriate;
- GIS overlay metadata and file URLs do not expose unauthorized storage objects;
- users without Map capability cannot retrieve the same records through direct Supabase REST calls;
- service-role operations remain separate from end-user policy.

If policies are missing or overly broad, the fix belongs in migrations with regression tests.

## Discovery / Network

Discovery privacy is already comparatively strong and should be preserved.

This project should not redesign Discovery. It should add regression coverage ensuring:

- users without Discovery entitlement cannot access its workspace/actions;
- incognito counterpart identity remains hidden until mutual interest;
- RLS and workspace shaping remain aligned;
- Concierge proposal endpoints do not broaden Discovery access.

## Finance Boundary

Finance functionality, invoice/payment lifecycle, financial RPCs, and existing financial workflows are outside the functional-change scope of this project.

The project may:

- test that existing Finance routes still resolve for authorized profiles;
- test that unauthorized profiles do not gain access through the new OS shell;
- document legacy authorization helpers that mix canonical access with employee/email/title checks.

The project must not refactor invoice/payment behavior merely to make the authorization model prettier.

## Operations Regression Coverage

Booking remains the browser-E2E reference suite and must stay green.

Add browser-level E2E coverage for the highest-value workflows:

### Activities

- authorized user can open the calendar;
- create activity on a date;
- edit activity;
- move/reschedule through the temporal UI where supported;
- delete/cancel according to current behavior;
- unauthorized user cannot perform write actions;
- temporal interaction remains consistent with Bed Booking language.

### Tasks

- list/open tasks;
- create where authorized;
- update status/assignment where authorized;
- forbidden write is rejected server-side, not merely hidden.

### Checklists

- open checklist;
- create/start/complete according to current domain behavior;
- verify role restrictions;
- verify direct URL behavior.

The tests should prefer real browser interactions over contract tests when validating user-visible access boundaries.

## Profile / Access E2E Matrix

Create representative authenticated test fixtures for the three known perspectives.

For each perspective, test:

- expected six-area visibility;
- expected module visibility;
- allowed direct routes;
- forbidden direct routes;
- allowed reads;
- forbidden writes;
- Today does not expose data from unauthorized modules;
- server-authorized OS workspaces match the sidebar/hub state.

The fixtures may be named for the perspectives in test data, but production authorization must continue to be capability-based.

## Error Handling

Authorization failures must be deterministic and non-leaky.

- unauthenticated API call: 401;
- authenticated but forbidden API/RPC call: 403 or domain-specific forbidden error mapped to 403;
- forbidden page route: redirect to the nearest valid area or render a clear access-denied state according to existing product convention;
- inability to resolve canonical access: fail closed;
- a single hub card failing authorization/data load must not expose partial sensitive payloads in error details.

## Migration Strategy

Hardening should be incremental and reversible.

1. Add tests that capture current intended access for representative profiles.
2. Introduce canonical capability helpers/snapshot without removing old behavior.
3. Switch navigation to explicit view capabilities.
4. Align route guards with those capabilities.
5. Harden People Graph payload shaping.
6. Audit and harden Map/GIS RLS.
7. Add profile E2E and Operations E2E.
8. Remove only clearly redundant authorization paths after regression evidence proves equivalence.

Do not make one migration simultaneously change every domain policy.

## Testing Strategy

Required automated coverage:

- unit/contract tests for capability derivation;
- navigation tests for view vs operate distinction;
- proxy/route-access tests for direct-route enforcement;
- People Graph privacy tests for member vs operator/admin payloads;
- RLS/policy tests or executable SQL assertions for Map/GIS;
- Discovery privacy regression tests;
- authenticated browser E2E for Santiago/Raimundo/Tomas perspectives;
- Activities, Tasks, Checklists E2E;
- existing Booking E2E remains 13/13;
- production build and prebuild remain green.

Where production test users are unavailable, use isolated test fixtures and deterministic seed/setup. Never weaken production authorization to make E2E easier.

## Non-Goals

- creating three separate applications for Santiago, Raimundo, and Tomas;
- hard-coding access by user name;
- replacing Supabase RLS with frontend guards;
- redesigning the six-area OS taxonomy;
- redesigning Discovery;
- refactoring invoice/payment workflows;
- changing Booking behavior unrelated to regressions discovered by this hardening effort;
- broad domain rewrites.

## Success Criteria

The hardening is successful when:

- the same canonical capability model explains what the user sees, which routes they may open, and what the backend permits;
- a normal Member can browse the intended Member directory but cannot retrieve other Members' private presence/guest data;
- Map/GIS access is proven safe through RLS rather than assumed safe because a menu item is hidden;
- Santiago, Raimundo, and Tomas retain their intended perspectives without name-based authorization;
- direct forbidden routes fail closed;
- Discovery privacy remains intact;
- Finance functionality remains unchanged;
- Activities, Tasks, Checklists, and Booking have browser-level regression protection;
- prebuild, build, and all required E2E suites pass before merge.
