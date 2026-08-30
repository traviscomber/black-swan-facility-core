import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

const FAO_WCA_CSV = "https://stats.fao.org/caliper/download/WCA2020Crops/WCACROPS-core.csv"
const SOURCE_PAGE = "https://www.fao.org/statistics/caliper/classifications/wca/en"

const SEARCH_ALIASES: Record<string, string[]> = {
  manzana: ["apple", "apples", "malus"],
  manzanas: ["apple", "apples", "malus"],
  apfel: ["apple", "apples", "malus"],
  pera: ["pear", "pears", "pyrus"],
  peras: ["pear", "pears", "pyrus"],
  birne: ["pear", "pears", "pyrus"],
  birnen: ["pear", "pears", "pyrus"],
  tomate: ["tomato", "tomatoes", "solanum lycopersicum"],
  tomates: ["tomato", "tomatoes", "solanum lycopersicum"],
  papa: ["potato", "potatoes", "solanum tuberosum"],
  papas: ["potato", "potatoes", "solanum tuberosum"],
  patata: ["potato", "potatoes", "solanum tuberosum"],
  kartoffel: ["potato", "potatoes", "solanum tuberosum"],
  kartoffeln: ["potato", "potatoes", "solanum tuberosum"],
  cebolla: ["onion", "onions", "allium cepa"],
  cebollas: ["onion", "onions", "allium cepa"],
  zwiebel: ["onion", "onions", "allium cepa"],
  zwiebeln: ["onion", "onions", "allium cepa"],
  zanahoria: ["carrot", "carrots", "daucus carota"],
  zanahorias: ["carrot", "carrots", "daucus carota"],
  karotte: ["carrot", "carrots", "daucus carota"],
  karotten: ["carrot", "carrots", "daucus carota"],
  mohre: ["carrot", "carrots", "daucus carota"],
  mohren: ["carrot", "carrots", "daucus carota"],
  lechuga: ["lettuce", "lettuces", "lactuca sativa"],
  salat: ["lettuce", "lettuces", "lactuca sativa"],
  espinaca: ["spinach", "spinaches", "spinacia oleracea"],
  spinat: ["spinach", "spinaches", "spinacia oleracea"],
  albahaca: ["basil", "ocimum basilicum"],
  basilikum: ["basil", "ocimum basilicum"],
  perejil: ["parsley", "petroselinum crispum"],
  petersilie: ["parsley", "petroselinum crispum"],
  rucula: ["arugula", "rocket", "eruca vesicaria"],
  rucola: ["arugula", "rocket", "eruca vesicaria"],
  rabano: ["radish", "radishes", "raphanus sativus"],
  radieschen: ["radish", "radishes", "raphanus sativus"],
  rettich: ["radish", "radishes", "raphanus sativus"],
  betarraga: ["beet", "beetroot", "beta vulgaris"],
  remolacha: ["beet", "beetroot", "beta vulgaris"],
  rotebete: ["beet", "beetroot", "beta vulgaris"],
  "rote bete": ["beet", "beetroot", "beta vulgaris"],
  pimenton: ["pepper", "peppers", "capsicum"],
  paprika: ["pepper", "peppers", "capsicum"],
  frutilla: ["strawberry", "strawberries", "fragaria"],
  fresa: ["strawberry", "strawberries", "fragaria"],
  erdbeere: ["strawberry", "strawberries", "fragaria"],
  erdbeeren: ["strawberry", "strawberries", "fragaria"],
  uva: ["grape", "grapes", "vitis vinifera"],
  traube: ["grape", "grapes", "vitis vinifera"],
  trauben: ["grape", "grapes", "vitis vinifera"],
  durazno: ["peach", "peaches", "prunus persica"],
  melocoton: ["peach", "peaches", "prunus persica"],
  pfirsich: ["peach", "peaches", "prunus persica"],
  pfirsiche: ["peach", "peaches", "prunus persica"],
  limon: ["lemon", "lemons", "citrus limon"],
  zitrone: ["lemon", "lemons", "citrus limon"],
  zitronen: ["lemon", "lemons", "citrus limon"],
  naranja: ["orange", "oranges", "citrus sinensis"],
  orange: ["orange", "oranges", "citrus sinensis"],
  orangen: ["orange", "oranges", "citrus sinensis"],
  palta: ["avocado", "avocados", "persea americana"],
  aguacate: ["avocado", "avocados", "persea americana"],
  avocado: ["avocado", "avocados", "persea americana"],
  avocados: ["avocado", "avocados", "persea americana"],
  maiz: ["maize", "corn", "zea mays"],
  mais: ["maize", "corn", "zea mays"],
  trigo: ["wheat", "triticum"],
  weizen: ["wheat", "triticum"],
  arroz: ["rice", "oryza sativa"],
  reis: ["rice", "oryza sativa"],
  poroto: ["bean", "beans", "phaseolus"],
  porotos: ["bean", "beans", "phaseolus"],
  frejol: ["bean", "beans", "phaseolus"],
  frijol: ["bean", "beans", "phaseolus"],
  bohne: ["bean", "beans", "phaseolus"],
  bohnen: ["bean", "beans", "phaseolus"],
  arveja: ["pea", "peas", "pisum sativum"],
  erbse: ["pea", "peas", "pisum sativum"],
  erbsen: ["pea", "peas", "pisum sativum"],
  zapallo: ["squash", "pumpkin", "cucurbita"],
  kurbis: ["squash", "pumpkin", "cucurbita"],
  pepino: ["cucumber", "cucumis sativus"],
  gurke: ["cucumber", "cucumis sativus"],
  gurken: ["cucumber", "cucumis sativus"],
}

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
function normalizeSearch(value: string) { return value.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "") }
function queryTerms(value: string) {
  const normalized = normalizeSearch(value)
  if (!normalized) return []
  return Array.from(new Set([normalized, ...(SEARCH_ALIASES[normalized] ?? [])].map(normalizeSearch)))
}
function pickIndex(headers: string[], exact: string[], contains: string[]) {
  for (const candidate of exact) { const i = headers.indexOf(candidate); if (i >= 0) return i }
  for (const candidate of contains) { const i = headers.findIndex((header) => header.includes(candidate)); if (i >= 0) return i }
  return -1
}
function nameFromUri(value: string) {
  try { const last = new URL(value).pathname.split("/").filter(Boolean).pop() ?? ""; return decodeURIComponent(last).replace(/[_-]+/g, " ").trim() }
  catch { return "" }
}

export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: authData } = await supabase.auth.getUser()
  if (!authData.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const url = new URL(request.url)
  const rawQuery = url.searchParams.get("q") ?? ""
  const searchTerms = queryTerms(rawQuery)
  const requestedLimit = Number(url.searchParams.get("limit") ?? 80)
  const limit = Number.isFinite(requestedLimit) ? Math.max(1, Math.min(150, requestedLimit)) : 80

  try {
    const response = await fetch(FAO_WCA_CSV, { next: { revalidate: 86400 } })
    if (!response.ok) return NextResponse.json({ error: `FAO crop list unavailable (${response.status})` }, { status: 502 })
    const rows = parseCsv(await response.text())
    if (rows.length < 2) return NextResponse.json({ error: "FAO crop list returned no rows" }, { status: 502 })

    const headers = rows[0].map(normalizeHeader)
    const codeIndex = pickIndex(headers, ["code", "notation", "skos_notation", "item_code"], ["notation", "code"])
    const commonNameIndex = pickIndex(headers,
      ["vernacular_name", "vernacular_name_en", "alternative_label", "alternative_label_en", "alt_label", "alt_label_en", "altlabel", "altlabel_en", "skos_altlabel", "skos_altlabel_en", "common_name", "common_name_en", "title_en", "label_en", "name_en"],
      ["vernacular", "alternative_label", "alt_label", "altlabel", "common_name"])
    const scientificNameIndex = pickIndex(headers,
      ["scientific_name", "scientificname", "dwc_scientificname", "pref_label_lat", "preflabel_lat", "preferred_label_lat", "latin_label", "label_lat"],
      ["scientific", "label_lat", "latin"])
    const uriIndex = pickIndex(headers, ["uri", "concept_uri", "subject", "concept"], ["uri"])
    const iccIndex = pickIndex(headers, ["icc_1_1_code", "icc11_code", "icc_code"], ["icc_1_1", "icc11"])
    if (commonNameIndex < 0 && uriIndex < 0) return NextResponse.json({ error: "FAO WCA crop-list schema changed", headers }, { status: 502 })

    const seen = new Set<string>()
    const allItems = rows.slice(1).flatMap((row, index) => {
      const name = ((commonNameIndex >= 0 ? row[commonNameIndex] : "") || (uriIndex >= 0 ? nameFromUri(row[uriIndex] ?? "") : "")).trim()
      if (!name) return []
      const key = name.toLowerCase()
      if (seen.has(key)) return []
      seen.add(key)
      const scientificName = scientificNameIndex >= 0 ? (row[scientificNameIndex] ?? "").trim() || null : null
      const iccCode = iccIndex >= 0 ? (row[iccIndex] ?? "").trim() || null : null
      return [{ externalId: (codeIndex >= 0 ? (row[codeIndex] ?? "").trim() : "") || `wca-${index + 1}`, name, scientificName, iccCode }]
    })
    const items = allItems
      .filter((item) => {
        if (!searchTerms.length) return true
        const haystack = normalizeSearch(`${item.name} ${item.scientificName ?? ""} ${item.iccCode ?? ""} ${item.externalId}`)
        return searchTerms.some((term) => haystack.includes(term))
      })
      .slice(0, limit)

    return NextResponse.json({
      source: { name: "FAO WCA 2020 Crop List", publisher: "Food and Agriculture Organization of the United Nations", sourcePage: SOURCE_PAGE, datasetUrl: FAO_WCA_CSV },
      totalRows: allItems.length,
      items,
      search: { query: rawQuery, terms: searchTerms, languages: ["en", "es", "de"] },
    })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not load FAO crop list" }, { status: 502 })
  }
}
