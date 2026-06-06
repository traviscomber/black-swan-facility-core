'use client'

import { useState } from 'react'
import { useLanguage } from '@/lib/hooks/use-language'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { format, addDays, startOfWeek } from 'date-fns'

interface WorkOrder {
  id: string
  title: string
  status: string
  priority: string
  assigned_to?: string
  date_objective: string
}

interface MaintenanceWeekViewProps {
  tasks: WorkOrder[]
  onTaskClick?: (task: WorkOrder) => void
}

const getStatusColor = (status: string) => {
  const colors: Record<string, string> = {
    draft: 'bg-gray-100 text-gray-800',
    scheduled: 'bg-blue-100 text-blue-800',
    assigned: 'bg-purple-100 text-purple-800',
    in_progress: 'bg-yellow-100 text-yellow-800',
    blocked: 'bg-red-100 text-red-800',
    completed: 'bg-green-100 text-green-800',
    verified: 'bg-emerald-100 text-emerald-800',
    cancelled: 'bg-gray-200 text-gray-600',
  }
  return colors[status] || 'bg-gray-100 text-gray-800'
}

const getPriorityColor = (priority: string) => {
  const colors: Record<string, string> = {
    low: 'text-green-600',
    medium: 'text-yellow-600',
    high: 'text-orange-600',
    critical: 'text-red-600',
  }
  return colors[priority] || 'text-gray-600'
}

export function MaintenanceWeekView({ tasks, onTaskClick }: MaintenanceWeekViewProps) {
  const { t } = useLanguage()
  const [currentDate, setCurrentDate] = useState(new Date())
  
  const weekStart = startOfWeek(currentDate)
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))
  
  const getTasksForDate = (date: Date) => {
    const dateStr = format(date, 'yyyy-MM-dd')
    return tasks.filter(task => task.date_objective?.startsWith(dateStr))
  }

  const goToPreviousWeek = () => setCurrentDate(addDays(currentDate, -7))
  const goToNextWeek = () => setCurrentDate(addDays(currentDate, 7))

  return (
    <div className="space-y-4">
      {/* Week Navigation */}
      <div className="flex items-center justify-between">
        <Button variant="outline" size="sm" onClick={goToPreviousWeek}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <div className="text-sm font-semibold">
          {format(weekStart, 'MMM d')} - {format(addDays(weekStart, 6), 'MMM d, yyyy')}
        </div>
        <Button variant="outline" size="sm" onClick={goToNextWeek}>
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      {/* Week Grid */}
      <div className="grid grid-cols-7 gap-2">
        {weekDays.map((date) => {
          const dayTasks = getTasksForDate(date)
          const isToday = format(date, 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd')

          return (
            <Card key={format(date, 'yyyy-MM-dd')} className={isToday ? 'border-2 border-blue-500' : ''}>
              <CardHeader className="pb-2">
                <div className="text-xs font-semibold text-gray-500">
                  {format(date, 'EEE')}
                </div>
                <div className={`text-lg font-bold ${isToday ? 'text-blue-600' : ''}`}>
                  {format(date, 'd')}
                </div>
              </CardHeader>
              <CardContent className="space-y-1">
                {dayTasks.length === 0 ? (
                  <div className="text-xs text-gray-400">{t('maintenance.no_tasks_today')}</div>
                ) : (
                  dayTasks.map((task) => (
                    <div
                      key={task.id}
                      onClick={() => onTaskClick?.(task)}
                      className="p-2 bg-gray-50 rounded cursor-pointer hover:bg-gray-100 transition"
                    >
                      <div className="text-xs font-medium truncate">{task.title}</div>
                      <div className="flex gap-1 mt-1">
                        <Badge variant="secondary" className={`text-xs ${getStatusColor(task.status)}`}>
                          {task.status}
                        </Badge>
                        {task.priority && (
                          <span className={`text-xs font-semibold ${getPriorityColor(task.priority)}`}>
                            {task.priority}
                          </span>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          )
        })}
      </div>
    </div>
  )
}
