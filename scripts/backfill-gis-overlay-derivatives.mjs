import { createClient } from "@supabase/supabase-js"
import { deriveOverlay, needsDerivative } from "../lib/map/server/derive-overlay.mjs"

const dryRun = process.argv.includes("--dry-run")
const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
const bucket = process.env.GIS_DERIVATIVE_BUCKET

if (!url || !serviceRoleKey || !bucket) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, or GIS_DERIVATIVE_BUCKET. No changes were made.")
  process.exit(2)
}

const supabase = createClient(url, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } })

const { data: overlays, error } = await supabase
  .from("gis_overlays")
  .select("id,name,file_url,file_type,updated_at,derived_geojson_url,derived_source_version")
  .order("created_at")

if (error) throw error

for (const row of overlays ?? []) {
  const sourceVersion = String(row.updated_at ?? "")
  if (!needsDerivative({ sourceVersion, derivedSourceVersion: row.derived_source_version })) {
    console.log(`skip ${row.id} ${row.name ?? ""}`)
    continue
  }

  console.log(`generate ${row.id} ${row.name ?? ""}${dryRun ? " (dry-run)" : ""}`)
  if (dryRun) continue

  try {
    const derived = await deriveOverlay({ sourceUrl: row.file_url, fileType: row.file_type, sourceVersion })
    const objectPath = `gis-overlays/${row.id}/${encodeURIComponent(sourceVersion)}.geojson`
    const bytes = new TextEncoder().encode(derived.geojsonText)
    const upload = await supabase.storage.from(bucket).upload(objectPath, bytes, {
      contentType: "application/geo+json",
      cacheControl: "31536000",
      upsert: false,
    })

    if (upload.error && !/already exists|duplicate/i.test(upload.error.message)) throw upload.error

    const { data: publicUrlData } = supabase.storage.from(bucket).getPublicUrl(objectPath)
    const derivedUrl = publicUrlData.publicUrl
    const update = await supabase
      .from("gis_overlays")
      .update({
        derived_geojson_url: derivedUrl,
        derived_source_version: sourceVersion,
        derived_feature_count: derived.featureCount,
        derived_generated_at: new Date().toISOString(),
      })
      .eq("id", row.id)
    if (update.error) throw update.error
  } catch (rowError) {
    console.error(`error ${row.id} ${rowError instanceof Error ? rowError.message : String(rowError)}`)
    process.exitCode = 1
  }
}
