'use client'

import Link from "next/link"
import { useEffect, useState } from "react"
import { Calendar, Home, TrendingUp, Wrench, Sparkles, ArrowRight, Bed, Users } from "lucide-react"
import { useTranslations } from "next-intl"
import { AppLayout } from "@/components/app-layout"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { createBrowserClient } from "@/lib/supabase/client"
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
  const t = useTranslations()
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

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [])

  useEffect(() => {
    loadMetrics()
  }, [])

  async function loadMetrics() {
    try {
      setLoading(true)
      const today = new Date()
      const todayStr = format(today, "yyyy-MM-dd")

      const [bedsResult, roomsResult, checkInsResult, checkOutsResult, occupiedResult] = await Promise.all([
        supabase.from("beds").select("id, is_available", { count: "exact" }).limit(1),
        supabase.from("rooms").select("id", { count: "exact" }).limit(1),
        supabase
          .from("reservations")
          .select("id", { count: "exact" })
          .eq("status", "confirmed")
          .eq("check_in", todayStr),
        supabase
          .from("reservations")
          .select("id", { count: "exact" })
          .eq("status", "confirmed")
          .eq("check_out", todayStr),
        supabase
          .from("reservations")
          .select("num_guests, total_amount")
          .eq("status", "confirmed")
          .lte("check_in", todayStr)
          .gte("check_out", todayStr),
      ])

      const beds = bedsResult.data || []
      const totalBeds = bedsResult.count || beds.length
      const totalRooms = roomsResult.count || 0
      const availableBeds = beds.filter((b) => b.is_available).length
      const occupiedBeds = totalBeds - availableBeds
      const occupancyRate = totalBeds > 0 ? Math.round((occupiedBeds / totalBeds) * 100) : 0

      let activeGuests = 0
      let totalRevenue = 0
      const occupiedData = occupiedResult.data || []

      occupiedData.forEach((res) => {
        activeGuests += res.num_guests || 0
        totalRevenue += res.total_amount || 0
      })

      const activeReservationsResult = await supabase
        .from("reservations")
        .select("id", { count: "exact" })
        .eq("status", "confirmed")
        .lte("check_in", todayStr)
        .gte("check_out", todayStr)
        .limit(1)

      setMetrics({
        totalRooms,
        totalBeds,
        availableBeds,
        occupiedBeds,
        occupancyRate,
        activeGuests,
        todayCheckIns: checkInsResult.count || 0,
        todayCheckOuts: checkOutsResult.count || 0,
        totalRevenue,
        activeReservations: activeReservationsResult.count || 0,
      })
    } catch (error) {
      console.error("Error loading metrics:", error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <AppLayout>
      <div className="bg-gradient-to-b from-accent/5 via-accent/2 to-background border-b border-primary/20">
        <div className="mx-auto max-w-7xl px-3 sm:px-4 py-8 sm:py-12 md:py-16 lg:px-6">
          <div className="space-y-6">
            <div className="flex flex-col md:flex-row items-center gap-6 md:gap-8">
              <div className="flex-shrink-0">
                <img
                  src="/blackswan-logo.png"
                  alt="Blackswan Logo"
                  className="h-32 w-32 md:h-40 md:w-40 object-contain drop-shadow-lg"
                />
              </div>
              <div className="flex-1 space-y-4">
                <div>
                  <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-accent leading-tight">
                    {t("dashboard.title")}
                  </h1>
                  <p className="text-lg md:text-xl text-primary font-semibold mt-2">
                    {t("dashboard.subtitle")}
                  </p>
                </div>
                <p className="text-base md:text-lg text-muted-foreground max-w-2xl">
                  {t("dashboard.description")}
                </p>
                <div className="flex flex-col sm:flex-row gap-3 pt-2">
                  <Link href="/bookings" className="inline-block">
                    <Button size="lg" className="gap-2 w-full sm:w-auto">
                      <Calendar className="h-5 w-5" />
                      {t("navigation.bookings")}
                    </Button>
                  </Link>
                  <Link href="/property-management" className="inline-block">
                    <Button variant="outline" size="lg" className="gap-2 w-full sm:w-auto bg-transparent">
                      <Home className="h-5 w-5" />
                      {t("navigation.property")}
                    </Button>
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-3 sm:px-4 py-6 sm:py-8 md:py-12 lg:px-6 space-y-8 sm:space-y-12">
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <div className="h-1 w-12 bg-primary rounded-full"></div>
            <h2 className="text-xl sm:text-2xl font-bold text-accent">{t("dashboard.overview")}</h2>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            <Card className="border-primary/20 hover:border-primary/40 transition-colors">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-xs sm:text-sm font-medium text-muted-foreground">{t("metrics.rooms")}</CardTitle>
                  <Home className="h-4 w-4 text-primary" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl sm:text-3xl font-bold text-accent">{loading ? "-" : metrics.totalRooms}</div>
                <p className="text-xs text-muted-foreground mt-2">{t("metrics.active")}</p>
              </CardContent>
            </Card>

            <Card className="border-primary/20 hover:border-primary/40 transition-colors">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-xs sm:text-sm font-medium text-muted-foreground">{t("metrics.beds")}</CardTitle>
                  <Bed className="h-4 w-4 text-primary" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl sm:text-3xl font-bold text-accent">{loading ? "-" : metrics.totalBeds}</div>
                <p className="text-xs text-muted-foreground mt-2">{t("metrics.inventory")}</p>
              </CardContent>
            </Card>

            <Card className="border-emerald-200 hover:border-emerald-400 transition-colors">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-xs sm:text-sm font-medium text-muted-foreground">{t("metrics.available")}</CardTitle>
                  <Bed className="h-4 w-4 text-emerald-600" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl sm:text-3xl font-bold text-emerald-600">
                  {loading ? "-" : metrics.availableBeds}
                </div>
                <p className="text-xs text-muted-foreground mt-2">{t("metrics.ready")}</p>
              </CardContent>
            </Card>

            <Card className="border-orange-200 hover:border-orange-400 transition-colors">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-xs sm:text-sm font-medium text-muted-foreground">{t("metrics.occupied")}</CardTitle>
                  <Users className="h-4 w-4 text-orange-600" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl sm:text-3xl font-bold text-orange-600">
                  {loading ? "-" : metrics.occupiedBeds}
                </div>
                <p className="text-xs text-muted-foreground mt-2">{t("metrics.booked")}</p>
              </CardContent>
            </Card>

            <Card className="border-blue-200 hover:border-blue-400 transition-colors">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-xs sm:text-sm font-medium text-muted-foreground">{t("metrics.occupancy")}</CardTitle>
                  <TrendingUp className="h-4 w-4 text-blue-600" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl sm:text-3xl font-bold text-blue-600">
                  {loading ? "-" : `${metrics.occupancyRate}%`}
                </div>
                <p className="text-xs text-muted-foreground mt-2">{t("metrics.utilization")}</p>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-4 sm:grid-cols-3 mt-6">
            <Card className="border-blue-200 bg-blue-50">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-blue-900">{t("metrics.checkins")}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-blue-600">{loading ? "-" : metrics.todayCheckIns}</div>
              </CardContent>
            </Card>

            <Card className="border-red-200 bg-red-50">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-red-900">{t("metrics.checkouts")}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-red-600">{loading ? "-" : metrics.todayCheckOuts}</div>
              </CardContent>
            </Card>

            <Card className="border-green-200 bg-green-50">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-green-900">{t("metrics.guests")}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-600">{loading ? "-" : metrics.activeGuests}</div>
              </CardContent>
            </Card>
          </div>
        </div>

        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <div className="h-1 w-12 bg-primary rounded-full"></div>
            <h2 className="text-xl sm:text-2xl font-bold text-accent">{t("dashboard.tasks")}</h2>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card className="border-secondary hover:shadow-lg transition-shadow cursor-pointer group relative">
              <CardHeader>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1">
                    <CardTitle className="flex items-center gap-2 text-accent text-sm sm:text-base">
                      <Calendar className="h-5 w-5 text-primary flex-shrink-0" />
                      {t("tasks.calendar.title")}
                    </CardTitle>
                    <CardDescription className="mt-1">{t("tasks.calendar.desc")}</CardDescription>
                  </div>
                  <ArrowRight className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors flex-shrink-0" />
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-xs sm:text-sm text-muted-foreground">
                  {t("tasks.calendar.detail")}
                </p>
              </CardContent>
              <Link href="/bookings" className="absolute inset-0 z-0" />
            </Card>

            <Card className="border-secondary hover:shadow-lg transition-shadow cursor-pointer group relative">
              <CardHeader>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1">
                    <CardTitle className="flex items-center gap-2 text-accent text-sm sm:text-base">
                      <Home className="h-5 w-5 text-primary flex-shrink-0" />
                      {t("tasks.property.title")}
                    </CardTitle>
                    <CardDescription className="mt-1">{t("tasks.property.desc")}</CardDescription>
                  </div>
                  <ArrowRight className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors flex-shrink-0" />
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-xs sm:text-sm text-muted-foreground">
                  {t("tasks.property.detail")}
                </p>
              </CardContent>
              <Link href="/property-management" className="absolute inset-0 z-0" />
            </Card>

            <Card className="border-secondary hover:shadow-lg transition-shadow cursor-pointer group relative">
              <CardHeader>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1">
                    <CardTitle className="flex items-center gap-2 text-accent text-sm sm:text-base">
                      <Wrench className="h-5 w-5 text-primary flex-shrink-0" />
                      {t("tasks.maintenance.title")}
                    </CardTitle>
                    <CardDescription className="mt-1">{t("tasks.maintenance.desc")}</CardDescription>
                  </div>
                  <ArrowRight className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors flex-shrink-0" />
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-xs sm:text-sm text-muted-foreground">
                  {t("tasks.maintenance.detail")}
                </p>
              </CardContent>
              <Link href="/maintenance" className="absolute inset-0 z-0" />
            </Card>

            <Card className="border-secondary hover:shadow-lg transition-shadow cursor-pointer group relative">
              <CardHeader>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1">
                    <CardTitle className="flex items-center gap-2 text-accent text-sm sm:text-base">
                      <TrendingUp className="h-5 w-5 text-primary flex-shrink-0" />
                      {t("tasks.analytics.title")}
                    </CardTitle>
                    <CardDescription className="mt-1">{t("tasks.analytics.desc")}</CardDescription>
                  </div>
                  <ArrowRight className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors flex-shrink-0" />
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-xs sm:text-sm text-muted-foreground">
                  {t("tasks.analytics.detail")}
                </p>
              </CardContent>
              <Link href="/analytics" className="absolute inset-0 z-0" />
            </Card>
          </div>
        </div>

        <div className="bg-secondary/40 border border-secondary rounded-lg p-4 sm:p-6 md:p-8 space-y-4">
          <h3 className="text-lg sm:text-xl font-bold text-accent">{t("dashboard.getting_started")}</h3>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 text-sm">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <div className="flex items-center justify-center h-6 w-6 rounded-full bg-primary text-white text-xs font-bold flex-shrink-0">
                  1
                </div>
                <span className="font-semibold text-accent text-sm">{t("onboarding.step1.title")}</span>
              </div>
              <p className="text-muted-foreground text-xs ml-8">{t("onboarding.step1.desc")}</p>
            </div>
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <div className="flex items-center justify-center h-6 w-6 rounded-full bg-primary text-white text-xs font-bold flex-shrink-0">
                  2
                </div>
                <span className="font-semibold text-accent text-sm">{t("onboarding.step2.title")}</span>
              </div>
              <p className="text-muted-foreground text-xs ml-8">{t("onboarding.step2.desc")}</p>
            </div>
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <div className="flex items-center justify-center h-6 w-6 rounded-full bg-primary text-white text-xs font-bold flex-shrink-0">
                  3
                </div>
                <span className="font-semibold text-accent text-sm">{t("onboarding.step3.title")}</span>
              </div>
              <p className="text-muted-foreground text-xs ml-8">{t("onboarding.step3.desc")}</p>
            </div>
          </div>
        </div>
      </div>

      <button
        onClick={() => setSearchDialogOpen(true)}
        className="fixed bottom-4 right-4 sm:bottom-6 sm:right-6 z-50 flex items-center gap-2 px-3 sm:px-4 py-2 sm:py-3 bg-primary text-primary-foreground rounded-full shadow-lg hover:shadow-xl hover:scale-105 transition-all duration-300"
        aria-label="Quick search"
      >
        <Sparkles className="h-4 sm:h-5 w-4 sm:w-5 flex-shrink-0" />
        <span className="font-medium hidden sm:inline text-sm">{t("dashboard.help")}</span>
        <kbd className="hidden sm:inline-flex items-center gap-1 px-2 py-1 text-xs bg-white/20 rounded border border-white/30 ml-2">
          <span>⌘</span>K
        </kbd>
      </button>
    </AppLayout>
  )
}
