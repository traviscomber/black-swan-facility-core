import { NextResponse } from 'next/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'

type Candidate = {
  id: string
  division_id: string
  division_name: string
  division_key: string
  category_id: string
  category_name: string
  category_key: string
  source_row: number | null
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
    const { data: document, error: documentError } = await admin.from('finance_documents')
      .select('id,supplier_name,supplier_rut,document_number,document_date,total_amount,currency,approval_status,description')
      .eq('id', documentId)
      .maybeSingle()

    if (documentError) return NextResponse.json({ error: documentError.message }, { status: 500 })
    if (!document) return NextResponse.json({ error: 'Finance document not found' }, { status: 404 })
    if (!['pending_mapping', 'ready'].includes(document.approval_status)) {
      return NextResponse.json({ error: 'Document is not awaiting Raimundo review' }, { status: 409 })
    }

    const historyQuery = admin.from('finance_documents')
      .select('division_id,category_id,supplier_name,supplier_rut,approved_at')
      .not('division_id', 'is', null)
      .not('category_id', 'is', null)
      .in('approval_status', ['approved', 'pending_valuation'])
      .order('approved_at', { ascending: false })
      .limit(20)

    if (document.supplier_rut) historyQuery.eq('supplier_rut', document.supplier_rut)
    else historyQuery.eq('supplier_name', document.supplier_name)

    const [{ data: categories, error: categoriesError }, { data: upload, error: uploadError }, { data: history, error: historyError }] = await Promise.all([
      admin.from('budget_categories')
        .select('id,name,source_key,source_row,division_id,budget_divisions!inner(id,name,source_key,is_active,is_aggregate)')
        .eq('is_active', true)
        .eq('category_role', 'cost')
        .not('source_key', 'is', null)
        .eq('budget_divisions.is_active', true)
        .eq('budget_divisions.is_aggregate', false)
        .not('budget_divisions.source_key', 'is', null)
        .order('source_row'),
      admin.from('finance_sii_uploads')
        .select('id,storage_bucket,storage_path,original_filename,finance_document_id')
        .eq('finance_document_id', documentId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
      historyQuery,
    ])

    if (categoriesError) return NextResponse.json({ error: categoriesError.message }, { status: 500 })
    if (uploadError) return NextResponse.json({ error: uploadError.message }, { status: 500 })
    if (historyError) return NextResponse.json({ error: historyError.message }, { status: 500 })
    if (!upload) return NextResponse.json({ ok: true, suggestion: null, reason: 'source_pdf_not_available' })

    const candidates = (categories ?? []).map((row) => {
      const division = Array.isArray(row.budget_divisions) ? row.budget_divisions[0] : row.budget_divisions
      return {
        id: row.id,
        division_id: row.division_id,
        division_name: division?.name ?? 'P&L',
        division_key: division?.source_key ?? '',
        category_id: row.id,
        category_name: row.name,
        category_key: row.source_key,
        source_row: row.source_row,
      } satisfies Candidate
    }).filter((candidate) => candidate.division_id && candidate.division_key && candidate.category_key)

    if (!candidates.length) return NextResponse.json({ ok: true, suggestion: null, reason: 'canonical_budget_not_available' })

    const candidateByCategory = new Map(candidates.map((candidate) => [candidate.category_id, candidate]))
    const historyCounts = new Map<string, number>()
    for (const row of history ?? []) {
      const candidate = row.category_id ? candidateByCategory.get(row.category_id) : null
      if (!candidate || candidate.division_id !== row.division_id) continue
      const key = candidate.category_id
      historyCounts.set(key, (historyCounts.get(key) ?? 0) + 1)
    }

    const historyText = Array.from(historyCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([categoryId, count]) => {
        const candidate = candidateByCategory.get(categoryId)!
        return `${count}× | ${candidate.division_name} | ${candidate.category_name}`
      })
      .join('\n')

    const { data: source, error: sourceError } = await admin.storage.from(upload.storage_bucket).download(upload.storage_path)
    if (sourceError || !source) return NextResponse.json({ error: sourceError?.message ?? 'Could not read invoice PDF' }, { status: 500 })
    const bytes = Buffer.from(await source.arrayBuffer())

    const candidateIds = candidates.map((candidate) => candidate.id)
    const candidateText = candidates.map((candidate) =>
      [
        candidate.id,
        candidate.division_name,
        candidate.category_name,
        `budget_row=${candidate.source_row ?? '—'}`,
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
                'La fuente de verdad es el Budget canónico importado desde el Excel maestro.',
                'Debes sugerir como máximo una combinación división/categoría de costo de la lista permitida.',
                'Usa evidencia visible en la factura: proveedor, glosa, bienes/servicios, cantidades y contexto explícito.',
                'El historial del proveedor es evidencia adicional, nunca limita el universo del Budget.',
                'Nunca inventes una combinación, nunca elijas fuera de la lista y nunca apruebes el gasto.',
                'Si la evidencia no distingue razonablemente una combinación, responde category_id=null.',
                'Una sugerencia de baja confianza debe ser null.',
                '',
                `Proveedor: ${document.supplier_name ?? '—'}`,
                `RUT: ${document.supplier_rut ?? '—'}`,
                `Documento: ${document.document_number ?? '—'}`,
                `Fecha: ${document.document_date ?? '—'}`,
                `Monto: ${document.total_amount ?? '—'} ${document.currency ?? ''}`,
                '',
                'Historial aprobado del proveedor (solo evidencia):',
                historyText || 'Sin historial aprobado comparable.',
                '',
                'Budget canónico permitido (category_id | división | categoría | fila Excel):',
                candidateText,
              ].join('\n'),
            },
          ],
        }],
        text: {
          format: {
            type: 'json_schema',
            name: 'finance_budget_mapping_suggestion',
            strict: true,
            schema: {
              type: 'object',
              additionalProperties: false,
              required: ['category_id', 'confidence', 'reason'],
              properties: {
                category_id: { anyOf: [{ type: 'string', enum: candidateIds }, { type: 'null' }] },
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

    const parsed = JSON.parse(text) as { category_id: string | null; confidence: number; reason: string }
    const selected = parsed.category_id ? candidateByCategory.get(parsed.category_id) : null
    if (!selected || parsed.confidence < 0.55) {
      console.info('[finance/cost-center-suggestion] no-safe-suggestion', {
        documentId,
        confidence: parsed.confidence,
        reason: parsed.reason || 'insufficient_evidence',
      })
      return NextResponse.json({
        ok: true,
        suggestion: null,
        reason: parsed.reason || 'insufficient_evidence',
        confidence: parsed.confidence,
      })
    }

    console.info('[finance/cost-center-suggestion] suggestion', {
      documentId,
      division: selected.division_name,
      category: selected.category_name,
      confidence: parsed.confidence,
      reason: parsed.reason,
    })

    return NextResponse.json({
      ok: true,
      suggestion: {
        center_id: selected.category_id,
        center_label: `${selected.division_name} · ${selected.category_name}`,
        division_id: selected.division_id,
        division_name: selected.division_name,
        division_key: selected.division_key,
        category_id: selected.category_id,
        category_name: selected.category_name,
        category_key: selected.category_key,
        confidence: parsed.confidence,
        reason: parsed.reason,
      },
      candidate_count: candidates.length,
      source: 'canonical_budget_workbook',
    })
  } catch (error) {
    console.error('[finance/cost-center-suggestion] failed', error)
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Could not suggest cost center' }, { status: 500 })
  }
}
