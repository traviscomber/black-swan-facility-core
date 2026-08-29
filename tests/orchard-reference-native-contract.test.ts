import assert from "node:assert/strict"
import test from "node:test"
import { readFileSync } from "node:fs"

const faoRoute = readFileSync(new URL("../app/api/orchard/library/fao/route.ts", import.meta.url), "utf8")
const faoPage = readFileSync(new URL("../app/orchard/library/fao/page.tsx", import.meta.url), "utf8")
const migration = readFileSync(new URL("../supabase/migrations/20260829153410_orchard_fao_reference_identity.sql", import.meta.url), "utf8")
const nativePackage = JSON.parse(readFileSync(new URL("../native/package.json", import.meta.url), "utf8")) as { dependencies?: Record<string,string>; devDependencies?: Record<string,string> }
const nativeConfig = JSON.parse(readFileSync(new URL("../native/capacitor.config.json", import.meta.url), "utf8")) as { appId?:string; server?:{url?:string;cleartext?:boolean} }
const nativeReadme = readFileSync(new URL("../native/README.md", import.meta.url), "utf8")

test("FAO crop catalog is authenticated and source bounded", () => {
  assert.match(faoRoute, /supabase\.auth\.getUser\(\)/)
  assert.match(faoRoute, /if \(!authData\.user\)/)
  assert.match(faoRoute, /ICC11-core\.csv/)
  assert.match(faoRoute, /revalidate: 86400/)
  assert.doesNotMatch(faoRoute, /service_role|SUPABASE_SERVICE_ROLE/)
})

test("FAO imports preserve canonical source identity without inventing agronomy", () => {
  assert.match(migration, /external_source text/)
  assert.match(migration, /external_id text/)
  assert.match(migration, /orchard_crop_library_external_identity_unique/)
  assert.match(faoPage, /external_source:"fao_icc_1_1"/)
  assert.match(faoPage, /provenance_type:"reference"/)
  assert.doesNotMatch(faoPage, /days_to_maturity:/)
  assert.doesNotMatch(faoPage, /target_yield_per_sqm:/)
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
