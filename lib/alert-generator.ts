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

export async function generateOperationalAlerts(): Promise<Alert[]> {
  const supabase = await createClient()
  const alerts: Alert[] = []
  const now = new Date()
  const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000)

  try {
    // Critical: Unresolved issues older than 24 hours
    try {
      const { data: oldIssues } = await supabase
        .from('issues')
        .select('id, title, created_at, priority')
        .eq('status', 'open')
        .lt('created_at', twentyFourHoursAgo.toISOString())
        .order('created_at', { ascending: true })
        .limit(5)

      if (oldIssues && oldIssues.length > 0) {
        oldIssues.forEach((issue: any) => {
          alerts.push({
            id: `issue-${issue.id}`,
            title: `Unresolved Issue: ${issue.title}`,
            description: `Open for ${Math.floor((now.getTime() - new Date(issue.created_at).getTime()) / (1000 * 60 * 60))}+ hours`,
            severity: 'critical',
            type: 'issue',
            actionUrl: `/issues`,
            actionLabel: 'View Issue',
            timestamp: issue.created_at,
          })
        })
      }
    } catch (e) {
      console.debug('[Alert Generator] Issues table query failed:', e)
    }

    // Warning: High-priority pending issues
    try {
      const { data: highPriorityIssues } = await supabase
        .from('issues')
        .select('id, title, priority, created_at')
        .eq('status', 'open')
        .eq('priority', 'high')
        .order('created_at', { ascending: true })
        .limit(3)

      if (highPriorityIssues && highPriorityIssues.length > 0) {
        highPriorityIssues.forEach((issue: any) => {
          alerts.push({
            id: `high-${issue.id}`,
            title: `High Priority: ${issue.title}`,
            description: `Requires immediate attention`,
            severity: 'warning',
            type: 'issue',
            actionUrl: `/issues`,
            actionLabel: 'View',
            timestamp: issue.created_at,
          })
        })
      }
    } catch (e) {
      console.debug('[Alert Generator] High priority issues query failed:', e)
    }

    // Warning: Pending guest requests
    try {
      const { data: pendingRequests } = await supabase
        .from('guest_requests')
        .select('id, request_type, created_at')
        .eq('status', 'pending')
        .order('created_at', { ascending: true })
        .limit(3)

      if (pendingRequests && pendingRequests.length > 0) {
        alerts.push({
          id: 'pending-requests',
          title: `${pendingRequests.length} Pending Guest Requests`,
          description: `Awaiting staff response`,
          severity: 'warning',
          type: 'request',
          actionUrl: `/issues`,
          actionLabel: 'View Requests',
          timestamp: new Date().toISOString(),
        })
      }
    } catch (e) {
      console.debug('[Alert Generator] Guest requests query failed:', e)
    }

    // Info: Maintenance issues pending
    try {
      const { data: maintenanceIssues } = await supabase
        .from('issues')
        .select('id, title, created_at')
        .eq('status', 'open')
        .ilike('title', '%maintenance%')
        .limit(2)

      if (maintenanceIssues && maintenanceIssues.length > 0) {
        alerts.push({
          id: 'maintenance-pending',
          title: `${maintenanceIssues.length} Maintenance Items Pending`,
          description: `Scheduled maintenance needs attention`,
          severity: 'warning',
          type: 'maintenance',
          actionUrl: `/issues`,
          actionLabel: 'Review',
          timestamp: new Date().toISOString(),
        })
      }
    } catch (e) {
      console.debug('[Alert Generator] Maintenance issues query failed:', e)
    }

    // Info: Recent task completions (positive alert)
    try {
      const { data: recentTasks } = await supabase
        .from('tasks')
        .select('id, title, status, created_at')
        .eq('status', 'completed')
        .gte('created_at', new Date(now.getTime() - 2 * 60 * 60 * 1000).toISOString())
        .limit(1)

      if (recentTasks && recentTasks.length > 0) {
        alerts.push({
          id: 'tasks-completed',
          title: `Task Completed Successfully`,
          description: `Keep up the great work on daily operations`,
          severity: 'info',
          type: 'task',
          actionUrl: `/tasks`,
          actionLabel: 'View Tasks',
          timestamp: new Date().toISOString(),
        })
      }
    } catch (e) {
      console.debug('[Alert Generator] Tasks query failed:', e)
    }

    // Sort by severity and timestamp
    alerts.sort((a, b) => {
      const severityOrder = { critical: 0, warning: 1, info: 2 }
      const severityDiff = severityOrder[a.severity] - severityOrder[b.severity]
      if (severityDiff !== 0) return severityDiff
      return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    })

    return alerts.slice(0, 8) // Return top 8 alerts
  } catch (error) {
    console.error('[Alert Generator] Fatal error:', error)
    return []
  }
}
