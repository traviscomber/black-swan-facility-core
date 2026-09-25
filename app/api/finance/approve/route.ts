import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'

type MindicadorResponse = {
  serie?: Array<{ fecha?: string; valor?: number }>
}

function toApiDate(date: Date) {
  const dd = String(date.getUTCDate()).padStart(2, '0')
  const mm = String(date.getUTCMonth() + 1).padStart(2, '0')
  const yyyy = date.getUTCFullYear()
  return `${dd}-${mm}-${yyyy}`
}

function toIsoDate(value: string | undefined, fallback: Date) {
  if (value) {
    const parsed = new Date(value)
    if (!Number.isNaN(parsed.getTime())) return parsed.toISOString().slice(0, 10)
  }
  return fallback.toISOString().slice(0, 10)
}

async function resolveClpPerEur(documentDate: string) {
  const base = new Date(`${documentDate}T12:00:00.000Z`)
  if (Number.isNaN(base.getTime())) throw new Error('Invalid document date')

  for (let offset = 0; offset <= 7; offset += 1) {
    const candidate = new Date(base)
    candidate.setUTCDate(candidate.getUTCDate() - offset)
    const url = `https://mindicador.cl/api/euro/${toApiDate(candidate)}`

    try {
      const response = await fetch(url, {
        headers: { accept: 'application/json' },
        cache: 'no-store',
        signal: AbortSignal.timeout(8000),
      })
      if (!response.ok) continue

      const payload = await response.json() as MindicadorResponse
      const item = payload.serie?.find((entry) => Number.isFinite(entry.valor) && Number(entry.valor) > 0)
      if (!item?.valor) continue

      return {
        clpPerEur: Number(item.valor),
        fxDate: toIsoDate(item.fecha, candidate),
        source: 'mindicador.cl / Banco Central de Chile',
      }
    } catch {
      // Retry the previous calendar day. This also covers weekends/holidays.
    }
  }

  throw new Error('No CLP/EUR reference rate available for the document date or prior 7 days')
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Authentication required' }, { status: 401 })

  const { data: canApprove, error: permissionError } = await supabase.rpc('can_finance_approve')
  if (permissionError || !canApprove) {
    return NextResponse.json({ error: 'Finance approval permission required' }, { status: 403 })
  }

  try {
    const body = await request.json() as { document_id?: unknown; notes?: unknown }
    const documentId = typeof body.document_id === 'string' ? body.document_id.trim() : ''
    const notes = typeof body.notes === 'string' && body.notes.trim() ? body.notes.trim() : null
    if (!documentId) return NextResponse.json({ error: 'document_id is required' }, { status: 400 })

    const { data: document, error: documentError } = await supabase
      .from('finance_documents')
      .select('id,document_date,total_amount,currency,approval_status,approved_at,payment_status')
      .eq('id', documentId)
      .maybeSingle()

    if (documentError) return NextResponse.json({ error: documentError.message }, { status: 500 })
    if (!document) return NextResponse.json({ error: 'Finance document not found' }, { status: 404 })
    if (!['ready', 'pending_valuation'].includes(document.approval_status)) {
      return NextResponse.json({ error: 'Document is not awaiting approval or valuation' }, { status: 409 })
    }

    const currency = String(document.currency ?? '').toUpperCase()
    let approvalResult: Record<string, unknown> | null = null

    // Approval and hand-off to Santiago must never depend on FX availability.
    if (document.approval_status === 'ready') {
      const { data, error } = await supabase.rpc('approve_finance_document', {
        p_document_id: documentId,
        p_notes: notes,
      })
      if (error) return NextResponse.json({ error: error.message }, { status: 400 })
      approvalResult = (data ?? null) as Record<string, unknown> | null
    }

    if (currency === 'EUR') {
      return NextResponse.json({
        ok: true,
        valuation: 'not_required',
        result: approvalResult ?? {
          approval_status: document.approval_status,
          payment_status: document.payment_status,
        },
      })
    }

    // EUR valuation is an internal Budget concern. It runs best-effort and
    // never blocks Raimundo's approval or Santiago's payment queue.
    if (currency === 'CLP') {
      try {
        const fx = await resolveClpPerEur(document.document_date)
        const { data, error } = await supabase.rpc('approve_finance_document_auto_eur', {
          p_document_id: documentId,
          p_clp_per_eur: fx.clpPerEur,
          p_fx_date: fx.fxDate,
          p_fx_source: fx.source,
          p_notes: notes,
        })
        if (error) throw error

        return NextResponse.json({
          ok: true,
          valuation: 'automatic',
          result: data,
        })
      } catch (error) {
        console.warn('[finance/approve] EUR valuation deferred without blocking approval', {
          documentId,
          error: error instanceof Error ? error.message : String(error),
        })
      }
    }

    return NextResponse.json({
      ok: true,
      valuation: 'deferred',
      result: approvalResult ?? {
        approval_status: 'pending_valuation',
        payment_status: document.payment_status,
      },
    })
  } catch (error) {
    console.error('[finance/approve] approval failed', error)
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Finance approval failed',
    }, { status: 500 })
  }
}
