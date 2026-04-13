'use client'

import { AppLayout } from '@/components/app-layout'
import { PageHeader } from '@/components/page-header'
import { Button } from '@/components/ui/button'
import { MaintenanceWeekView } from '@/components/maintenance-week-view'
import { createClient } from '@/lib/supabase/client'
import { useLanguage } from '@/lib/hooks/use-language'
import { Plus } from 'lucide-react'
import { useEffect, useState } from 'react'

export default function MaintenancePage() {
  const supabase = createClient()
  const { t } = useLanguage()
  const [tasks, setTasks] = useState([])
  const [loading, setLoading] = useState(true)
  const [kpis, setKpis] = useState({
    total_orders: 0,
    completed_this_week: 0,
    pending_orders: 0,
    overdue_orders: 0,
  })

  useEffect(() => {
    fetchTasks()
  }, [])

  const fetchTasks = async () => {
    try {
      setLoading(true)
      const { data, error } = await supabase
        .from('maintenance_tasks')
        .select('*, assets(name), employees(name)')
        .order('next_run', { ascending: true })

      if (error) throw error
      
      const tasksData = data || []
      setTasks(tasksData)
      
      // Calculate KPIs
      const now = new Date()
      const weekStart = new Date(now.getTime() - now.getDay() * 24 * 60 * 60 * 1000)
      const weekEnd = new Date(weekStart.getTime() + 6 * 24 * 60 * 60 * 1000)
      
      const completedThisWeek = tasksData.filter((task: any) => {
        const completed = task.last_completed ? new Date(task.last_completed) : null
        return completed && completed >= weekStart && completed <= weekEnd
      }).length
      
      const pending = tasksData.filter((task: any) => task.status !== 'completed').length
      const overdue = tasksData.filter((task: any) => {
        const nextRun = new Date(task.next_run)
        return nextRun < now && task.status !== 'completed'
      }).length
      
      setKpis({
        total_orders: tasksData.length,
        completed_this_week: completedThisWeek,
        pending_orders: pending,
        overdue_orders: overdue,
      })
    } catch (error) {
      console.error('[v0] Error fetching maintenance tasks:', error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <AppLayout>
      <PageHeader
        title={t('maintenance.title')}
        description={t('maintenance.description')}
        actions={
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            {t('maintenance.add_task')}
          </Button>
        }
      />

      <div className="p-6 space-y-6">
        {/* KPI Stats Row */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white p-4 rounded-lg border">
            <div className="text-sm text-gray-600">{t('stats.total_orders')}</div>
            <div className="text-3xl font-bold">{kpis.total_orders}</div>
          </div>
          <div className="bg-white p-4 rounded-lg border">
            <div className="text-sm text-gray-600">{t('stats.completed_this_week')}</div>
            <div className="text-3xl font-bold text-green-600">{kpis.completed_this_week}</div>
          </div>
          <div className="bg-white p-4 rounded-lg border">
            <div className="text-sm text-gray-600">{t('stats.pending_orders')}</div>
            <div className="text-3xl font-bold text-blue-600">{kpis.pending_orders}</div>
          </div>
          <div className="bg-white p-4 rounded-lg border">
            <div className="text-sm text-gray-600">{t('stats.overdue_orders')}</div>
            <div className="text-3xl font-bold text-red-600">{kpis.overdue_orders}</div>
          </div>
        </div>

        {/* Week View */}
        {!loading && <MaintenanceWeekView tasks={tasks} />}
        {loading && <div className="text-center py-12">{t('common.loading')}</div>}
      </div>
    </AppLayout>
  )
}
