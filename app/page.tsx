import { AppLayout } from "@/components/app-layout"
import { PageHeader } from "@/components/page-header"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { createClient } from "@/lib/supabase/server"
import type { Utility, Issue, MaintenanceTask } from "@/lib/types"
import Link from "next/link"
import { MapPin, Plus, AlertTriangle } from "lucide-react"

function getUtilityStatusColor(status: string) {
  switch (status) {
    case "ok":
      return "bg-green-100 text-green-800 border-green-200"
    case "warning":
      return "bg-yellow-100 text-yellow-800 border-yellow-200"
    case "critical":
      return "bg-red-100 text-red-800 border-red-200"
    default:
      return "bg-gray-100 text-gray-800 border-gray-200"
  }
}

function formatDate(dateString: string) {
  return new Date(dateString).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  })
}

export default async function DashboardPage() {
  const supabase = await createClient()

  // Fetch utilities
  const { data: utilities } = await supabase.from("utilities").select("*").order("category")

  // Fetch recent issues
  const { data: issues } = await supabase
    .from("issues")
    .select("*, assets(name)")
    .eq("status", "open")
    .order("created_at", { ascending: false })
    .limit(5)

  // Fetch upcoming maintenance
  const { data: maintenanceTasks } = await supabase
    .from("maintenance_tasks")
    .select("*, assets(name)")
    .eq("status", "pending")
    .order("next_run", { ascending: true })
    .limit(5)

  // Fetch critical assets stats
  const { count: criticalAssetsCount } = await supabase
    .from("assets")
    .select("*", { count: "exact", head: true })
    .eq("is_critical", true)

  const { count: assetsWithIssuesCount } = await supabase
    .from("issues")
    .select("asset_id", { count: "exact", head: true })
    .eq("status", "open")
    .not("asset_id", "is", null)

  return (
    <AppLayout>
      <PageHeader title="Dashboard" description="Facility overview and system status" />

      <div className="p-4 md:p-6">
        <div className="grid gap-4 md:gap-6">
          {/* Utilities Status */}
          <div>
            <h2 className="mb-3 text-sm font-semibold text-black md:text-base">Utilities Status</h2>
            <div className="grid gap-3 md:grid-cols-3">
              {utilities?.map((utility: Utility) => (
                <Card key={utility.id} className="border-gray-100">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-sm md:text-base">{utility.category}</CardTitle>
                      <Badge variant="outline" className={getUtilityStatusColor(utility.status || "unknown")}>
                        {utility.status?.toUpperCase()}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="pb-4">
                    <p className="text-xs text-gray-600 md:text-sm">{utility.notes}</p>
                    <p className="mt-2 text-xs text-gray-400">Last updated: {formatDate(utility.last_update)}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>

          {/* Open Issues Panel */}
          <div>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-black md:text-base">Open Issues</h2>
              <Link href="/issues/report">
                <Button size="sm" className="h-8 text-xs">
                  <Plus className="mr-1 h-3 w-3 md:mr-2 md:h-4 md:w-4" />
                  <span className="hidden sm:inline">Report Issue</span>
                  <span className="sm:hidden">Report</span>
                </Button>
              </Link>
            </div>
            <Card className="border-gray-100">
              <CardContent className="p-0">
                {issues && issues.length > 0 ? (
                  <div className="divide-y divide-gray-100">
                    {issues.map((issue: Issue & { assets?: { name: string } | null }) => (
                      <div key={issue.id} className="flex items-start justify-between gap-3 p-3 md:items-center md:p-4">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-black truncate">{issue.assets?.name || "No asset"}</p>
                          <p className="mt-0.5 text-xs text-gray-600 line-clamp-2 md:text-sm">{issue.description}</p>
                          <p className="mt-1 text-xs text-gray-400">{formatDate(issue.created_at)}</p>
                        </div>
                        <Badge variant="outline" className="shrink-0 bg-red-50 text-red-700 border-red-200 text-xs">
                          {issue.status}
                        </Badge>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-8 text-center text-sm text-gray-400">No open issues</div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Upcoming Maintenance */}
          <div>
            <h2 className="mb-3 text-sm font-semibold text-black md:text-base">Upcoming Maintenance</h2>
            <Card className="border-gray-100">
              <CardContent className="p-0">
                {maintenanceTasks && maintenanceTasks.length > 0 ? (
                  <div className="divide-y divide-gray-100">
                    {maintenanceTasks.map((task: MaintenanceTask & { assets?: { name: string } | null }) => (
                      <div
                        key={task.id}
                        className="flex flex-col gap-2 p-3 md:flex-row md:items-center md:justify-between md:p-4"
                      >
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-black truncate">{task.title}</p>
                          <p className="mt-0.5 text-xs text-gray-600">Asset: {task.assets?.name || "General"}</p>
                        </div>
                        <div className="flex items-center gap-2 md:flex-col md:items-end">
                          <p className="text-xs font-medium text-black md:text-sm">
                            {task.next_run ? formatDate(task.next_run) : "Not scheduled"}
                          </p>
                          <Badge variant="outline" className="text-xs">
                            {task.frequency || "One-time"}
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-8 text-center text-sm text-gray-400">No upcoming maintenance</div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Critical Assets Summary & Shortcuts */}
          <div className="grid gap-4 md:grid-cols-2">
            <Card className="border-gray-100">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm md:text-base">Critical Assets</CardTitle>
                <CardDescription className="text-xs">System health overview</CardDescription>
              </CardHeader>
              <CardContent className="pb-4">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-600 md:text-sm">Total Critical Assets</span>
                    <span className="text-xl font-semibold text-black md:text-2xl">{criticalAssetsCount || 0}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-600 md:text-sm">Assets with Issues</span>
                    <div className="flex items-center gap-2">
                      <span className="text-xl font-semibold text-black md:text-2xl">{assetsWithIssuesCount || 0}</span>
                      {(assetsWithIssuesCount || 0) > 0 && (
                        <AlertTriangle className="h-4 w-4 text-yellow-600 md:h-5 md:w-5" />
                      )}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-gray-100">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm md:text-base">Quick Actions</CardTitle>
                <CardDescription className="text-xs">Common tasks</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2 pb-4">
                <Link href="/map">
                  <Button variant="outline" className="h-9 w-full justify-start bg-transparent text-xs md:text-sm">
                    <MapPin className="mr-2 h-3 w-3 md:h-4 md:w-4" />
                    Open GIS Map
                  </Button>
                </Link>
                <Link href="/issues/report">
                  <Button variant="outline" className="h-9 w-full justify-start bg-transparent text-xs md:text-sm">
                    <AlertTriangle className="mr-2 h-3 w-3 md:h-4 md:w-4" />
                    Report New Issue
                  </Button>
                </Link>
                <Link href="/assets">
                  <Button variant="outline" className="h-9 w-full justify-start bg-transparent text-xs md:text-sm">
                    <Plus className="mr-2 h-3 w-3 md:h-4 md:w-4" />
                    Add New Asset
                  </Button>
                </Link>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </AppLayout>
  )
}
