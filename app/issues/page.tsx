import Link from "next/link"
import { AlertCircle, CheckCircle2, Clock3, Plus, Wrench } from "lucide-react"
import { AppLayout } from "@/components/app-layout"
import { PageHeader } from "@/components/page-header"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { createClient } from "@/lib/supabase/server"
import { EditIssueDialog } from "@/components/edit-issue-dialog"
import { DeleteIssueButton } from "@/components/delete-issue-button"
import { IssueLabelSelector } from "@/components/issue-labels-selector"
import { IssueTaskLinkDialog } from "@/components/issue-task-link-dialog"

type IssueLabel = {
  id: string
  name: string
  color: string | null
}

type LinkedTask = {
  id: string
  title: string
  status: string | null
}

type IssueRecord = {
  id: string
  title: string | null
  description: string | null
  category: string | null
  status: string | null
  priority: string | null
  severity: string | null
  created_at: string | null
  photo_url: string | null
  related_item_type: string | null
  assets: { name: string } | null
  reporter: { name: string } | null
  issue_label_assignments: Array<{ issue_labels: IssueLabel | null }> | null
  issue_task_assignments: Array<{ tasks: LinkedTask | null }> | null
}

const STATUS_LABELS: Record<string, string> = {
  open: "Abierta",
  "in-progress": "En ejecución",
  in_progress: "En ejecución",
  resolved: "Resuelta",
  closed: "Cerrada",
}

const PRIORITY_LABELS: Record<string, string> = {
  low: "Baja",
  medium: "Media",
  high: "Alta",
  critical: "Crítica",
}

function normalizedStatus(value: string | null) {
  return value?.toLowerCase().replaceAll("_", "-") || "open"
}

function statusVariant(status: string | null): "default" | "secondary" | "destructive" | "outline" {
  const value = normalizedStatus(status)
  if (value === "resolved" || value === "closed") return "secondary"
  if (value === "in-progress") return "default"
  return "outline"
}

function priorityVariant(priority: string): "default" | "secondary" | "destructive" | "outline" {
  if (priority === "critical") return "destructive"
  if (priority === "high") return "default"
  if (priority === "low") return "secondary"
  return "outline"
}

function formatDate(value: string | null) {
  if (!value) return "Fecha no registrada"
  return new Intl.DateTimeFormat("es-CL", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "America/Santiago",
  }).format(new Date(value))
}

export default async function FacilityRequestsPage() {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("issues")
    .select(`
      *,
      assets:assets!issues_asset_id_fkey(name),
      reporter:employees!issues_reported_by_fkey(name),
      issue_label_assignments(issue_labels(id, name, color)),
      issue_task_assignments(tasks(id, title, status))
    `)
    .order("created_at", { ascending: false })

  const issues = (data ?? []) as unknown as IssueRecord[]
  const openCount = issues.filter((issue) => normalizedStatus(issue.status) === "open").length
  const inProgressCount = issues.filter((issue) => normalizedStatus(issue.status) === "in-progress").length
  const resolvedCount = issues.filter((issue) => ["resolved", "closed"].includes(normalizedStatus(issue.status))).length
  const unlinkedCount = issues.filter((issue) => !(issue.issue_task_assignments ?? []).some((item) => item.tasks)).length

  return (
    <AppLayout>
      <PageHeader
        title="Incidencias · Fundo Corcovado"
        description="Registro y seguimiento de problemas operativos, solicitudes de servicio y trabajos derivados en Valdivia."
        actions={
          <Button asChild>
            <Link href="/issues/report">
              <Plus className="mr-2 h-4 w-4" />
              Registrar incidencia
            </Link>
          </Button>
        }
      />

      <div className="space-y-6 p-4 md:p-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Contexto operativo</CardTitle>
          </CardHeader>
          <CardContent className="text-sm leading-6 text-muted-foreground">
            Las incidencias documentan problemas detectados por el equipo. Cuando requieren ejecución técnica, deben vincularse a una tarea y gestionarse desde Mantenimiento.
          </CardContent>
        </Card>

        {error && (
          <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">
            No fue posible cargar las incidencias: {error.message}
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Metric title="Incidencias abiertas" value={openCount} icon={AlertCircle} alert={openCount > 0} />
          <Metric title="En ejecución" value={inProgressCount} icon={Clock3} />
          <Metric title="Resueltas" value={resolvedCount} icon={CheckCircle2} />
          <Metric title="Sin tarea vinculada" value={unlinkedCount} icon={Wrench} alert={unlinkedCount > 0} />
        </div>

        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline">
            <Link href="/maintenance">
              <Wrench className="mr-2 h-4 w-4" />
              Ir a mantenimiento
            </Link>
          </Button>
        </div>

        {issues.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <AlertCircle className="mx-auto mb-3 h-6 w-6 text-muted-foreground" />
              <p className="font-medium">No hay incidencias registradas.</p>
              <p className="mt-1 text-sm text-muted-foreground">Registra la primera incidencia para iniciar su seguimiento operativo.</p>
              <Button asChild className="mt-4">
                <Link href="/issues/report">Registrar incidencia</Link>
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {issues.map((issue) => {
              const status = normalizedStatus(issue.status)
              const priority = (issue.severity || issue.priority || "medium").toLowerCase()
              const labels = (issue.issue_label_assignments ?? []).flatMap((item) => item.issue_labels ? [item.issue_labels] : [])
              const linkedTasks = (issue.issue_task_assignments ?? []).flatMap((item) => item.tasks ? [item.tasks] : [])

              return (
                <Card key={issue.id}>
                  <CardHeader className="pb-3">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0">
                        <CardTitle className="text-lg">{issue.title || "Incidencia sin título"}</CardTitle>
                        <p className="mt-1 text-sm text-muted-foreground">
                          {issue.category || "Categoría no registrada"} · {formatDate(issue.created_at)}
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Badge variant={priorityVariant(priority)}>{PRIORITY_LABELS[priority] || priority}</Badge>
                        <Badge variant={statusVariant(issue.status)}>{STATUS_LABELS[status] || status}</Badge>
                      </div>
                    </div>
                  </CardHeader>

                  <CardContent className="space-y-4">
                    {issue.description ? (
                      <p className="text-sm leading-6 text-foreground">{issue.description}</p>
                    ) : (
                      <p className="text-sm text-muted-foreground">Sin descripción registrada.</p>
                    )}

                    <div className="grid gap-3 rounded-lg border bg-muted/20 p-4 text-sm sm:grid-cols-3">
                      <div>
                        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Reportada por</p>
                        <p className="mt-1 font-medium">{issue.reporter?.name || "Responsable no identificado"}</p>
                      </div>
                      <div>
                        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Activo o elemento</p>
                        <p className="mt-1 font-medium">{issue.assets?.name || issue.related_item_type || "No asociado"}</p>
                      </div>
                      <div>
                        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Tareas vinculadas</p>
                        <p className="mt-1 font-medium">{linkedTasks.length}</p>
                      </div>
                    </div>

                    {labels.length > 0 && (
                      <div className="flex flex-wrap gap-2">
                        {labels.map((label) => (
                          <Badge key={label.id} variant="outline" style={label.color ? { borderColor: label.color } : undefined}>
                            {label.name}
                          </Badge>
                        ))}
                      </div>
                    )}

                    {linkedTasks.length > 0 && (
                      <div className="space-y-2 rounded-lg border p-3">
                        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Trabajos derivados</p>
                        <div className="flex flex-wrap gap-2">
                          {linkedTasks.map((task) => (
                            <Badge key={task.id} variant="secondary">
                              {task.title}{task.status ? ` · ${task.status}` : ""}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="flex flex-col gap-3 border-t pt-4 sm:flex-row sm:items-center sm:justify-between">
                      {issue.photo_url ? (
                        <img src={issue.photo_url} alt={`Evidencia de ${issue.title || "incidencia"}`} className="h-16 w-16 rounded-md border object-cover" />
                      ) : (
                        <p className="text-xs text-muted-foreground">Sin evidencia fotográfica.</p>
                      )}
                      <div className="flex flex-wrap items-center gap-2">
                        <IssueLabelSelector issueId={issue.id} />
                        <IssueTaskLinkDialog issueId={issue.id} />
                        <EditIssueDialog issue={issue} />
                        <DeleteIssueButton issueId={issue.id} />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        )}
      </div>
    </AppLayout>
  )
}

function Metric({
  title,
  value,
  icon: Icon,
  alert = false,
}: {
  title: string
  value: number
  icon: typeof AlertCircle
  alert?: boolean
}) {
  return (
    <Card className={alert ? "border-amber-300" : undefined}>
      <CardContent className="flex items-start justify-between p-4">
        <div>
          <p className="text-sm font-medium text-muted-foreground">{title}</p>
          <p className="mt-1 text-3xl font-semibold tabular-nums">{value.toLocaleString("es-CL")}</p>
        </div>
        <Icon className="h-5 w-5 text-muted-foreground" />
      </CardContent>
    </Card>
  )
}

export const dynamic = "force-dynamic"
export const revalidate = 0
