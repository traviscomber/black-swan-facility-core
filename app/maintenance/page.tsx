"use client"

import { AppLayout } from "@/components/app-layout"
import { PageHeader } from "@/components/page-header"
import { Button } from "@/components/ui/button"
import { MaintenanceCalendar } from "@/components/maintenance-calendar"
import { createBrowserClient } from "@/lib/supabase/client"
import { useLanguage } from "@/lib/hooks/use-language"
import { Plus } from "lucide-react"
import { useEffect, useState } from "react"

export default function MaintenancePage() {
  const supabase = createBrowserClient()
  const { t } = useLanguage()
  const [tasks, setTasks] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchTasks()
  }, [])

  const fetchTasks = async () => {
    try {
      setLoading(true)
      const { data, error } = await supabase
        .from("maintenance_tasks")
        .select("*, assets(name), employees(name)")
        .order("next_run", { ascending: true })

      if (error) throw error
      setTasks(data || [])
    } catch (error) {
      console.error("[v0] Error fetching maintenance tasks:", error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <AppLayout>
      <PageHeader
        title={t("maintenance.title")}
        description={t("maintenance.description")}
        actions={
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            {t("maintenance.add_task")}
          </Button>
        }
      />

      <div className="p-8">
        <MaintenanceCalendar tasks={tasks} />
      </div>
    </AppLayout>
  )
}
