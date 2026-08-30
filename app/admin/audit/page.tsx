import { AdminAuditView } from "@/components/admin-audit-view"
import { createClient } from "@/lib/supabase/server"

const tables = ["approver_audit_log", "procurement_audit_log", "audit_actions"] as const

export default async function AdminAuditPage() {
  const supabase = await createClient()
  const results = await Promise.all(tables.map((table) => supabase.from(table).select("*", { count: "exact", head: true })))
  const sources = tables.map((table, index) => ({ table, count: results[index].count ?? 0, failed: Boolean(results[index].error) }))
  return <AdminAuditView sources={sources} />
}
