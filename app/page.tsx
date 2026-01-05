"use client"

import Link from "next/link"
import { useEffect, useState } from "react"
import { Calendar, Home, TrendingUp, Wrench, Sparkles, ArrowRight, Bed, Users } from "lucide-react"
import { AppLayout } from "@/components/app-layout"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { createBrowserClient } from "@/lib/supabase/client"
import { format, parseISO, isWithinInterval } from "date-fns"

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

      const [bedsResult, roomsResult, reservationsResult] = await Promise.all([
        supabase.from("beds").select("id, is_available"),
        supabase.from("rooms").select("id"),
        supabase
          .from("reservations")
          .select("check_in, check_out, num_guests, status, total_amount")
          .eq("status", "confirmed"),
      ])

      const beds = bedsResult.data || []
      const rooms = roomsResult.data || []
      const reservations = reservationsResult.data || []

      const totalBeds = beds.length
      const availableBeds = beds.filter((b) => b.is_available).length
      const occupiedBeds = totalBeds - availableBeds

      // Calculate today's check-ins/outs and active guests
      let todayCheckIns = 0
      let todayCheckOuts = 0
      let activeGuests = 0
      let totalRevenue = 0

      reservations.forEach((res) => {
        const checkInDate = parseISO(res.check_in)
        const checkOutDate = parseISO(res.check_out)

        // Check if reservation spans today
        if (isWithinInterval(today, { start: checkInDate, end: checkOutDate })) {
          activeGuests += res.num_guests || 0
        }

        // Check for today's check-ins
        if (format(checkInDate, "yyyy-MM-dd") === format(today, "yyyy-MM-dd")) {
          todayCheckIns++
        }

        // Check for today's check-outs
        if (format(checkOutDate, "yyyy-MM-dd") === format(today, "yyyy-MM-dd")) {
          todayCheckOuts++
        }

        // Add to total revenue
        totalRevenue += res.total_amount || 0
      })

      const occupancyRate = totalBeds > 0 ? Math.round((occupiedBeds / totalBeds) * 100) : 0

      setMetrics({
        totalRooms: rooms.length,
        totalBeds,
        availableBeds,
        occupiedBeds,
        occupancyRate,
        activeGuests,
        todayCheckIns,
        todayCheckOuts,
        totalRevenue,
        activeReservations: reservations.length,
      })
    } catch (error) {
      console.error("Error loading metrics:", error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <AppLayout>
      <div className="bg-gradient-to-br from-secondary via-background to-background border-b border-secondary">
        <div className="mx-auto max-w-7xl px-3 sm:px-4 py-8 sm:py-16 md:py-20 lg:px-6">
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 sm:gap-6 mb-6">
              <img
                src="/blackswan-logo.png"
                alt="Blackswan Logo"
                className="h-24 sm:h-32 w-24 sm:w-32 object-contain flex-shrink-0 drop-shadow-lg"
              />
              <div className="flex-1">
                <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold text-accent leading-tight">
                  Blackswan Facility Core System
                </h1>
                <p className="text-sm sm:text-base text-muted-foreground mt-2">
                  BFCS v1.0 - Luxury Property Management
                </p>
              </div>
            </div>
            <p className="text-base sm:text-lg text-muted-foreground max-w-2xl">
              Professional facility management and booking system for your luxury vacation rental. Manage reservations,
              track availability, and optimize occupancy rates.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 pt-4">
              <Link href="/bookings" className="inline-block relative z-10">
                <Button size="lg" className="gap-2 w-full sm:w-auto">
                  <Calendar className="h-5 w-5" />
                  View Bookings
                </Button>
              </Link>
              <Link href="/property-management" className="inline-block relative z-10">
                <Button variant="outline" size="lg" className="gap-2 bg-transparent w-full sm:w-auto">
                  <Home className="h-5 w-5" />
                  Manage Property
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-3 sm:px-4 py-6 sm:py-8 md:py-12 lg:px-6 space-y-8 sm:space-y-12">
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <div className="h-1 w-12 bg-primary rounded-full"></div>
            <h2 className="text-xl sm:text-2xl font-bold text-accent">Property Overview</h2>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            <Card className="border-primary/20 hover:border-primary/40 transition-colors">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-xs sm:text-sm font-medium text-muted-foreground">Total Rooms</CardTitle>
                  <Home className="h-4 w-4 text-primary" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl sm:text-3xl font-bold text-accent">{loading ? "-" : metrics.totalRooms}</div>
                <p className="text-xs text-muted-foreground mt-2">Active properties</p>
              </CardContent>
            </Card>

            <Card className="border-primary/20 hover:border-primary/40 transition-colors">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-xs sm:text-sm font-medium text-muted-foreground">Total Beds</CardTitle>
                  <Bed className="h-4 w-4 text-primary" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl sm:text-3xl font-bold text-accent">{loading ? "-" : metrics.totalBeds}</div>
                <p className="text-xs text-muted-foreground mt-2">Available inventory</p>
              </CardContent>
            </Card>

            <Card className="border-emerald-200 hover:border-emerald-400 transition-colors">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-xs sm:text-sm font-medium text-muted-foreground">Available</CardTitle>
                  <Bed className="h-4 w-4 text-emerald-600" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl sm:text-3xl font-bold text-emerald-600">
                  {loading ? "-" : metrics.availableBeds}
                </div>
                <p className="text-xs text-muted-foreground mt-2">Ready for booking</p>
              </CardContent>
            </Card>

            <Card className="border-orange-200 hover:border-orange-400 transition-colors">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-xs sm:text-sm font-medium text-muted-foreground">Occupied</CardTitle>
                  <Users className="h-4 w-4 text-orange-600" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl sm:text-3xl font-bold text-orange-600">
                  {loading ? "-" : metrics.occupiedBeds}
                </div>
                <p className="text-xs text-muted-foreground mt-2">Currently booked</p>
              </CardContent>
            </Card>

            <Card className="border-blue-200 hover:border-blue-400 transition-colors">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-xs sm:text-sm font-medium text-muted-foreground">Occupancy</CardTitle>
                  <TrendingUp className="h-4 w-4 text-blue-600" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl sm:text-3xl font-bold text-blue-600">
                  {loading ? "-" : `${metrics.occupancyRate}%`}
                </div>
                <p className="text-xs text-muted-foreground mt-2">Utilization rate</p>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-4 sm:grid-cols-3 mt-6">
            <Card className="border-blue-200 bg-blue-50">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-blue-900">Today's Check-ins</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-blue-600">{loading ? "-" : metrics.todayCheckIns}</div>
              </CardContent>
            </Card>

            <Card className="border-red-200 bg-red-50">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-red-900">Today's Check-outs</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-red-600">{loading ? "-" : metrics.todayCheckOuts}</div>
              </CardContent>
            </Card>

            <Card className="border-green-200 bg-green-50">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-green-900">Active Guests</CardTitle>
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
            <h2 className="text-xl sm:text-2xl font-bold text-accent">Essential Tasks</h2>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card className="border-secondary hover:shadow-lg transition-shadow cursor-pointer group relative">
              <CardHeader>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1">
                    <CardTitle className="flex items-center gap-2 text-accent text-sm sm:text-base">
                      <Calendar className="h-5 w-5 text-primary flex-shrink-0" />
                      Booking Calendar
                    </CardTitle>
                    <CardDescription className="mt-1">View and manage all reservations</CardDescription>
                  </div>
                  <ArrowRight className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors flex-shrink-0" />
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-xs sm:text-sm text-muted-foreground">
                  Check availability, create new bookings, and track guest check-ins across all rooms and beds.
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
                      Property Management
                    </CardTitle>
                    <CardDescription className="mt-1">Configure rooms and amenities</CardDescription>
                  </div>
                  <ArrowRight className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors flex-shrink-0" />
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-xs sm:text-sm text-muted-foreground">
                  Edit room details, manage bed configurations, set rates, and update property availability settings.
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
                      Maintenance
                    </CardTitle>
                    <CardDescription className="mt-1">Schedule and track maintenance</CardDescription>
                  </div>
                  <ArrowRight className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors flex-shrink-0" />
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-xs sm:text-sm text-muted-foreground">
                  Keep track of property maintenance schedules, repairs, and facility improvements.
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
                      Analytics
                    </CardTitle>
                    <CardDescription className="mt-1">View booking trends and insights</CardDescription>
                  </div>
                  <ArrowRight className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors flex-shrink-0" />
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-xs sm:text-sm text-muted-foreground">
                  Monitor occupancy rates, revenue trends, and booking patterns to optimize your rental strategy.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>

        <div className="bg-secondary/40 border border-secondary rounded-lg p-4 sm:p-6 md:p-8 space-y-4">
          <h3 className="text-lg sm:text-xl font-bold text-accent">Getting Started</h3>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 text-sm">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <div className="flex items-center justify-center h-6 w-6 rounded-full bg-primary text-white text-xs font-bold flex-shrink-0">
                  1
                </div>
                <span className="font-semibold text-accent text-sm">Set Up Your Property</span>
              </div>
              <p className="text-muted-foreground text-xs ml-8">Configure rooms, beds, and pricing for your facility</p>
            </div>
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <div className="flex items-center justify-center h-6 w-6 rounded-full bg-primary text-white text-xs font-bold flex-shrink-0">
                  2
                </div>
                <span className="font-semibold text-accent text-sm">Create First Booking</span>
              </div>
              <p className="text-muted-foreground text-xs ml-8">
                Add a test reservation to familiarize yourself with the system
              </p>
            </div>
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <div className="flex items-center justify-center h-6 w-6 rounded-full bg-primary text-white text-xs font-bold flex-shrink-0">
                  3
                </div>
                <span className="font-semibold text-accent text-sm">Start Accepting Guests</span>
              </div>
              <p className="text-muted-foreground text-xs ml-8">
                Open your calendar and begin managing real reservations
              </p>
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
        <span className="font-medium hidden sm:inline text-sm">Help & Search</span>
        <kbd className="hidden sm:inline-flex items-center gap-1 px-2 py-1 text-xs bg-white/20 rounded border border-white/30 ml-2">
          <span>⌘</span>K
        </kbd>
      </button>
    </AppLayout>
  )
}
