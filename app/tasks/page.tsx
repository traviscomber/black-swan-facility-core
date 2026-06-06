"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Plus, Calendar, Users, CheckCircle2, Clock, AlertCircle } from "lucide-react"
import { createBrowserClient } from "@/lib/supabase/client"
import { AddTaskDialog } from "@/components/add-task-dialog"
import { TaskDetailPanel } from "@/components/task-detail-panel"
import { EditTaskDialog } from "@/components/edit-task-dialog"
import { useLanguage } from "@/lib/hooks/use-language"
import { format, isToday, isThisWeek } from "date-fns"
import { es } from "date-fns/locale"
import { AppLayout } from "@/components/app-layout"

interface Task {
  id: string
  title: string
  description: string
  priority: "baja" | "media" | "alta" | "urgente"
  status: "nueva" | "en_progreso" | "completada" | "cancelada"
  due_date: string
  location_name: string
  latitude: number
  longitude: number
  created_at: string
  task_assignments: {
    employee_id: string
    employees: {
      id: string
      name: string
      email: string
    }
  }[]
}

const priorityColors = {
  baja: "bg-gray-100 text-gray-800",
  media: "bg-yellow-100 text-yellow-800",
  alta: "bg-orange-100 text-orange-800",
  urgente: "bg-red-100 text-red-800",
}

export default function TasksPage() {
  const { t } = useLanguage()
  const [tasks, setTasks] = useState<Task[]>([])
  const [selectedTask, setSelectedTask] = useState<Task | null>(null)
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [taskToEdit, setTaskToEdit] = useState<Task | null>(null)
  const [activeTab, setActiveTab] = useState("nuevas")
  const [isLoading, setIsLoading] = useState(true)
  const supabase = createBrowserClient()

  const priorityLabels = {
    baja: t("tasks.low"),
    media: t("tasks.medium"),
    alta: t("tasks.high"),
    urgente: t("tasks.urgent"),
  }

  const statusLabels = {
    nueva: t("tasks.new"),
    en_progreso: t("tasks.in_progress"),
    completada: t("tasks.completed"),
    cancelada: t("tasks.cancelled"),
  }

  useEffect(() => {
    fetchTasks()
  }, [])

  async function fetchTasks() {
    setIsLoading(true)
    const { data, error } = await supabase
      .from("tasks")
      .select(`
        *,
        task_assignments(
          employee_id,
          employees(id, name, email)
        )
      `)
      .order("created_at", { ascending: false })

    if (error) {
      console.error("[v0] Error fetching tasks:", error)
    } else {
      setTasks(data || [])
      console.log("[v0] Loaded tasks:", data?.length)
    }
    setIsLoading(false)
  }

  const stats = {
    nuevasHoy: tasks.filter((t) => isToday(new Date(t.created_at)) && t.status === "nueva").length,
    pendientes: tasks.filter((t) => t.status === "nueva" || t.status === "en_progreso").length,
    completadasSemana: tasks.filter(
      (t) => t.status === "completada" && t.completed_at && isThisWeek(new Date(t.completed_at)),
    ).length,
    totalUsuarios: new Set(tasks.flatMap((t) => t.task_assignments.map((a) => a.employee_id))).size,
  }

  const filteredTasks = tasks.filter((task) => {
    if (activeTab === "nuevas") return task.status === "nueva"
    if (activeTab === "en_progreso") return task.status === "en_progreso"
    if (activeTab === "completadas") return task.status === "completada"
    return true
  })

  return (
    <AppLayout>
      <div className="flex h-full bg-background">
        {/* Left Panel - Task List */}
        <div className="w-1/3 border-r flex flex-col">
          <div className="p-6 border-b">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h1 className="text-2xl font-bold">{t("tasks.title")}</h1>
                <p className="text-sm text-muted-foreground">Task coordination system</p>
              </div>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-2 gap-3 mb-4">
              <Card>
                <CardContent className="p-3">
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-blue-600" />
                    <div>
                      <p className="text-xs text-muted-foreground">{t("tasks.new")} Today</p>
                      <p className="text-2xl font-bold">{stats.nuevasHoy}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-3">
                  <div className="flex items-center gap-2">
                    <AlertCircle className="h-4 w-4 text-orange-600" />
                    <div>
                      <p className="text-xs text-muted-foreground">Pending</p>
                      <p className="text-2xl font-bold">{stats.pendientes}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-3">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                    <div>
                      <p className="text-xs text-muted-foreground">{t("tasks.completed")} (Week)</p>
                      <p className="text-2xl font-bold">{stats.completadasSemana}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-3">
                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4 text-purple-600" />
                    <div>
                      <p className="text-xs text-muted-foreground">Users</p>
                      <p className="text-2xl font-bold">{stats.totalUsuarios}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            <Button onClick={() => setIsAddDialogOpen(true)} className="w-full">
              <Plus className="h-4 w-4 mr-2" />
              {t("tasks.add_task")}
            </Button>
          </div>

          {/* Tabs */}
          <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
            <TabsList className="mx-6 mt-4">
              <TabsTrigger value="nuevas">{t("tasks.new")}</TabsTrigger>
              <TabsTrigger value="en_progreso">{t("tasks.in_progress")}</TabsTrigger>
              <TabsTrigger value="completadas">{t("tasks.completed")}</TabsTrigger>
              <TabsTrigger value="todas">All</TabsTrigger>
            </TabsList>

            <div className="flex-1 overflow-auto p-6">
              {isLoading ? (
                <p className="text-center text-muted-foreground">Loading tasks...</p>
              ) : filteredTasks.length === 0 ? (
                <p className="text-center text-muted-foreground">No tasks</p>
              ) : (
                <div className="space-y-3">
                  {filteredTasks.map((task) => (
                    <Card
                      key={task.id}
                      className={`cursor-pointer hover:shadow-md transition-shadow ${
                        selectedTask?.id === task.id ? "ring-2 ring-primary" : ""
                      }`}
                      onClick={() => setSelectedTask(task)}
                    >
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between mb-2">
                          <h3 className="font-semibold text-sm">{task.title}</h3>
                          <Badge className={priorityColors[task.priority]}>{priorityLabels[task.priority]}</Badge>
                        </div>
                        {task.location_name && (
                          <p className="text-xs text-muted-foreground mb-2">{task.location_name}</p>
                        )}
                        {task.due_date && (
                          <div className="flex items-center gap-1 text-xs text-muted-foreground mb-2">
                            <Calendar className="h-3 w-3" />
                            {format(new Date(task.due_date), "d 'de' MMMM, yyyy", { locale: es })}
                          </div>
                        )}
                        {task.task_assignments.length > 0 && (
                          <div className="flex items-center gap-1 text-xs text-muted-foreground">
                            <Users className="h-3 w-3" />
                            {task.task_assignments.length} assigned
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          </Tabs>
        </div>

        {/* Right Panel - Task Details */}
        <div className="flex-1">
          {selectedTask ? (
            <TaskDetailPanel
              task={selectedTask}
              onUpdate={fetchTasks}
              onClose={() => setSelectedTask(null)}
              onEdit={(task) => {
                setTaskToEdit(task)
                setIsEditDialogOpen(true)
              }}
            />
          ) : (
            <div className="h-full flex items-center justify-center text-muted-foreground">
              Select a task to view details
            </div>
          )}
        </div>

        <AddTaskDialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen} onTaskCreated={fetchTasks} />

        {taskToEdit && (
          <EditTaskDialog
            open={isEditDialogOpen}
            onOpenChange={setIsEditDialogOpen}
            onTaskUpdated={() => {
              fetchTasks()
              setTaskToEdit(null)
            }}
            task={taskToEdit}
          />
        )}
      </div>
    </AppLayout>
  )
}
