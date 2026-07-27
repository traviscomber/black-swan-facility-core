"use client"

import Link from "next/link"
import { useEffect, useMemo, useState } from "react"
import { ArrowRight, CheckCircle2, Clock3, Loader2, UserRound } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { createBrowserClient } from "@/lib/supabase/client"
import type { TaskSourceType } from "@/lib/operational-task-links"

type LinkedTask = {
  id: string
  title: string
  status: "nueva" | "en_progreso" | "completada" | "cancelada"
  due_date: string | null
  completed_at: string | null
  task_assignments: Array<{
    employees?: { name: string } | null
    volunteers?: { name: string } | null
  }>
}

const statusLabels: Record<LinkedTask["status"], string> = {
  nueva: "Pendiente",
  en_progreso: "En curso",
  completada: "Completada",
  cancelada: "Cancelada",
}

export function LinkedOperationalTask({ sourceType, sourceId, compact = false }: { sourceType: TaskSourceType; sourceId: string; compact?: boolean }) {
  const supabase = useMemo(() => createBrowserClient(), [])
  const [task, setTask] = useState<LinkedTask | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      const { data } = await supabase
        .from("tasks")
        .select("id, title, status, due_date, completed_at, task_assignments(employees(name), volunteers(name))")
        .eq("source_type", sourceType)
        .eq("source_id", sourceId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle()
      if (!cancelled) {
        setTask((data as LinkedTask | null) ?? null)
        setLoading(false)
      }
    }
    void load()
    return () => { cancelled = true }
  }, [sourceId, sourceType, supabase])

  if (loading) return <div className="flex items-center gap-2 text-xs text-muted-foreground"><Loader2 className="h-3.5 w-3.5 animate-spin" />Consultando tarea vinculada…</div>
  if (!task) return null

  const names = task.task_assignments.map((item) => item.employees?.name ?? item.volunteers?.name).filter(Boolean) as string[]
  const completed = task.status === "completada"

  return <div className={`rounded-md border ${compact ? "p-2" : "p-3"}`}>
    <div className="flex flex-wrap items-center justify-between gap-2">
      <div className="min-w-0">
        <p className="flex items-center gap-1.5 text-xs font-medium">{completed ? <CheckCircle2 className="h-3.5 w-3.5" /> : <Clock3 className="h-3.5 w-3.5" />}Tarea operativa vinculada</p>
        <p className="mt-1 truncate text-xs text-muted-foreground">{task.title}</p>
      </div>
      <Badge variant={completed ? "secondary" : "outline"}>{statusLabels[task.status]}</Badge>
    </div>
    <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
      <span className="flex items-center gap-1 text-xs text-muted-foreground"><UserRound className="h-3.5 w-3.5" />{names.length ? names.join(", ") : "Sin responsable"}</span>
      <Button asChild variant="ghost" size="sm" className="h-7 px-2 text-xs"><Link href={`/tasks?selected=${task.id}`}>Ver seguimiento<ArrowRight className="ml-1 h-3.5 w-3.5" /></Link></Button>
    </div>
  </div>
}
