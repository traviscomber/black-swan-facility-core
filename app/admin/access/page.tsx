import Link from "next/link"
import { redirect } from "next/navigation"
import { revalidatePath } from "next/cache"
import { createClient as createAdminClient } from "@supabase/supabase-js"
import { ArrowLeft, KeyRound, MapPin, ShieldCheck, UserCog } from "lucide-react"
import { AppLayout } from "@/components/app-layout"
import { PageHeader } from "@/components/page-header"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { createClient } from "@/lib/supabase/server"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const DEPARTMENTS = [
  "booking",
  "housekeeping",
  "hospitality",
  "maintenance",
  "services",
  "activities",
  "finance",
  "procurement",
  "inventory",
  "fleet",
  "fuel",
] as const

const ROLE_LABELS: Record<string, string> = {
  admin: "Administrador",
  approver: "Aprobador",
  operator: "Operador",
}

function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error("Falta configuración administrativa de Supabase")
  return createAdminClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } })
}

async function requireAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")
  const { data, error } = await supabase.rpc("get_current_user_effective_access")
  if (error || data?.role !== "admin") redirect("/admin")
  return user
}

async function updateUserAccess(formData: FormData) {
  "use server"
  const actor = await requireAdmin()
  const admin = getAdminClient()
  const targetUserId = String(formData.get("userId") ?? "")
  const role = String(formData.get("role") ?? "")
  const isActive = formData.get("isActive") === "on"
  const reason = String(formData.get("reason") ?? "").trim()
  const departments = formData.getAll("departments").map(String)
  const locations = formData.getAll("locations").map(String)

  if (!targetUserId || !["admin", "approver", "operator"].includes(role)) throw new Error("Datos de acceso inválidos")
  if (reason.length < 5) throw new Error("El motivo debe tener al menos 5 caracteres")
  if (targetUserId === actor.id && (!isActive || role !== "admin")) throw new Error("No puedes suspender ni degradar tu propia cuenta administrativa")
  if (locations.length > 0 && departments.length === 0) throw new Error("Selecciona al menos un departamento para restringir ubicaciones")

  const { data: currentUserData, error: currentUserError } = await admin.auth.admin.getUserById(targetUserId)
  if (currentUserError || !currentUserData.user) throw new Error(currentUserError?.message ?? "Usuario no encontrado")
  const target = currentUserData.user

  const [{ data: previousScopes, error: previousScopesError }, { data: previousProfile, error: previousProfileError }] = await Promise.all([
    admin
      .from("user_operational_scopes")
      .select("department,location_id,is_active")
      .eq("user_id", targetUserId),
    admin
      .from("user_access_profiles")
      .select("is_active")
      .eq("user_id", targetUserId)
      .maybeSingle(),
  ])
  if (previousScopesError) throw new Error(previousScopesError.message)
  if (previousProfileError) throw new Error(previousProfileError.message)

  const previousRole = String(target.app_metadata?.procurement_role ?? "operator")
  const previousActive = previousProfile?.is_active ?? true

  const { error: authError } = await admin.auth.admin.updateUserById(targetUserId, {
    app_metadata: { ...(target.app_metadata ?? {}), procurement_role: role },
    ban_duration: isActive ? "none" : "876000h",
  })
  if (authError) throw new Error(authError.message)

  const { error: profileError } = await admin.from("user_access_profiles").upsert({
    user_id: targetUserId,
    email: target.email?.toLowerCase() ?? null,
    role_key: role,
    is_active: isActive,
    updated_by: actor.id,
    updated_at: new Date().toISOString(),
  })
  if (profileError) throw new Error(profileError.message)

  const { error: deleteError } = await admin.from("user_operational_scopes").delete().eq("user_id", targetUserId)
  if (deleteError) throw new Error(deleteError.message)

  if (departments.length > 0) {
    if (locations.length > 0) {
      const locationScopeRows = departments.flatMap((department) =>
        locations.map((locationId) => ({
          user_id: targetUserId,
          department,
          location_id: locationId,
          is_active: true,
          granted_by: actor.id,
          notes: reason,
        })),
      )
      const { error: scopeError } = await admin.from("user_operational_scopes").insert(locationScopeRows)
      if (scopeError) throw new Error(scopeError.message)
    } else {
      const departmentScopeRows = departments.map((department) => ({
        user_id: targetUserId,
        department,
        is_active: true,
        granted_by: actor.id,
        notes: reason,
      }))
      const { error: scopeError } = await admin.from("user_operational_scopes").insert(departmentScopeRows)
      if (scopeError) throw new Error(scopeError.message)
    }
  }

  const auditRows = []
  if (previousRole !== role) auditRows.push({ target_user_id: targetUserId, target_email: target.email, action: "role_changed", previous_value: { role: previousRole }, new_value: { role }, reason, actor_id: actor.id, actor_email: actor.email })
  if (previousActive !== isActive) auditRows.push({ target_user_id: targetUserId, target_email: target.email, action: "status_changed", previous_value: { isActive: previousActive }, new_value: { isActive }, reason, actor_id: actor.id, actor_email: actor.email })
  auditRows.push({ target_user_id: targetUserId, target_email: target.email, action: "scopes_replaced", previous_value: { scopes: previousScopes ?? [] }, new_value: { departments, locations, unrestricted: departments.length === 0 }, reason, actor_id: actor.id, actor_email: actor.email })

  const { error: auditError } = await admin.from("user_access_audit_log").insert(auditRows)
  if (auditError) throw new Error(auditError.message)

  revalidatePath("/admin/access")
}

export default async function AdminAccessPage() {
  await requireAdmin()
  const admin = getAdminClient()

  const [{ data: authData, error: usersError }, { data: profiles }, { data: scopes }, { data: locations }, { data: audits }] = await Promise.all([
    admin.auth.admin.listUsers({ page: 1, perPage: 1000 }),
    admin.from("user_access_profiles").select("user_id,role_key,is_active"),
    admin.from("user_operational_scopes").select("user_id,department,location_id,is_active").eq("is_active", true),
    admin.from("locations").select("id,name").eq("is_active", true).order("name"),
    admin.from("user_access_audit_log").select("id,target_email,action,reason,actor_email,created_at").order("created_at", { ascending: false }).limit(20),
  ])

  if (usersError) throw new Error(usersError.message)
  const profileMap = new Map((profiles ?? []).map((item) => [item.user_id, item]))
  const users = authData.users
    .filter((user) => user.email)
    .map((user) => {
      const profile = profileMap.get(user.id)
      const userScopes = (scopes ?? []).filter((scope) => scope.user_id === user.id)
      return {
        id: user.id,
        email: user.email ?? "",
        name: String(user.user_metadata?.full_name ?? user.user_metadata?.name ?? user.email ?? "Usuario"),
        role: profile?.role_key ?? String(user.app_metadata?.procurement_role ?? "operator"),
        isActive: profile?.is_active ?? true,
        departments: [...new Set(userScopes.map((scope) => scope.department).filter(Boolean))] as string[],
        locations: [...new Set(userScopes.map((scope) => scope.location_id).filter(Boolean))] as string[],
        restricted: userScopes.length > 0,
      }
    })
    .sort((a, b) => a.name.localeCompare(b.name))

  return (
    <AppLayout>
      <PageHeader title="Accesos y alcance operacional" description="Administra roles, suspensión y alcance por departamento y ubicación. Los cambios se aplican de inmediato en RLS y RPC." />
      <div className="space-y-6 p-4 md:p-8">
        <Link href="/admin" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="h-4 w-4" /> Volver a Administración</Link>

        <div className="grid gap-4 md:grid-cols-3">
          <Card><CardHeader><CardTitle className="flex items-center gap-2"><UserCog className="h-5 w-5" />{users.length} usuarios</CardTitle><CardDescription>Cuentas autenticadas administrables</CardDescription></CardHeader></Card>
          <Card><CardHeader><CardTitle className="flex items-center gap-2"><ShieldCheck className="h-5 w-5" />{users.filter((u) => u.restricted).length} restringidos</CardTitle><CardDescription>Con alcance explícito por área o propiedad</CardDescription></CardHeader></Card>
          <Card><CardHeader><CardTitle className="flex items-center gap-2"><MapPin className="h-5 w-5" />{locations?.length ?? 0} ubicaciones</CardTitle><CardDescription>Disponibles para asignación operacional</CardDescription></CardHeader></Card>
        </div>

        <div className="space-y-4">
          {users.map((user) => (
            <Card key={user.id}>
              <CardHeader>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div><CardTitle className="text-lg">{user.name}</CardTitle><CardDescription>{user.email}</CardDescription></div>
                  <div className="flex gap-2"><Badge variant={user.isActive ? "secondary" : "destructive"}>{user.isActive ? "Activo" : "Suspendido"}</Badge><Badge variant="outline">{ROLE_LABELS[user.role] ?? user.role}</Badge><Badge variant="outline">{user.restricted ? "Alcance limitado" : "Sin restricción"}</Badge></div>
                </div>
              </CardHeader>
              <CardContent>
                <form action={updateUserAccess} className="space-y-5">
                  <input type="hidden" name="userId" value={user.id} />
                  <div className="grid gap-4 md:grid-cols-3">
                    <label className="space-y-2 text-sm"><span className="font-medium">Rol</span><select name="role" defaultValue={user.role} className="w-full rounded-md border bg-background px-3 py-2"><option value="admin">Administrador</option><option value="approver">Aprobador</option><option value="operator">Operador</option></select></label>
                    <label className="flex items-center gap-3 rounded-md border px-3 py-2 text-sm"><input type="checkbox" name="isActive" defaultChecked={user.isActive} /><span><strong>Acceso activo</strong><br /><span className="text-xs text-muted-foreground">Al desactivar, RLS bloquea de inmediato.</span></span></label>
                    <label className="space-y-2 text-sm"><span className="font-medium">Motivo del cambio</span><input name="reason" required minLength={5} placeholder="Ej. asignación a recepción" className="w-full rounded-md border bg-background px-3 py-2" /></label>
                  </div>

                  <div className="grid gap-5 lg:grid-cols-2">
                    <fieldset><legend className="mb-2 text-sm font-medium">Departamentos</legend><div className="grid grid-cols-2 gap-2 rounded-md border p-3 sm:grid-cols-3">{DEPARTMENTS.map((department) => <label key={department} className="flex items-center gap-2 text-sm"><input type="checkbox" name="departments" value={department} defaultChecked={user.departments.includes(department)} /><span className="capitalize">{department}</span></label>)}</div><p className="mt-2 text-xs text-muted-foreground">Sin departamentos seleccionados = acceso sin restricción adicional según su rol.</p></fieldset>
                    <fieldset><legend className="mb-2 text-sm font-medium">Ubicaciones</legend><div className="grid max-h-44 grid-cols-2 gap-2 overflow-y-auto rounded-md border p-3">{(locations ?? []).map((location) => <label key={location.id} className="flex items-center gap-2 text-sm"><input type="checkbox" name="locations" value={location.id} defaultChecked={user.locations.includes(location.id)} /><span>{location.name}</span></label>)}</div><p className="mt-2 text-xs text-muted-foreground">Las ubicaciones se combinan con los departamentos seleccionados.</p></fieldset>
                  </div>

                  <button type="submit" className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"><KeyRound className="h-4 w-4" />Guardar acceso</button>
                </form>
              </CardContent>
            </Card>
          ))}
        </div>

        <Card>
          <CardHeader><CardTitle>Últimos cambios de acceso</CardTitle><CardDescription>Bitácora append-only de roles, suspensiones y alcances.</CardDescription></CardHeader>
          <CardContent className="overflow-x-auto"><table className="w-full min-w-[760px] text-sm"><thead><tr className="border-b text-left"><th className="p-3">Fecha</th><th className="p-3">Usuario</th><th className="p-3">Acción</th><th className="p-3">Motivo</th><th className="p-3">Actor</th></tr></thead><tbody>{(audits ?? []).map((audit) => <tr key={audit.id} className="border-b last:border-0"><td className="p-3">{new Date(audit.created_at).toLocaleString("es-CL")}</td><td className="p-3">{audit.target_email}</td><td className="p-3"><Badge variant="outline">{audit.action}</Badge></td><td className="p-3">{audit.reason}</td><td className="p-3 text-muted-foreground">{audit.actor_email ?? "Sistema"}</td></tr>)}</tbody></table></CardContent>
        </Card>
      </div>
    </AppLayout>
  )
}
