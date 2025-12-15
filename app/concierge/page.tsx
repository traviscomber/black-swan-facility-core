"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { createBrowserClient } from "@/lib/supabase/client"
import { MessageSquare, Users, AlertTriangle, CheckCircle2, Clock, TrendingUp } from "lucide-react"
import Link from "next/link"
import { format } from "date-fns"

interface Stats {
  newLeads: number
  activeConversations: number
  openIncidents: number
  tasksToday: number
  conversionRate: number
  avgResponseTime: number
}

export default function ConciergeDashboard() {
  const [stats, setStats] = useState<Stats>({
    newLeads: 0,
    activeConversations: 0,
    openIncidents: 0,
    tasksToday: 0,
    conversionRate: 0,
    avgResponseTime: 0,
  })
  const [recentActivity, setRecentActivity] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadDashboard()
  }, [])

  async function loadDashboard() {
    const supabase = createBrowserClient()

    const [leadsRes, messagesRes, incidentsRes, tasksRes, auditRes] = await Promise.all([
      supabase.from("leads").select("*").eq("stage", "new"),
      supabase
        .from("messages")
        .select("*")
        .gte("ts", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()),
      supabase.from("incidents").select("*").eq("status", "open"),
      supabase.from("tasks").select("*").eq("due_date", format(new Date(), "yyyy-MM-dd")),
      supabase.from("audit_actions").select("*").order("ts", { ascending: false }).limit(10),
    ])

    // Calculate conversion rate
    const { data: allLeads } = await supabase.from("leads").select("stage")
    const converted = allLeads?.filter((l) => l.stage === "converted").length || 0
    const total = allLeads?.length || 1
    const conversionRate = Math.round((converted / total) * 100)

    setStats({
      newLeads: leadsRes.data?.length || 0,
      activeConversations: messagesRes.data?.length || 0,
      openIncidents: incidentsRes.data?.length || 0,
      tasksToday: tasksRes.data?.length || 0,
      conversionRate,
      avgResponseTime: 2.3, // Mock for now - calculate from messages
    })

    setRecentActivity(auditRes.data || [])
    setLoading(false)
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold">Concierge Command Center</h1>
        <p className="text-muted-foreground">AI-powered WhatsApp operations & guest management</p>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">New Leads</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.newLeads}</div>
            <p className="text-xs text-muted-foreground">Awaiting qualification</p>
            <Link href="/concierge/leads">
              <Button size="sm" variant="link" className="px-0">
                View all leads →
              </Button>
            </Link>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Conversations</CardTitle>
            <MessageSquare className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.activeConversations}</div>
            <p className="text-xs text-muted-foreground">Last 24 hours</p>
            <Link href="/concierge/messages">
              <Button size="sm" variant="link" className="px-0">
                View messages →
              </Button>
            </Link>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Open Incidents</CardTitle>
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.openIncidents}</div>
            <p className="text-xs text-muted-foreground">Require attention</p>
            <Link href="/concierge/incidents">
              <Button size="sm" variant="link" className="px-0">
                View incidents →
              </Button>
            </Link>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Tasks Today</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.tasksToday}</div>
            <p className="text-xs text-muted-foreground">Due today</p>
            <Link href="/tasks">
              <Button size="sm" variant="link" className="px-0">
                View tasks →
              </Button>
            </Link>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Conversion Rate</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.conversionRate}%</div>
            <p className="text-xs text-muted-foreground">Lead to booking</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Response Time</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.avgResponseTime}m</div>
            <p className="text-xs text-muted-foreground">WhatsApp replies</p>
          </CardContent>
        </Card>
      </div>

      {/* Recent Activity */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Agent Activity</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-muted-foreground">Loading activity...</div>
          ) : recentActivity.length === 0 ? (
            <div className="text-muted-foreground">No recent activity</div>
          ) : (
            <div className="space-y-4">
              {recentActivity.map((action) => (
                <div key={action.id} className="flex items-start justify-between border-b pb-3 last:border-0">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <Badge variant={action.actor === "agent" ? "default" : "secondary"}>{action.actor}</Badge>
                      <span className="text-sm font-medium">{action.action_type.replace(/_/g, " ")}</span>
                    </div>
                    {action.phone && <div className="text-xs text-muted-foreground">Phone: {action.phone}</div>}
                  </div>
                  <div className="text-xs text-muted-foreground">{format(new Date(action.ts), "MMM d, h:mm a")}</div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Link href="/concierge/leads">
            <Button variant="outline">Manage Leads</Button>
          </Link>
          <Link href="/concierge/messages">
            <Button variant="outline">View Messages</Button>
          </Link>
          <Link href="/concierge/incidents">
            <Button variant="outline">Report Incident</Button>
          </Link>
          <Link href="/tasks">
            <Button variant="outline">Create Task</Button>
          </Link>
          <Link href="/bookings">
            <Button variant="outline">Check Availability</Button>
          </Link>
        </CardContent>
      </Card>
    </div>
  )
}
