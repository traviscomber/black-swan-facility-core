import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

const FAO_ICC_CSV = "https://storage.googleapis.com/fao-datalab-caliper/Downloads/ICCv1.1/ICC11-core.csv"
const SOURCE_PAGE = "https://www.fao.org/statistics/caliper/tools/download/en"

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
    const response = await fetch(FAO_ICC_CSV, { next: { revalidate: 86400 } })
    if (!response.ok) return NextResponse.json({ error: `FAO catalog unavailable (${response.status})` }, { status: 502 })
    const rows = parseCsv(await response.text())
    if (rows.length < 2) return NextResponse.json({ error: "FAO catalog returned no rows" }, { status: 502 })

    const headers = rows[0].map(normalizeHeader)
    const codeIndex = pickIndex(headers, ["code", "icc_code", "item_code"], ["code"])
    const nameIndex = pickIndex(headers, ["title_en", "label_en", "name_en", "title", "label", "name"], ["title", "label", "name"])
    const categoryIndex = pickIndex(headers, ["parent_title_en", "group_title_en", "class_title_en", "category"], ["parent", "group", "class", "category"])
    if (nameIndex < 0) return NextResponse.json({ error: "FAO catalog schema changed", headers }, { status: 502 })

    const items = rows.slice(1)
      .map((row, index) => ({
        externalId: (codeIndex >= 0 ? row[codeIndex] : "") || `icc-row-${index + 1}`,
        name: row[nameIndex] || "",
        category: categoryIndex >= 0 ? row[categoryIndex] || null : null,
      }))
      .filter((item) => item.name && (!query || `${item.name} ${item.category ?? ""} ${item.externalId}`.toLowerCase().includes(query)))
      .slice(0, limit)

    return NextResponse.json({
      source: { name: "FAO ICC 1.1", publisher: "Food and Agriculture Organization of the United Nations", sourcePage: SOURCE_PAGE, datasetUrl: FAO_ICC_CSV },
      totalRows: Math.max(0, rows.length - 1),
      items,
    })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not load FAO crop catalog" }, { status: 502 })
  }
}
