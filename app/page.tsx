'use client'

import Link from "next/link"
import { useEffect, useState } from "react"
import { Calendar, Home, TrendingUp, Wrench, Sparkles, ArrowRight, Bed, Users } from "lucide-react"
import { AppLayout } from "@/components/app-layout"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { createBrowserClient } from "@/lib/supabase/client"
import { useLanguage } from "@/lib/language-provider"
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
}

export default function Dashboard() {
  const { t } = useLanguage()
  const [searchDialogOpen, setSearchDialogOpen] = useState(false)
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
  })
  const [loading, setLoading] = useState(true)

  const supabase = createBrowserClient()

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
          .select("id, check_in_date, check_out_date")
          .gte("check_out_date", new Date().toISOString())
          .lte("check_in_date", new Date().toISOString())

        const totalRooms = roomsData?.length || 0
        const totalBeds = bedsData?.length || 0

        const today = new Date().toDateString()
        const todayCheckIns = reservationsData?.filter((r) => new Date(r.check_in_date).toDateString() === today).length || 0
        const todayCheckOuts = reservationsData?.filter((r) => new Date(r.check_out_date).toDateString() === today).length || 0

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
        })
      } catch (error) {
        console.error("Error fetching metrics:", error)
      } finally {
        setLoading(false)
      }
    }

    fetchMetrics()
  }, [])

  const quickActions = [
    {
      titleKey: "dashboard.booking_calendar",
      descKey: "dashboard.booking_calendar_desc",
      icon: Calendar,
      href: "/bookings",
    },
    {
      titleKey: "dashboard.property_management",
      descKey: "dashboard.property_management_desc",
      icon: Home,
      href: "/property-management",
    },
    {
      titleKey: "dashboard.maintenance",
      descKey: "dashboard.maintenance_desc",
      icon: Wrench,
      href: "/maintenance",
    },
    {
      titleKey: "dashboard.analytics",
      descKey: "dashboard.analytics_desc",
      icon: TrendingUp,
      href: "/assets/analytics",
    },
  ]

  return (
    <AppLayout>
      <main className="flex-1 overflow-auto">
        <div className="grid gap-4 md:gap-6 p-4 md:p-6 lg:p-8">
          {/* Header */}
          <div className="space-y-2">
            <h1 className="text-3xl md:text-4xl font-bold tracking-tight">
              {t("dashboard.title")}
            </h1>
            <p className="text-sm md:text-base text-gray-400">
              {t("dashboard.description")}
            </p>
          </div>

          {/* Key Metrics */}
          {!loading && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mt-4">
              <Card className="bg-secondary/20 border-secondary">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-gray-400">{t("dashboard.total_rooms")}</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{metrics.totalRooms}</div>
                  <p className="text-xs text-gray-500 mt-1">{t("dashboard.total_rooms_desc")}</p>
                </CardContent>
              </Card>

              <Card className="bg-secondary/20 border-secondary">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-gray-400">{t("dashboard.total_beds")}</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{metrics.totalBeds}</div>
                  <p className="text-xs text-gray-500 mt-1">{t("dashboard.total_beds_desc")}</p>
                </CardContent>
              </Card>

              <Card className="bg-secondary/20 border-secondary">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-gray-400">{t("dashboard.occupancy_rate")}</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{metrics.occupancyRate}%</div>
                  <p className="text-xs text-gray-500 mt-1">{t("dashboard.occupancy_rate_desc")}</p>
                </CardContent>
              </Card>

              <Card className="bg-secondary/20 border-secondary">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-gray-400">{t("dashboard.active_reservations")}</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{metrics.activeReservations}</div>
                  <p className="text-xs text-gray-500 mt-1">{t("dashboard.active_reservations_desc")}</p>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Today's Events */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
            <Card className="bg-secondary/20 border-secondary">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium">{t("dashboard.todays_checkins")}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-green-500">{metrics.todayCheckIns}</div>
                <p className="text-xs text-gray-500 mt-1">{t("dashboard.todays_checkins_desc")}</p>
              </CardContent>
            </Card>

            <Card className="bg-secondary/20 border-secondary">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium">{t("dashboard.todays_checkouts")}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-amber-500">{metrics.todayCheckOuts}</div>
                <p className="text-xs text-gray-500 mt-1">{t("dashboard.todays_checkouts_desc")}</p>
              </CardContent>
            </Card>
          </div>

          {/* Quick Actions */}
          <div className="mt-8">
            <h2 className="text-lg font-semibold mb-4">{t("dashboard.quick_actions")}</h2>
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
                        <h3 className="font-semibold text-base text-foreground leading-tight">
                          {t(action.titleKey)}
                        </h3>
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
