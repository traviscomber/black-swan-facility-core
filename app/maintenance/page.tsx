import { AppLayout } from "@/components/app-layout"
import { PageHeader } from "@/components/page-header"
import { Button } from "@/components/ui/button"
import { MaintenanceCalendar } from "@/components/maintenance-calendar"
import { createClient } from "@/lib/supabase/server"
import { Plus } from "lucide-react"

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
        <MaintenanceCalendar tasks={tasks || []} />
      </div>
    </AppLayout>
  )
}
