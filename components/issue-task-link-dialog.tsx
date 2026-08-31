"use client"

import Link from "next/link"
import { useState } from "react"
import { CheckSquare, ClipboardPlus, Loader2 } from "lucide-react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { LinkedOperationalTask } from "@/components/linked-operational-task"
import { createBrowserClient } from "@/lib/supabase/client"
import { buildOperationalTaskHref } from "@/lib/operational-task-links"

type ActiveTask = { id: string; title: string; status: string; priority: string }
type IssueSummary = { id: string; title: string | null; description: string | null; category: string | null; priority: string | null; severity: string | null }
const priorityMap: Record<string, "baja" | "media" | "alta" | "urgente"> = { low: "baja", medium: "media", high: "alta", critical: "urgente" }

export function IssueTaskLinkDialog({ issueId, canCreateTask }: { issueId: string; canCreateTask: boolean }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [tasks, setTasks] = useState<ActiveTask[]>([])
  const [linkedTaskIds, setLinkedTaskIds] = useState<string[]>([])
  const [issue, setIssue] = useState<IssueSummary | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleOpenChange(isOpen: boolean) {
    setOpen(isOpen)
    if (!isOpen) return
    setLoading(true)
    setError(null)
    const supabase = createBrowserClient()
    const [tasksResult, linkedResult, issueResult] = await Promise.all([
      supabase.from("tasks").select("id, title, status, priority").in("status", ["nueva", "en_progreso"]).order("created_at", { ascending: false }),
      supabase.from("issue_task_assignments").select("task_id").eq("issue_id", issueId),
      supabase.from("issues").select("id, title, description, category, priority, severity").eq("id", issueId).maybeSingle(),
    ])
    const firstError = tasksResult.error ?? linkedResult.error ?? issueResult.error
    if (firstError) {
      setError(firstError.message)
      setTasks([])
      setLinkedTaskIds([])
      setIssue(null)
    } else {
      setTasks((tasksResult.data ?? []) as ActiveTask[])
      setLinkedTaskIds((linkedResult.data ?? []).map((item) => item.task_id))
      setIssue(issueResult.data as IssueSummary | null)
    }
    setLoading(false)
  }

  async function handleTaskToggle(taskId: string) {
    const supabase = createBrowserClient()
    if (linkedTaskIds.includes(taskId)) {
      const { error: unlinkError } = await supabase.from("issue_task_assignments").delete().eq("issue_id", issueId).eq("task_id", taskId)
      if (unlinkError) return setError(unlinkError.message)
      setLinkedTaskIds((current) => current.filter((id) => id !== taskId))
    } else {
      const { error: linkError } = await supabase.from("issue_task_assignments").insert({ issue_id: issueId, task_id: taskId })
      if (linkError) return setError(linkError.message)
      setLinkedTaskIds((current) => [...current, taskId])
    }
    router.refresh()
  }

  const taskHref = canCreateTask && issue ? buildOperationalTaskHref({ area: "mantenimiento", title: `Resolver incidencia: ${issue.title || "sin título"}`, description: issue.description || "Revisar la incidencia y registrar la solución ejecutada.", category: issue.category || "Incidencia", priority: priorityMap[(issue.severity || issue.priority || "medium").toLowerCase()] || "media", sourceType: "issue", sourceId: issue.id, sourceLabel: issue.title || "Incidencia sin título", sourcePath: "/issues" }) : null

  return <Dialog open={open} onOpenChange={handleOpenChange}>
    <DialogTrigger asChild><Button variant="outline" size="sm"><CheckSquare className="mr-2 h-4 w-4" />Tareas</Button></DialogTrigger>
    <DialogContent className="max-w-md"><DialogHeader><DialogTitle>Tareas vinculadas</DialogTitle></DialogHeader>{loading ? <div className="flex items-center justify-center py-10"><Loader2 className="h-5 w-5 animate-spin" /></div> : <div className="space-y-4">{error && <div className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">{error}</div>}<LinkedOperationalTask sourceType="issue" sourceId={issueId} />{taskHref && <Button asChild className="w-full"><Link href={taskHref}><ClipboardPlus className="mr-2 h-4 w-4" />Crear tarea desde esta incidencia</Link></Button>}<div className="border-t pt-4"><p className="mb-2 text-sm font-medium">Vincular tarea existente</p>{tasks.length === 0 ? <p className="text-sm text-muted-foreground">No hay tareas activas disponibles.</p> : <div className="max-h-72 space-y-2 overflow-y-auto">{tasks.map((task) => <label key={task.id} className="flex cursor-pointer items-center gap-3 rounded-md border p-3 hover:bg-muted/50"><input type="checkbox" checked={linkedTaskIds.includes(task.id)} onChange={() => void handleTaskToggle(task.id)} className="h-4 w-4" /><div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{task.title}</p><div className="mt-1 flex gap-2"><Badge variant="outline" className="text-xs">{task.status}</Badge><Badge variant="outline" className="text-xs">{task.priority}</Badge></div></div></label>)}</div>}</div></div>}</DialogContent>
  </Dialog>
}
