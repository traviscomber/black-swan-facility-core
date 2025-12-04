import { AppLayout } from "@/components/app-layout"
import { PageHeader } from "@/components/page-header"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { createClient } from "@/lib/supabase/server"
import type { Issue } from "@/lib/types"
import Link from "next/link"
import { Plus, ImageIcon } from "lucide-react"

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

export default async function IssuesPage() {
  const supabase = await createClient()

  const { data: issues } = await supabase
    .from("issues")
    .select("*, assets(name), employees(name)")
    .order("created_at", { ascending: false })

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
                <TableHead>Asset</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Reported By</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Photo</TableHead>
                <TableHead>Date</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {issues && issues.length > 0 ? (
                issues.map(
                  (issue: Issue & { assets?: { name: string } | null; employees?: { name: string } | null }) => (
                    <TableRow key={issue.id}>
                      <TableCell className="font-medium">{issue.assets?.name || "No asset"}</TableCell>
                      <TableCell className="max-w-md">{issue.description || "-"}</TableCell>
                      <TableCell>{issue.employees?.name || "Unknown"}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className={getStatusColor(issue.status)}>
                          {issue.status}
                        </Badge>
                      </TableCell>
                      <TableCell>{issue.photo_url && <ImageIcon className="h-4 w-4 text-gray-600" />}</TableCell>
                      <TableCell className="text-sm text-gray-600">{formatDate(issue.created_at)}</TableCell>
                    </TableRow>
                  ),
                )
              ) : (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-gray-500">
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
