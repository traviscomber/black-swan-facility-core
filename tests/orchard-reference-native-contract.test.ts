import assert from "node:assert/strict"
import test from "node:test"
import { readFileSync } from "node:fs"

const faoRoute = readFileSync(new URL("../app/api/orchard/library/fao/route.ts", import.meta.url), "utf8")
const faoSyncRoute = readFileSync(new URL("../app/api/orchard/library/fao/sync/route.ts", import.meta.url), "utf8")
const faoPage = readFileSync(new URL("../app/orchard/library/fao/page.tsx", import.meta.url), "utf8")
const identityMigration = readFileSync(new URL("../supabase/migrations/20260829153410_orchard_fao_reference_identity.sql", import.meta.url), "utf8")
const syncMigration = readFileSync(new URL("../supabase/migrations/20260829154522_orchard_agronomy_sync_2.sql", import.meta.url), "utf8")
const classificationMigration = readFileSync(new URL("../supabase/migrations/20260829154733_orchard_crop_classification_metadata.sql", import.meta.url), "utf8")
const nativePackage = JSON.parse(readFileSync(new URL("../native/package.json", import.meta.url), "utf8")) as { dependencies?: Record<string,string>; devDependencies?: Record<string,string> }
const nativeConfig = JSON.parse(readFileSync(new URL("../native/capacitor.config.json", import.meta.url), "utf8")) as { appId?:string; server?:{url?:string;cleartext?:boolean} }
const nativeReadme = readFileSync(new URL("../native/README.md", import.meta.url), "utf8")

test("FAO WCA crop catalog is authenticated and source bounded", () => {
  assert.match(faoRoute, /supabase\.auth\.getUser\(\)/)
  assert.match(faoRoute, /if \(!authData\.user\)/)
  assert.match(faoRoute, /WCACROPS-core\.csv/)
  assert.match(faoRoute, /revalidate: 86400/)
  assert.match(faoRoute, /scientificName/)
  assert.doesNotMatch(faoRoute, /service_role|SUPABASE_SERVICE_ROLE/)
})

test("WCA parser follows Caliper SKOS semantics and has URI fallback", () => {
  for (const source of [faoRoute, faoSyncRoute]) {
    assert.match(source, /alternative_label/)
    assert.match(source, /alt_label/)
    assert.match(source, /vernacular_name/)
    assert.match(source, /nameFromUri/)
    assert.match(source, /pref_label_lat/)
    assert.match(source, /dwc_scientificname/)
  }
})

test("FAO imports preserve canonical crop identity without inventing agronomy", () => {
  assert.match(identityMigration, /external_source text/)
  assert.match(identityMigration, /external_id text/)
  assert.match(classificationMigration, /classification_scheme text/)
  assert.match(classificationMigration, /classification_code text/)
  assert.match(faoPage, /external_source:"fao_wca_2020"/)
  assert.match(faoPage, /provenance_type:"reference"/)
  assert.doesNotMatch(faoPage, /days_to_maturity:/)
  assert.doesNotMatch(faoPage, /target_yield_per_sqm:/)
})

test("bulk FAO sync is admin-only, audited, idempotent and preserves observed agronomy", () => {
  assert.match(faoSyncRoute, /current_app_role/)
  assert.match(faoSyncRoute, /role!=="admin"/)
  assert.match(faoSyncRoute, /orchard_reference_sync_runs/)
  assert.match(faoSyncRoute, /fao_wca_2020/)
  assert.match(faoSyncRoute, /CHUNK_SIZE = 200/)
  assert.match(faoSyncRoute, /if\(current\.external_source\|\|current\.external_id\)/)
  assert.doesNotMatch(faoSyncRoute, /days_to_maturity|target_yield_per_sqm|germination_rate_pct|plant_spacing_cm/)
  assert.match(syncMigration, /current_app_role\(\) = 'admin'/)
  assert.match(syncMigration, /orchard_reference_sync_runs/)
})

test("native workspace stays isolated and pinned to current stable Capacitor", () => {
  assert.equal(nativePackage.dependencies?.["@capacitor/core"], "8.5.0")
  assert.equal(nativePackage.dependencies?.["@capacitor/ios"], "8.5.0")
  assert.equal(nativePackage.dependencies?.["@capacitor/android"], "8.5.0")
  assert.equal(nativePackage.devDependencies?.["@capacitor/cli"], "8.5.0")
  assert.equal(nativeConfig.appId, "app.blackswn.facilitycore")
  assert.equal(nativeConfig.server?.url, "https://blackswn.app")
  assert.equal(nativeConfig.server?.cleartext, false)
})

test("native release gate never claims store publication", () => {
  assert.match(nativeReadme, /does \*\*not\*\* mean the product has been published/)
  assert.match(nativeReadme, /signed native build/)
  assert.match(nativeReadme, /physical devices/)
})
