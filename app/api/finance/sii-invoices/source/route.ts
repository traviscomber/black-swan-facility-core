import { NextResponse } from 'next/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'

function adminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Supabase server configuration is incomplete')
  return createAdminClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
}

export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: authData } = await supabase.auth.getUser()
  if (!authData.user) return NextResponse.json({ error: 'Authentication required' }, { status: 401 })

  const { data: allowed, error: permissionError } = await supabase.rpc('can_app_action', { p_action_key: 'finance.adjust' })
  if (permissionError || !allowed) return NextResponse.json({ error: 'Finance permission required' }, { status: 403 })

  const params = new URL(request.url).searchParams
  const documentId = params.get('documentId')
  const uploadId = params.get('uploadId')
  if (!documentId && !uploadId) return NextResponse.json({ error: 'documentId or uploadId is required' }, { status: 400 })

  const admin = adminClient()
  let query = admin
    .from('finance_sii_uploads')
    .select('storage_bucket,storage_path,upload_kind')
    .order('upload_kind', { ascending: true })
    .order('created_at', { ascending: false })
    .limit(1)

  query = documentId ? query.eq('finance_document_id', documentId) : query.eq('id', uploadId!)
  const { data: upload, error } = await query.maybeSingle()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!upload) return NextResponse.json({ error: 'No SII source file was found' }, { status: 404 })

  const { data: signed, error: signedError } = await admin.storage.from(upload.storage_bucket).createSignedUrl(upload.storage_path, 300)
  if (signedError || !signed?.signedUrl) return NextResponse.json({ error: signedError?.message ?? 'Could not create source link' }, { status: 500 })

  return NextResponse.redirect(signed.signedUrl, 302)
}
