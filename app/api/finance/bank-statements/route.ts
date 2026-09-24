import { createHash, randomUUID } from 'node:crypto'
import { NextResponse } from 'next/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'
const BUCKET = 'finance-bank-statements'
const MAX_FILE_BYTES = 15 * 1024 * 1024

function adminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Supabase server configuration is incomplete')
  return createAdminClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
}

async function authorized() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: NextResponse.json({ error: 'Authentication required' }, { status: 401 }) }
  const [{ data: reviewer }, { data: uploader }] = await Promise.all([
    supabase.rpc('can_app_action', { p_action_key: 'finance.adjust' }),
    supabase.rpc('can_app_action', { p_action_key: 'finance.document_upload' }),
  ])
  if (!reviewer && !uploader) return { error: NextResponse.json({ error: 'Document upload permission required' }, { status: 403 }) }
  return { user, supabase }
}

export async function GET() {
  const access = await authorized()
  if ('error' in access) return access.error
  const { data, error } = await access.supabase.from('finance_bank_statement_uploads')
    .select('id,original_filename,period_start,period_end,status,created_at')
    .order('created_at', { ascending: false }).limit(20)
  if (error) return NextResponse.json({ error: 'Could not load bank statements' }, { status: 500 })
  return NextResponse.json({ rows: data ?? [] })
}

export async function POST(request: Request) {
  const access = await authorized()
  if ('error' in access) return access.error
  try {
    const form = await request.formData()
    const file = form.get('file')
    const start = String(form.get('period_start') ?? '')
    const end = String(form.get('period_end') ?? '')
    if (!(file instanceof File) || !file.size || file.size > MAX_FILE_BYTES) return NextResponse.json({ error: 'Select a statement up to 15 MB' }, { status: 400 })
    if (!/^\d{4}-\d{2}-\d{2}$/.test(start) || !/^\d{4}-\d{2}-\d{2}$/.test(end) || start > end || !Number.isFinite(Date.parse(`${start}T00:00:00Z`)) || !Number.isFinite(Date.parse(`${end}T00:00:00Z`))) {
      return NextResponse.json({ error: 'Enter a valid statement date range' }, { status: 400 })
    }
    const ext = file.name.toLowerCase().split('.').pop()
    if (ext !== 'pdf' && ext !== 'csv' && ext !== 'xlsx') return NextResponse.json({ error: 'Use PDF, CSV or XLSX bank statements' }, { status: 400 })
    const bytes = Buffer.from(await file.arrayBuffer())
    if (ext === 'pdf' && bytes.subarray(0, 5).toString('ascii') !== '%PDF-') return NextResponse.json({ error: 'Invalid PDF statement' }, { status: 400 })
    if (ext === 'csv' && (bytes.includes(0) || !bytes.toString('utf8').trim())) return NextResponse.json({ error: 'Invalid CSV statement' }, { status: 400 })
    if (ext === 'xlsx' && bytes.subarray(0, 2).toString('ascii') !== 'PK') return NextResponse.json({ error: 'Invalid XLSX statement' }, { status: 400 })
    const admin = adminClient()
    const hash = createHash('sha256').update(bytes).digest('hex')
    const { data: existing, error: duplicateError } = await admin.from('finance_bank_statement_uploads').select('id').eq('file_hash', hash).maybeSingle()
    if (duplicateError) return NextResponse.json({ error: 'Could not check duplicate statement' }, { status: 500 })
    if (existing) return NextResponse.json({ status: 'duplicate' })
    const path = `${end.slice(0, 7)}/${hash}-${randomUUID()}.${ext}`
    const mime = ext === 'pdf' ? 'application/pdf' : ext === 'xlsx' ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' : 'text/csv'
    const { error: storageError } = await admin.storage.from(BUCKET).upload(path, bytes, { contentType: mime, upsert: false })
    if (storageError) return NextResponse.json({ error: 'Could not store statement' }, { status: 500 })
    const { data, error } = await admin.from('finance_bank_statement_uploads').insert({
      file_hash: hash, storage_path: path, original_filename: file.name.slice(0, 255),
      mime_type: mime, size_bytes: file.size, period_start: start, period_end: end, uploaded_by: access.user.id,
    }).select('id,status').single()
    if (error) {
      await admin.storage.from(BUCKET).remove([path])
      return NextResponse.json({ error: 'Could not register statement' }, { status: 500 })
    }
    return NextResponse.json({ id: data.id, status: data.status }, { status: 201 })
  } catch (error) {
    console.error('[bank-statements] upload failed', error)
    return NextResponse.json({ error: 'Could not upload statement' }, { status: 500 })
  }
}
