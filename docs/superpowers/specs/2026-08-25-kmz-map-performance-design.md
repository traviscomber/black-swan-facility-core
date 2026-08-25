# KMZ Map Performance Hardening

Date: 2026-08-25
Status: Proposed for implementation after review

## Goal

Make `/map` become interactive quickly and prevent KMZ processing from blocking initial page usability. Keep KMZ files as source artifacts while using cached, runtime-optimized GeoJSON for display.

Target behavior:

- Base map and infrastructure become usable independently of KMZ processing.
- Visible overlays appear progressively.
- Hidden overlays do not incur download, unzip, parse, or render cost until activated.
- Repeated visits reuse derived/cached GeoJSON instead of repeating KMZ decompression and KML conversion.
- Existing KMZ source files remain untouched.
- No changes to billing, invoices, or payments.

## Current bottleneck

`app/map/page.tsx` currently performs the full conversion in the browser:

1. Fetch the overlay file.
2. Read the KMZ into an `ArrayBuffer`.
3. Decompress with `JSZip`.
4. Extract the KML.
5. Parse XML with `DOMParser`.
6. Convert KML to GeoJSON with `@mapbox/togeojson`.
7. Register the GeoJSON source and three MapLibre layers.

The overlay loop awaits each overlay sequentially. As a result, total startup cost grows roughly with the sum of all overlay download and processing times, and hidden overlays can still consume startup work.

## Chosen architecture

### 1. Runtime representation

KMZ remains the authoritative uploaded/source format. A derived GeoJSON representation is generated and cached for runtime use.

Each overlay can reference a cached derivative through metadata or dedicated derived-file fields, keyed by the source overlay identity plus a source version marker such as `updated_at`, file hash, or an equivalent immutable cache key.

The browser should prefer the derived GeoJSON whenever present. Direct KMZ parsing remains only as a controlled fallback for overlays that have not yet been preprocessed.

### 2. Progressive map startup

Initial startup is split into independent phases:

- Fetch infrastructure, connections, and overlay metadata.
- Load MapLibre and render the base satellite map immediately.
- Add infrastructure and connection sources immediately.
- Mark the map as interactive/ready without waiting for KMZ overlays.
- Start loading only overlays whose `is_visible !== false`.
- Load each visible overlay independently so one slow or invalid overlay does not block the others.

The global `Cargando mapa operativo…` state ends when the base map is usable, not when every GIS overlay has finished.

### 3. Lazy loading

Hidden overlays are metadata-only at startup.

When the user activates a hidden overlay:

- If the source is already registered in MapLibre, only switch visibility.
- If the overlay has never been loaded, fetch/parse its runtime GeoJSON at that moment, add the source/layers, then mark it visible.
- If loading fails, preserve the rest of the map and expose an overlay-specific error state.

Once loaded during the session, an overlay is not fetched or parsed again when toggled off/on.

### 4. Concurrency

Visible overlays should not be processed through a serial `for ... await` chain.

Use independent overlay-loading tasks with a conservative concurrency limit. The intent is to overlap network waits without launching enough simultaneous decompression/parsing work to freeze the main thread.

The initial implementation should keep concurrency modest and measurable rather than maximizing parallelism blindly.

### 5. Derived GeoJSON generation and simplification

The preprocessing path converts KMZ/KML into GeoJSON outside the page startup path.

For large line and polygon datasets, the runtime derivative may be simplified for display while preserving the original KMZ unchanged. Simplification must preserve operationally meaningful geometry and should be configurable or skipped for small overlays.

The derived artifact should omit KMZ packaging overhead and any unused embedded assets that are irrelevant to MapLibre rendering.

### 6. Cache behavior

Derived GeoJSON should be addressable by a stable versioned URL and served with long-lived caching when the version/key changes with source updates.

The page should not need to re-run KMZ decompression merely because the user revisited `/map`.

A source update invalidates the derivative by generating a new version/key rather than relying on short TTLs.

### 7. Overlay state model

Each overlay should have an independent runtime state, for example:

- `idle` — metadata known, not requested.
- `loading` — runtime geometry being retrieved/processed.
- `ready` — MapLibre source/layers registered.
- `error` — overlay failed without taking down the map.

The sidebar shows these states instead of a generic `Procesando…` for every layer.

Feature counts are populated when the GeoJSON becomes available.

### 8. Performance telemetry

During the hardening pass, capture lightweight development diagnostics for each overlay:

- total load time;
- network time when directly fetching source/runtime geometry;
- KMZ unzip time when fallback parsing is used;
- KML-to-GeoJSON parse time when fallback parsing is used;
- feature count;
- source byte size when available.

This telemetry is diagnostic and should not create a heavy permanent analytics subsystem.

## Components and boundaries

### `app/map/page.tsx`

Responsibilities after the change:

- create the map;
- render infrastructure/connections;
- manage user interaction and overlay visibility;
- request overlays through an overlay loader abstraction;
- display per-overlay runtime state.

It should no longer contain all conversion/cache policy inline.

### GIS overlay loader module

Introduce a small isolated module responsible for:

- selecting derived GeoJSON vs source fallback;
- fetching runtime geometry;
- performing KMZ/KML fallback conversion when necessary;
- returning normalized GeoJSON and timing metadata;
- preventing duplicate in-session loads.

This boundary keeps map UI code separate from file-format processing.

### Preprocessing path

A server-side/admin-side processing path is responsible for generating the runtime derivative when an overlay is created or changed, or via an explicit backfill for existing overlays.

Exact placement should follow existing project/Supabase patterns discovered during implementation rather than introducing an unrelated service.

## Error handling

- A failed overlay must never make the whole map unusable.
- The sidebar exposes a clear retryable overlay error state.
- The map-level error remains reserved for failures that prevent MapLibre/base map initialization.
- If a derived GeoJSON URL fails and the original KMZ/KML source remains available, a controlled fallback may attempt source parsing.
- Invalid KML/KMZ is reported for that overlay only.

## Migration/backfill

Existing `gis_overlays` rows need a one-time backfill path so current KMZ sources can receive runtime derivatives.

The backfill must be idempotent:

- skip overlays whose derivative matches the current source version;
- regenerate when the source version differs;
- never modify or delete the original KMZ.

If schema changes are required, they are limited to GIS overlay runtime metadata/derivative references.

## Testing

### Unit coverage

- chooses derived GeoJSON when available;
- falls back to KMZ/KML conversion when required;
- extracts the KML entry from KMZ correctly;
- rejects invalid archives/XML cleanly;
- deduplicates concurrent requests for the same overlay;
- invalidates/reloads when the source version changes.

### UI/integration coverage

- base map becomes ready without waiting for overlays;
- hidden overlays are not loaded at startup;
- toggling a hidden overlay loads it once and then reuses it;
- one overlay failure does not prevent other overlays from rendering;
- visible overlays can load progressively;
- overlay status and feature count update correctly.

### Performance acceptance checks

On the production-like dataset:

- `/map` reaches base-map interactivity in approximately 2 seconds under a normal broadband connection, excluding unavoidable third-party tile latency.
- Initial page readiness does not wait for all KMZ layers.
- Hidden KMZ layers produce no startup fetch/parse work.
- Repeat visits use cached derived geometry where available.
- Main-thread stalls from KMZ decompression/parsing are materially reduced or eliminated in the normal path.

## Rollout

1. Add loader abstraction and per-overlay state without changing data persistence.
2. Make startup progressive and hidden overlays lazy.
3. Add derived GeoJSON support while preserving KMZ fallback.
4. Add the preprocessing/backfill path for existing overlays.
5. Run the backfill and validate the real dataset.
6. Measure before/after timings and tune simplification/concurrency only if data shows it is necessary.
7. Perform final map smoke testing before closing the site readiness work.

## Non-goals

- Replacing MapLibre.
- Replacing the satellite tile provider as part of this change.
- Rebuilding the entire GIS data model.
- Removing original KMZ files.
- Refactoring unrelated application areas.
- Changing invoices, billing, or payments.

## Approval constraint

Implementation should begin only after this design is reviewed and accepted. Any discovered requirement that changes persistence shape, adds a new external service, or materially changes the upload workflow should be surfaced before expanding scope.
