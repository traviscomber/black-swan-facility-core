import * as XLSX from 'xlsx'

export type RaimundoCenter = { label: string; header_frequency: number }
export type RaimundoRule = {
  supplier_key: string
  supplier_name: string
  historical_cost_center: string
  historical_count: number
  match_count: number
  dominance: number | null
  median_clp: number | null
  accepted_min_clp: number | null
  accepted_max_clp: number | null
  confidence_label: string | null
  treatment: string | null
  historical_alternatives: string | null
}
export type RaimundoDocument = {
  external_id: string
  supplier_name: string
  supplier_rut: string | null
  document_number: string
  document_date: string
  description: string | null
  total_amount: number
  classification_status: 'ready' | 'exception' | 'manual_review'
  historical_count: number
  historical_dominance: number | null
  accepted_min: number | null
  accepted_max: number | null
  classification_reason: string | null
  decision_source: string | null
  historical_cost_center: string | null
  confidence_label: string | null
  source_row: number
}
export type RaimundoFinancePreview = {
  workbookHash: string
  centers: RaimundoCenter[]
  rules: RaimundoRule[]
  documents: RaimundoDocument[]
  counts: { ready: number; exception: number; manual_review: number }
}

const requiredSheets = ['APROBACION RAIMUNDO', 'REGLAS RECURRENTES', 'CATALOGO CENTROS COSTO', 'CRITERIO CANONICO']

function value(sheet: XLSX.WorkSheet, row: number, col: number) {
  return sheet[XLSX.utils.encode_cell({ r: row - 1, c: col - 1 })]?.v
}
function n(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null
  const parsed = Number(v)
  return Number.isFinite(parsed) ? parsed : null
}
function text(v: unknown) { return v == null ? null : String(v).trim() || null }
function isoDate(v: unknown) {
  if (v instanceof Date) return v.toISOString().slice(0, 10)
  if (typeof v === 'number') {
    const d = XLSX.SSF.parse_date_code(v)
    if (d) return `${d.y}-${String(d.m).padStart(2, '0')}-${String(d.d).padStart(2, '0')}`
  }
  const d = new Date(String(v ?? ''))
  if (Number.isNaN(d.getTime())) throw new Error(`Fecha inválida en workbook: ${String(v)}`)
  return d.toISOString().slice(0, 10)
}
async function sha256(buffer: ArrayBuffer) {
  const digest = await crypto.subtle.digest('SHA-256', buffer)
  return Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, '0')).join('')
}
function rutFromSupplier(raw: string) {
  return raw.match(/^([0-9.\-Kk]+)\s+/)?.[1] ?? null
}

export async function parseRaimundoFinanceWorkbook(buffer: ArrayBuffer): Promise<RaimundoFinancePreview> {
  const wb = XLSX.read(buffer, { type: 'array', cellDates: true })
  for (const sheet of requiredSheets) if (!wb.SheetNames.includes(sheet)) throw new Error(`Falta la hoja canónica “${sheet}”.`)
  const workbookHash = await sha256(buffer)

  const centersSheet = wb.Sheets['CATALOGO CENTROS COSTO']
  const centerRange = XLSX.utils.decode_range(centersSheet['!ref'] ?? 'A1:B1')
  const centers: RaimundoCenter[] = []
  for (let r = 2; r <= centerRange.e.r + 1; r += 1) {
    const label = text(value(centersSheet, r, 1))
    if (!label) continue
    centers.push({ label, header_frequency: Math.trunc(n(value(centersSheet, r, 2)) ?? 0) })
  }

  const ruleSheet = wb.Sheets['REGLAS RECURRENTES']
  const ruleRange = XLSX.utils.decode_range(ruleSheet['!ref'] ?? 'A1:L1')
  const rules: RaimundoRule[] = []
  for (let r = 2; r <= ruleRange.e.r + 1; r += 1) {
    const supplierKey = text(value(ruleSheet, r, 1))
    const supplierName = text(value(ruleSheet, r, 2))
    const center = text(value(ruleSheet, r, 3))
    if (!supplierKey || !supplierName || !center) continue
    rules.push({
      supplier_key: supplierKey,
      supplier_name: supplierName,
      historical_cost_center: center,
      historical_count: Math.trunc(n(value(ruleSheet, r, 4)) ?? 0),
      match_count: Math.trunc(n(value(ruleSheet, r, 5)) ?? 0),
      dominance: n(value(ruleSheet, r, 6)),
      median_clp: n(value(ruleSheet, r, 7)),
      accepted_min_clp: n(value(ruleSheet, r, 8)),
      accepted_max_clp: n(value(ruleSheet, r, 9)),
      confidence_label: text(value(ruleSheet, r, 10)),
      treatment: text(value(ruleSheet, r, 11)),
      historical_alternatives: text(value(ruleSheet, r, 12)),
    })
  }

  const approvalSheet = wb.Sheets['APROBACION RAIMUNDO']
  const approvalRange = XLSX.utils.decode_range(approvalSheet['!ref'] ?? 'A1:Q1')
  const map: Record<string, RaimundoDocument['classification_status']> = {
    'LISTA PARA APROBAR': 'ready',
    'REVISAR EXCEPCION': 'exception',
    'REVISION MANUAL': 'manual_review',
  }
  const documents: RaimundoDocument[] = []
  for (let r = 6; r <= approvalRange.e.r + 1; r += 1) {
    const sourceStatus = text(value(approvalSheet, r, 1))
    if (!sourceStatus || !map[sourceStatus]) continue
    const supplier = text(value(approvalSheet, r, 3)) ?? 'Proveedor sin nombre'
    const documentNumber = text(value(approvalSheet, r, 4)) ?? `ROW-${r}`
    const documentDate = isoDate(value(approvalSheet, r, 5))
    const supplierRut = rutFromSupplier(supplier)
    documents.push({
      external_id: `raimundo:${r}:${supplierRut ?? supplier}:${documentNumber}:${documentDate}`,
      supplier_name: supplier,
      supplier_rut: supplierRut,
      document_number: documentNumber,
      document_date: documentDate,
      description: text(value(approvalSheet, r, 6)),
      total_amount: n(value(approvalSheet, r, 7)) ?? 0,
      classification_status: map[sourceStatus],
      historical_count: Math.trunc(n(value(approvalSheet, r, 9)) ?? 0),
      historical_dominance: n(value(approvalSheet, r, 10)),
      accepted_min: n(value(approvalSheet, r, 11)),
      accepted_max: n(value(approvalSheet, r, 12)),
      classification_reason: text(value(approvalSheet, r, 13)),
      decision_source: text(value(approvalSheet, r, 14)),
      historical_cost_center: text(value(approvalSheet, r, 2)),
      confidence_label: text(value(approvalSheet, r, 8)),
      source_row: r,
    })
  }

  const counts = {
    ready: documents.filter(d => d.classification_status === 'ready').length,
    exception: documents.filter(d => d.classification_status === 'exception').length,
    manual_review: documents.filter(d => d.classification_status === 'manual_review').length,
  }
  return { workbookHash, centers, rules, documents, counts }
}
