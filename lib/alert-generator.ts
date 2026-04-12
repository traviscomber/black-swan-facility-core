import { createClient } from '@/lib/supabase/server'

export interface Alert {
  id: string
  title: string
  description: string
  severity: 'critical' | 'warning' | 'info'
  type: 'issue' | 'task' | 'request' | 'maintenance' | 'fuel' | 'reservation'
  actionUrl: string
  timestamp: string
}

export async function generateOperationalAlerts(): Promise<Alert[]> {
  const supabase = await createClient()
  const alerts: Alert[] = []
  const now = new Date()
  const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000)

  try {
    // Critical: Unresolved issues older than 24 hours
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
          timestamp: issue.created_at,
        })
      })
    }

    // Critical: Overdue maintenance tasks
    const { data: overdueTasks } = await supabase
      .from('tasks')
      .select('id, title, due_date, priority')
      .eq('status', 'pending')
      .eq('category', 'maintenance')
      .lt('due_date', now.toISOString())
      .limit(5)

    if (overdueTasks && overdueTasks.length > 0) {
      overdueTasks.forEach((task: any) => {
        alerts.push({
          id: `task-${task.id}`,
          title: `Overdue Maintenance: ${task.title}`,
          description: `Due date has passed`,
          severity: 'critical',
          type: 'maintenance',
          actionUrl: `/tasks`,
          timestamp: task.due_date,
        })
      })
    }

    // Warning: High-priority pending issues
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
          timestamp: issue.created_at,
        })
      })
    }

    // Warning: Pending facility requests
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
        timestamp: new Date().toISOString(),
      })
    }

    // Info: Today's upcoming check-ins
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString()
    const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).toISOString()

    const { data: todayCheckIns } = await supabase
      .from('reservations')
      .select('id, guest_name')
      .eq('status', 'confirmed')
      .gte('check_in_date', todayStart)
      .lt('check_in_date', todayEnd)
      .limit(3)

    if (todayCheckIns && todayCheckIns.length > 0) {
      alerts.push({
        id: 'checkins-today',
        title: `${todayCheckIns.length} Check-Ins Today`,
        description: `Rooms need to be prepared`,
        severity: 'info',
        type: 'reservation',
        actionUrl: `/bookings`,
        timestamp: new Date().toISOString(),
      })
    }

    // Info: Fuel anomalies from last week
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
    const { data: fuelAnomalies } = await supabase
      .from('fuel_records')
      .select('id, employee_id, liters, date_recorded, employees(name)')
      .gte('date_recorded', sevenDaysAgo.toISOString())
      .gt('liters', 50)
      .limit(2)

    if (fuelAnomalies && fuelAnomalies.length > 0) {
      alerts.push({
        id: 'fuel-anomaly',
        title: 'Unusual Fuel Consumption Detected',
        description: `${fuelAnomalies.length} records with high consumption`,
        severity: 'info',
        type: 'fuel',
        actionUrl: `/combustibles`,
        timestamp: new Date().toISOString(),
      })
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
    console.error('[Alert Generator] Error fetching alerts:', error)
    return []
  }
}
