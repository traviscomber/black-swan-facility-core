import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

const FAO_WCA_CSV = "https://stats.fao.org/caliper/download/WCA2020Crops/WCACROPS-core.csv"
const SOURCE_PAGE = "https://www.fao.org/statistics/caliper/classifications/wca/en"

function parseCsv(input: string) {
  const rows: string[][] = []
  let row: string[] = []
  let field = ""
  let quoted = false
  for (let i = 0; i < input.length; i += 1) {
    const char = input[i]
    if (char === '"') {
      if (quoted && input[i + 1] === '"') { field += '"'; i += 1 } else quoted = !quoted
    } else if (char === "," && !quoted) {
      row.push(field.trim()); field = ""
    } else if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && input[i + 1] === "\n") i += 1
      row.push(field.trim()); field = ""
      if (row.some(Boolean)) rows.push(row)
      row = []
    } else field += char
  }
  if (field || row.length) { row.push(field.trim()); if (row.some(Boolean)) rows.push(row) }
  return rows
}

function normalizeHeader(value: string) { return value.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "") }
function pickIndex(headers: string[], exact: string[], contains: string[]) {
  for (const candidate of exact) { const i = headers.indexOf(candidate); if (i >= 0) return i }
  for (const candidate of contains) { const i = headers.findIndex((header) => header.includes(candidate)); if (i >= 0) return i }
  return -1
}

export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: authData } = await supabase.auth.getUser()
  if (!authData.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const url = new URL(request.url)
  const query = (url.searchParams.get("q") ?? "").trim().toLowerCase()
  const requestedLimit = Number(url.searchParams.get("limit") ?? 80)
  const limit = Number.isFinite(requestedLimit) ? Math.max(1, Math.min(150, requestedLimit)) : 80

  try {
    const response = await fetch(FAO_WCA_CSV, { next: { revalidate: 86400 } })
    if (!response.ok) return NextResponse.json({ error: `FAO crop list unavailable (${response.status})` }, { status: 502 })
    const rows = parseCsv(await response.text())
    if (rows.length < 2) return NextResponse.json({ error: "FAO crop list returned no rows" }, { status: 502 })

    const headers = rows[0].map(normalizeHeader)
    const codeIndex = pickIndex(headers, ["code", "notation", "item_code"], ["code", "notation"])
    const commonNameIndex = pickIndex(headers, ["title_en", "label_en", "name_en", "common_name", "vernacular_name", "title", "label", "name"], ["vernacular", "common", "title_en", "label_en", "name_en"])
    const scientificNameIndex = pickIndex(headers, ["scientific_name", "scientificname", "dwc_scientificname"], ["scientific"])
    const iccIndex = pickIndex(headers, ["icc_1_1_code", "icc11_code", "icc_code"], ["icc_1_1", "icc11"])
    if (commonNameIndex < 0) return NextResponse.json({ error: "FAO WCA crop-list schema changed", headers }, { status: 502 })

    const seen = new Set<string>()
    const allItems = rows.slice(1).flatMap((row, index) => {
      const name = (row[commonNameIndex] ?? "").trim()
      if (!name) return []
      const key = name.toLowerCase()
      if (seen.has(key)) return []
      seen.add(key)
      const scientificName = scientificNameIndex >= 0 ? (row[scientificNameIndex] ?? "").trim() || null : null
      const iccCode = iccIndex >= 0 ? (row[iccIndex] ?? "").trim() || null : null
      return [{
        externalId: (codeIndex >= 0 ? (row[codeIndex] ?? "").trim() : "") || `wca-${index + 1}`,
        name,
        scientificName,
        iccCode,
      }]
    })
    const items = allItems
      .filter((item) => !query || `${item.name} ${item.scientificName ?? ""} ${item.iccCode ?? ""} ${item.externalId}`.toLowerCase().includes(query))
      .slice(0, limit)

    return NextResponse.json({
      source: { name: "FAO WCA 2020 Crop List", publisher: "Food and Agriculture Organization of the United Nations", sourcePage: SOURCE_PAGE, datasetUrl: FAO_WCA_CSV },
      totalRows: allItems.length,
      items,
    })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not load FAO crop list" }, { status: 502 })
  }
}
