import { AppLayout } from "@/components/app-layout"
import { PageHeader } from "@/components/page-header"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { createClient } from "@/lib/supabase/server"
import type { MaintenanceTask } from "@/lib/types"
import { Plus } from "lucide-react"

function formatDate(dateString: string | null) {
  if (!dateString) return "-"
  return new Date(dateString).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  })
}

function getStatusColor(status: string) {
  switch (status) {
    case "pending":
      return "bg-yellow-50 text-yellow-700 border-yellow-200"
    case "completed":
      return "bg-green-50 text-green-700 border-green-200"
    case "overdue":
      return "bg-red-50 text-red-700 border-red-200"
    default:
      return "bg-gray-50 text-gray-700 border-gray-200"
  }
}

export default async function MaintenancePage() {
  const supabase = await createClient()

  const { data: tasks } = await supabase
    .from("maintenance_tasks")
    .select("*, assets(name), employees(name)")
    .order("next_run", { ascending: true })

  return (
    <AppLayout>
      <PageHeader
        title="Maintenance Tasks"
        description="Schedule and track maintenance activities"
        actions={
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            Add Task
          </Button>
        }
      />

      <div className="p-8">
        <div className="rounded-lg border border-gray-200 bg-white">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Title</TableHead>
                <TableHead>Asset</TableHead>
                <TableHead>Frequency</TableHead>
                <TableHead>Next Run</TableHead>
                <TableHead>Assigned To</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tasks && tasks.length > 0 ? (
                tasks.map(
                  (
                    task: MaintenanceTask & { assets?: { name: string } | null; employees?: { name: string } | null },
                  ) => (
                    <TableRow key={task.id}>
                      <TableCell className="font-medium">{task.title}</TableCell>
                      <TableCell>{task.assets?.name || "General"}</TableCell>
                      <TableCell>{task.frequency ? <Badge variant="outline">{task.frequency}</Badge> : "-"}</TableCell>
                      <TableCell>{formatDate(task.next_run)}</TableCell>
                      <TableCell>{task.employees?.name || "Unassigned"}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className={getStatusColor(task.status)}>
                          {task.status}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ),
                )
              ) : (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-gray-500">
                    No maintenance tasks found
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </AppLayout>
  )
}
