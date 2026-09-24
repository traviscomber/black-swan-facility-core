import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const EMAIL = 'maribel@blackswn.org'

const copy = {
  en: {
    title: 'Maribel document access',
    body: 'Creates restricted access to Invoices / documents. She can upload SII invoices and bank statements, but cannot approve documents, register payments, or browse other areas.',
    created: 'Account created. Verify access with Maribel in /es/budgets/documents.',
    exists: 'A profile already exists for this address. Review its access before changing credentials.',
    short: 'The initial password requires at least 12 characters.',
    error: 'Provisioning could not be completed. Do not share credentials until the account state is reviewed.',
    password: 'Initial password',
    submit: 'Create restricted access',
  },
  es: {
    title: 'Acceso documental de Maribel',
    body: 'Crea acceso restringido a Facturas / documentos. Puede subir facturas SII y cartolas, pero no aprobar documentos, registrar pagos ni navegar otras áreas.',
    created: 'Cuenta creada. Verifica el acceso con Maribel en /es/budgets/documents.',
    exists: 'Ya existe un perfil para esta dirección. Revisa su acceso antes de cambiar credenciales.',
    short: 'La contraseña inicial requiere al menos 12 caracteres.',
    error: 'No se pudo completar el alta. No compartas credenciales hasta revisar el estado de la cuenta.',
    password: 'Contraseña inicial',
    submit: 'Crear acceso limitado',
  },
  de: {
    title: 'Dokumentenzugang für Maribel',
    body: 'Erstellt einen eingeschränkten Zugang zu Rechnungen / Dokumenten. Sie kann SII-Rechnungen und Kontoauszüge hochladen, aber keine Dokumente freigeben, Zahlungen erfassen oder andere Bereiche öffnen.',
    created: 'Konto erstellt. Prüfe den Zugang mit Maribel unter /es/budgets/documents.',
    exists: 'Für diese Adresse besteht bereits ein Profil. Prüfe den Zugriff, bevor Zugangsdaten geändert werden.',
    short: 'Das Startpasswort muss mindestens 12 Zeichen haben.',
    error: 'Die Bereitstellung konnte nicht abgeschlossen werden. Zugangsdaten erst nach Prüfung des Kontostatus weitergeben.',
    password: 'Startpasswort',
    submit: 'Eingeschränkten Zugang erstellen',
  },
} as const

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
  const requestHeaders = await headers()
  const localeHeader = requestHeaders.get('x-site-locale')
  const language = localeHeader === 'es' || localeHeader === 'de' ? localeHeader : 'en'
  const c = copy[language]

  return <main className="mx-auto max-w-xl space-y-5 p-8 text-[var(--bs-text-primary)]">
    <h1 className="text-2xl">{c.title}</h1>
    <p className="text-sm text-[var(--bs-text-secondary)]">{c.body}</p>
    {status === 'created' && <p role="status">{c.created}</p>}
    {status === 'exists' && <p role="status">{c.exists}</p>}
    {status === 'short' && <p role="alert">{c.short}</p>}
    {status === 'error' && <p role="alert">{c.error}</p>}
    <form action={provision} className="space-y-4 border border-[var(--bs-divider-subtle)] p-5">
      <label className="block text-sm">{c.password}<input name="password" type="password" required minLength={12} autoComplete="new-password" className="mt-2 h-11 w-full border border-[var(--bs-divider-subtle)] bg-[var(--bs-surface-secondary)] px-3" /></label>
      <button className="bg-[var(--bs-cool-sage)] px-5 py-3 text-sm text-black" type="submit">{c.submit}</button>
    </form>
  </main>
}
