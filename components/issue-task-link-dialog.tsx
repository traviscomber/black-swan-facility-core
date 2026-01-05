"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { createBrowserClient } from "@supabase/ssr"
import { CheckSquare } from "lucide-react"
import { useRouter } from "next/navigation"

interface IssueTaskLinkDialogProps {
  issueId: string
}

export function IssueTaskLinkDialog({ issueId }: IssueTaskLinkDialogProps) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [tasks, setTasks] = useState<any[]>([])
  const [linkedTaskIds, setLinkedTaskIds] = useState<string[]>([])
  const [loading, setLoading] = useState(false)

  const handleOpenChange = async (isOpen: boolean) => {
    setOpen(isOpen)
    if (isOpen) {
      setLoading(true)
      try {
        const supabase = createBrowserClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        )

        // Fetch active tasks
        const { data: activeTasks, error: tasksError } = await supabase
          .from("tasks")
          .select("*")
          .in("status", ["nueva", "en_progreso"])
          .order("created_at", { ascending: false })

        if (tasksError) {
          console.error("[v0] Error fetching tasks:", tasksError.message)
          setTasks([])
          setLoading(false)
          return
        }

        // Fetch currently linked tasks
        const { data: linked, error: linkedError } = await supabase
          .from("issue_task_assignments")
          .select("task_id")
          .eq("issue_id", issueId)

        if (linkedError) {
          console.error("[v0] Error fetching linked tasks:", linkedError.message)
          setLinkedTaskIds([])
          setLoading(false)
          return
        }

        setTasks(activeTasks || [])
        setLinkedTaskIds((linked || []).map((l: any) => l.task_id))
      } catch (error) {
        console.error("[v0] Error loading tasks:", error)
        setTasks([])
        setLinkedTaskIds([])
      }
      setLoading(false)
    }
  }

  const handleTaskToggle = async (taskId: string) => {
    try {
      const supabase = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      )

      if (linkedTaskIds.includes(taskId)) {
        // Remove link
        const { error } = await supabase
          .from("issue_task_assignments")
          .delete()
          .eq("issue_id", issueId)
          .eq("task_id", taskId)
        if (!error) setLinkedTaskIds(linkedTaskIds.filter((id) => id !== taskId))
      } else {
        // Add link
        const { error } = await supabase.from("issue_task_assignments").insert({ issue_id: issueId, task_id: taskId })
        if (!error) setLinkedTaskIds([...linkedTaskIds, taskId])
      }

      router.refresh()
    } catch (error) {
      console.error("[v0] Error toggling task:", error)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" title="Link to tasks">
          <CheckSquare className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Link to Tasks</DialogTitle>
        </DialogHeader>
        <div className="space-y-2">
          {loading ? (
            <p className="text-muted-foreground">Loading tasks...</p>
          ) : tasks.length === 0 ? (
            <p className="text-muted-foreground text-sm">No active tasks available</p>
          ) : (
            tasks.map((task) => (
              <label key={task.id} className="flex items-center gap-3 p-2 rounded hover:bg-gray-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={linkedTaskIds.includes(task.id)}
                  onChange={() => handleTaskToggle(task.id)}
                  className="h-4 w-4"
                />
                <div className="flex-1">
                  <p className="text-sm font-medium text-foreground">{task.title}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <Badge variant="outline" className="text-xs">
                      {task.status}
                    </Badge>
                    <Badge variant="outline" className="text-xs">
                      {task.priority}
                    </Badge>
                  </div>
                </div>
              </label>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
