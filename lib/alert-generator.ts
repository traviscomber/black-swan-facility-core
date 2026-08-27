import { createClient } from '@/lib/supabase/server'

export interface Alert {
  id: string
  title: string
  description: string
  severity: 'critical' | 'warning' | 'info'
  type: 'issue' | 'task' | 'request' | 'maintenance' | 'fuel' | 'reservation'
  actionUrl: string
  actionLabel?: string
  timestamp: string
}

export interface OperationalAlertSnapshot {
  alerts: Alert[]
  health: 'healthy' | 'degraded' | 'failed'
  failedSources: string[]
  successfulSources: number
}

function recordSourceFailure(failedSources: string[], source: string, error: unknown) {
  failedSources.push(source)
  console.error(`[Alert Generator] ${source} query failed`, error)
}

export async function generateOperationalAlertSnapshot(): Promise<OperationalAlertSnapshot> {
  const supabase = await createClient()
  const alerts: Alert[] = []
  const failedSources: string[] = []
  let successfulSources = 0
  const now = new Date()
  const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000)

  const oldIssuesResult = await supabase
    .from('issues')
    .select('id, title, created_at, priority')
    .eq('status', 'open')
    .lt('created_at', twentyFourHoursAgo.toISOString())
    .order('created_at', { ascending: true })
    .limit(5)

  if (oldIssuesResult.error) {
    recordSourceFailure(failedSources, 'issues.old', oldIssuesResult.error)
  } else {
    successfulSources += 1
    for (const issue of oldIssuesResult.data ?? []) {
      alerts.push({
        id: `issue-${issue.id}`,
        title: `Unresolved Issue: ${issue.title}`,
        description: `Open for ${Math.floor((now.getTime() - new Date(issue.created_at).getTime()) / (1000 * 60 * 60))}+ hours`,
        severity: 'critical',
        type: 'issue',
        actionUrl: '/issues',
        actionLabel: 'View Issue',
        timestamp: issue.created_at,
      })
    }
  }

  const highPriorityResult = await supabase
    .from('issues')
    .select('id, title, priority, created_at')
    .eq('status', 'open')
    .eq('priority', 'high')
    .order('created_at', { ascending: true })
    .limit(3)

  if (highPriorityResult.error) {
    recordSourceFailure(failedSources, 'issues.high_priority', highPriorityResult.error)
  } else {
    successfulSources += 1
    for (const issue of highPriorityResult.data ?? []) {
      alerts.push({
        id: `high-${issue.id}`,
        title: `High Priority: ${issue.title}`,
        description: 'Requires immediate attention',
        severity: 'warning',
        type: 'issue',
        actionUrl: '/issues',
        actionLabel: 'View',
        timestamp: issue.created_at,
      })
    }
  }

  const pendingRequestsResult = await supabase
    .from('guest_requests')
    .select('id, request_type, created_at')
    .eq('status', 'pending')
    .order('created_at', { ascending: true })
    .limit(3)

  if (pendingRequestsResult.error) {
    recordSourceFailure(failedSources, 'guest_requests.pending', pendingRequestsResult.error)
  } else {
    successfulSources += 1
    const pendingRequests = pendingRequestsResult.data ?? []
    if (pendingRequests.length > 0) {
      alerts.push({
        id: 'pending-requests',
        title: `${pendingRequests.length} Pending Guest Requests`,
        description: 'Awaiting staff response',
        severity: 'warning',
        type: 'request',
        actionUrl: '/issues',
        actionLabel: 'View Requests',
        timestamp: pendingRequests[0]?.created_at ?? now.toISOString(),
      })
    }
  }

  const maintenanceResult = await supabase
    .from('issues')
    .select('id, title, created_at')
    .eq('status', 'open')
    .ilike('title', '%maintenance%')
    .limit(2)

  if (maintenanceResult.error) {
    recordSourceFailure(failedSources, 'issues.maintenance', maintenanceResult.error)
  } else {
    successfulSources += 1
    const maintenanceIssues = maintenanceResult.data ?? []
    if (maintenanceIssues.length > 0) {
      alerts.push({
        id: 'maintenance-pending',
        title: `${maintenanceIssues.length} Maintenance Items Pending`,
        description: 'Scheduled maintenance needs attention',
        severity: 'warning',
        type: 'maintenance',
        actionUrl: '/issues',
        actionLabel: 'Review',
        timestamp: maintenanceIssues[0]?.created_at ?? now.toISOString(),
      })
    }
  }

  const recentTasksResult = await supabase
    .from('tasks')
    .select('id, title, status, created_at')
    .eq('status', 'completed')
    .gte('created_at', new Date(now.getTime() - 2 * 60 * 60 * 1000).toISOString())
    .limit(1)

  if (recentTasksResult.error) {
    recordSourceFailure(failedSources, 'tasks.recent_completed', recentTasksResult.error)
  } else {
    successfulSources += 1
    const recentTasks = recentTasksResult.data ?? []
    if (recentTasks.length > 0) {
      alerts.push({
        id: 'tasks-completed',
        title: 'Task Completed Successfully',
        description: 'Recent operational work was completed',
        severity: 'info',
        type: 'task',
        actionUrl: '/tasks',
        actionLabel: 'View Tasks',
        timestamp: recentTasks[0]?.created_at ?? now.toISOString(),
      })
    }
  }

  alerts.sort((a, b) => {
    const severityOrder = { critical: 0, warning: 1, info: 2 }
    const severityDiff = severityOrder[a.severity] - severityOrder[b.severity]
    if (severityDiff !== 0) return severityDiff
    return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  })

  const health = successfulSources === 0 ? 'failed' : failedSources.length > 0 ? 'degraded' : 'healthy'

  return {
    alerts: alerts.slice(0, 8),
    health,
    failedSources,
    successfulSources,
  }
}

export async function generateOperationalAlerts(): Promise<Alert[]> {
  const snapshot = await generateOperationalAlertSnapshot()
  return snapshot.alerts
}
