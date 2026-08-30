import { timingSafeEqual } from "node:crypto"
import { createClient } from "@supabase/supabase-js"
import { redirect } from "next/navigation"
import { ProcurementUsersProvisioning } from "@/components/admin/procurement-users-provisioning"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

type PageProps = { searchParams: Promise<{ status?: string; code?: string }> }
type Locale = "en" | "es" | "de"

const USERS = [
  { name: "Juan Vial", email: "juan@n3uralia.com", appMetadata: { procurement_role: "admin" } },
  { name: "Raimundo Colvin", email: "raimundo@blackswn.org", appMetadata: { procurement_role: "approver", procurement_approval_limit_clp: 25_000_000 } },
  { name: "Santiago Colvin", email: "santiago@blackswn.org", appMetadata: { procurement_role: "approver", procurement_approval_limit_clp: 25_000_000 } },
] as const

function safeLocale(value: FormDataEntryValue | null): Locale {
  return value === "es" || value === "de" ? value : "en"
}

function resultPath(locale: Locale, status: "success" | "error", code?: string) {
  const params = new URLSearchParams({ status })
  if (code) params.set("code", code)
  return `/${locale}/admin/procurement-users?${params.toString()}`
}

function secureCompare(received: string, expected: string) {
  const receivedBuffer = Buffer.from(received)
  const expectedBuffer = Buffer.from(expected)
  if (receivedBuffer.length !== expectedBuffer.length) return false
  return timingSafeEqual(receivedBuffer, expectedBuffer)
}

function getSupabaseAdmin() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !serviceRoleKey) throw new Error("Procurement user provisioning is not configured")
  return createClient(supabaseUrl, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } })
}

async function findUserByEmail(supabase: ReturnType<typeof getSupabaseAdmin>, email: string) {
  const normalizedEmail = email.trim().toLowerCase()
  for (let page = 1; page <= 20; page += 1) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 1000 })
    if (error) throw error
    const user = data.users.find((candidate) => candidate.email?.toLowerCase() === normalizedEmail)
    if (user) return user
    if (data.users.length < 1000) break
  }
  return null
}

async function provisionUsers(formData: FormData) {
  "use server"

  const locale = safeLocale(formData.get("locale"))
  const setupSecret = String(formData.get("setupSecret") ?? "")
  const password = String(formData.get("password") ?? "")
  const expectedSecret = process.env.PROCUREMENT_SETUP_SECRET

  if (!expectedSecret) redirect(resultPath(locale, "error", "not-configured"))
  if (!secureCompare(setupSecret, expectedSecret)) redirect(resultPath(locale, "error", "invalid-secret"))
  if (password.length < 12) redirect(resultPath(locale, "error", "short-password"))

  try {
    const supabase = getSupabaseAdmin()
    for (const account of USERS) {
      const existingUser = await findUserByEmail(supabase, account.email)
      if (existingUser) {
        const { error } = await supabase.auth.admin.updateUserById(existingUser.id, {
          password,
          user_metadata: { ...(existingUser.user_metadata ?? {}), full_name: account.name, name: account.name },
          app_metadata: { ...(existingUser.app_metadata ?? {}), ...account.appMetadata },
        })
        if (error) throw error
        continue
      }

      const { error } = await supabase.auth.admin.createUser({
        email: account.email,
        password,
        email_confirm: true,
        user_metadata: { full_name: account.name, name: account.name },
        app_metadata: account.appMetadata,
      })
      if (error) throw error
    }
    redirect(resultPath(locale, "success"))
  } catch (error) {
    console.error("[procurement-users] provisioning failed", error)
    redirect(resultPath(locale, "error", "failed"))
  }
}

export default async function ProcurementUsersPage({ searchParams }: PageProps) {
  const params = await searchParams
  const accounts = USERS.map((user) => ({ name: user.name, email: user.email, role: user.appMetadata.procurement_role }))
  return <ProcurementUsersProvisioning accounts={accounts} action={provisionUsers} status={params.status} code={params.code} />
}
