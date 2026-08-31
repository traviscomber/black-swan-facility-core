import { notFound } from 'next/navigation'
import { IssueObjectView } from '@/components/issue-object-view'
import { createClient } from '@/lib/supabase/server'

type PageProps = { params: Promise<{ id: string }> }

type IssueRow = {
  id: string
  title: string | null
  description: string | null
  status: string | null
  priority: string | null
  severity: string | null
  category: string | null
  created_at: string | null
  resolved_at: string | null
  asset_id: string | null
  related_item_type: string | null
  related_item_id: string | null
}

export default async function IssueObjectPage({ params }: PageProps) {
  const { id } = await params
  const supabase = await createClient()
  const issueResult = await supabase
    .from('issues')
    .select('id,title,description,status,priority,severity,category,created_at,resolved_at,asset_id,related_item_type,related_item_id')
    .eq('id', id)
    .maybeSingle()

  if (issueResult.error || !issueResult.data) notFound()
  const issue = issueResult.data as IssueRow

  const linkedAssetId = issue.asset_id || (issue.related_item_type === 'asset' ? issue.related_item_id : null)
  const linkedReservationId = issue.related_item_type === 'reservation' ? issue.related_item_id : null

  const [assetResult, reservationResult, taskAssignmentsResult, maintenanceResult] = await Promise.all([
    linkedAssetId
      ? supabase.from('assets').select('id,name,asset_code,status').eq('id', linkedAssetId).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    linkedReservationId
      ? supabase.from('reservations').select('id,guest_name,check_in,check_out,status').eq('id', linkedReservationId).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    supabase.from('issue_task_assignments').select('tasks(id,title,status,priority,due_date)').eq('issue_id', id),
    supabase.from('maintenance_tasks').select('id,title,status,prioridad,fecha_objetivo,bloqueado').eq('issue_id', id).order('created_at', { ascending: false }).limit(20),
  ])

  const tasks = (taskAssignmentsResult.data ?? []).flatMap((row) => {
    const task = Array.isArray(row.tasks) ? row.tasks[0] : row.tasks
    return task ? [task] : []
  })
  const partial = Boolean(assetResult.error || reservationResult.error || taskAssignmentsResult.error || maintenanceResult.error)

  return <IssueObjectView issue={issue} asset={assetResult.data ?? null} reservation={reservationResult.data ?? null} tasks={tasks} maintenance={maintenanceResult.data ?? []} partial={partial} />
}

export const dynamic = 'force-dynamic'
export const revalidate = 0
