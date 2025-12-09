"use client"

import { useState, useEffect } from "react"
import { createBrowserClient } from "@/lib/supabase/client"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { DollarSign, BedDouble, TrendingUp, Calendar, Download, ArrowUpRight, ArrowDownRight } from "lucide-react"
import { format, startOfMonth, endOfMonth, subMonths } from "date-fns"

interface Statistics {
  totalRevenue: number
  totalBookings: number
  occupancyRate: number
  averageRate: number
  revenueChange: number
  bookingsChange: number
}

interface MonthlyData {
  month: string
  revenue: number
  bookings: number
}

export default function ReportsPage() {
  const [stats, setStats] = useState<Statistics>({
    totalRevenue: 0,
    totalBookings: 0,
    occupancyRate: 0,
    averageRate: 0,
    revenueChange: 0,
    bookingsChange: 0,
  })
  const [monthlyData, setMonthlyData] = useState<MonthlyData[]>([])
  const [recentBookings, setRecentBookings] = useState<any[]>([])
  const [selectedPeriod, setSelectedPeriod] = useState("current_month")
  const [loading, setLoading] = useState(true)

  const supabase = createBrowserClient()

  useEffect(() => {
    loadReports()
  }, [selectedPeriod])

  async function loadReports() {
    setLoading(true)

    const now = new Date()
    let startDate: Date
    let endDate: Date

    // Calculate date range based on selected period
    switch (selectedPeriod) {
      case "current_month":
        startDate = startOfMonth(now)
        endDate = endOfMonth(now)
        break
      case "last_month":
        startDate = startOfMonth(subMonths(now, 1))
        endDate = endOfMonth(subMonths(now, 1))
        break
      case "last_3_months":
        startDate = startOfMonth(subMonths(now, 3))
        endDate = endOfMonth(now)
        break
      case "last_6_months":
        startDate = startOfMonth(subMonths(now, 6))
        endDate = endOfMonth(now)
        break
      default:
        startDate = startOfMonth(now)
        endDate = endOfMonth(now)
    }

    // Fetch reservations for the period
    const { data: reservations } = await supabase
      .from("reservations")
      .select("*")
      .gte("check_in", format(startDate, "yyyy-MM-dd"))
      .lte("check_out", format(endDate, "yyyy-MM-dd"))
      .neq("status", "cancelled")

    // Fetch all rooms to calculate occupancy
    const { data: rooms } = await supabase.from("rooms").select("*")

    // Calculate statistics
    const totalRevenue = reservations?.reduce((sum, res) => sum + (Number(res.total_amount) || 0), 0) || 0
    const totalBookings = reservations?.length || 0
    const averageRate = totalBookings > 0 ? totalRevenue / totalBookings : 0

    // Calculate occupancy rate
    const totalRooms = rooms?.length || 1
    const daysInPeriod = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24))
    const totalRoomNights = totalRooms * daysInPeriod
    const bookedRoomNights =
      reservations?.reduce((sum, res) => {
        const nights = Math.ceil(
          (new Date(res.check_out).getTime() - new Date(res.check_in).getTime()) / (1000 * 60 * 60 * 24),
        )
        return sum + nights
      }, 0) || 0
    const occupancyRate = totalRoomNights > 0 ? (bookedRoomNights / totalRoomNights) * 100 : 0

    // Fetch previous period data for comparison
    const prevStartDate = new Date(startDate.getTime() - (endDate.getTime() - startDate.getTime()))
    const prevEndDate = startDate

    const { data: prevReservations } = await supabase
      .from("reservations")
      .select("*")
      .gte("check_in", format(prevStartDate, "yyyy-MM-dd"))
      .lte("check_out", format(prevEndDate, "yyyy-MM-dd"))
      .neq("status", "cancelled")

    const prevRevenue = prevReservations?.reduce((sum, res) => sum + (Number(res.total_amount) || 0), 0) || 0
    const prevBookings = prevReservations?.length || 0

    const revenueChange = prevRevenue > 0 ? ((totalRevenue - prevRevenue) / prevRevenue) * 100 : 0
    const bookingsChange = prevBookings > 0 ? ((totalBookings - prevBookings) / prevBookings) * 100 : 0

    setStats({
      totalRevenue,
      totalBookings,
      occupancyRate,
      averageRate,
      revenueChange,
      bookingsChange,
    })

    // Get recent bookings
    const { data: recent } = await supabase
      .from("reservations")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(5)

    setRecentBookings(recent || [])

    // Generate monthly data for chart (last 6 months)
    const monthlyStats: MonthlyData[] = []
    for (let i = 5; i >= 0; i--) {
      const monthStart = startOfMonth(subMonths(now, i))
      const monthEnd = endOfMonth(subMonths(now, i))

      const { data: monthReservations } = await supabase
        .from("reservations")
        .select("*")
        .gte("check_in", format(monthStart, "yyyy-MM-dd"))
        .lte("check_out", format(monthEnd, "yyyy-MM-dd"))
        .neq("status", "cancelled")

      const revenue = monthReservations?.reduce((sum, res) => sum + (Number(res.total_amount) || 0), 0) || 0
      const bookings = monthReservations?.length || 0

      monthlyStats.push({
        month: format(monthStart, "MMM yyyy"),
        revenue,
        bookings,
      })
    }

    setMonthlyData(monthlyStats)
    setLoading(false)
  }

  function exportReport() {
    // Create CSV content
    const csvContent = [
      ["Booking Reports", ""],
      ["Period", selectedPeriod],
      ["", ""],
      ["Summary", ""],
      ["Total Revenue", `$${stats.totalRevenue.toFixed(2)}`],
      ["Total Bookings", stats.totalBookings.toString()],
      ["Occupancy Rate", `${stats.occupancyRate.toFixed(1)}%`],
      ["Average Rate", `$${stats.averageRate.toFixed(2)}`],
      ["", ""],
      ["Monthly Breakdown", ""],
      ["Month", "Revenue", "Bookings"],
      ...monthlyData.map((data) => [data.month, `$${data.revenue.toFixed(2)}`, data.bookings.toString()]),
    ]
      .map((row) => row.join(","))
      .join("\n")

    // Download CSV
    const blob = new Blob([csvContent], { type: "text/csv" })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = url
    link.download = `booking-report-${format(new Date(), "yyyy-MM-dd")}.csv`
    link.click()
  }

  return (
    <div className="flex h-screen flex-col bg-background">
      {/* Header */}
      <div className="flex items-center justify-between border-b bg-card px-6 py-4">
        <div>
          <h1 className="text-2xl font-bold">Reports and Finances</h1>
          <p className="text-sm text-muted-foreground">Revenue analytics and booking statistics</p>
        </div>
        <div className="flex gap-2">
          <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
            <SelectTrigger className="w-[200px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="current_month">Current Month</SelectItem>
              <SelectItem value="last_month">Last Month</SelectItem>
              <SelectItem value="last_3_months">Last 3 Months</SelectItem>
              <SelectItem value="last_6_months">Last 6 Months</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" onClick={exportReport}>
            <Download className="mr-2 h-4 w-4" />
            Export
          </Button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-6">
        {loading ? (
          <div className="flex items-center justify-center p-8">
            <div className="text-muted-foreground">Loading reports...</div>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Stats Cards */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
                  <DollarSign className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">${stats.totalRevenue.toFixed(2)}</div>
                  <div className="flex items-center text-xs text-muted-foreground">
                    {stats.revenueChange >= 0 ? (
                      <ArrowUpRight className="mr-1 h-3 w-3 text-green-500" />
                    ) : (
                      <ArrowDownRight className="mr-1 h-3 w-3 text-red-500" />
                    )}
                    <span className={stats.revenueChange >= 0 ? "text-green-500" : "text-red-500"}>
                      {Math.abs(stats.revenueChange).toFixed(1)}%
                    </span>
                    <span className="ml-1">from previous period</span>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Bookings</CardTitle>
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stats.totalBookings}</div>
                  <div className="flex items-center text-xs text-muted-foreground">
                    {stats.bookingsChange >= 0 ? (
                      <ArrowUpRight className="mr-1 h-3 w-3 text-green-500" />
                    ) : (
                      <ArrowDownRight className="mr-1 h-3 w-3 text-red-500" />
                    )}
                    <span className={stats.bookingsChange >= 0 ? "text-green-500" : "text-red-500"}>
                      {Math.abs(stats.bookingsChange).toFixed(1)}%
                    </span>
                    <span className="ml-1">from previous period</span>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Occupancy Rate</CardTitle>
                  <BedDouble className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stats.occupancyRate.toFixed(1)}%</div>
                  <p className="text-xs text-muted-foreground">Room utilization</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Average Rate</CardTitle>
                  <TrendingUp className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">${stats.averageRate.toFixed(2)}</div>
                  <p className="text-xs text-muted-foreground">Per booking</p>
                </CardContent>
              </Card>
            </div>

            {/* Monthly Revenue Chart */}
            <Card>
              <CardHeader>
                <CardTitle>Monthly Performance</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {monthlyData.map((data, index) => {
                    const maxRevenue = Math.max(...monthlyData.map((d) => d.revenue))
                    const percentage = maxRevenue > 0 ? (data.revenue / maxRevenue) * 100 : 0

                    return (
                      <div key={index} className="space-y-2">
                        <div className="flex items-center justify-between text-sm">
                          <span className="font-medium">{data.month}</span>
                          <div className="flex gap-4">
                            <span className="text-muted-foreground">{data.bookings} bookings</span>
                            <span className="font-semibold">${data.revenue.toFixed(2)}</span>
                          </div>
                        </div>
                        <div className="h-2 w-full rounded-full bg-muted">
                          <div
                            className="h-full rounded-full bg-primary transition-all"
                            style={{ width: `${percentage}%` }}
                          ></div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </CardContent>
            </Card>

            {/* Recent Bookings */}
            <Card>
              <CardHeader>
                <CardTitle>Recent Bookings</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {recentBookings.map((booking) => (
                    <div key={booking.id} className="flex items-center justify-between border-b pb-4 last:border-0">
                      <div>
                        <div className="font-medium">{booking.guest_name}</div>
                        <div className="text-sm text-muted-foreground">
                          {format(new Date(booking.check_in), "MMM d")} -{" "}
                          {format(new Date(booking.check_out), "MMM d, yyyy")}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-semibold">${Number(booking.total_amount || 0).toFixed(2)}</div>
                        <div
                          className={`text-sm capitalize ${
                            booking.status === "confirmed"
                              ? "text-blue-500"
                              : booking.status === "checked_in"
                                ? "text-green-500"
                                : booking.status === "cancelled"
                                  ? "text-red-500"
                                  : "text-yellow-500"
                          }`}
                        >
                          {booking.status}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  )
}
