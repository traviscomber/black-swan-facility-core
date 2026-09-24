import { redirect } from 'next/navigation'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const EMAIL = 'maribel@blackswn.org'

async function requireAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/en/auth/login')
  const { data: access } = await supabase.rpc('get_current_user_effective_access')
  if (access?.role !== 'admin') redirect('/en/os')
  return user
}

function adminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Administrative configuration unavailable')
  return createAdminClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
}

async function provision(form: FormData) {
  'use server'
  const actor = await requireAdmin()
  const password = String(form.get('password') ?? '')
  if (password.length < 12) redirect('/en/admin/access/finance-uploader?status=short')
  const admin = adminClient()
  const { data: existing, error: existingError } = await admin.from('user_access_profiles').select('user_id').eq('email', EMAIL).maybeSingle()
  if (existingError) redirect('/en/admin/access/finance-uploader?status=error')
  if (existing) redirect('/en/admin/access/finance-uploader?status=exists')

  const { data: created, error: authError } = await admin.auth.admin.createUser({
    email: EMAIL, password, email_confirm: true,
    user_metadata: { full_name: 'Maribel', name: 'Maribel' },
  })
  if (authError || !created.user) redirect('/en/admin/access/finance-uploader?status=error')

  const { error: profileError } = await admin.from('user_access_profiles').insert({
    user_id: created.user.id, email: EMAIL, role_key: 'finance_uploader', is_active: true,
    os_persona_key: 'general', os_primary_domain: 'finance', os_start_path: '/budgets/documents', updated_by: actor.id,
  })
  const { error: scopeError } = profileError ? { error: profileError } : await admin.from('user_operational_scopes').insert({
    user_id: created.user.id, department: 'finance', is_active: true,
    granted_by: actor.id, notes: 'Carga de facturas SII y cartolas; sin aprobación ni pagos',
  })
  if (profileError || scopeError) {
    await admin.auth.admin.updateUserById(created.user.id, { ban_duration: '876000h' })
    redirect('/en/admin/access/finance-uploader?status=error')
  }
  const { error: auditError } = await admin.from('user_access_audit_log').insert({
    target_user_id: created.user.id, target_email: EMAIL, action: 'finance_uploader_created',
    previous_value: {}, new_value: { role: 'finance_uploader', departments: ['finance'] },
    reason: 'Facturas SII y cartolas semanales', actor_id: actor.id, actor_email: actor.email,
  })
  if (auditError) {
    await admin.auth.admin.updateUserById(created.user.id, { ban_duration: '876000h' })
    redirect('/en/admin/access/finance-uploader?status=error')
  }
  redirect('/en/admin/access/finance-uploader?status=created')
}

export default async function FinanceUploaderProvision({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  await requireAdmin()
  const status = (await searchParams).status
  return <main className="mx-auto max-w-xl space-y-5 p-8 text-[var(--bs-text-primary)]">
    <h1 className="text-2xl">Acceso documental de Maribel</h1>
    <p className="text-sm text-[var(--bs-text-secondary)]">Crea el acceso de {EMAIL} a Facturas / documentos. Podrá subir facturas SII y cartolas; no podrá aprobar documentos, registrar pagos ni navegar otras áreas.</p>
    {status === 'created' && <p role="status">Cuenta creada. Verifica el acceso con Maribel en /en/budgets/documents.</p>}
    {status === 'exists' && <p role="status">Ya existe un perfil para esta dirección. Revisa su acceso antes de cambiar credenciales.</p>}
    {status === 'short' && <p role="alert">La contraseña requiere al menos 12 caracteres.</p>}
    {status === 'error' && <p role="alert">No se pudo completar el alta. No compartas credenciales hasta revisar el estado de la cuenta.</p>}
    <form action={provision} className="space-y-4 border border-[var(--bs-divider-subtle)] p-5">
      <label className="block text-sm">Contraseña inicial<input name="password" type="password" required minLength={12} autoComplete="new-password" className="mt-2 h-11 w-full border border-[var(--bs-divider-subtle)] bg-[var(--bs-surface-secondary)] px-3" /></label>
      <button className="bg-[var(--bs-cool-sage)] px-5 py-3 text-sm text-black" type="submit">Crear acceso limitado</button>
    </form>
  </main>
}
