import { parseManualPdfMetadata, type ManualPdfMetadata } from '@/lib/finance/sii-invoice'

export type PdfFiscalExtraction = {
  metadata: ManualPdfMetadata | null
  confidence: number | null
  raw: Record<string, unknown>
  reason?: string
}

function stringValue(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

function numberValue(value: unknown) {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && value.trim()) {
    const normalized = value.replace(/\./g, '').replace(',', '.').replace(/[^0-9.-]/g, '')
    const parsed = Number(normalized)
    return Number.isFinite(parsed) ? parsed : null
  }
  return null
}

function mapDocumentType(value: unknown): ManualPdfMetadata['document_type'] {
  const normalized = String(value ?? '').toLowerCase()
  if (normalized.includes('credit')) return 'credit_note'
  if (normalized.includes('debit')) return 'debit_note'
  if (normalized.includes('invoice') || normalized.includes('factura')) return 'invoice'
  return 'other'
}

function normalizePayload(payload: Record<string, unknown>) {
  const source = payload.data && typeof payload.data === 'object'
    ? payload.data as Record<string, unknown>
    : payload

  const nested = source.raw_extraction && typeof source.raw_extraction === 'object'
    ? source.raw_extraction as Record<string, unknown>
    : source

  return {
    supplier_name: stringValue(nested.supplier_name ?? nested.issuer_name ?? nested.emitter_name),
    supplier_rut: stringValue(nested.supplier_rut ?? nested.issuer_rut ?? nested.emitter_rut),
    document_number: stringValue(nested.document_number ?? source.proposed_document_number ?? nested.folio),
    document_date: stringValue(nested.document_date ?? source.proposed_document_date ?? nested.issue_date),
    due_date: stringValue(nested.due_date ?? source.proposed_due_date),
    document_type: mapDocumentType(nested.document_type ?? source.proposed_document_type),
    net_amount: numberValue(nested.net_amount ?? source.proposed_net_amount),
    tax_amount: numberValue(nested.tax_amount ?? source.proposed_tax_amount ?? nested.iva),
    total_amount: numberValue(nested.total_amount ?? source.proposed_total_amount),
    currency: stringValue(nested.currency ?? source.proposed_currency)?.toUpperCase() ?? 'CLP',
  }
}

export async function extractSiiPdfFiscalMetadata(
  bytes: Buffer,
  filename: string,
): Promise<PdfFiscalExtraction> {
  const endpoint = process.env.DOCUMENT_AI_ENDPOINT
  if (!endpoint) return { metadata: null, confidence: null, raw: {}, reason: 'document_ai_not_configured' }

  const token = process.env.DOCUMENT_AI_TOKEN
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({
      task: 'black_swan_sii_invoice_extraction',
      schema_version: '1',
      file: {
        name: filename,
        content_type: 'application/pdf',
        base64: bytes.toString('base64'),
      },
      schema: {
        supplier_name: 'string',
        supplier_rut: 'string Chilean RUT',
        document_number: 'string folio',
        document_date: 'YYYY-MM-DD',
        due_date: 'YYYY-MM-DD|null',
        document_type: 'invoice|credit_note|debit_note|other',
        net_amount: 'number|null',
        tax_amount: 'number|null',
        total_amount: 'number',
        currency: 'ISO-4217, default CLP',
      },
      rules: [
        'Extract only values visible in the source document.',
        'Never infer or invent a missing fiscal value.',
        'For Chilean invoices, issuer/emitter data is the supplier.',
        'Return null for unreadable optional values.',
      ],
    }),
  })

  if (!response.ok) {
    const detail = await response.text()
    throw new Error(`Document AI failed (${response.status}): ${detail.slice(0, 300)}`)
  }

  const payload = await response.json() as Record<string, unknown>
  const normalized = normalizePayload(payload)
  const metadata = parseManualPdfMetadata(normalized)
  const confidenceRaw = payload.confidence ?? (payload.data && typeof payload.data === 'object' ? (payload.data as Record<string, unknown>).confidence : null)
  const confidence = typeof confidenceRaw === 'number' && Number.isFinite(confidenceRaw)
    ? Math.max(0, Math.min(1, confidenceRaw))
    : null

  return {
    metadata,
    confidence,
    raw: payload,
    reason: metadata ? undefined : 'required_fiscal_fields_missing',
  }
}
