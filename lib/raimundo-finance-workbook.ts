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
  due_date?: string | null
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
  source_sheet?: string | null
  source_row: number
  reported_type?: string | null
}
export type RaimundoPaidObservation = {
  supplier_name: string
  supplier_rut: string | null
  document_number: string
  document_date: string
  description: string | null
  total_amount: number
  historical_cost_center: string | null
  source_sheet: string
  source_row: number
  reported_type: string | null
  observed_payment_date: string | null
}
export type RaimundoFinancePreview = {
  format: 'canonical' | 'operational_report'
  workbookHash: string
  centers: RaimundoCenter[]
  rules: RaimundoRule[]
  documents: RaimundoDocument[]
  paidObservations: RaimundoPaidObservation[]
  counts: {
    ready: number
    exception: number
    manual_review: number
    paid_observed: number
    pending_observed: number
  }
}

const canonicalSheets = ['APROBACION RAIMUNDO', 'REGLAS RECURRENTES', 'CATALOGO CENTROS COSTO', 'CRITERIO CANONICO']
const pendingReportSheet = 'PENDIENTE AGRICOLA(LISTADO)'

function value(sheet: XLSX.WorkSheet, row: number, col: number) {
  return sheet[XLSX.utils.encode_cell({ r: row - 1, c: col - 1 })]?.v
}
function n(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null
  const parsed = Number(v)
  return Number.isFinite(parsed) ? parsed : null
}
function text(v: unknown) { return v == null ? null : String(v).trim() || null }
function isoDate(v: unknown): string {
  if (v instanceof Date) return v.toISOString().slice(0, 10)
  if (typeof v === 'number') {
    const d = XLSX.SSF.parse_date_code(v)
    if (d) return `${d.y}-${String(d.m).padStart(2, '0')}-${String(d.d).padStart(2, '0')}`
  }
  const d = new Date(String(v ?? ''))
  if (Number.isNaN(d.getTime())) throw new Error(`Fecha inválida en workbook: ${String(v)}`)
  return d.toISOString().slice(0, 10)
}
function optionalIsoDate(v: unknown): string | null {
  if (v == null || v === '') return null
  try { return isoDate(v) } catch { return null }
}
async function sha256(buffer: ArrayBuffer) {
  const digest = await crypto.subtle.digest('SHA-256', buffer)
  return Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, '0')).join('')
}
function rutFromSupplier(raw: string) {
  return raw.match(/^([0-9.\-Kk]+)\s+/)?.[1] ?? null
}
function normalizeHeader(v: unknown) {
  return (text(v) ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, ' ')
    .trim()
}
function compactIdentity(v: string | null | undefined) {
  return (v ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().replace(/[^A-Z0-9]+/g, '')
}
function dueDateFromNote(v: unknown) {
  const raw = text(v)
  if (!raw) return null
  const match = raw.match(/(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})/)
  if (!match) return null
  const year = Number(match[3]) < 100 ? 2000 + Number(match[3]) : Number(match[3])
  return `${year}-${String(Number(match[2])).padStart(2, '0')}-${String(Number(match[1])).padStart(2, '0')}`
}
function isCenterLabel(v: unknown) {
  const raw = text(v)
  return Boolean(raw && /^\([^)]+\)\s+/.test(raw))
}
function paidSheetNames(wb: XLSX.WorkBook) {
  return wb.SheetNames.filter((name) => /^PAGADO\s+/i.test(name))
}

function parseCanonicalWorkbook(wb: XLSX.WorkBook, workbookHash: string): RaimundoFinancePreview {
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
  const statusMap: Record<string, RaimundoDocument['classification_status']> = {
    'LISTA PARA APROBAR': 'ready',
    'REVISAR EXCEPCION': 'exception',
    'REVISION MANUAL': 'manual_review',
  }
  const documents: RaimundoDocument[] = []
  for (let r = 6; r <= approvalRange.e.r + 1; r += 1) {
    const sourceStatus = text(value(approvalSheet, r, 1))
    if (!sourceStatus || !statusMap[sourceStatus]) continue
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
      classification_status: statusMap[sourceStatus],
      historical_count: Math.trunc(n(value(approvalSheet, r, 9)) ?? 0),
      historical_dominance: n(value(approvalSheet, r, 10)),
      accepted_min: n(value(approvalSheet, r, 11)),
      accepted_max: n(value(approvalSheet, r, 12)),
      classification_reason: text(value(approvalSheet, r, 13)),
      decision_source: text(value(approvalSheet, r, 14)),
      historical_cost_center: text(value(approvalSheet, r, 2)),
      confidence_label: text(value(approvalSheet, r, 8)),
      source_sheet: 'APROBACION RAIMUNDO',
      source_row: r,
    })
  }

  return {
    format: 'canonical',
    workbookHash,
    centers,
    rules,
    documents,
    paidObservations: [],
    counts: {
      ready: documents.filter(d => d.classification_status === 'ready').length,
      exception: documents.filter(d => d.classification_status === 'exception').length,
      manual_review: documents.filter(d => d.classification_status === 'manual_review').length,
      paid_observed: 0,
      pending_observed: documents.length,
    },
  }
}

function parseOperationalReport(wb: XLSX.WorkBook, workbookHash: string): RaimundoFinancePreview {
  const pendingSheet = wb.Sheets[pendingReportSheet]
  if (!pendingSheet) throw new Error(`Falta la hoja “${pendingReportSheet}”.`)

  const pendingRange = XLSX.utils.decode_range(pendingSheet['!ref'] ?? 'A1:H1')
  const documents: RaimundoDocument[] = []
  const centerFrequency = new Map<string, number>()

  for (let r = 2; r <= pendingRange.e.r + 1; r += 1) {
    const center = text(value(pendingSheet, r, 1))
    const supplier = text(value(pendingSheet, r, 2))
    const documentNumber = text(value(pendingSheet, r, 3))
    const dateValue = value(pendingSheet, r, 4)
    const total = n(value(pendingSheet, r, 6))
    if (!center || !supplier || !documentNumber || dateValue == null || total == null) continue

    const documentDate = isoDate(dateValue)
    const supplierRut = rutFromSupplier(supplier)
    const reportedType = text(value(pendingSheet, r, 7))
    centerFrequency.set(center, (centerFrequency.get(center) ?? 0) + 1)
    documents.push({
      external_id: `raimundo-report:${compactIdentity(supplierRut ?? supplier)}:${compactIdentity(documentNumber)}:${documentDate}:${Math.round(total * 100)}`,
      supplier_name: supplier,
      supplier_rut: supplierRut,
      document_number: documentNumber,
      document_date: documentDate,
      due_date: dueDateFromNote(value(pendingSheet, r, 8)),
      description: text(value(pendingSheet, r, 5)),
      total_amount: total,
      classification_status: 'manual_review',
      historical_count: 0,
      historical_dominance: null,
      accepted_min: null,
      accepted_max: null,
      classification_reason: 'Pendiente observado en informe operacional; el centro histórico se confirma contra el mapeo canónico vigente.',
      decision_source: 'operational_reconciliation_report',
      historical_cost_center: center,
      confidence_label: null,
      source_sheet: pendingReportSheet,
      source_row: r,
      reported_type: reportedType,
    })
  }

  const paidObservations: RaimundoPaidObservation[] = []
  for (const sheetName of paidSheetNames(wb)) {
    const sheet = wb.Sheets[sheetName]
    const range = XLSX.utils.decode_range(sheet['!ref'] ?? 'A1:K1')
    let currentCenter: string | null = null
    let header: Record<string, number> | null = null

    for (let r = 1; r <= range.e.r + 1; r += 1) {
      const first = value(sheet, r, 1)
      if (isCenterLabel(first) && !text(value(sheet, r, 2))) {
        currentCenter = text(first)
        header = null
        continue
      }

      const normalized = Array.from({ length: range.e.c + 1 }, (_, c) => normalizeHeader(value(sheet, r, c + 1)))
      const providerIndex = normalized.findIndex((v) => v === 'PROVEEDOR')
      const docIndex = normalized.findIndex((v) => v === 'DOC')
      const dateIndex = normalized.findIndex((v) => v === 'FECHA')
      const totalIndex = normalized.findIndex((v) => v === 'TOTAL')
      if (providerIndex >= 0 && docIndex >= 0 && dateIndex >= 0 && totalIndex >= 0) {
        header = {
          provider: providerIndex + 1,
          doc: docIndex + 1,
          date: dateIndex + 1,
          detail: normalized.findIndex((v) => v === 'DETALLE') + 1,
          total: totalIndex + 1,
          type: normalized.findIndex((v) => v === 'TIPO') + 1,
          paidAt: normalized.findIndex((v) => v === 'FECHA PAGO') + 1,
        }
        continue
      }
      if (!header) continue

      const supplier = text(value(sheet, r, header.provider))
      const documentNumber = text(value(sheet, r, header.doc))
      const dateValue = value(sheet, r, header.date)
      const total = n(value(sheet, r, header.total))
      if (!supplier || !documentNumber || dateValue == null || total == null) continue

      const documentDate = optionalIsoDate(dateValue)
      if (!documentDate) continue
      const reportedType = header.type > 0 ? text(value(sheet, r, header.type)) : null
      const observedPaymentDate = header.paidAt > 0 ? optionalIsoDate(value(sheet, r, header.paidAt)) : null
      const normalizedType = normalizeHeader(reportedType)
      if (!observedPaymentDate && !/PAGADO|RENDICION/.test(normalizedType)) continue

      paidObservations.push({
        supplier_name: supplier,
        supplier_rut: rutFromSupplier(supplier),
        document_number: documentNumber,
        document_date: documentDate,
        description: header.detail > 0 ? text(value(sheet, r, header.detail)) : null,
        total_amount: total,
        historical_cost_center: currentCenter,
        source_sheet: sheetName,
        source_row: r,
        reported_type: reportedType,
        observed_payment_date: observedPaymentDate,
      })
    }
  }

  const centers = Array.from(centerFrequency.entries())
    .map(([label, header_frequency]) => ({ label, header_frequency }))
    .sort((a, b) => b.header_frequency - a.header_frequency || a.label.localeCompare(b.label, 'es'))

  return {
    format: 'operational_report',
    workbookHash,
    centers,
    rules: [],
    documents,
    paidObservations,
    counts: {
      ready: 0,
      exception: 0,
      manual_review: documents.length,
      paid_observed: paidObservations.length,
      pending_observed: documents.length,
    },
  }
}

export async function parseRaimundoFinanceWorkbook(buffer: ArrayBuffer): Promise<RaimundoFinancePreview> {
  const wb = XLSX.read(buffer, { type: 'array', cellDates: true })
  const workbookHash = await sha256(buffer)
  const isCanonical = canonicalSheets.every((sheet) => wb.SheetNames.includes(sheet))
  if (isCanonical) return parseCanonicalWorkbook(wb, workbookHash)
  if (wb.SheetNames.includes(pendingReportSheet)) return parseOperationalReport(wb, workbookHash)
  throw new Error('Formato no reconocido. Usa el workbook canónico o el INFORME operacional con la hoja PENDIENTE AGRICOLA(LISTADO).')
}
