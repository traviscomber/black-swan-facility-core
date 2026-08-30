import assert from "node:assert/strict"
import test from "node:test"
import { readFileSync } from "node:fs"

const faoRoute = readFileSync(new URL("../app/api/orchard/library/fao/route.ts", import.meta.url), "utf8")
const faoSyncRoute = readFileSync(new URL("../app/api/orchard/library/fao/sync/route.ts", import.meta.url), "utf8")
const faoPage = readFileSync(new URL("../app/orchard/library/fao/page.tsx", import.meta.url), "utf8")
const orchardLibraryPage = readFileSync(new URL("../app/orchard/library/page.tsx", import.meta.url), "utf8")
const orchardIntelCard = readFileSync(new URL("../components/orchard/black-swan-intelligence.tsx", import.meta.url), "utf8")
const assistantRoute = readFileSync(new URL("../app/api/orchard/assistant/route.ts", import.meta.url), "utf8")
const assistantScope = readFileSync(new URL("../lib/orchard-ai/game-plan-scope.ts", import.meta.url), "utf8")
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

test("Fundo Corcovado library reads only the canonical Black Swan crop layer", () => {
  assert.match(orchardLibraryPage, /CANONICAL_SCHEME = "black_swan_canonical"/)
  assert.match(orchardLibraryPage, /CANONICAL_CODE = "fundo_corcovado"/)
  assert.match(orchardLibraryPage, /\.eq\("classification_scheme",CANONICAL_SCHEME\)/)
  assert.match(orchardLibraryPage, /\.eq\("classification_code",CANONICAL_CODE\)/)
  assert.match(orchardLibraryPage, /Fundo Corcovado/)
  assert.doesNotMatch(orchardLibraryPage, /Valdivia \/ Los Ríos|SOUTH_CHILE_PRIORITY|southChilePriority|chileRepresentativeScore/)
})

test("canonical crop creation stays inside Fundo Corcovado instead of becoming a reference profile", () => {
  assert.match(orchardLibraryPage, /classification_scheme:CANONICAL_SCHEME/)
  assert.match(orchardLibraryPage, /classification_code:CANONICAL_CODE/)
  assert.match(orchardLibraryPage, /provenance_type:"manual"/)
  assert.doesNotMatch(orchardLibraryPage, /source\?"reference"/)
})

test("Orchard AI reads Corcovado canonical profiles and succession history directly", () => {
  assert.match(assistantRoute, /from\("orchard_crop_library"\)/)
  assert.match(assistantRoute, /\.eq\("classification_scheme", "black_swan_canonical"\)/)
  assert.match(assistantRoute, /\.eq\("classification_code", "fundo_corcovado"\)/)
  assert.match(assistantRoute, /from\("orchard_cultivar_library"\)/)
  assert.match(assistantRoute, /knowledge_source_snapshot/)
  assert.match(assistantRoute, /black_swan_history_2024_25/)
  assert.match(assistantRoute, /black_swan_history_2025_26/)
  assert.match(assistantRoute, /right_censored or measurement_incomplete evidence as partial measurement/)
  assert.match(assistantScope, /scoped\.canonical_crop_library/)
  assert.match(assistantScope, /scoped\.canonical_cultivars/)
  assert.match(assistantScope, /cropLibraryIds/)
})

test("Orchard AI preserves operator notes without letting them override canonical evidence", () => {
  assert.match(assistantRoute, /supabase\.from\("orchard_notes"\)/)
  assert.match(assistantRoute, /Notes may contain operator context, but they do not override canonical crop profiles/)
  assert.match(assistantRoute, /Use ONLY the authorized ORCHARD_SNAPSHOT/)
  assert.match(assistantRoute, /Distinguish recorded facts from inferences/)
  assert.match(assistantRoute, /Never invent rows, weather, agronomy facts, prices, yields, tasks, dates, or actions/)
  assert.match(assistantScope, /if \(snapshot\.notes\)/)
})

test("Orchard AI excludes legacy spatial placeholders from operational grounding", () => {
  assert.match(assistantRoute, /from\("orchard_plots"\).*\.neq\("status", "abandoned"\)/)
  assert.match(assistantRoute, /from\("orchard_beds"\).*\.neq\("status", "out_of_service"\)/)
})

test("Orchard AI keeps Game Plan boundaries around historical intelligence", () => {
  assert.match(assistantRoute, /The snapshot has already been filtered to this Game Plan/)
  assert.match(assistantRoute, /Never infer, mention, compare, or use operational records from another Game Plan/)
  assert.match(assistantScope, /scoped\.game_plans = gamePlans/)
  assert.match(assistantScope, /scoped\.crop_cycles = cropCycles/)
  assert.match(assistantScope, /scoped\.successions = successions/)
})

test("Corcovado intelligence card exposes evidence confidence and comparability", () => {
  assert.match(orchardIntelCard, /Corcovado intelligence/)
  assert.match(orchardIntelCard, /Inteligencia Corcovado/)
  assert.match(orchardIntelCard, /Corcovado-Intelligenz/)
  assert.match(orchardIntelCard, /Evidence confidence/)
  assert.match(orchardIntelCard, /two real seasons/)
  assert.match(orchardIntelCard, /Related profile — not equivalent/)
  assert.match(orchardIntelCard, /No final performance conclusion/)
  assert.match(orchardIntelCard, /isLimited/)
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
