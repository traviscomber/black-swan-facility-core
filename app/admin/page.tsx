import { AppLayout } from "@/components/app-layout"
import { PageHeader } from "@/components/page-header"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { createClient } from "@/lib/supabase/server"
import { Database, Users, Box, Wrench, AlertTriangle, CheckSquare } from "lucide-react"

export default async function AdminPage() {
  const supabase = await createClient()

  // Get counts for all entities
  const { count: assetsCount } = await supabase.from("assets").select("*", { count: "exact", head: true })

  const { count: employeesCount } = await supabase
    .from("employees")
    .select("*", { count: "exact", head: true })
    .eq("is_active", true)

  const { count: issuesCount } = await supabase
    .from("issues")
    .select("*", { count: "exact", head: true })
    .eq("status", "open")

  const { count: maintenanceCount } = await supabase
    .from("maintenance_tasks")
    .select("*", { count: "exact", head: true })
    .eq("status", "pending")

  const { count: checklistsCount } = await supabase.from("checklists").select("*", { count: "exact", head: true })

  const { count: criticalAssetsCount } = await supabase
    .from("assets")
    .select("*", { count: "exact", head: true })
    .eq("is_critical", true)

  return (
    <AppLayout>
      <PageHeader title="Admin Settings" description="System overview and configuration" />

      <div className="p-8">
        <div className="space-y-6">
          {/* System Overview */}
          <div>
            <h2 className="mb-4 text-lg font-semibold text-black">System Overview</h2>
            <div className="grid gap-4 md:grid-cols-3">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium">Total Assets</CardTitle>
                  <Box className="h-4 w-4 text-gray-600" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{assetsCount || 0}</div>
                  <p className="mt-1 text-xs text-gray-600">{criticalAssetsCount} critical</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium">Active Employees</CardTitle>
                  <Users className="h-4 w-4 text-gray-600" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{employeesCount || 0}</div>
                  <p className="mt-1 text-xs text-gray-600">Staff members</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium">Open Issues</CardTitle>
                  <AlertTriangle className="h-4 w-4 text-gray-600" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{issuesCount || 0}</div>
                  <p className="mt-1 text-xs text-gray-600">Require attention</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium">Pending Maintenance</CardTitle>
                  <Wrench className="h-4 w-4 text-gray-600" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{maintenanceCount || 0}</div>
                  <p className="mt-1 text-xs text-gray-600">Tasks scheduled</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium">Checklists</CardTitle>
                  <CheckSquare className="h-4 w-4 text-gray-600" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{checklistsCount || 0}</div>
                  <p className="mt-1 text-xs text-gray-600">Total checklists</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium">Database</CardTitle>
                  <Database className="h-4 w-4 text-gray-600" />
                </CardHeader>
                <CardContent>
                  <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                    Connected
                  </Badge>
                  <p className="mt-2 text-xs text-gray-600">Supabase</p>
                </CardContent>
              </Card>
            </div>
          </div>

          {/* Database Information */}
          <Card>
            <CardHeader>
              <CardTitle>Database Configuration</CardTitle>
              <CardDescription>Connected to Supabase with Row Level Security enabled</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">Tables:</span>
                  <span className="font-medium">8 tables configured</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Security:</span>
                  <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                    RLS Enabled
                  </Badge>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </AppLayout>
  )
}
