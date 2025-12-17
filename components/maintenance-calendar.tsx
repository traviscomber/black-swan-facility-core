"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ChevronLeft, ChevronRight, AlertCircle } from "lucide-react"
import { format, addDays, subDays, startOfMonth, endOfMonth, getDaysInMonth, isSameDay } from "date-fns"

interface MaintenanceTask {
  id: string
  title: string
  asset_id: string | null
  assets?: { name: string } | null
  frequency: string | null
  next_run: string | null
  assigned_to: string | null
  employees?: { name: string } | null
  status: string
}

interface MaintenanceCalendarProps {
  tasks: MaintenanceTask[]
}

export function MaintenanceCalendar({ tasks }: MaintenanceCalendarProps) {
  const [startDate, setStartDate] = useState(new Date())
  const [displayedTasks, setDisplayedTasks] = useState<MaintenanceTask[]>(tasks)

  const firstDayOfMonth = startOfMonth(startDate)
  const lastDayOfMonth = endOfMonth(startDate)
  const daysInMonth = getDaysInMonth(startDate)
  const dateArray = Array.from({ length: daysInMonth }, (_, i) => addDays(firstDayOfMonth, i))
  const today = new Date()

  useEffect(() => {
    setDisplayedTasks(tasks)
  }, [tasks])

  const getTasksForDate = (date: Date) => {
    return displayedTasks.filter((task) => {
      if (!task.next_run) return false
      const taskDate = new Date(task.next_run)
      return isSameDay(taskDate, date)
    })
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case "pending":
        return "bg-yellow-100 text-yellow-800 border-yellow-300"
      case "completed":
        return "bg-green-100 text-green-800 border-green-300"
      case "overdue":
        return "bg-red-100 text-red-800 border-red-300"
      default:
        return "bg-gray-100 text-gray-800 border-gray-300"
    }
  }

  const stats = {
    total: displayedTasks.length,
    completed: displayedTasks.filter((t) => t.status === "completed").length,
    overdue: displayedTasks.filter((t) => t.status === "overdue").length,
  }

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-white">Total Tasks</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-white">{stats.total}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-white">Completed</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-green-400">{stats.completed}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-white">Overdue</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-red-400">{stats.overdue}</div>
          </CardContent>
        </Card>
      </div>

      {/* Calendar Controls */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-white">{format(startDate, "MMMM yyyy")}</CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              {daysInMonth} days in {format(startDate, "MMMM")}
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setStartDate(subDays(startDate, 30))} className="gap-2">
              <ChevronLeft className="h-4 w-4" />
              Previous
            </Button>
            <Button variant="outline" size="sm" onClick={() => setStartDate(new Date())}>
              Today
            </Button>
            <Button variant="outline" size="sm" onClick={() => setStartDate(addDays(startDate, 30))} className="gap-2">
              Next
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
      </Card>

      {/* Calendar Table */}
      <Card className="border-0 shadow-lg overflow-x-auto">
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-800 border-b border-slate-700">
                <th className="text-left font-semibold text-white px-4 py-3 w-48 sticky left-0 bg-slate-800">
                  Asset / Task
                </th>
                {dateArray.map((date) => {
                  const isToday = isSameDay(date, today)
                  return (
                    <th
                      key={date.toISOString()}
                      className={`text-center font-semibold px-2 py-3 w-20 min-w-20 whitespace-nowrap ${
                        isToday ? "bg-amber-900/30 border-2 border-amber-500 rounded" : "bg-slate-800"
                      }`}
                    >
                      <div className={`text-xs font-semibold ${isToday ? "text-amber-300" : "text-gray-400"}`}>
                        {format(date, "EEE")}
                      </div>
                      <div className={`text-sm ${isToday ? "text-amber-300 font-bold" : "text-gray-300"}`}>
                        {format(date, "d")}
                      </div>
                    </th>
                  )
                })}
              </tr>
            </thead>
            <tbody>
              {displayedTasks.map((task) => (
                <tr key={task.id} className="border-b border-slate-700 hover:bg-slate-800/50">
                  <td className="px-4 py-3 font-medium text-white sticky left-0 bg-slate-900 z-10">
                    <div>{task.title}</div>
                    <div className="text-xs text-gray-400 mt-1">
                      {task.assets?.name || "General"} • {task.employees?.name || "Unassigned"}
                    </div>
                  </td>
                  {dateArray.map((date) => {
                    const tasksOnDate = getTasksForDate(date)
                    const isThisTask = tasksOnDate.some((t) => t.id === task.id)

                    return (
                      <td
                        key={date.toISOString()}
                        className={`text-center px-2 py-3 ${isSameDay(date, today) ? "bg-amber-900/10" : ""}`}
                      >
                        {isThisTask && <Badge className={`${getStatusColor(task.status)} border`}>{task.status}</Badge>}
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      {/* Info Card */}
      <Card className="border-primary/20 bg-primary/5">
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2 text-white">
            <AlertCircle className="h-4 w-4" />
            Calendar Legend
          </CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-gray-300 space-y-2">
          <p>
            •{" "}
            <Badge className="bg-yellow-100 text-yellow-800 border-yellow-300 border inline-block ml-2">Pending</Badge>{" "}
            - Task scheduled
          </p>
          <p>
            • <Badge className="bg-green-100 text-green-800 border-green-300 border inline-block ml-2">Completed</Badge>{" "}
            - Task finished
          </p>
          <p>
            • <Badge className="bg-red-100 text-red-800 border-red-300 border inline-block ml-2">Overdue</Badge> - Task
            past due date
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
