import { redirect } from "next/navigation"
import { revalidatePath } from "next/cache"
import { createClient as createAdminClient } from "@supabase/supabase-js"
import { AdminAccessView, type AdminAccessAudit, type AdminAccessLocation, type AdminAccessUser } from "@/components/admin-access-view"
import { createClient } from "@/lib/supabase/server"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const DEPARTMENTS = ["booking","housekeeping","hospitality","maintenance","services","activities","finance","procurement","inventory","fleet","fuel"] as const

function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error("Missing Supabase administrative configuration")
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

  if (!targetUserId || !["admin", "approver", "operator"].includes(role)) throw new Error("INVALID_ACCESS_DATA")
  if (reason.length < 5) throw new Error("ACCESS_REASON_TOO_SHORT")
  if (targetUserId === actor.id && (!isActive || role !== "admin")) throw new Error("ADMIN_SELF_PROTECTION")
  if (locations.length > 0 && departments.length === 0) throw new Error("LOCATION_REQUIRES_DEPARTMENT")

  const { data: currentUserData, error: currentUserError } = await admin.auth.admin.getUserById(targetUserId)
  if (currentUserError || !currentUserData.user) throw new Error("ACCESS_USER_NOT_FOUND")
  const target = currentUserData.user

  const [{ data: previousScopes, error: previousScopesError }, { data: previousProfile, error: previousProfileError }] = await Promise.all([
    admin.from("user_operational_scopes").select("department,location_id,is_active").eq("user_id", targetUserId),
    admin.from("user_access_profiles").select("is_active").eq("user_id", targetUserId).maybeSingle(),
  ])
  if (previousScopesError || previousProfileError) throw new Error("ACCESS_STATE_READ_FAILED")

  const previousRole = String(target.app_metadata?.procurement_role ?? "operator")
  const previousActive = previousProfile?.is_active ?? true

  const { error: authError } = await admin.auth.admin.updateUserById(targetUserId, {
    app_metadata: { ...(target.app_metadata ?? {}), procurement_role: role },
    ban_duration: isActive ? "none" : "876000h",
  })
  if (authError) throw new Error("ACCESS_AUTH_UPDATE_FAILED")

  const { error: profileError } = await admin.from("user_access_profiles").upsert({
    user_id: targetUserId,
    email: target.email?.toLowerCase() ?? null,
    role_key: role,
    is_active: isActive,
    updated_by: actor.id,
    updated_at: new Date().toISOString(),
  })
  if (profileError) throw new Error("ACCESS_PROFILE_UPDATE_FAILED")

  const { error: deleteError } = await admin.from("user_operational_scopes").delete().eq("user_id", targetUserId)
  if (deleteError) throw new Error("ACCESS_SCOPE_RESET_FAILED")

  if (departments.length > 0) {
    if (locations.length > 0) {
      const rows = departments.flatMap((department) => locations.map((locationId) => ({ user_id: targetUserId, department, location_id: locationId, is_active: true, granted_by: actor.id, notes: reason })))
      const { error } = await admin.from("user_operational_scopes").insert(rows)
      if (error) throw new Error("ACCESS_SCOPE_WRITE_FAILED")
    } else {
      const rows = departments.map((department) => ({ user_id: targetUserId, department, is_active: true, granted_by: actor.id, notes: reason }))
      const { error } = await admin.from("user_operational_scopes").insert(rows)
      if (error) throw new Error("ACCESS_SCOPE_WRITE_FAILED")
    }
  }

  const auditRows = []
  if (previousRole !== role) auditRows.push({ target_user_id: targetUserId, target_email: target.email, action: "role_changed", previous_value: { role: previousRole }, new_value: { role }, reason, actor_id: actor.id, actor_email: actor.email })
  if (previousActive !== isActive) auditRows.push({ target_user_id: targetUserId, target_email: target.email, action: "status_changed", previous_value: { isActive: previousActive }, new_value: { isActive }, reason, actor_id: actor.id, actor_email: actor.email })
  auditRows.push({ target_user_id: targetUserId, target_email: target.email, action: "scopes_replaced", previous_value: { scopes: previousScopes ?? [] }, new_value: { departments, locations, unrestricted: departments.length === 0 }, reason, actor_id: actor.id, actor_email: actor.email })

  const { error: auditError } = await admin.from("user_access_audit_log").insert(auditRows)
  if (auditError) throw new Error("ACCESS_AUDIT_WRITE_FAILED")
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
  if (usersError) throw new Error("ACCESS_USERS_READ_FAILED")

  const profileMap = new Map((profiles ?? []).map((item) => [item.user_id, item]))
  const users: AdminAccessUser[] = authData.users.filter((user) => user.email).map((user) => {
    const profile = profileMap.get(user.id)
    const userScopes = (scopes ?? []).filter((scope) => scope.user_id === user.id)
    return {
      id: user.id,
      email: user.email ?? "",
      name: String(user.user_metadata?.full_name ?? user.user_metadata?.name ?? user.email ?? "User"),
      role: profile?.role_key ?? String(user.app_metadata?.procurement_role ?? "operator"),
      isActive: profile?.is_active ?? true,
      departments: [...new Set(userScopes.map((scope) => scope.department).filter(Boolean))] as string[],
      locations: [...new Set(userScopes.map((scope) => scope.location_id).filter(Boolean))] as string[],
      restricted: userScopes.length > 0,
    }
  }).sort((a, b) => a.name.localeCompare(b.name))

  return <AdminAccessView users={users} locations={(locations ?? []) as AdminAccessLocation[]} audits={(audits ?? []) as AdminAccessAudit[]} departments={DEPARTMENTS} updateUserAccess={updateUserAccess} />
}
