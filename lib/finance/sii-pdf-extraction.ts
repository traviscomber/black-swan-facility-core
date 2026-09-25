import { parseManualPdfMetadata, type ManualPdfMetadata } from '@/lib/finance/sii-invoice'

export type PdfFiscalExtraction = {
  metadata: ManualPdfMetadata | null
  draft: Record<string, unknown>
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
  if (normalized.includes('credit') || normalized.includes('credito') || normalized.includes('crédito')) return 'credit_note'
  if (normalized.includes('debit') || normalized.includes('debito') || normalized.includes('débito')) return 'debit_note'
  if (normalized.includes('invoice') || normalized.includes('factura')) return 'invoice'
  return 'other'
}

function normalizePayload(source: Record<string, unknown>) {
  return {
    supplier_name: stringValue(source.supplier_name),
    supplier_rut: stringValue(source.supplier_rut),
    document_number: stringValue(source.document_number),
    document_date: stringValue(source.document_date),
    due_date: stringValue(source.due_date),
    document_type: mapDocumentType(source.document_type),
    net_amount: numberValue(source.net_amount),
    tax_amount: numberValue(source.tax_amount),
    total_amount: numberValue(source.total_amount),
    currency: stringValue(source.currency)?.toUpperCase() ?? 'CLP',
  }
}

function outputText(payload: Record<string, unknown>) {
  if (typeof payload.output_text === 'string' && payload.output_text.trim()) return payload.output_text.trim()

  const output = Array.isArray(payload.output) ? payload.output : []
  for (const item of output) {
    if (!item || typeof item !== 'object') continue
    const content = Array.isArray((item as Record<string, unknown>).content)
      ? (item as Record<string, unknown>).content as unknown[]
      : []

    for (const part of content) {
      if (!part || typeof part !== 'object') continue
      const record = part as Record<string, unknown>
      if (record.type === 'output_text' && typeof record.text === 'string' && record.text.trim()) {
        return record.text.trim()
      }
    }
  }

  return null
}

export async function extractSiiPdfFiscalMetadata(
  bytes: Buffer,
  filename: string,
): Promise<PdfFiscalExtraction> {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    console.error('[sii-pdf-extraction] OPENAI_API_KEY missing')
    return {
      metadata: null,
      draft: {},
      confidence: null,
      raw: {},
      reason: 'openai_api_key_missing',
    }
  }

  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: {
      authorization: `Bearer ${apiKey}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: process.env.OPENAI_OCR_MODEL || 'gpt-4o-mini',
      input: [{
        role: 'user',
        content: [
          {
            type: 'input_file',
            filename,
            file_data: `data:application/pdf;base64,${bytes.toString('base64')}`,
          },
          {
            type: 'input_text',
            text: [
              'OCR fiscal de una factura chilena.',
              'Lee solo información visible en el PDF.',
              'No inventes, no completes por contexto y no uses placeholders.',
              'supplier_name y supplier_rut son los datos del emisor/proveedor.',
              'document_number es el folio SII.',
              'document_date y due_date deben ser YYYY-MM-DD.',
              'net_amount, tax_amount y total_amount deben ser números sin separadores de miles.',
              'currency debe ser CLP salvo que el documento muestre explícitamente otra moneda.',
              'confidence debe estar entre 0 y 1.',
            ].join(' '),
          },
        ],
      }],
      text: {
        format: {
          type: 'json_schema',
          name: 'chilean_invoice_ocr',
          strict: true,
          schema: {
            type: 'object',
            additionalProperties: false,
            required: [
              'supplier_name',
              'supplier_rut',
              'document_number',
              'document_date',
              'due_date',
              'document_type',
              'net_amount',
              'tax_amount',
              'total_amount',
              'currency',
              'confidence',
            ],
            properties: {
              supplier_name: { anyOf: [{ type: 'string' }, { type: 'null' }] },
              supplier_rut: { anyOf: [{ type: 'string' }, { type: 'null' }] },
              document_number: { anyOf: [{ type: 'string' }, { type: 'null' }] },
              document_date: { anyOf: [{ type: 'string' }, { type: 'null' }] },
              due_date: { anyOf: [{ type: 'string' }, { type: 'null' }] },
              document_type: {
                type: 'string',
                enum: ['invoice', 'credit_note', 'debit_note', 'other'],
              },
              net_amount: { anyOf: [{ type: 'number' }, { type: 'null' }] },
              tax_amount: { anyOf: [{ type: 'number' }, { type: 'null' }] },
              total_amount: { anyOf: [{ type: 'number' }, { type: 'null' }] },
              currency: { anyOf: [{ type: 'string' }, { type: 'null' }] },
              confidence: { type: 'number', minimum: 0, maximum: 1 },
            },
          },
        },
      },
      max_output_tokens: 600,
    }),
  })

  if (!response.ok) {
    const detail = await response.text()
    throw new Error(`OpenAI OCR failed (${response.status}): ${detail.slice(0, 300)}`)
  }

  const raw = await response.json() as Record<string, unknown>
  console.info('[sii-pdf-extraction] OpenAI response received', { filename, status: response.status })
  const text = outputText(raw)
  if (!text) {
    return {
      metadata: null,
      draft: {},
      confidence: null,
      raw,
      reason: 'openai_ocr_empty',
    }
  }

  let parsed: Record<string, unknown>
  try {
    parsed = JSON.parse(text) as Record<string, unknown>
  } catch {
    return {
      metadata: null,
      draft: {},
      confidence: null,
      raw,
      reason: 'openai_ocr_invalid_json',
    }
  }

  const normalized = normalizePayload(parsed)
  const metadata = parseManualPdfMetadata(normalized)
  console.info('[sii-pdf-extraction] OCR parsed', { filename, complete: Boolean(metadata), fields: Object.entries(normalized).filter(([, value]) => value !== null && value !== '').map(([key]) => key) })
  const confidenceRaw = parsed.confidence
  const confidence = typeof confidenceRaw === 'number' && Number.isFinite(confidenceRaw)
    ? Math.max(0, Math.min(1, confidenceRaw))
    : null

  return {
    metadata,
    draft: normalized,
    confidence,
    raw: { provider: 'openai_direct', extraction: parsed },
    reason: metadata ? undefined : 'required_fiscal_fields_missing',
  }
}
