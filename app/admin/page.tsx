import Link from "next/link"
import { AppLayout } from "@/components/app-layout"
import { AdminControlCard, AdminOverview } from "@/components/admin-overview"
import { createClient } from "@/lib/supabase/server"

export default async function AdminPage() {
  const supabase = await createClient()

  const [
    assets,
    employees,
    issues,
    maintenance,
    checklists,
    criticalAssets,
    assetTypes,
    locations,
    issueTypes,
    approverAudit,
    procurementAudit,
    auditActions,
  ] = await Promise.all([
    supabase.from("assets").select("*", { count: "exact", head: true }),
    supabase.from("employees").select("*", { count: "exact", head: true }).eq("is_active", true),
    supabase.from("issues").select("*", { count: "exact", head: true }).eq("status", "open"),
    supabase.from("maintenance_tasks").select("*", { count: "exact", head: true }).eq("status", "pending"),
    supabase.from("checklists").select("*", { count: "exact", head: true }),
    supabase.from("assets").select("*", { count: "exact", head: true }).eq("is_critical", true),
    supabase.from("infrastructure_asset_types").select("*", { count: "exact", head: true }).eq("is_active", true),
    supabase.from("locations").select("*", { count: "exact", head: true }).eq("is_active", true),
    supabase.from("issue_types").select("*", { count: "exact", head: true }).eq("is_active", true),
    supabase.from("approver_audit_log").select("*", { count: "exact", head: true }),
    supabase.from("procurement_audit_log").select("*", { count: "exact", head: true }),
    supabase.from("audit_actions").select("*", { count: "exact", head: true }),
  ])

  return (
    <AppLayout>
      <AdminOverview
        counts={{
          assets: assets.count ?? 0,
          criticalAssets: criticalAssets.count ?? 0,
          employees: employees.count ?? 0,
          openIssues: issues.count ?? 0,
          pendingMaintenance: maintenance.count ?? 0,
          checklists: checklists.count ?? 0,
          assetTypes: assetTypes.count ?? 0,
          locations: locations.count ?? 0,
          issueTypes: issueTypes.count ?? 0,
        }}
        auditRecords={(approverAudit.count ?? 0) + (procurementAudit.count ?? 0) + (auditActions.count ?? 0)}
      />
      <div className="grid gap-4 px-4 pb-8 md:grid-cols-2 md:px-8">
        <Link href="/admin/access" className="group"><AdminControlCard kind="access" /></Link>
        <Link href="/admin/it-control" className="group"><AdminControlCard kind="it" /></Link>
      </div>
    </AppLayout>
  )
}
