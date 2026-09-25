import { NextResponse } from 'next/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'

type Candidate = {
  id: string
  historical_label: string
  operational_label: string | null
  division_id: string
  category_id: string
  division_name: string
  category_name: string
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
      if (record.type === 'output_text' && typeof record.text === 'string' && record.text.trim()) return record.text.trim()
    }
  }
  return null
}

async function authorizeRaimundo() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: NextResponse.json({ error: 'Authentication required' }, { status: 401 }) }
  const { data: canApprove, error } = await supabase.rpc('can_finance_approve')
  if (error || !canApprove) return { error: NextResponse.json({ error: 'Finance approval permission required' }, { status: 403 }) }
  return { user }
}

function adminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Supabase server configuration is incomplete')
  return createAdminClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
}

export async function POST(request: Request) {
  const authorization = await authorizeRaimundo()
  if ('error' in authorization) return authorization.error

  try {
    const body = await request.json() as { document_id?: unknown }
    const documentId = typeof body.document_id === 'string' ? body.document_id.trim() : ''
    if (!documentId) return NextResponse.json({ error: 'document_id is required' }, { status: 400 })

    const apiKey = process.env.OPENAI_API_KEY
    if (!apiKey) return NextResponse.json({ ok: false, suggestion: null, reason: 'openai_api_key_missing' }, { status: 503 })

    const admin = adminClient()
    const [{ data: document, error: documentError }, { data: centers, error: centersError }, { data: upload, error: uploadError }] = await Promise.all([
      admin.from('finance_documents')
        .select('id,supplier_name,supplier_rut,document_number,document_date,total_amount,currency,approval_status,description')
        .eq('id', documentId)
        .maybeSingle(),
      admin.from('finance_historical_cost_centers')
        .select('id,historical_label,operational_label,division_id,category_id,budget_divisions!inner(name),budget_categories!inner(name)')
        .eq('mapping_status', 'mapped')
        .not('division_id', 'is', null)
        .not('category_id', 'is', null)
        .order('historical_label'),
      admin.from('finance_sii_uploads')
        .select('id,storage_bucket,storage_path,original_filename,finance_document_id')
        .eq('finance_document_id', documentId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
    ])

    if (documentError) return NextResponse.json({ error: documentError.message }, { status: 500 })
    if (!document) return NextResponse.json({ error: 'Finance document not found' }, { status: 404 })
    if (!['pending_mapping', 'ready'].includes(document.approval_status)) {
      return NextResponse.json({ error: 'Document is not awaiting Raimundo review' }, { status: 409 })
    }
    if (centersError) return NextResponse.json({ error: centersError.message }, { status: 500 })
    if (uploadError) return NextResponse.json({ error: uploadError.message }, { status: 500 })
    if (!upload) return NextResponse.json({ ok: true, suggestion: null, reason: 'source_pdf_not_available' })

    const candidates = (centers ?? []).map((row) => {
      const division = Array.isArray(row.budget_divisions) ? row.budget_divisions[0] : row.budget_divisions
      const category = Array.isArray(row.budget_categories) ? row.budget_categories[0] : row.budget_categories
      return {
        id: row.id,
        historical_label: row.historical_label,
        operational_label: row.operational_label,
        division_id: row.division_id,
        category_id: row.category_id,
        division_name: division?.name ?? 'P&L',
        category_name: category?.name ?? 'Categoría',
      } satisfies Candidate
    })

    if (!candidates.length) return NextResponse.json({ ok: true, suggestion: null, reason: 'no_mapped_centers' })

    const { data: source, error: sourceError } = await admin.storage.from(upload.storage_bucket).download(upload.storage_path)
    if (sourceError || !source) return NextResponse.json({ error: sourceError?.message ?? 'Could not read invoice PDF' }, { status: 500 })
    const bytes = Buffer.from(await source.arrayBuffer())

    const candidateIds = candidates.map((candidate) => candidate.id)
    const candidateText = candidates.map((candidate) =>
      [
        candidate.id,
        candidate.operational_label ?? candidate.historical_label,
        candidate.division_name,
        candidate.category_name,
      ].join(' | ')
    ).join('\n')

    const response = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        authorization: `Bearer ${apiKey}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: process.env.OPENAI_FINANCE_CLASSIFIER_MODEL || process.env.OPENAI_OCR_MODEL || 'gpt-5.6-luna',
        input: [{
          role: 'user',
          content: [
            {
              type: 'input_file',
              filename: upload.original_filename,
              file_data: `data:application/pdf;base64,${bytes.toString('base64')}`,
              detail: 'high',
            },
            {
              type: 'input_text',
              text: [
                'Actúa como clasificador contable interno, no como aprobador.',
                'Debes sugerir como máximo un centro de costo de la lista permitida.',
                'Usa únicamente evidencia visible en la factura: proveedor, glosa, bienes/servicios, cantidades y contexto explícito.',
                'Nunca inventes un centro, nunca elijas fuera de la lista y nunca apruebes el gasto.',
                'Si la evidencia no distingue razonablemente un centro, responde center_id=null.',
                'Una sugerencia de baja confianza debe ser null.',
                '',
                `Proveedor: ${document.supplier_name ?? '—'}`,
                `RUT: ${document.supplier_rut ?? '—'}`,
                `Documento: ${document.document_number ?? '—'}`,
                `Fecha: ${document.document_date ?? '—'}`,
                `Monto: ${document.total_amount ?? '—'} ${document.currency ?? ''}`,
                '',
                'Centros permitidos (id | centro | división | categoría):',
                candidateText,
              ].join('\n'),
            },
          ],
        }],
        text: {
          format: {
            type: 'json_schema',
            name: 'finance_cost_center_suggestion',
            strict: true,
            schema: {
              type: 'object',
              additionalProperties: false,
              required: ['center_id', 'confidence', 'reason'],
              properties: {
                center_id: { anyOf: [{ type: 'string', enum: candidateIds }, { type: 'null' }] },
                confidence: { type: 'number', minimum: 0, maximum: 1 },
                reason: { type: 'string', maxLength: 320 },
              },
            },
          },
        },
        max_output_tokens: 350,
      }),
    })

    if (!response.ok) {
      const detail = await response.text()
      throw new Error(`OpenAI finance classification failed (${response.status}): ${detail.slice(0, 300)}`)
    }

    const raw = await response.json() as Record<string, unknown>
    const text = outputText(raw)
    if (!text) return NextResponse.json({ ok: true, suggestion: null, reason: 'empty_model_output' })

    const parsed = JSON.parse(text) as { center_id: string | null; confidence: number; reason: string }
    const selected = parsed.center_id ? candidates.find((candidate) => candidate.id === parsed.center_id) : null
    if (!selected || parsed.confidence < 0.55) {
      return NextResponse.json({
        ok: true,
        suggestion: null,
        reason: parsed.reason || 'insufficient_evidence',
        confidence: parsed.confidence,
      })
    }

    return NextResponse.json({
      ok: true,
      suggestion: {
        center_id: selected.id,
        center_label: selected.operational_label ?? selected.historical_label,
        division_id: selected.division_id,
        division_name: selected.division_name,
        category_id: selected.category_id,
        category_name: selected.category_name,
        confidence: parsed.confidence,
        reason: parsed.reason,
      },
    })
  } catch (error) {
    console.error('[finance/cost-center-suggestion] failed', error)
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Could not suggest cost center' }, { status: 500 })
  }
}
