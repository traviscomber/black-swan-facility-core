"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { createBrowserClient } from "@/lib/supabase/client"
import { format } from "date-fns"
import { Calendar, MapPin, Users, X, MessageSquare, Send, Pencil, Trash2 } from "lucide-react"

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

interface TaskDetailPanelProps {
  task: Task
  onUpdate: () => void
  onClose: () => void
  onEdit: () => void
}

const statusColors = {
  nueva: "bg-blue-100 text-blue-800",
  en_progreso: "bg-yellow-100 text-yellow-800",
  completada: "bg-green-100 text-green-800",
  cancelada: "bg-gray-100 text-gray-800",
}

const statusLabels = {
  nueva: "New",
  en_progreso: "In Progress",
  completada: "Completed",
  cancelada: "Cancelled",
}

export function TaskDetailPanel({ task, onUpdate, onClose, onEdit }: TaskDetailPanelProps) {
  const [newStatus, setNewStatus] = useState(task.status)
  const [comment, setComment] = useState("")
  const [isSendingWhatsApp, setIsSendingWhatsApp] = useState(false)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const supabase = createBrowserClient()

  async function handleStatusChange() {
    if (newStatus === task.status) return

    const { error } = await supabase
      .from("tasks")
      .update({
        status: newStatus,
        completed_at: newStatus === "completada" ? new Date().toISOString() : null,
      })
      .eq("id", task.id)

    if (error) {
      console.error("[v0] Error updating task status:", error)
      alert("Error updating status")
    } else {
      // Add status history
      await supabase.from("task_status_history").insert({
        task_id: task.id,
        old_status: task.status,
        new_status: newStatus,
      })

      onUpdate()
    }
  }

  async function handleAddComment() {
    if (!comment.trim()) return

    const { error } = await supabase.from("task_comments").insert({
      task_id: task.id,
      comment,
    })

    if (error) {
      console.error("[v0] Error adding comment:", error)
      alert("Error adding comment")
    } else {
      setComment("")
      onUpdate()
    }
  }

  async function handleSendWhatsAppReminders() {
    setIsSendingWhatsApp(true)

    try {
      // Get full employee details
      const employeeIds = task.task_assignments.map((a) => a.employee_id)
      const { data: employees, error } = await supabase.from("employees").select("*").in("id", employeeIds)

      if (error) throw error

      for (const employee of employees || []) {
        if (employee.phone) {
          const message = `Reminder: Task "${task.title}" - Status: ${statusLabels[task.status]}. ${task.due_date ? `Due date: ${format(new Date(task.due_date), "MMMM d")}` : ""}`

          // Get WhatsApp Web URL
          const response = await fetch("/api/send-whatsapp", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              to: employee.phone,
              message,
            }),
          })

          const data = await response.json()

          if (data.success && data.whatsappUrl) {
            // Open WhatsApp Web in new window
            window.open(data.whatsappUrl, "_blank")

            // Update notification timestamp
            await supabase
              .from("task_assignments")
              .update({
                notified_via_whatsapp: true,
                whatsapp_sent_at: new Date().toISOString(),
              })
              .eq("task_id", task.id)
              .eq("employee_id", employee.id)
          }
        }
      }
    } catch (error) {
      console.error("[v0] Error sending WhatsApp reminders:", error)
      alert("Error sending WhatsApp reminders")
    } finally {
      setIsSendingWhatsApp(false)
    }
  }

  async function handleDeleteTask() {
    if (!confirm("Are you sure you want to delete this task? This action cannot be undone.")) {
      return
    }

    setIsDeleting(true)

    try {
      const { error } = await supabase.from("tasks").delete().eq("id", task.id)

      if (error) throw error

      onClose()
      onUpdate()
    } catch (error) {
      console.error("[v0] Error deleting task:", error)
      alert("Error deleting task")
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <div className="h-full flex flex-col">
      <div className="p-6 border-b flex items-center justify-between">
        <h2 className="text-xl font-bold">Task Details and Actions</h2>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={() => setIsEditDialogOpen(true)}>
            <Pencil className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="icon" onClick={handleDeleteTask} disabled={isDeleting}>
            <Trash2 className="h-4 w-4 text-destructive" />
          </Button>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-6 space-y-6">
        {/* Task Info */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">{task.title}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {task.description && <p className="text-sm text-muted-foreground">{task.description}</p>}

            {task.due_date && (
              <div className="flex items-center gap-2 text-sm">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <span>Due: {format(new Date(task.due_date), "MMMM d, yyyy")}</span>
              </div>
            )}

            {task.location_name && (
              <div className="flex items-center gap-2 text-sm">
                <MapPin className="h-4 w-4 text-muted-foreground" />
                <span>{task.location_name}</span>
              </div>
            )}

            {task.latitude && task.longitude && (
              <div className="text-xs text-muted-foreground">
                Coordinates: {task.latitude}, {task.longitude}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Assigned Users */}
        {task.task_assignments.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-2">
                <Users className="h-4 w-4" />
                Assigned Users
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2">
                {task.task_assignments.map((assignment) => (
                  <li key={assignment.employee_id} className="text-sm">
                    {assignment.employees.name} ({assignment.employees.email})
                  </li>
                ))}
              </ul>
              <Button
                onClick={handleSendWhatsAppReminders}
                disabled={isSendingWhatsApp}
                variant="outline"
                className="w-full mt-3 bg-transparent"
              >
                <Send className="h-4 w-4 mr-2" />
                {isSendingWhatsApp ? "Sending..." : "Send WhatsApp Reminder"}
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Status Update */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Task Status</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center gap-2">
              <span className="text-sm">Current status:</span>
              <Badge className={statusColors[task.status]}>{statusLabels[task.status]}</Badge>
            </div>

            <Select value={newStatus} onValueChange={setNewStatus}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="nueva">New</SelectItem>
                <SelectItem value="en_progreso">In Progress</SelectItem>
                <SelectItem value="completada">Completed</SelectItem>
                <SelectItem value="cancelada">Cancelled</SelectItem>
              </SelectContent>
            </Select>

            <Button onClick={handleStatusChange} disabled={newStatus === task.status} className="w-full">
              Update Status
            </Button>
          </CardContent>
        </Card>

        {/* Comments */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <MessageSquare className="h-4 w-4" />
              Add Note or Comment
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Textarea
              placeholder="Write a note or comment..."
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              rows={4}
            />
            <Button onClick={handleAddComment} className="w-full">
              Add Comment
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
