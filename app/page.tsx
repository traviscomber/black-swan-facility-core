import { AppLayout } from "@/components/app-layout"
import { PageHeader } from "@/components/page-header"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { createClient } from "@/lib/supabase/server"
import type { Utility, Issue, MaintenanceTask } from "@/lib/types"
import Link from "next/link"
import { MapPin, Plus, AlertTriangle, Wrench, CheckCircle2, XCircle, Clock, TrendingUp, Activity } from "lucide-react"
import { IssuesTrendChart, AssetDistributionChart } from "@/components/dashboard-charts"

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

function getUtilityIcon(status: string) {
  switch (status) {
    case "ok":
      return <CheckCircle2 className="h-5 w-5 text-green-600" />
    case "warning":
      return <AlertTriangle className="h-5 w-5 text-yellow-600" />
    case "critical":
      return <XCircle className="h-5 w-5 text-red-600" />
    default:
      return <Activity className="h-5 w-5 text-gray-600" />
  }
}

function formatDate(dateString: string) {
  return new Date(dateString).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  })
}

function formatTime(dateString: string) {
  return new Date(dateString).toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
  })
}

export default async function DashboardPage() {
  const supabase = await createClient()

  // Fetch utilities
  const { data: utilities } = await supabase.from("utilities").select("*").order("category")

  // Fetch ALL issues for trends
  const { data: allIssues } = await supabase
    .from("issues")
    .select("*, assets(name)")
    .order("created_at", { ascending: false })

  // Fetch recent open issues
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

  // Fetch all assets
  const { data: allAssets } = await supabase.from("assets").select("*")

  // Critical assets stats
  const { count: criticalAssetsCount } = await supabase
    .from("assets")
    .select("*", { count: "exact", head: true })
    .eq("is_critical", true)

  const { count: assetsWithIssuesCount } = await supabase
    .from("issues")
    .select("asset_id", { count: "exact", head: true })
    .eq("status", "open")
    .not("asset_id", "is", null)

  // Recent activity - combine issues and maintenance
  const { data: recentLogs } = await supabase
    .from("asset_logs")
    .select("*, assets(name)")
    .order("created_at", { ascending: false })
    .limit(8)

  let hospitalityData = null
  let hospitalityEnabled = false

  // Check if hospitality tables exist by attempting a query and checking the error
  const { error: hospitalityCheckError } = await supabase.from("rooms").select("id").limit(1).maybeSingle()

  // Only fetch hospitality data if tables exist
  if (!hospitalityCheckError) {
    hospitalityEnabled = true

    // Fetch all hospitality data in parallel
    const [roomsResult, reservationsResult, guestRequestsResult, housekeepingResult] = await Promise.all([
      supabase.from("rooms").select("*"),
      supabase
        .from("reservations")
        .select("*")
        .gte("check_out", new Date().toISOString().split("T")[0])
        .order("check_in"),
      supabase.from("guest_requests").select("*, reservations(guest_name)").eq("status", "open").limit(5),
      supabase
        .from("housekeeping_tasks")
        .select("*, rooms(room_number)")
        .eq("status", "pending")
        .order("created_at", { ascending: false })
        .limit(5),
    ])

    const today = new Date().toISOString().split("T")[0]
    const checkIns = reservationsResult.data?.filter((r) => r.check_in === today) || []
    const checkOuts = reservationsResult.data?.filter((r) => r.check_out === today) || []
    const activeReservations = reservationsResult.data?.filter((r) => r.check_in <= today && r.check_out >= today) || []

    hospitalityData = {
      rooms: roomsResult.data || [],
      totalRooms: roomsResult.data?.length || 0,
      occupiedRooms: activeReservations.length,
      checkInsToday: checkIns.length,
      checkOutsToday: checkOuts.length,
      guestRequests: guestRequestsResult.data || [],
      housekeepingTasks: housekeepingResult.data || [],
    }
  }

  // Calculate metrics
  const openIssuesCount = allIssues?.filter((i) => i.status === "open").length || 0
  const resolvedIssuesCount = allIssues?.filter((i) => i.status === "resolved").length || 0
  const totalAssets = allAssets?.length || 0

  const last7Days = Array.from({ length: 7 }, (_, i) => {
    const date = new Date()
    date.setDate(date.getDate() - (6 - i))
    return date.toISOString().split("T")[0]
  })

  const issuesTrendData = last7Days.map((date) => {
    const dayIssues = allIssues?.filter((issue) => issue.created_at?.startsWith(date)) || []
    return {
      date: new Date(date).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      issues: dayIssues.length,
    }
  })

  const assetTypeData =
    allAssets && allAssets.length > 0
      ? allAssets.reduce(
          (acc, asset) => {
            const type = asset.type || "Other"
            const existing = acc.find((item) => item.type === type)
            if (existing) {
              existing.count++
            } else {
              acc.push({ type, count: 1 })
            }
            return acc
          },
          [] as { type: string; count: number }[],
        )
      : [{ type: "No Data", count: 0 }]

  return (
    <AppLayout>
      <PageHeader title="Dashboard" description="Facility overview and system status" />

      <div className="p-4 md:p-6 space-y-6">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card className="border-gray-100">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Total Assets</CardTitle>
              <MapPin className="h-4 w-4 text-blue-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-black">{totalAssets}</div>
              <p className="text-xs text-gray-500 mt-1">{criticalAssetsCount} critical</p>
            </CardContent>
          </Card>

          <Card className="border-gray-100">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Open Issues</CardTitle>
              <AlertTriangle className="h-4 w-4 text-yellow-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-black">{openIssuesCount}</div>
              <p className="text-xs text-gray-500 mt-1">{resolvedIssuesCount} resolved this month</p>
            </CardContent>
          </Card>

          <Card className="border-gray-100">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Pending Tasks</CardTitle>
              <Wrench className="h-4 w-4 text-blue-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-black">{maintenanceTasks?.length || 0}</div>
              <p className="text-xs text-gray-500 mt-1">Maintenance scheduled</p>
            </CardContent>
          </Card>

          <Card className="border-gray-100">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">System Health</CardTitle>
              <TrendingUp className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-black">
                {utilities?.filter((u) => u.status === "ok").length || 0}/{utilities?.length || 0}
              </div>
              <p className="text-xs text-gray-500 mt-1">Utilities operational</p>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <Card className="border-gray-100">
            <CardHeader>
              <CardTitle className="text-base">Issue Trends</CardTitle>
              <CardDescription className="text-xs">Last 7 days</CardDescription>
            </CardHeader>
            <CardContent>
              <IssuesTrendChart data={issuesTrendData} />
            </CardContent>
          </Card>

          <Card className="border-gray-100">
            <CardHeader>
              <CardTitle className="text-base">Asset Distribution</CardTitle>
              <CardDescription className="text-xs">By asset type</CardDescription>
            </CardHeader>
            <CardContent>
              <AssetDistributionChart data={assetTypeData} />
            </CardContent>
          </Card>
        </div>

        {hospitalityEnabled && hospitalityData && (
          <div>
            <h2 className="mb-3 text-base font-semibold text-black">Hospitality Overview</h2>
            <div className="grid gap-4 md:grid-cols-3">
              <Card className="border-gray-100">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium text-gray-600">Occupancy</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-end justify-between mb-2">
                    <div className="text-2xl font-bold text-black">
                      {hospitalityData.totalRooms > 0
                        ? Math.round((hospitalityData.occupiedRooms / hospitalityData.totalRooms) * 100)
                        : 0}
                      %
                    </div>
                    <div className="text-xs text-gray-500">
                      {hospitalityData.occupiedRooms}/{hospitalityData.totalRooms} rooms
                    </div>
                  </div>
                  <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-blue-600 rounded-full"
                      style={{
                        width: `${hospitalityData.totalRooms > 0 ? (hospitalityData.occupiedRooms / hospitalityData.totalRooms) * 100 : 0}%`,
                      }}
                    />
                  </div>
                  <div className="mt-3 flex justify-between text-xs">
                    <span className="text-gray-600">Check-ins: {hospitalityData.checkInsToday}</span>
                    <span className="text-gray-600">Check-outs: {hospitalityData.checkOutsToday}</span>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-gray-100">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium text-gray-600">Guest Requests</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {hospitalityData.guestRequests.length > 0 ? (
                      hospitalityData.guestRequests.slice(0, 3).map((request: any) => (
                        <div key={request.id} className="flex items-start gap-2 text-xs">
                          <Badge variant="outline" className="shrink-0 text-[10px] bg-yellow-50 border-yellow-200">
                            {request.request_type}
                          </Badge>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-black truncate">{request.reservations?.guest_name}</p>
                            <p className="text-gray-500 truncate">{request.description}</p>
                          </div>
                        </div>
                      ))
                    ) : (
                      <p className="text-xs text-gray-400 text-center py-4">No open requests</p>
                    )}
                  </div>
                </CardContent>
              </Card>

              <Card className="border-gray-100">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium text-gray-600">Housekeeping</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {hospitalityData.housekeepingTasks.length > 0 ? (
                      hospitalityData.housekeepingTasks.slice(0, 3).map((task: any) => (
                        <div key={task.id} className="flex items-center justify-between text-xs">
                          <div className="flex items-center gap-2">
                            <div
                              className={`h-2 w-2 rounded-full ${
                                task.priority === "high"
                                  ? "bg-red-500"
                                  : task.priority === "medium"
                                    ? "bg-yellow-500"
                                    : "bg-green-500"
                              }`}
                            />
                            <span className="font-medium text-black">Room {task.rooms?.room_number}</span>
                          </div>
                          <Badge variant="outline" className="text-[10px]">
                            {task.task_type}
                          </Badge>
                        </div>
                      ))
                    ) : (
                      <p className="text-xs text-gray-400 text-center py-4">All tasks complete</p>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        )}

        {!hospitalityEnabled && (
          <Card className="border-gray-100 bg-blue-50/30">
            <CardContent className="p-6 text-center">
              <div className="text-blue-600 mb-2">
                <Activity className="h-8 w-8 mx-auto" />
              </div>
              <h3 className="text-sm font-semibold text-black mb-1">Hospitality Module Available</h3>
              <p className="text-xs text-gray-600 mb-3">
                Run the hospitality setup script to enable guest management features
              </p>
              <Badge variant="outline" className="text-xs bg-white">
                scripts/006_create_hospitality_schema.sql
              </Badge>
            </CardContent>
          </Card>
        )}

        <div>
          <h2 className="mb-3 text-base font-semibold text-black">Utilities Status</h2>
          <div className="grid gap-3 md:grid-cols-3">
            {utilities?.map((utility: Utility) => (
              <Card key={utility.id} className="border-gray-100 hover:border-gray-200 transition-colors">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {getUtilityIcon(utility.status || "unknown")}
                      <CardTitle className="text-sm md:text-base">{utility.category}</CardTitle>
                    </div>
                    <Badge variant="outline" className={getUtilityStatusColor(utility.status || "unknown")}>
                      {utility.status?.toUpperCase()}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="pb-4">
                  <p className="text-xs text-gray-600 md:text-sm line-clamp-2">{utility.notes}</p>
                  <div className="mt-2 flex items-center gap-1 text-xs text-gray-400">
                    <Clock className="h-3 w-3" />
                    {formatDate(utility.last_update)} at {formatTime(utility.last_update)}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <div>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-base font-semibold text-black">Open Issues</h2>
              <Link href="/issues/report">
                <Button size="sm" className="h-8 text-xs">
                  <Plus className="mr-1 h-3 w-3 md:mr-2 md:h-4 md:w-4" />
                  Report Issue
                </Button>
              </Link>
            </div>
            <Card className="border-gray-100">
              <CardContent className="p-0">
                {issues && issues.length > 0 ? (
                  <div className="divide-y divide-gray-100">
                    {issues.map((issue: Issue & { assets?: { name: string } | null }) => (
                      <Link
                        href={`/issues`}
                        key={issue.id}
                        className="flex items-start justify-between gap-3 p-3 hover:bg-gray-50 transition-colors md:items-center md:p-4"
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <AlertTriangle className="h-4 w-4 text-red-500 shrink-0" />
                            <p className="text-sm font-medium text-black truncate">
                              {issue.assets?.name || "No asset"}
                            </p>
                          </div>
                          <p className="mt-0.5 text-xs text-gray-600 line-clamp-2 md:text-sm">{issue.description}</p>
                          <p className="mt-1 text-xs text-gray-400">{formatDate(issue.created_at)}</p>
                        </div>
                        <Badge variant="outline" className="shrink-0 bg-red-50 text-red-700 border-red-200 text-xs">
                          {issue.status}
                        </Badge>
                      </Link>
                    ))}
                  </div>
                ) : (
                  <div className="p-8 text-center">
                    <CheckCircle2 className="h-12 w-12 text-green-500 mx-auto mb-2" />
                    <p className="text-sm text-gray-600 font-medium">No open issues</p>
                    <p className="text-xs text-gray-400 mt-1">All systems operational</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          <div>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-base font-semibold text-black">Upcoming Maintenance</h2>
              <Link href="/maintenance">
                <Button variant="outline" size="sm" className="h-8 text-xs bg-transparent">
                  View All
                </Button>
              </Link>
            </div>
            <Card className="border-gray-100">
              <CardContent className="p-0">
                {maintenanceTasks && maintenanceTasks.length > 0 ? (
                  <div className="divide-y divide-gray-100">
                    {maintenanceTasks.map((task: MaintenanceTask & { assets?: { name: string } | null }) => (
                      <Link
                        href="/maintenance"
                        key={task.id}
                        className="flex flex-col gap-2 p-3 hover:bg-gray-50 transition-colors md:flex-row md:items-center md:justify-between md:p-4"
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <Wrench className="h-4 w-4 text-blue-600 shrink-0" />
                            <p className="text-sm font-medium text-black truncate">{task.title}</p>
                          </div>
                          <p className="mt-0.5 text-xs text-gray-600">Asset: {task.assets?.name || "General"}</p>
                        </div>
                        <div className="flex items-center gap-2 md:flex-col md:items-end">
                          <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700 border-blue-200">
                            {task.frequency || "One-time"}
                          </Badge>
                          <p className="text-xs font-medium text-gray-600">
                            {task.next_run ? formatDate(task.next_run) : "Not scheduled"}
                          </p>
                        </div>
                      </Link>
                    ))}
                  </div>
                ) : (
                  <div className="p-8 text-center">
                    <CheckCircle2 className="h-12 w-12 text-gray-300 mx-auto mb-2" />
                    <p className="text-sm text-gray-600 font-medium">No upcoming maintenance</p>
                    <p className="text-xs text-gray-400 mt-1">All maintenance tasks completed</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>

        <div>
          <h2 className="mb-3 text-base font-semibold text-black">Recent Activity</h2>
          <Card className="border-gray-100">
            <CardContent className="p-0">
              {recentLogs && recentLogs.length > 0 ? (
                <div className="divide-y divide-gray-100">
                  {recentLogs.map((log: any) => (
                    <div key={log.id} className="flex items-start gap-3 p-3 md:p-4">
                      <div className="shrink-0 mt-0.5">
                        <Activity className="h-4 w-4 text-blue-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-black">
                          {log.log_type || "Activity"} - {log.assets?.name || "Unknown asset"}
                        </p>
                        <p className="mt-0.5 text-xs text-gray-600 line-clamp-2">{log.description}</p>
                        <p className="mt-1 text-xs text-gray-400">
                          {formatDate(log.created_at)} at {formatTime(log.created_at)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-8 text-center text-sm text-gray-400">No recent activity</div>
              )}
            </CardContent>
          </Card>
        </div>

        <Card className="border-gray-100">
          <CardHeader>
            <CardTitle className="text-base">Quick Actions</CardTitle>
            <CardDescription className="text-xs">Common facility management tasks</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            <Link href="/map">
              <Button variant="outline" className="w-full justify-start bg-transparent text-sm h-10">
                <MapPin className="mr-2 h-4 w-4" />
                Open GIS Map
              </Button>
            </Link>
            <Link href="/issues/report">
              <Button variant="outline" className="w-full justify-start bg-transparent text-sm h-10">
                <AlertTriangle className="mr-2 h-4 w-4" />
                Report Issue
              </Button>
            </Link>
            <Link href="/assets">
              <Button variant="outline" className="w-full justify-start bg-transparent text-sm h-10">
                <Plus className="mr-2 h-4 w-4" />
                Add Asset
              </Button>
            </Link>
            <Link href="/maintenance">
              <Button variant="outline" className="w-full justify-start bg-transparent text-sm h-10">
                <Wrench className="mr-2 h-4 w-4" />
                Schedule Maintenance
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  )
}
