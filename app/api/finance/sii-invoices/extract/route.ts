import { NextResponse } from 'next/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import { extractSiiPdfFiscalMetadata } from '@/lib/finance/sii-pdf-extraction'

export const runtime = 'nodejs'

async function authorizeFinance() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: NextResponse.json({ error: 'Authentication required' }, { status: 401 }) }

  const [{ data: reviewer }, { data: uploader }] = await Promise.all([
    supabase.rpc('can_app_action', { p_action_key: 'finance.adjust' }),
    supabase.rpc('can_app_action', { p_action_key: 'finance.document_upload' }),
  ])
  if (!reviewer && !uploader) return { error: NextResponse.json({ error: 'Document upload permission required' }, { status: 403 }) }
  return { user, reviewer: Boolean(reviewer) }
}

function adminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Supabase server configuration is incomplete')
  return createAdminClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
}

export async function POST(request: Request) {
  const authorization = await authorizeFinance()
  if ('error' in authorization) return authorization.error

  try {
    const body = await request.json() as { upload_id?: unknown }
    const uploadId = typeof body.upload_id === 'string' ? body.upload_id.trim() : ''
    if (!uploadId) return NextResponse.json({ error: 'upload_id is required' }, { status: 400 })

    const admin = adminClient()
    let query = admin.from('finance_sii_uploads')
      .select('id,upload_kind,status,finance_document_id,storage_bucket,storage_path,original_filename,uploaded_by')
      .eq('id', uploadId)

    if (!authorization.reviewer) query = query.eq('uploaded_by', authorization.user.id)

    const { data: upload, error: uploadError } = await query.maybeSingle()
    if (uploadError) return NextResponse.json({ error: uploadError.message }, { status: 500 })
    if (!upload) return NextResponse.json({ error: 'SII upload not found' }, { status: 404 })
    if (upload.finance_document_id) {
      return NextResponse.json({ ok: true, status: 'already_finalized', document_id: upload.finance_document_id })
    }
    if (upload.upload_kind !== 'pdf') return NextResponse.json({ error: 'Automatic extraction is only for PDF uploads' }, { status: 409 })

    const { data: source, error: sourceError } = await admin.storage.from(upload.storage_bucket).download(upload.storage_path)
    if (sourceError || !source) return NextResponse.json({ error: sourceError?.message ?? 'Could not read PDF source' }, { status: 500 })

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json({
        error: 'OCR no configurado: falta OPENAI_API_KEY en este environment.',
        reason: 'openai_api_key_missing',
      }, { status: 503 })
    }

    const bytes = Buffer.from(await source.arrayBuffer())
    const extraction = await extractSiiPdfFiscalMetadata(bytes, upload.original_filename)

    return NextResponse.json({
      ok: true,
      status: extraction.metadata ? 'extracted' : 'partial',
      confidence: extraction.confidence,
      metadata: extraction.metadata ?? extraction.draft,
      reason: extraction.reason ?? null,
    })
  } catch (error) {
    console.error('[finance/sii-invoices/extract] automatic extraction failed', error)
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Automatic extraction failed' }, { status: 500 })
  }
}
