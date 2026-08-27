import { generateOperationalAlertSnapshot } from "@/lib/alert-generator"
import { NextResponse } from "next/server"

export async function GET() {
  try {
    const snapshot = await generateOperationalAlertSnapshot()
    const formattedAlerts = snapshot.alerts.map((alert) => ({
      id: alert.id,
      title: alert.title,
      description: alert.description,
      severity: alert.severity,
      timestamp: alert.timestamp,
      actionUrl: alert.actionUrl || '/issues',
      actionLabel: alert.actionLabel || 'View',
    }))

    return NextResponse.json(formattedAlerts, {
      status: snapshot.health === 'failed' ? 503 : 200,
      headers: {
        'x-operations-health': snapshot.health,
        'x-operations-failed-sources': snapshot.failedSources.join(','),
      },
    })
  } catch (error) {
    console.error("[API] Error generating alerts:", error)
    return NextResponse.json([], {
      status: 503,
      headers: {
        'x-operations-health': 'failed',
        'x-operations-failed-sources': 'alert-generator',
      },
    })
  }
}
