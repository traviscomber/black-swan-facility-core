import { NextResponse } from 'next/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'

export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
  const [{ data: reviewer }, { data: uploader }] = await Promise.all([
    supabase.rpc('can_app_action', { p_action_key: 'finance.adjust' }),
    supabase.rpc('can_app_action', { p_action_key: 'finance.document_upload' }),
  ])
  if (!reviewer && !uploader) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const id = new URL(request.url).searchParams.get('id')
  if (!id || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) return NextResponse.json({ error: 'Valid statement ID required' }, { status: 400 })
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return NextResponse.json({ error: 'Configuration unavailable' }, { status: 500 })
  const admin = createAdminClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
  const { data: row, error } = await admin.from('finance_bank_statement_uploads')
    .select('storage_bucket,storage_path,uploaded_by').eq('id', id).maybeSingle()
  if (error || !row || (!reviewer && row.uploaded_by !== user.id)) return NextResponse.json({ error: 'Statement not found' }, { status: 404 })
  const { data: signed, error: signedError } = await admin.storage.from(row.storage_bucket).createSignedUrl(row.storage_path, 300)
  if (signedError || !signed?.signedUrl) return NextResponse.json({ error: 'Could not open statement' }, { status: 500 })
  return NextResponse.redirect(signed.signedUrl, 302)
}
