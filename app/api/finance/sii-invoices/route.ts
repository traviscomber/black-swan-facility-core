import { createHash, randomUUID } from 'node:crypto'
import { NextResponse } from 'next/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import { parseManualPdfMetadata, parseSiiXml, siiBaseName, siiExtension, type ParsedSiiInvoice } from '@/lib/finance/sii-invoice'

export const runtime = 'nodejs'

const BUCKET = 'finance-sii-invoices'
const MAX_FILE_BYTES = 15 * 1024 * 1024
const MAX_FILES = 10

async function authorizeFinance() {
  const supabase = await createClient()
  const { data: authData, error: authError } = await supabase.auth.getUser()
  if (authError || !authData.user) return { error: NextResponse.json({ error: 'Authentication required' }, { status: 401 }) }

  const [{ data: reviewer }, { data: uploader }] = await Promise.all([
    supabase.rpc('can_app_action', { p_action_key: 'finance.adjust' }),
    supabase.rpc('can_app_action', { p_action_key: 'finance.document_upload' }),
  ])
  if (!reviewer && !uploader) return { error: NextResponse.json({ error: 'Document upload permission required' }, { status: 403 }) }
  return { user: authData.user, reviewer: Boolean(reviewer) }
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
    const formData = await request.formData()
    const files = formData.getAll('files').filter((item): item is File => item instanceof File)
    if (!files.length) return NextResponse.json({ error: 'At least one PDF or XML file is required' }, { status: 400 })
    if (files.length > MAX_FILES) return NextResponse.json({ error: `Maximum ${MAX_FILES} files per upload` }, { status: 400 })

    const invalid = files.find((file) => !siiExtension(file.name) || file.size <= 0 || file.size > MAX_FILE_BYTES)
    if (invalid) return NextResponse.json({ error: `Invalid file: ${invalid.name}. Use PDF/XML up to 15 MB each.` }, { status: 400 })

    const admin = adminClient()
    const orderedFiles = [...files].sort((a, b) => Number(siiExtension(b.name) === 'xml') - Number(siiExtension(a.name) === 'xml'))
    const documentByBase = new Map<string, string>()
    const results: Array<Record<string, unknown>> = []

    for (const file of orderedFiles) {
      const ext = siiExtension(file.name)!
      const bytes = Buffer.from(await file.arrayBuffer())
      if (ext === 'pdf' && bytes.subarray(0, 5).toString('ascii') !== '%PDF-') {
        results.push({ filename: file.name, status: 'failed', error: 'El archivo no contiene una cabecera PDF válida.' })
        continue
      }

      let parsedPayload: ParsedSiiInvoice | Record<string, never> = {}
      if (ext === 'xml') {
        const xml = bytes.toString('utf8')
        parsedPayload = parseSiiXml(xml)
        if (!parsedPayload.sii_document_type || !parsedPayload.supplier_rut || !parsedPayload.document_number) {
          results.push({ filename: file.name, status: 'failed', error: 'El XML no parece contener una DTE SII válida.' })
          continue
        }
      }

      const hash = createHash('sha256').update(bytes).digest('hex')
      const { data: existingUpload } = await admin
        .from('finance_sii_uploads')
        .select('id,status,finance_document_id')
        .eq('file_hash', hash)
        .maybeSingle()

      if (existingUpload) {
        results.push({ filename: file.name, upload_id: existingUpload.id, document_id: existingUpload.finance_document_id, status: existingUpload.finance_document_id ? 'duplicate' : existingUpload.status, duplicate: Boolean(existingUpload.finance_document_id) })
        if (existingUpload.finance_document_id) documentByBase.set(siiBaseName(file.name), existingUpload.finance_document_id)
        continue
      }

      const now = new Date()
      const storagePath = `${now.getUTCFullYear()}/${String(now.getUTCMonth() + 1).padStart(2, '0')}/${hash}-${randomUUID()}.${ext}`
      const contentType = ext === 'pdf' ? 'application/pdf' : 'application/xml'
      const { error: storageError } = await admin.storage.from(BUCKET).upload(storagePath, bytes, { contentType, upsert: false })
      if (storageError) {
        results.push({ filename: file.name, status: 'failed', error: storageError.message })
        continue
      }

      const { data: registration, error: registrationError } = await admin.rpc('register_sii_finance_upload', {
        p_file_hash: hash,
        p_storage_path: storagePath,
        p_original_filename: file.name,
        p_mime_type: contentType,
        p_size_bytes: file.size,
        p_upload_kind: ext,
        p_uploaded_by: authorization.user.id,
        p_parsed_payload: parsedPayload,
      })

      if (registrationError) {
        await admin.storage.from(BUCKET).remove([storagePath])
        results.push({ filename: file.name, status: 'failed', error: registrationError.message })
        continue
      }

      const result = registration as { upload_id?: string; document_id?: string | null; status?: string; classification_status?: string; duplicate?: boolean }
      if (result.document_id) documentByBase.set(siiBaseName(file.name), result.document_id)
      results.push({ filename: file.name, ...result })
    }

    for (const result of results) {
      if (typeof result.filename !== 'string' || !result.upload_id || result.document_id || result.status === 'failed') continue
      const documentId = documentByBase.get(siiBaseName(result.filename))
      if (!documentId || !String(result.filename).toLowerCase().endsWith('.pdf')) continue
      const { error } = await admin.from('finance_sii_uploads').update({ finance_document_id: documentId, status: 'linked', updated_at: new Date().toISOString() }).eq('id', result.upload_id)
      if (!error) {
        result.document_id = documentId
        result.status = 'linked'
      }
    }

    return NextResponse.json({ ok: results.some((row) => row.status !== 'failed'), results })
  } catch (error) {
    console.error('[finance/sii-invoices] upload failed', error)
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Upload failed' }, { status: 500 })
  }
}

export async function PATCH(request: Request) {
  const authorization = await authorizeFinance()
  if ('error' in authorization) return authorization.error

  try {
    const body = await request.json() as { upload_id?: unknown; metadata?: unknown }
    const uploadId = typeof body.upload_id === 'string' ? body.upload_id.trim() : ''
    const metadata = parseManualPdfMetadata(body.metadata)
    if (!uploadId || !metadata) {
      return NextResponse.json({ error: 'upload_id and valid fiscal metadata are required' }, { status: 400 })
    }

    const admin = adminClient()
    const { data: upload, error: uploadError } = await admin
      .from('finance_sii_uploads')
      .select('id,upload_kind,status,finance_document_id')
      .eq('id', uploadId)
      .maybeSingle()

    if (uploadError) return NextResponse.json({ error: uploadError.message }, { status: 500 })
    if (!upload) return NextResponse.json({ error: 'SII upload not found' }, { status: 404 })
    if (!authorization.reviewer) {
      const { data: owned } = await admin.from('finance_sii_uploads').select('id').eq('id', uploadId).eq('uploaded_by', authorization.user.id).maybeSingle()
      if (!owned) return NextResponse.json({ error: 'SII upload not found' }, { status: 404 })
    }
    if (upload.upload_kind !== 'pdf') return NextResponse.json({ error: 'Only PDF uploads use manual metadata completion' }, { status: 409 })

    const { data, error } = await admin.rpc('finalize_sii_pdf_upload', {
      p_upload_id: uploadId,
      p_actor_id: authorization.user.id,
      p_metadata: metadata,
    })
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })

    return NextResponse.json({ ok: true, result: data })
  } catch (error) {
    console.error('[finance/sii-invoices] PDF metadata finalization failed', error)
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Could not finalize PDF invoice' }, { status: 500 })
  }
}
