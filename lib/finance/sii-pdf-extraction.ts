import { generateObject } from 'ai'
import { z } from 'zod'
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


const invoiceOcrSchema = z.object({
  supplier_name: z.string().nullable(),
  supplier_rut: z.string().nullable(),
  document_number: z.string().nullable(),
  document_date: z.string().nullable(),
  due_date: z.string().nullable(),
  document_type: z.enum(['invoice', 'credit_note', 'debit_note', 'other']),
  net_amount: z.number().nullable(),
  tax_amount: z.number().nullable(),
  total_amount: z.number().nullable(),
  currency: z.string().nullable(),
  confidence: z.number().min(0).max(1),
})

async function extractWithVercelGateway(bytes: Buffer, filename: string): Promise<PdfFiscalExtraction> {
  const { object } = await generateObject({
    model: process.env.OCR_GATEWAY_MODEL || 'openai/gpt-5.6-luna',
    schema: invoiceOcrSchema,
    messages: [{
      role: 'user',
      content: [
        {
          type: 'file',
          data: bytes,
          mediaType: 'application/pdf',
          filename,
        },
        {
          type: 'text',
          text: [
            'OCR fiscal para una factura chilena.',
            'Lee texto e imagen del PDF y devuelve solamente datos visibles.',
            'No inventes valores ni uses placeholders.',
            'supplier_name y supplier_rut corresponden al emisor/proveedor.',
            'document_number es el folio SII.',
            'Fechas en YYYY-MM-DD.',
            'Montos como números sin separadores de miles.',
            'Usa CLP salvo que el documento muestre explícitamente otra moneda.',
          ].join(' '),
        },
      ],
    }],
  })

  const payload = object as z.infer<typeof invoiceOcrSchema>
  const normalized = normalizePayload(payload as unknown as Record<string, unknown>)
  const metadata = parseManualPdfMetadata(normalized)
  return {
    metadata,
    draft: normalized,
    confidence: payload.confidence,
    raw: { provider: 'vercel_ai_gateway', extraction: payload },
    reason: metadata ? undefined : 'required_fiscal_fields_missing',
  }
}

function extractResponseText(payload: Record<string, unknown>) {
  if (typeof payload.output_text === 'string' && payload.output_text.trim()) return payload.output_text.trim()
  const output = Array.isArray(payload.output) ? payload.output : []
  for (const item of output) {
    if (!item || typeof item !== 'object') continue
    const content = Array.isArray((item as Record<string, unknown>).content) ? (item as Record<string, unknown>).content as unknown[] : []
    for (const part of content) {
      if (!part || typeof part !== 'object') continue
      const record = part as Record<string, unknown>
      if (record.type === 'output_text' && typeof record.text === 'string' && record.text.trim()) return record.text.trim()
    }
  }
  return null
}

async function extractWithOpenAi(bytes: Buffer, filename: string): Promise<PdfFiscalExtraction> {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) return { metadata: null, draft: {}, confidence: null, raw: {}, reason: 'openai_ocr_not_configured' }

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
            detail: 'high',
          },
          {
            type: 'input_text',
            text: [
              'Lee esta factura chilena como OCR fiscal.',
              'Extrae SOLO valores visibles en el PDF. No inventes ni completes por contexto.',
              'El emisor/proveedor es supplier_name y supplier_rut.',
              'El folio SII es document_number.',
              'Los montos deben ser números sin separadores de miles.',
              'currency normalmente será CLP salvo que el documento indique otra moneda.',
              'confidence debe reflejar tu confianza global entre 0 y 1.',
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
              'supplier_name','supplier_rut','document_number','document_date','due_date',
              'document_type','net_amount','tax_amount','total_amount','currency','confidence',
            ],
            properties: {
              supplier_name: { anyOf: [{ type: 'string' }, { type: 'null' }] },
              supplier_rut: { anyOf: [{ type: 'string' }, { type: 'null' }] },
              document_number: { anyOf: [{ type: 'string' }, { type: 'null' }] },
              document_date: { anyOf: [{ type: 'string' }, { type: 'null' }] },
              due_date: { anyOf: [{ type: 'string' }, { type: 'null' }] },
              document_type: { type: 'string', enum: ['invoice','credit_note','debit_note','other'] },
              net_amount: { anyOf: [{ type: 'number' }, { type: 'null' }] },
              tax_amount: { anyOf: [{ type: 'number' }, { type: 'null' }] },
              total_amount: { anyOf: [{ type: 'number' }, { type: 'null' }] },
              currency: { anyOf: [{ type: 'string' }, { type: 'null' }] },
              confidence: { type: 'number', minimum: 0, maximum: 1 },
            },
          },
        },
      },
      max_output_tokens: 700,
    }),
  })

  if (!response.ok) {
    const detail = await response.text()
    throw new Error(`OpenAI OCR failed (${response.status}): ${detail.slice(0, 300)}`)
  }

  const raw = await response.json() as Record<string, unknown>
  const text = extractResponseText(raw)
  if (!text) return { metadata: null, draft: {}, confidence: null, raw, reason: 'openai_ocr_empty' }

  let parsed: Record<string, unknown>
  try {
    parsed = JSON.parse(text) as Record<string, unknown>
  } catch {
    return { metadata: null, draft: {}, confidence: null, raw, reason: 'openai_ocr_invalid_json' }
  }

  const normalized = normalizePayload(parsed)
  const metadata = parseManualPdfMetadata(normalized)
  const confidenceRaw = parsed.confidence
  const confidence = typeof confidenceRaw === 'number' && Number.isFinite(confidenceRaw)
    ? Math.max(0, Math.min(1, confidenceRaw))
    : null

  return {
    metadata,
    draft: normalized,
    confidence,
    raw: { provider: 'openai', response: raw, extraction: parsed },
    reason: metadata ? undefined : 'required_fiscal_fields_missing',
  }
}

async function extractWithConfiguredEndpoint(bytes: Buffer, filename: string): Promise<PdfFiscalExtraction | null> {
  const endpoint = process.env.DOCUMENT_AI_ENDPOINT
  if (!endpoint) return null

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
    draft: normalized,
    confidence,
    raw: { provider: 'document_ai', response: payload },
    reason: metadata ? undefined : 'required_fiscal_fields_missing',
  }
}

export async function extractSiiPdfFiscalMetadata(
  bytes: Buffer,
  filename: string,
): Promise<PdfFiscalExtraction> {
  try {
    const gatewayResult = await extractWithVercelGateway(bytes, filename)
    if (gatewayResult.metadata || Object.keys(gatewayResult.draft).length > 0) return gatewayResult
  } catch (error) {
    console.error('[sii-pdf-extraction] Vercel AI Gateway OCR failed; trying direct OpenAI', error)
  }

  try {
    const openAiResult = await extractWithOpenAi(bytes, filename)
    if (openAiResult.metadata || Object.keys(openAiResult.draft).length > 0) return openAiResult
  } catch (error) {
    console.error('[sii-pdf-extraction] direct OpenAI OCR failed; trying configured endpoint', error)
  }

  try {
    const endpointResult = await extractWithConfiguredEndpoint(bytes, filename)
    if (endpointResult) return endpointResult
  } catch (error) {
    console.error('[sii-pdf-extraction] configured OCR failed', error)
  }

  return {
    metadata: null,
    draft: {},
    confidence: null,
    raw: {},
    reason: 'ocr_unavailable',
  }
}
