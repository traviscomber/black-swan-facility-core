# BlackSwan OS Navigation Architecture

## Goal

Turn BlackSwan from a large collection of operational modules into one coherent operating system without removing existing depth, changing domain behavior, or breaking existing URLs.

The primary navigation becomes six stable areas:

1. Today
2. Operations
3. People
4. Places & Assets
5. Finance
6. Network

Admin remains a secondary permission-gated control surface. Concierge / AI Ops becomes a global contextual layer rather than a peer navigation module.

## Core Product Principle

BlackSwan is one operating system with multiple perspectives, not separate applications for different users.

Santiago, Raimundo, and Tomas use the same six-area information architecture. Their permissions, ordering, summaries, badges, shortcuts, and Today content adapt to the existing profile/access model. The navigation layer must consume existing authorization; it must not introduce name-based authorization or replace current role/permission rules.

## Compatibility Contract

This project is an information-architecture and shell change first.

- Existing domain routes remain valid.
- Existing domain data models remain authoritative.
- Existing authorization remains authoritative.
- Deep links and bookmarks continue to work.
- Domain modules are grouped, not rewritten.
- Invoice/payment business logic, RPCs, migrations, APIs, and lifecycle behavior are explicitly out of scope. Finance may expose links to those existing surfaces but must not alter them.

## Area Model

### Today

Today is the personalized operational command surface. It answers: what requires my attention now?

It combines authorized information already available elsewhere: scheduled work, reservations, activities, approvals, alerts, deadlines, exceptions, and recent operational changes. Content is filtered and prioritized for the signed-in user's existing profile and permissions.

Today should favor action and time over module taxonomy. It is not a second dashboard containing every metric.

### Operations

Groups work execution and service delivery. Expected children include activities, checklists, bookings/hospitality, events, procurement workflows, and other operational work surfaces where they already exist.

### People

Groups employees, members, guests, roles, presence, responsibilities, and people-oriented operational views where they already exist.

### Places & Assets

Groups assets, infrastructure, locations, fleet, fuel, cattle, cattle health, and other physical-resource surfaces where they already exist.

### Finance

Groups budgets, accounting, financial procurement views, and existing invoice/payment entry points. This navigation project does not change invoice/payment behavior.

### Network

Groups Discovery, relationship/introduction surfaces, relevant community/event network views, and external relationship workflows. Concierge remains global rather than living only inside Network.

## Personalized Perspectives

All three known perspectives — Santiago, Raimundo, and Tomas — retain the same top-level mental model.

Personalization can change:

- visibility according to existing permissions;
- ordering of secondary links and shortcuts;
- Today feed composition and priority;
- counts, alerts, and pending-action badges;
- default landing content within an area when justified by existing profile behavior.

Personalization must not create three separate route trees or duplicate implementations. A user must be able to learn BlackSwan once and recognize it from another authorized perspective.

## Temporal UX Standard: Bed Booking Language

The existing Bed Booking calendar is the reference interaction language for time-based BlackSwan experiences.

Where a domain represents scheduled occupancy, work, reservations, events, maintenance, staffing, or another meaningful time allocation, new or consolidated calendar surfaces should reuse the same conceptual grammar:

- visible time axis;
- resource or responsibility rows when appropriate;
- clear bounded blocks for scheduled items;
- consistent date navigation;
- consistent selection and detail behavior;
- recognizable density and hierarchy;
- status communicated without requiring the user to learn a new calendar model in every module.

This does not mean every module becomes a calendar. Ledgers, accounting controls, master records, Discovery evaluation, configuration, and other non-temporal workflows keep their natural interfaces.

The goal is one temporal language across BlackSwan, not one component forced into every page.

## Shell and Navigation

The application shell should present the six areas as the dominant navigation. Secondary module links appear within their parent area rather than competing at the same hierarchy level.

The shell must derive visible navigation from existing access controls. Hidden navigation is not a security boundary; backend/domain authorization remains mandatory.

Admin is visually secondary and permission-gated.

Concierge / AI is globally reachable from the shell. It receives enough route/area context to understand where the user is working, while respecting the same authorization boundaries as the underlying product.

## Hub Strategy

Use a hybrid approach:

- preserve existing module routes;
- introduce lightweight area hubs where they improve orientation;
- avoid moving existing pages merely to achieve prettier URLs;
- allow hubs to summarize and link to authorized existing modules;
- make Today the strongest cross-domain hub.

The first implementation should prefer navigation composition over backend changes.

## Data Flow

Navigation configuration defines the six areas and maps existing routes/modules to each area.

At runtime:

1. Resolve the authenticated user and existing access/profile context.
2. Filter area children using existing authorization capabilities.
3. Compute the active area from the current route.
4. Render the common shell and authorized secondary navigation.
5. For Today and area hubs, query only the existing domain data required for visible cards/timeline items.
6. Pass current area/route context to the global Concierge surface without bypassing authorization.

No domain write path should be routed through the navigation layer.

## Error and Empty States

Navigation must degrade safely.

- A failure to load a hub summary must not make the underlying module inaccessible.
- If a user has no authorized children in an area, the area is hidden unless product policy requires an explanatory empty state.
- Calendar/timeline aggregation errors should isolate the failed source rather than blank the entire temporal view.
- Existing direct routes continue to rely on their own authorization and error handling.

## Testing Strategy

Implementation follows test-driven development.

Required regression coverage:

- the six-area navigation configuration is stable;
- known existing routes map to the expected parent area;
- existing routes are not renamed by this project;
- navigation filtering respects the existing access model;
- Santiago, Raimundo, and Tomas resolve through one navigation architecture rather than hard-coded separate apps;
- unauthorized modules do not appear in navigation;
- direct-route authorization remains independent of menu visibility;
- global Concierge receives route context without broadening permissions;
- temporal hubs use the shared calendar/timeline abstraction when introduced;
- existing Bed Booking E2E coverage remains green;
- invoice/payment implementation files and behavior remain untouched by this project.

## Delivery Sequence

1. Inventory the current shell, route map, access/profile mechanism, and Bed Booking calendar primitives.
2. Introduce a tested navigation taxonomy/configuration layer for the six areas.
3. Adapt the existing shell/sidebar to render the taxonomy through current permissions.
4. Add lightweight area hubs incrementally, starting with Today and Operations.
5. Extract/reuse the Bed Booking temporal grammar as a shared abstraction only where a second real consumer proves the interface.
6. Add People, Places & Assets, Finance, and Network hubs without rewriting their domain modules.
7. Make Concierge globally contextual.
8. Validate each known profile perspective and all existing deep links.

## Non-Goals

- Rewriting domain modules.
- Renaming all routes.
- Creating separate applications for Santiago, Raimundo, and Tomas.
- Replacing existing authorization.
- Refactoring unrelated backend services.
- Changing invoice/payment functionality.
- Forcing calendar UI onto non-temporal workflows.

## Success Criteria

The redesign succeeds when a user can understand BlackSwan through six stable concepts, while every existing authorized workflow remains reachable and behaves as before.

Santiago, Raimundo, and Tomas should experience different priorities without experiencing different products. Time-based work should feel recognizably BlackSwan because it uses the Bed Booking temporal language. Existing deep links must remain valid, and financial invoice/payment behavior must remain unchanged.
