import { AppLayout } from "@/components/app-layout"
import { PageHeader } from "@/components/page-header"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { createClient } from "@/lib/supabase/server"
import Link from "next/link"
import { Plus } from "lucide-react"
import { EditIssueDialog } from "@/components/edit-issue-dialog"
import { DeleteIssueButton } from "@/components/delete-issue-button"

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

export default async function IssuesPage() {
  const supabase = await createClient()

  const { data: issues, error } = await supabase.from("issues").select(`*`).order("created_at", { ascending: false })

  if (error) {
    console.error("[v0] Error loading issues:", error)
  }

  const issuesWithDetails = await Promise.all(
    (issues || []).map(async (issue) => {
      let assetName = null
      let employeeName = null

      if (issue.asset_id) {
        const { data: asset } = await supabase.from("assets").select("name").eq("id", issue.asset_id).single()
        assetName = asset?.name
      }

      if (issue.reported_by) {
        const { data: employee } = await supabase.from("employees").select("name").eq("id", issue.reported_by).single()
        employeeName = employee?.name
      }

      return {
        ...issue,
        assets: assetName ? { name: assetName } : null,
        employees: employeeName ? { name: employeeName } : null,
      }
    }),
  )

  return (
    <AppLayout>
      <PageHeader
        title="Issues"
        description="Track and manage facility issues"
        actions={
          <Link href="/issues/report">
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Report Issue
            </Button>
          </Link>
        }
      />

      <div className="p-8">
        {issuesWithDetails && issuesWithDetails.length > 0 ? (
          <div className="space-y-4">
            {issuesWithDetails.map((issue: any) => (
              <div
                key={issue.id}
                className="border border-gray-700 rounded-lg bg-gray-900 p-6 hover:border-gray-600 transition-colors"
              >
                {/* Header with title and status */}
                <div className="flex items-start justify-between gap-4 mb-4">
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-foreground mb-1">{issue.title || "Untitled"}</h3>
                    {issue.category && <p className="text-sm text-muted-foreground">{issue.category}</p>}
                  </div>
                  <Badge className={`whitespace-nowrap ${getStatusColor(issue.status)}`}>{issue.status}</Badge>
                </div>

                {/* Description */}
                {issue.description && <p className="text-foreground mb-4 leading-relaxed">{issue.description}</p>}

                {/* Metadata row */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4 pb-4 border-t border-gray-700 pt-4">
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Priority</p>
                    <Badge className={getSeverityColor(issue.priority || "medium")}>{issue.priority || "medium"}</Badge>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Reported By</p>
                    <p className="text-foreground font-medium">{issue.employees?.name || "Unknown"}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Date</p>
                    <p className="text-foreground text-sm">{formatDate(issue.created_at)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Asset</p>
                    <p className="text-foreground text-sm">
                      {issue.assets?.name || (issue.related_item_type ? issue.related_item_type : "-")}
                    </p>
                  </div>
                </div>

                {/* Photo and actions */}
                <div className="flex items-center justify-between">
                  {issue.photo_url && (
                    <img
                      src={issue.photo_url || "/placeholder.svg"}
                      alt="Issue"
                      className="h-12 w-12 rounded object-cover"
                    />
                  )}
                  <div className="flex items-center gap-2 ml-auto">
                    <EditIssueDialog issue={issue} />
                    <DeleteIssueButton issueId={issue.id} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-12">
            <p className="text-muted-foreground mb-4">No issues found</p>
            <Link href="/issues/report">
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Report First Issue
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
