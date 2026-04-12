import { generateOperationalAlerts } from "@/lib/alert-generator"
import { NextResponse } from "next/server"

export async function GET() {
  try {
    const alerts = await generateOperationalAlerts()
    
    // Transform alerts to match the client interface
    const formattedAlerts = alerts.map((alert: any) => ({
      id: alert.id,
      title: alert.title,
      description: alert.description,
      severity: alert.severity,
      timestamp: alert.timestamp,
      actionUrl: alert.actionUrl || '/issues',
      actionLabel: alert.actionLabel || 'View',
    }))

    return NextResponse.json(formattedAlerts)
  } catch (error) {
    console.error("[API] Error generating alerts:", error)
    return NextResponse.json([], { status: 200 })
  }
}
