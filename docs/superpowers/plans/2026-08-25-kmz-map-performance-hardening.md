# KMZ Map Performance Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `/map` interactive quickly by moving KMZ conversion out of the critical startup path, lazy-loading hidden overlays, preferring cached GeoJSON derivatives, and keeping KMZ as a fallback/source artifact.

**Architecture:** Extract all overlay loading/conversion policy from `app/map/page.tsx` into a focused loader with in-flight deduplication and timing metadata. Split map readiness from overlay readiness, load visible overlays concurrently with a conservative limit, and add GIS-only derivative metadata/backfill support without touching unrelated domains.

**Tech Stack:** Next.js 16, React 19, MapLibre GL 6, JSZip 3.10, @mapbox/togeojson, Supabase/Postgres, Node 22 test runner, pnpm 10.

**Spec:** `docs/superpowers/specs/2026-08-25-kmz-map-performance-design.md`

## Global Constraints

- Original KMZ/KML source files remain authoritative and must never be deleted or rewritten by this work.
- Hidden overlays must perform no startup fetch/unzip/parse work.
- Base-map readiness must not wait for GIS overlay completion.
- Derived GeoJSON is preferred when present; direct KMZ/KML parsing remains a controlled fallback.
- A failed overlay must not make the whole map unusable.
- No changes to billing, invoices, payments, or unrelated financial workflows.
- Keep concurrency conservative and measurable; initial limit: `2` overlay loads at once.
- No new external service is introduced.

---

### Task 1: Extract and test the GIS overlay loader

**Files:**
- Create: `lib/map/overlay-loader.ts`
- Create: `tests/map-overlay-loader.test.ts`
- Modify: `package.json`

**Interfaces:**
- Produces: `loadOverlayGeoJson(overlay, options): Promise<OverlayLoadResult>`
- Produces: `clearOverlayLoadCache(): void`
- `OverlayLoadResult` contains `{ geojson, source, timings }` where `source` is `"derived" | "kmz" | "kml"`.
- `OverlayLoadTimings` contains `totalMs`, `networkMs`, `unzipMs`, `parseMs`, `byteSize`, and `featureCount`.

- [ ] **Step 1: Write failing loader tests**

Create tests that inject a fake `fetch` and prove four contracts: a valid `derived_geojson_url` wins over `file_url`; KMZ fallback extracts the first `.kml` file and returns GeoJSON; concurrent requests for the same `id + source_version` share one in-flight request; changing `source_version` causes a new request.

Use this test shape:

```ts
import assert from "node:assert/strict"
import test from "node:test"
import { clearOverlayLoadCache, loadOverlayGeoJson } from "../lib/map/overlay-loader.ts"

test("prefers a version-matched derived GeoJSON URL", async () => {
  clearOverlayLoadCache()
  const requests: string[] = []
  const result = await loadOverlayGeoJson(
    {
      id: "overlay-1",
      file_url: "https://example.test/source.kmz",
      file_type: "kmz",
      source_version: "v1",
      derived_geojson_url: "https://example.test/runtime-v1.geojson",
      derived_source_version: "v1",
    },
    {
      fetchImpl: async (url) => {
        requests.push(String(url))
        return new Response(JSON.stringify({ type: "FeatureCollection", features: [] }), {
          status: 200,
          headers: { "content-type": "application/geo+json", "content-length": "42" },
        })
      },
      now: (() => { let n = 0; return () => ++n })(),
    },
  )
  assert.equal(result.source, "derived")
  assert.deepEqual(requests, ["https://example.test/runtime-v1.geojson"])
})
```

- [ ] **Step 2: Run the test and confirm RED**

Run:

```bash
node --experimental-strip-types --test tests/map-overlay-loader.test.ts
```

Expected: FAIL because `lib/map/overlay-loader.ts` does not exist.

- [ ] **Step 3: Implement the minimal loader**

Implement these exported types/functions:

```ts
export type OverlayDescriptor = {
  id: string
  file_url: string
  file_type: string | null
  source_version: string
  derived_geojson_url?: string | null
  derived_source_version?: string | null
}

export type OverlayLoadTimings = {
  totalMs: number
  networkMs: number
  unzipMs: number
  parseMs: number
  byteSize: number | null
  featureCount: number
}

export type OverlayLoadResult = {
  geojson: GeoJsonFeatureCollection
  source: "derived" | "kmz" | "kml"
  timings: OverlayLoadTimings
}

export async function loadOverlayGeoJson(
  overlay: OverlayDescriptor,
  options?: { fetchImpl?: typeof fetch; now?: () => number },
): Promise<OverlayLoadResult>

export function clearOverlayLoadCache(): void
```

Use a module-level `Map<string, Promise<OverlayLoadResult>>` keyed by `${overlay.id}:${overlay.source_version}`. Prefer `derived_geojson_url` only when `derived_source_version === source_version`; if that request fails, evict the failed promise and fall back to the source KMZ/KML once.

- [ ] **Step 4: Make the test GREEN and wire it into prebuild**

Run the focused test, then add it to `prebuild` without changing package versions:

```json
"prebuild": "node --experimental-strip-types --test tests/map-overlay-loader.test.ts && ...existing commands..."
```

Run:

```bash
pnpm prebuild
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/map/overlay-loader.ts tests/map-overlay-loader.test.ts package.json
git commit -m "perf(map): extract cached overlay loader"
```

---

### Task 2: Make map startup progressive and hidden overlays lazy

**Files:**
- Modify: `app/map/page.tsx`
- Create: `lib/map/overlay-runtime.ts`
- Create: `tests/map-overlay-runtime.test.ts`

**Interfaces:**
- Consumes: `loadOverlayGeoJson()` from Task 1.
- Produces: `createOverlayLoadQueue({ concurrency: 2 })` with `run<T>(task): Promise<T>`.
- Produces UI state type: `OverlayRuntimeState = { status: "idle" | "loading" | "ready" | "error"; featureCount?: number; error?: string; source?: string; totalMs?: number }`.

- [ ] **Step 1: Write failing queue/runtime tests**

Prove that concurrency never exceeds two and that a failed task does not cancel queued tasks.

```ts
test("limits overlay work to two concurrent tasks", async () => {
  const queue = createOverlayLoadQueue({ concurrency: 2 })
  let active = 0
  let maxActive = 0
  const jobs = Array.from({ length: 5 }, (_, index) => queue.run(async () => {
    active += 1
    maxActive = Math.max(maxActive, active)
    await new Promise((resolve) => setTimeout(resolve, 5))
    active -= 1
    return index
  }))
  assert.deepEqual(await Promise.all(jobs), [0, 1, 2, 3, 4])
  assert.equal(maxActive, 2)
})
```

- [ ] **Step 2: Run and confirm RED**

```bash
node --experimental-strip-types --test tests/map-overlay-runtime.test.ts
```

- [ ] **Step 3: Implement the queue and refactor `page.tsx`**

In `app/map/page.tsx`:

1. Keep the Supabase metadata fetch in the existing initial `Promise.all`.
2. Include `updated_at`, `derived_geojson_url`, and `derived_source_version` in the overlay select.
3. Treat `updated_at` as the initial `source_version`.
4. Set global `loading=false` as soon as MapLibre has fired `load` and infrastructure/connections have been added; do not wait for overlays.
5. Initialize each overlay state as `idle`.
6. Schedule only overlays with `is_visible !== false` through the concurrency-2 queue.
7. On toggle of an unloaded hidden overlay: set `loading`, call the queue/loader, add its MapLibre source/layers, then mark `ready` and visible.
8. On toggle of a previously loaded overlay: only call `setLayoutProperty`; do not fetch again.
9. On one overlay error: set only that overlay to `error`; keep the map usable.
10. Replace the current generic `Procesando…` copy with `Sin cargar`, `Cargando…`, `<N> elementos`, or `Error · Reintentar`.

Move the layer-registration helper into a local focused function or `lib/map/overlay-runtime.ts`; do not leave file-format parsing in the page.

- [ ] **Step 4: Run tests and build**

```bash
node --experimental-strip-types --test tests/map-overlay-runtime.test.ts
pnpm prebuild
pnpm build
```

Expected: all PASS/build succeeds.

- [ ] **Step 5: Commit**

```bash
git add app/map/page.tsx lib/map/overlay-runtime.ts tests/map-overlay-runtime.test.ts
git commit -m "perf(map): lazy load overlays progressively"
```

---

### Task 3: Add GIS derivative metadata without changing source files

**Files:**
- Create: `supabase/migrations/20260825000100_add_gis_overlay_runtime_derivatives.sql`
- Create: `tests/map-gis-derivative-contract.test.ts`
- Modify: `package.json`

**Interfaces:**
- Adds nullable columns on `public.gis_overlays`:
  - `derived_geojson_url text`
  - `derived_source_version text`
  - `derived_feature_count integer`
  - `derived_generated_at timestamptz`
- Leaves `file_url`, `file_type`, and existing RLS policies intact.

- [ ] **Step 1: Write the failing migration contract test**

Test the SQL text for additive columns and for absence of `DROP COLUMN file_url`, `DELETE FROM gis_overlays`, or finance-related table names.

- [ ] **Step 2: Run and confirm RED**

```bash
node --experimental-strip-types --test tests/map-gis-derivative-contract.test.ts
```

- [ ] **Step 3: Add the additive migration**

Use:

```sql
alter table public.gis_overlays
  add column if not exists derived_geojson_url text,
  add column if not exists derived_source_version text,
  add column if not exists derived_feature_count integer,
  add column if not exists derived_generated_at timestamptz;

comment on column public.gis_overlays.derived_geojson_url is
  'Versioned runtime GeoJSON derivative. Original file_url remains authoritative.';
```

Do not loosen RLS or introduce public-read policies.

- [ ] **Step 4: Wire test into prebuild and run**

```bash
node --experimental-strip-types --test tests/map-gis-derivative-contract.test.ts
pnpm prebuild
```

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20260825000100_add_gis_overlay_runtime_derivatives.sql tests/map-gis-derivative-contract.test.ts package.json
git commit -m "feat(map): add runtime derivative metadata"
```

---

### Task 4: Add idempotent derivative generation/backfill

**Files:**
- Create: `scripts/backfill-gis-overlay-derivatives.mjs`
- Create: `lib/map/server/derive-overlay.mjs`
- Create: `tests/map-overlay-derivative.test.ts`
- Modify: `package.json`

**Interfaces:**
- Produces: `deriveOverlay({ sourceUrl, fileType, sourceVersion, fetchImpl }): Promise<{ geojsonText, featureCount, sourceVersion }>`.
- Backfill reads rows from `gis_overlays`, skips rows where `derived_source_version === updated_at`, writes a versioned `.geojson` object to an existing Supabase Storage bucket configured by `GIS_DERIVATIVE_BUCKET`, then updates only the four derivative columns.
- Required env for backfill: `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `GIS_DERIVATIVE_BUCKET`.

- [ ] **Step 1: Write failing pure derivative tests**

Cover KMZ extraction, KML conversion, invalid archive failure, and idempotency decision:

```ts
assert.equal(needsDerivative({ sourceVersion: "v1", derivedSourceVersion: "v1" }), false)
assert.equal(needsDerivative({ sourceVersion: "v2", derivedSourceVersion: "v1" }), true)
```

- [ ] **Step 2: Run and confirm RED**

```bash
node --experimental-strip-types --test tests/map-overlay-derivative.test.ts
```

- [ ] **Step 3: Implement the pure converter and backfill script**

The output object key must be versioned and immutable, e.g.:

```js
const objectPath = `gis-overlays/${row.id}/${encodeURIComponent(sourceVersion)}.geojson`
```

Upload with `contentType: "application/geo+json"` and `upsert: false`. If the immutable object already exists, treat that as reusable rather than deleting/replacing the source KMZ.

The backfill must support `--dry-run` and print one line per overlay with `skip`, `generate`, or `error`.

- [ ] **Step 4: Add a package command and verify**

Add:

```json
"map:backfill-derivatives": "node scripts/backfill-gis-overlay-derivatives.mjs"
```

Run unit tests plus:

```bash
node scripts/backfill-gis-overlay-derivatives.mjs --dry-run
```

Expected in CI/local without credentials: explicit configuration error before mutation; with configured staging credentials: a read-only plan showing rows to skip/generate.

- [ ] **Step 5: Commit**

```bash
git add scripts/backfill-gis-overlay-derivatives.mjs lib/map/server/derive-overlay.mjs tests/map-overlay-derivative.test.ts package.json
git commit -m "perf(map): add idempotent overlay derivative backfill"
```

---

### Task 5: Add map performance diagnostics and acceptance regression

**Files:**
- Modify: `app/map/page.tsx`
- Create: `tests/map-performance-contract.test.ts`
- Modify: `package.json`

**Interfaces:**
- Dev-only diagnostics log one structured line per loaded overlay with: `overlayId`, `source`, `totalMs`, `networkMs`, `unzipMs`, `parseMs`, `featureCount`, `byteSize`.
- Production UI does not expose raw timing details.

- [ ] **Step 1: Write failing contract tests**

Assert source-level contracts that prevent regression: no serial `for (const ... await loadOverlayGeoJson` startup loop in `page.tsx`; hidden overlays are filtered before scheduling initial loads; global loading completion is tied to map/base readiness; per-overlay states include `idle/loading/ready/error`.

- [ ] **Step 2: Run and confirm RED where applicable**

```bash
node --experimental-strip-types --test tests/map-performance-contract.test.ts
```

- [ ] **Step 3: Add diagnostic logging**

After each successful overlay load:

```ts
if (process.env.NODE_ENV !== "production") {
  console.info("[map-overlay-performance]", {
    overlayId: overlay.id,
    source: result.source,
    ...result.timings,
  })
}
```

Keep telemetry local/lightweight; do not add an analytics service.

- [ ] **Step 4: Run the complete regression gate**

```bash
pnpm prebuild
pnpm build
pnpm test:e2e:booking
```

Expected: prebuild PASS, production build PASS, Booking E2E remains 13/13.

Then deploy the branch to Vercel preview and manually validate with the real GIS dataset:

```text
1. Open /map with DevTools Network + Performance.
2. Verify base map/infrastructure are usable before all visible overlays finish.
3. Verify hidden overlay URLs are absent from initial network requests.
4. Activate one hidden overlay; verify exactly one geometry request starts.
5. Toggle it off/on; verify no second geometry fetch occurs in-session.
6. Reload; verify derivative `.geojson` uses browser/CDN caching where present.
7. Record base-map-ready time and the three slowest overlay timings.
```

Acceptance: base map approximately <=2 s on normal broadband excluding third-party satellite tile latency, and page readiness never waits for all KMZ overlays.

- [ ] **Step 5: Commit**

```bash
git add app/map/page.tsx tests/map-performance-contract.test.ts package.json
git commit -m "test(map): lock progressive KMZ performance behavior"
```

---

### Task 6: Final safety review and rollout preparation

**Files:**
- Modify only if needed to fix failing map-scoped tests/build.
- Do not modify Finance/invoice/payment files.

**Interfaces:**
- Produces a branch ready for review/deployment; does not merge automatically.

- [ ] **Step 1: Compare branch against main**

```bash
git diff --name-only main...HEAD
```

Expected changed areas only: `app/map`, `lib/map`, `tests/map-*`, GIS-only Supabase migration, map backfill script, `package.json`, and this plan/spec documentation.

- [ ] **Step 2: Confirm forbidden areas are untouched**

```bash
git diff --name-only main...HEAD | grep -Ei 'invoice|payment|billing|accounting' && exit 1 || true
```

Expected: no output.

- [ ] **Step 3: Run final verification fresh from HEAD**

```bash
pnpm prebuild
pnpm build
pnpm test:e2e:booking
```

Expected: all green; Booking 13/13.

- [ ] **Step 4: Validate the DB migration/backfill only in staging/preview first**

Apply the GIS-only migration to a non-production environment, run the backfill in `--dry-run`, then generate derivatives for a small sample before all rows. Confirm original `file_url` values are unchanged.

- [ ] **Step 5: Commit any final map-scoped fixes and request review**

Do not merge to `main` until the final regression output and preview performance evidence are reviewed.
