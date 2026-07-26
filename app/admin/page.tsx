import { AppLayout } from "@/components/app-layout"
import { AdminOverview } from "@/components/admin-overview"
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
        controls={{
          publicTables: 129,
          rlsEnabled: 129,
          rlsDisabled: 0,
          tablesWithoutPolicies: 0,
          permissiveTables: 75,
          publicRoleTables: 60,
          authenticatedRoleTables: 15,
          adminUsers: 1,
          approverUsers: 3,
          auditRecords: (approverAudit.count ?? 0) + (procurementAudit.count ?? 0) + (auditActions.count ?? 0),
          verifiedOn: "26-07-2026",
        }}
      />
    </AppLayout>
  )
}
