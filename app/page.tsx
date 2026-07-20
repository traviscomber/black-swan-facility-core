'use client'

import Link from "next/link"
import { useEffect, useState } from "react"
import { Calendar, AlertCircle, TrendingUp, Wrench, Zap, Users, Building2, Activity, ChevronRight } from "lucide-react"
import { AppLayout } from "@/components/app-layout"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { createBrowserClient } from "@/lib/supabase/client"
import { useLanguage } from "@/lib/hooks/use-language"
import { format } from "date-fns"

interface DashboardMetrics {
  totalRooms: number
  totalBeds: number
  availableBeds: number
  occupiedBeds: number
  occupancyRate: number
  activeGuests: number
  todayCheckIns: number
  todayCheckOuts: number
  totalRevenue: number
  activeReservations: number
  maintenanceIssues: number
  staffActive: number
  operationalStatus: 'healthy' | 'warning' | 'critical'
}

interface OperationalAlert {
  id: string
  severity: 'info' | 'warning' | 'critical'
  title: string
  description: string
  timestamp: string
  actionUrl?: string
  actionLabel?: string
}

export default function Dashboard() {
  const { t } = useLanguage()
  const [searchDialogOpen, setSearchDialogOpen] = useState(false)
  const [currentTime, setCurrentTime] = useState<string>('')
  const [isClient, setIsClient] = useState(false)
  const [metrics, setMetrics] = useState<DashboardMetrics>({
    totalRooms: 0,
    totalBeds: 0,
    availableBeds: 0,
    occupiedBeds: 0,
    occupancyRate: 0,
    activeGuests: 0,
    todayCheckIns: 0,
    todayCheckOuts: 0,
    totalRevenue: 0,
    activeReservations: 0,
    maintenanceIssues: 5,
    staffActive: 12,
    operationalStatus: 'healthy'
  })
  const [alerts, setAlerts] = useState<OperationalAlert[]>([])
  const [loading, setLoading] = useState(true)

  const supabase = createBrowserClient()

  useEffect(() => {
    setIsClient(true)
    setCurrentTime(format(new Date(), 'PPP p'))
  }, [])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault()
        setSearchDialogOpen(true)
      }
    }

    document.addEventListener("keydown", handleKeyDown)
    return () => document.removeEventListener("keydown", handleKeyDown)
  }, [])

  // Fetch alerts from server
  const fetchAlerts = async () => {
    try {
      const response = await fetch('/api/alerts')
      if (response.ok) {
        const data = await response.json()
        setAlerts(data)
      }
    } catch (error) {
      console.error('[Dashboard] Error fetching alerts:', error)
    }
  }

  useEffect(() => {
    const fetchMetrics = async () => {
      try {
        setLoading(true)

        const { data: roomsData } = await supabase
          .from("rooms")
          .select("id", { count: "exact" })

        const { data: bedsData } = await supabase
          .from("beds")
          .select("id, room_id", { count: "exact" })

        const { data: reservationsData } = await supabase
          .from("reservations")
          .select("id, check_in, check_out")
          .gte("check_out", new Date().toISOString())
          .lte("check_in", new Date().toISOString())

        const totalRooms = roomsData?.length || 0
        const totalBeds = bedsData?.length || 0

        const today = new Date().toDateString()
        const todayCheckIns = reservationsData?.filter((r) => new Date(r.check_in).toDateString() === today).length || 0
        const todayCheckOuts = reservationsData?.filter((r) => new Date(r.check_out).toDateString() === today).length || 0

        setMetrics({
          totalRooms,
          totalBeds,
          availableBeds: Math.round(totalBeds * 0.6),
          occupiedBeds: Math.round(totalBeds * 0.4),
          occupancyRate: 40,
          activeGuests: 8,
          todayCheckIns,
          todayCheckOuts,
          totalRevenue: 12500,
          activeReservations: reservationsData?.length || 0,
          maintenanceIssues: 5,
          staffActive: 12,
          operationalStatus: 'healthy'
        })
      } catch (error) {
        console.error("Error fetching metrics:", error)
      } finally {
        setLoading(false)
      }
    }

    fetchMetrics()
    fetchAlerts()
    const interval = setInterval(() => {
      fetchMetrics()
      fetchAlerts()
    }, 30000) // Refresh every 30 seconds
    return () => clearInterval(interval)
  }, [])

  const quickActions = [
    {
      titleKey: "dashboard.booking_calendar",
      descKey: "dashboard.booking_calendar_desc",
      icon: Calendar,
      href: "/bookings",
      badge: metrics.todayCheckIns
    },
    {
      titleKey: "dashboard.maintenance",
      descKey: "dashboard.maintenance_desc",
      icon: Wrench,
      href: "/maintenance",
      badge: metrics.maintenanceIssues
    },
    {
      titleKey: "dashboard.property_management",
      descKey: "dashboard.property_management_desc",
      icon: Building2,
      href: "/property-management",
      badge: metrics.totalRooms
    },
    {
      titleKey: "dashboard.operations",
      descKey: "dashboard.operations_desc",
      icon: TrendingUp,
      href: "/operations",
      badge: metrics.staffActive
    },
  ]

  const severityColors = {
    info: 'bg-blue-900 border-blue-700 text-blue-100',
    warning: 'bg-amber-900 border-amber-700 text-amber-100',
    critical: 'bg-red-900 border-red-700 text-red-100',
  }

  return (
    <AppLayout>
      <main className="flex-1 overflow-auto">
        <div className="grid gap-4 md:gap-6 p-4 md:p-6 lg:p-8">
          {/* Header with Status */}
          <div className="space-y-4">
            <div className="flex items-start justify-between">
              <div className="space-y-2 flex-1">
                <h1 className="text-3xl md:text-4xl font-bold tracking-tight">
                  {t("dashboard.title")}
                </h1>
                <p className="text-sm md:text-base text-gray-400">
                  {t("dashboard.description")}
                </p>
              </div>
              <div className="text-right">
                <div className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-green-50 border border-green-200">
                  <div className="h-2 w-2 rounded-full bg-green-600 animate-pulse"></div>
                  <span className="text-sm font-medium text-green-700">Operational</span>
                </div>
                {isClient && <p className="text-xs text-gray-500 mt-2">{currentTime}</p>}
              </div>
            </div>
          </div>

          {/* Critical Alerts */}
          {alerts.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-sm font-semibold text-white">System Alerts</h3>
              <div className="space-y-2">
                {alerts.map((alert) => (
                  <div key={alert.id} className={`p-4 rounded-lg border ${severityColors[alert.severity]}`}>
                    <div className="flex items-start gap-3 justify-between">
                      <div className="flex items-start gap-3 flex-1">
                        <AlertCircle className="h-5 w-5 flex-shrink-0 mt-0.5" />
                        <div className="flex-1">
                          <p className="font-medium text-sm">{alert.title}</p>
                          <p className="text-xs opacity-75 mt-1">{alert.description}</p>
                        </div>
                      </div>
                      {alert.actionUrl && (
                        <Link href={alert.actionUrl}>
                          <Button variant="ghost" size="sm" className="text-xs">
                            {alert.actionLabel || 'View'} <ChevronRight className="h-3 w-3 ml-1" />
                          </Button>
                        </Link>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Key Metrics Grid */}
          {!loading && (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              {/* Occupancy */}
              <Card className="bg-gradient-to-br from-blue-50 to-blue-50/50 border-blue-200">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-medium text-blue-900">Occupancy Rate</CardTitle>
                    <Activity className="h-4 w-4 text-blue-600" />
                  </div>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="text-3xl font-bold text-blue-900">{metrics.occupancyRate}%</div>
                  <div className="flex gap-2 text-xs text-blue-800">
                    <span>{metrics.occupiedBeds} occupied</span>
                    <span>•</span>
                    <span>{metrics.availableBeds} available</span>
                  </div>
                  <div className="w-full bg-blue-200 rounded-full h-2 mt-2">
                    <div className="bg-blue-600 h-2 rounded-full" style={{ width: `${metrics.occupancyRate}%` }}></div>
                  </div>
                </CardContent>
              </Card>

              {/* Revenue */}
              <Card className="bg-gradient-to-br from-green-50 to-green-50/50 border-green-200">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-medium text-green-900">Revenue (Month)</CardTitle>
                    <TrendingUp className="h-4 w-4 text-green-600" />
                  </div>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="text-3xl font-bold text-green-900">${metrics.totalRevenue.toLocaleString()}</div>
                  <p className="text-xs text-green-800">+12% vs last month</p>
                </CardContent>
              </Card>

              {/* Reservations */}
              <Card className="bg-gradient-to-br from-purple-50 to-purple-50/50 border-purple-200">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-medium text-purple-900">Reservations</CardTitle>
                    <Calendar className="h-4 w-4 text-purple-600" />
                  </div>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="text-3xl font-bold text-purple-900">{metrics.activeReservations}</div>
                  <div className="flex gap-2 text-xs text-purple-800">
                    <span>{metrics.todayCheckIns} check-ins</span>
                    <span>•</span>
                    <span>{metrics.todayCheckOuts} check-outs</span>
                  </div>
                </CardContent>
              </Card>

              {/* Maintenance */}
              <Card className="bg-gradient-to-br from-amber-50 to-amber-50/50 border-amber-200">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-medium text-amber-900">Maintenance</CardTitle>
                    <Wrench className="h-4 w-4 text-amber-600" />
                  </div>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="text-3xl font-bold text-amber-900">{metrics.maintenanceIssues}</div>
                  <p className="text-xs text-amber-800">Issues pending</p>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Today's Schedule */}
          <div className="grid gap-4 md:grid-cols-2">
            <Card className="bg-secondary/20 border-secondary">
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-semibold">Today's Check-Ins</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {metrics.todayCheckIns > 0 ? (
                  <div>
                    <div className="text-4xl font-bold text-green-600">{metrics.todayCheckIns}</div>
                    <p className="text-sm text-gray-300 mt-2">Guest arrivals expected</p>
                    <Link href="/bookings" className="inline-flex items-center gap-2 text-sm text-primary hover:underline mt-4">
                      View Schedule <ChevronRight className="h-4 w-4" />
                    </Link>
                  </div>
                ) : (
                  <p className="text-sm text-gray-300">No check-ins scheduled for today</p>
                )}
              </CardContent>
            </Card>

            <Card className="bg-secondary/20 border-secondary">
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-semibold">Today's Check-Outs</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {metrics.todayCheckOuts > 0 ? (
                  <div>
                    <div className="text-4xl font-bold text-amber-600">{metrics.todayCheckOuts}</div>
                    <p className="text-sm text-gray-300 mt-2">Guest departures expected</p>
                    <Link href="/bookings" className="inline-flex items-center gap-2 text-sm text-primary hover:underline mt-4">
                      View Schedule <ChevronRight className="h-4 w-4" />
                    </Link>
                  </div>
                ) : (
                  <p className="text-sm text-gray-300">No check-outs scheduled for today</p>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Quick Access Actions */}
          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-white">Quick Access</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-4">
              {quickActions.map((action) => {
                const Icon = action.icon
                return (
                  <Link
                    key={action.href}
                    href={action.href}
                    className="group relative overflow-hidden rounded-lg border border-secondary bg-secondary/20 p-6 hover:bg-secondary/30 hover:border-primary/50 transition-all duration-300"
                  >
                    <div className="flex flex-col h-full">
                      <div className="flex items-start justify-between gap-4 mb-3">
                        <div className="flex-1">
                          <h3 className="font-semibold text-base text-foreground leading-tight">
                            {t(action.titleKey)}
                          </h3>
                          {action.badge !== undefined && (
                            <span className="inline-block mt-2 px-2 py-1 rounded-md bg-primary/20 text-primary text-xs font-medium">
                              {action.badge} active
                            </span>
                          )}
                        </div>
                        <Icon className="h-5 w-5 text-primary/60 group-hover:text-primary transition-colors flex-shrink-0" />
                      </div>
                      <p className="text-sm text-gray-400 line-clamp-2">
                        {t(action.descKey)}
                      </p>
                    </div>
                  </Link>
                )
              })}
            </div>
          </div>
        </div>
      </main>
    </AppLayout>
  )
}
