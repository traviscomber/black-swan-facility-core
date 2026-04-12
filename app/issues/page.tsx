import { AppLayout } from "@/components/app-layout"
import { PageHeader } from "@/components/page-header"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { createClient } from "@/lib/supabase/server"
import Link from "next/link"
import { Plus } from "lucide-react"
import { EditIssueDialog } from "@/components/edit-issue-dialog"
import { DeleteIssueButton } from "@/components/delete-issue-button"
import { IssueLabelSelector } from "@/components/issue-labels-selector"
import { IssueTaskLinkDialog } from "@/components/issue-task-link-dialog"
import { cookies } from "next/headers"

// Translations dictionary
const translations = {
  en: {
    title: "Facility Requests",
    description: "Track and manage facility requests and service tickets",
    newRequest: "New Request",
    untitled: "Untitled",
    status: "Status",
    open: "Open",
    resolved: "Resolved",
    inProgress: "In Progress",
  },
  es: {
    title: "Problemas y Solicitudes",
    description: "Rastrear y gestionar solicitudes de instalaciones y tickets de servicio",
    newRequest: "Nueva Solicitud",
    untitled: "Sin título",
    status: "Estado",
    open: "Abierto",
    resolved: "Resuelto",
    inProgress: "En progreso",
  },
}

async function getLanguage() {
  const cookieStore = await cookies()
  const language = cookieStore.get("language")?.value || "es"
  return language
}

function formatDate(dateString: string) {
  return new Date(dateString).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

function getStatusColor(status: string) {
  switch (status) {
    case "open":
      return "bg-red-900 text-red-100"
    case "resolved":
      return "bg-green-900 text-green-100"
    case "in-progress":
      return "bg-yellow-900 text-yellow-100"
    default:
      return "bg-gray-700 text-gray-100"
  }
}

function getSeverityColor(severity: string) {
  switch (severity) {
    case "low":
      return "bg-green-900 text-green-100"
    case "medium":
      return "bg-yellow-900 text-yellow-100"
    case "high":
      return "bg-orange-900 text-orange-100"
    case "critical":
      return "bg-red-900 text-red-100"
    default:
      return "bg-gray-700 text-gray-100"
  }
}

export default async function FacilityRequestsPage() {
  const supabase = await createClient()
  const language = await getLanguage()
  const t = translations[language as keyof typeof translations] || translations.es

  const { data: issues, error } = await supabase.from("issues").select(`*`).order("created_at", { ascending: false })

  if (error) {
    console.error("[v0] Error loading facility requests:", error)
  }

  const requestsWithDetails = await Promise.all(
    (issues || []).map(async (issue) => {
      let assetName = null
      let employeeName = null
      let labels = []
      let linkedTasks = []

      if (issue.asset_id) {
        const { data: asset } = await supabase.from("assets").select("name").eq("id", issue.asset_id).single()
        assetName = asset?.name
      }

      if (issue.reported_by) {
        const { data: employee } = await supabase.from("employees").select("name").eq("id", issue.reported_by).single()
        employeeName = employee?.name
      }

      const { data: labelData } = await supabase
        .from("issue_label_assignments")
        .select("issue_labels(*)")
        .eq("issue_id", issue.id)

      if (labelData) {
        labels = labelData.map((l: any) => l.issue_labels)
      }

      const { data: taskData } = await supabase
        .from("issue_task_assignments")
        .select("tasks(*)")
        .eq("issue_id", issue.id)

      if (taskData) {
        linkedTasks = taskData.map((t: any) => t.tasks)
      }

      return {
        ...issue,
        assets: assetName ? { name: assetName } : null,
        employees: employeeName ? { name: employeeName } : null,
        labels,
        linkedTasks,
      }
    }),
  )

  return (
    <AppLayout>
      <PageHeader
        title={t.title}
        description={t.description}
        actions={
          <Link href="/issues/report">
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              {t.newRequest}
            </Button>
          </Link>
        }
      />

      <div className="p-8">
        {requestsWithDetails && requestsWithDetails.length > 0 ? (
          <div className="space-y-4">
            {requestsWithDetails.map((request: any) => (
              <div
                key={request.id}
                className="border border-gray-700 rounded-lg bg-gray-900 p-6 hover:border-gray-600 transition-colors"
              >
                <div className="flex items-start justify-between gap-4 mb-4">
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-foreground mb-1">{request.title || t.untitled}</h3>
                    {request.category && <p className="text-sm text-muted-foreground">{request.category}</p>}
                  </div>
                  <Badge className={`whitespace-nowrap ${getStatusColor(request.status)}`}>{request.status}</Badge>
                </div>

                {request.description && <p className="text-foreground mb-4 leading-relaxed">{request.description}</p>}

                {request.labels && request.labels.length > 0 && (
                  <div className="flex flex-wrap gap-2 mb-4">
                    {request.labels.map((label: any) => (
                      <Badge key={label.id} style={{ backgroundColor: label.color }} className="text-white">
                        {label.name}
                      </Badge>
                    ))}
                  </div>
                )}

                {request.linkedTasks && request.linkedTasks.length > 0 && (
                  <div className="mb-4 p-3 bg-blue-900 bg-opacity-20 border border-blue-700 rounded">
                    <p className="text-xs text-blue-300 font-semibold mb-2">Linked Tasks</p>
                    <div className="flex flex-wrap gap-2">
                      {request.linkedTasks.map((task: any) => (
                        <Badge key={task.id} variant="outline" className="text-xs">
                          {task.title}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4 pb-4 border-t border-gray-700 pt-4">
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Priority</p>
                    <Badge className={getSeverityColor(request.priority || "medium")}>
                      {request.priority || "medium"}
                    </Badge>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Reported By</p>
                    <p className="text-foreground font-medium">{request.employees?.name || "Unknown"}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Date</p>
                    <p className="text-foreground text-sm">{formatDate(request.created_at)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Asset</p>
                    <p className="text-foreground text-sm">
                      {request.assets?.name || (request.related_item_type ? request.related_item_type : "-")}
                    </p>
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  {request.photo_url && (
                    <img
                      src={request.photo_url || "/placeholder.svg"}
                      alt="Request"
                      className="h-12 w-12 rounded object-cover"
                    />
                  )}
                  <div className="flex items-center gap-2 ml-auto">
                    <IssueLabelSelector issueId={request.id} />
                    <IssueTaskLinkDialog issueId={request.id} />
                    <EditIssueDialog issue={request} />
                    <DeleteIssueButton issueId={request.id} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-12">
            <p className="text-muted-foreground mb-4">No facility requests found</p>
            <Link href="/issues/report">
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Create First Request
              </Button>
            </Link>
          </div>
        )}
      </div>
    </AppLayout>
  )
}

export const dynamic = "force-dynamic"
export const revalidate = 0
