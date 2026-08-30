import { IssuesView, type IssueRecord } from "@/components/issues-view"
import { createClient } from "@/lib/supabase/server"

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

  return <IssuesView issues={(data ?? []) as unknown as IssueRecord[]} loadFailed={Boolean(error)} />
}

export const dynamic = "force-dynamic"
export const revalidate = 0
