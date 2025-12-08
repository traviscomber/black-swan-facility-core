import { AppLayout } from "@/components/app-layout"
import { PageHeader } from "@/components/page-header"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
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
      return "bg-red-50 text-red-700 border-red-200"
    case "resolved":
      return "bg-green-50 text-green-700 border-green-200"
    case "in-progress":
      return "bg-yellow-50 text-yellow-700 border-yellow-200"
    default:
      return "bg-gray-50 text-gray-700 border-gray-200"
  }
}

function getSeverityColor(severity: string) {
  switch (severity) {
    case "low":
      return "bg-green-50 text-green-700 border-green-200"
    case "medium":
      return "bg-yellow-50 text-yellow-700 border-yellow-200"
    case "high":
      return "bg-orange-50 text-orange-700 border-orange-200"
    case "critical":
      return "bg-red-50 text-red-700 border-red-200"
    default:
      return "bg-gray-50 text-gray-700 border-gray-200"
  }
}

export default async function IssuesPage() {
  const supabase = await createClient()

  const { data: issues, error } = await supabase
    .from("issues")
    .select(`
      *
    `)
    .order("created_at", { ascending: false })

  if (error) {
    console.error("[v0] Error loading issues:", error)
  }

  console.log("[v0] Loaded issues:", issues?.length || 0)

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
        <div className="rounded-lg border border-gray-200 bg-white">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Title</TableHead>
                <TableHead>Asset</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Priority</TableHead>
                <TableHead>Reported By</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Photo</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {issuesWithDetails && issuesWithDetails.length > 0 ? (
                issuesWithDetails.map((issue: any) => (
                  <TableRow key={issue.id}>
                    <TableCell className="font-medium">
                      {issue.title || "Untitled"}
                      {issue.category && <div className="text-xs text-gray-500 mt-1">{issue.category}</div>}
                    </TableCell>
                    <TableCell>
                      {issue.assets?.name ? (
                        <div>
                          <div className="font-medium">{issue.assets.name}</div>
                          <div className="text-xs text-gray-500">Asset</div>
                        </div>
                      ) : issue.related_item_type === "infrastructure" ? (
                        <div className="text-sm text-gray-600">
                          Infrastructure (ID: {issue.related_item_id?.slice(0, 8)}...)
                        </div>
                      ) : issue.related_item_type ? (
                        <div className="text-sm text-gray-600">{issue.related_item_type}</div>
                      ) : (
                        <span className="text-gray-500">-</span>
                      )}
                    </TableCell>
                    <TableCell className="max-w-md">{issue.description || "-"}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={getSeverityColor(issue.priority || "medium")}>
                        {issue.priority || "medium"}
                      </Badge>
                    </TableCell>
                    <TableCell>{issue.employees?.name || "Unknown"}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={getStatusColor(issue.status)}>
                        {issue.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {issue.photo_url ? (
                        <img
                          src={issue.photo_url || "/placeholder.svg"}
                          alt="Issue"
                          className="h-10 w-10 rounded object-cover"
                        />
                      ) : (
                        <span className="text-gray-400 text-xs">No photo</span>
                      )}
                    </TableCell>
                    <TableCell className="text-sm text-gray-600">{formatDate(issue.created_at)}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <EditIssueDialog issue={issue} />
                        <DeleteIssueButton issueId={issue.id} />
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={9} className="text-center text-gray-500">
                    No issues found
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </AppLayout>
  )
}

export const dynamic = "force-dynamic"
export const revalidate = 0
