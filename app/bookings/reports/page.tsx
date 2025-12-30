"use client"

import { useState, useEffect } from "react"
import { createBrowserClient } from "@/lib/supabase/client"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  DollarSign,
  BedDouble,
  TrendingUp,
  Calendar,
  Download,
  ArrowUpRight,
  ArrowDownRight,
  MapPin,
  Users,
  CreditCard,
} from "lucide-react"
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

interface LocationStats {
  locationName: string
  revenue: number
  bookings: number
  occupancyRate: number
  roomCount: number
}

interface RoomPerformance {
  roomName: string
  revenue: number
  bookings: number
  occupancyRate: number
  location: string
}

interface PaymentStats {
  method: string
  amount: number
  count: number
}

interface GuestStats {
  repeatGuests: number
  vipGuests: number
  newGuests: number
  totalGuests: number
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
  const [locationStats, setLocationStats] = useState<LocationStats[]>([])
  const [roomPerformance, setRoomPerformance] = useState<RoomPerformance[]>([])
  const [paymentStats, setPaymentStats] = useState<PaymentStats[]>([])
  const [guestStats, setGuestStats] = useState<GuestStats>({
    repeatGuests: 0,
    vipGuests: 0,
    newGuests: 0,
    totalGuests: 0,
  })
  const [recentBookings, setRecentBookings] = useState<any[]>([])
  const [selectedPeriod, setSelectedPeriod] = useState("current_month")
  const [selectedLocation, setSelectedLocation] = useState("all")
  const [locations, setLocations] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  const supabase = createBrowserClient()

  useEffect(() => {
    loadLocations()
  }, [])

  useEffect(() => {
    loadReports()
  }, [selectedPeriod, selectedLocation])

  async function loadLocations() {
    const { data } = await supabase.from("locations").select("*").eq("is_active", true)
    setLocations(data || [])
  }

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

    let reservationQuery = supabase
      .from("reservations")
      .select("*, rooms(location_id, room_number, max_guests, location:locations(name)), guests(vip_status)")
      .gte("check_in", format(startDate, "yyyy-MM-dd"))
      .lte("check_out", format(endDate, "yyyy-MM-dd"))
      .neq("status", "cancelled")

    if (selectedLocation !== "all") {
      reservationQuery = reservationQuery.eq("location_id", selectedLocation)
    }

    const { data: reservations } = await reservationQuery

    // Fetch all rooms to calculate occupancy
    const { data: rooms } = await supabase.from("rooms").select("*")

    // Calculate base statistics
    const totalRevenue = reservations?.reduce((sum, res) => sum + (Number(res.total_amount) || 0), 0) || 0
    const totalBookings = reservations?.length || 0
    const averageRate = totalBookings > 0 ? totalRevenue / totalBookings : 0

    // Calculate occupancy rate
    const applicableRooms =
      selectedLocation !== "all" ? rooms?.filter((r) => r.location_id === selectedLocation) : rooms
    const totalRooms = applicableRooms?.length || 1
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

    const locationBreakdown: { [key: string]: LocationStats } = {}
    reservations?.forEach((res) => {
      const locId = res.location_id
      const locName = res.rooms?.location || "Unknown"

      if (!locationBreakdown[locId]) {
        locationBreakdown[locId] = {
          locationName: locName,
          revenue: 0,
          bookings: 0,
          occupancyRate: 0,
          roomCount: rooms?.filter((r) => r.location_id === locId).length || 0,
        }
      }

      locationBreakdown[locId].revenue += Number(res.total_amount) || 0
      locationBreakdown[locId].bookings += 1
    })

    // Calculate occupancy rate for each location
    Object.values(locationBreakdown).forEach((loc) => {
      const locRoomNights = loc.roomCount * daysInPeriod
      const locBookedNights =
        reservations
          ?.filter((r) => r.location_id === Object.keys(locationBreakdown).find((k) => locationBreakdown[k] === loc))
          .reduce((sum, res) => {
            const nights = Math.ceil(
              (new Date(res.check_out).getTime() - new Date(res.check_in).getTime()) / (1000 * 60 * 60 * 24),
            )
            return sum + nights
          }, 0) || 0

      loc.occupancyRate = locRoomNights > 0 ? (locBookedNights / locRoomNights) * 100 : 0
    })

    setLocationStats(Object.values(locationBreakdown).sort((a, b) => b.revenue - a.revenue))

    const roomStats: { [key: string]: RoomPerformance } = {}
    reservations?.forEach((res) => {
      const roomId = res.room_id
      const roomName = res.rooms?.room_number || "Unknown"
      const locName = res.rooms?.location || "Unknown"

      if (!roomStats[roomId]) {
        roomStats[roomId] = {
          roomName,
          revenue: 0,
          bookings: 0,
          occupancyRate: 0,
          location: locName,
        }
      }

      roomStats[roomId].revenue += Number(res.total_amount) || 0
      roomStats[roomId].bookings += 1
    })

    // Calculate occupancy for each room
    Object.entries(roomStats).forEach(([roomId, room]) => {
      const roomBookedNights =
        reservations
          ?.filter((r) => r.room_id === roomId)
          .reduce((sum, res) => {
            const nights = Math.ceil(
              (new Date(res.check_out).getTime() - new Date(res.check_in).getTime()) / (1000 * 60 * 60 * 24),
            )
            return sum + nights
          }, 0) || 0

      room.occupancyRate = daysInPeriod > 0 ? (roomBookedNights / daysInPeriod) * 100 : 0
    })

    setRoomPerformance(
      Object.values(roomStats)
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, 5),
    )

    const { data: payments } = await supabase
      .from("payments")
      .select("*")
      .gte("created_at", format(startDate, "yyyy-MM-dd"))
      .lte("created_at", format(endDate, "yyyy-MM-dd"))

    const paymentBreakdown: { [key: string]: PaymentStats } = {}
    payments?.forEach((payment) => {
      const method = payment.payment_method || "Unknown"
      if (!paymentBreakdown[method]) {
        paymentBreakdown[method] = {
          method,
          amount: 0,
          count: 0,
        }
      }
      paymentBreakdown[method].amount += Number(payment.amount) || 0
      paymentBreakdown[method].count += 1
    })

    setPaymentStats(Object.values(paymentBreakdown).sort((a, b) => b.amount - a.amount))

    const { data: guests } = await supabase.from("guests").select("*")
    const { data: allReservations } = await supabase.from("reservations").select("guest_id")

    const guestReservationCount: { [key: string]: number } = {}
    allReservations?.forEach((res) => {
      if (res.guest_id) {
        guestReservationCount[res.guest_id] = (guestReservationCount[res.guest_id] || 0) + 1
      }
    })

    const vipGuestCount = guests?.filter((g) => g.vip_status).length || 0
    const repeatGuestCount = Object.values(guestReservationCount).filter((count) => count > 1).length
    const newGuestCount = Object.values(guestReservationCount).filter((count) => count === 1).length

    setGuestStats({
      repeatGuests: repeatGuestCount,
      vipGuests: vipGuestCount,
      newGuests: newGuestCount,
      totalGuests: guests?.length || 0,
    })

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
    const csvContent = [
      ["Booking Reports", ""],
      ["Period", selectedPeriod],
      ["Location", selectedLocation === "all" ? "All Locations" : selectedLocation],
      ["", ""],
      ["Summary", ""],
      ["Total Revenue", `$${stats.totalRevenue.toFixed(2)}`],
      ["Total Bookings", stats.totalBookings.toString()],
      ["Occupancy Rate", `${stats.occupancyRate.toFixed(1)}%`],
      ["Average Rate", `$${stats.averageRate.toFixed(2)}`],
      ["", ""],
      ["Location Performance", ""],
      ["Location", "Revenue", "Bookings", "Occupancy %"],
      ...locationStats.map((loc) => [
        loc.locationName,
        `$${loc.revenue.toFixed(2)}`,
        loc.bookings.toString(),
        `${loc.occupancyRate.toFixed(1)}%`,
      ]),
      ["", ""],
      ["Top Rooms", ""],
      ["Room", "Location", "Revenue", "Bookings", "Occupancy %"],
      ...roomPerformance.map((room) => [
        room.roomName,
        room.location,
        `$${room.revenue.toFixed(2)}`,
        room.bookings.toString(),
        `${room.occupancyRate.toFixed(1)}%`,
      ]),
      ["", ""],
      ["Guest Statistics", ""],
      ["Total Guests", guestStats.totalGuests.toString()],
      ["Repeat Guests", guestStats.repeatGuests.toString()],
      ["VIP Guests", guestStats.vipGuests.toString()],
      ["New Guests", guestStats.newGuests.toString()],
    ]
      .map((row) => row.join(","))
      .join("\n")

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
      <div className="border-b bg-card px-6 py-4">
        <div className="mb-4">
          <h1 className="text-2xl font-bold">Reports and Analytics</h1>
          <p className="text-sm text-muted-foreground">Comprehensive revenue, occupancy, and performance insights</p>
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
          <Select value={selectedLocation} onValueChange={setSelectedLocation}>
            <SelectTrigger className="w-[200px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Locations</SelectItem>
              {locations.map((loc) => (
                <SelectItem key={loc.id} value={loc.id}>
                  {loc.name}
                </SelectItem>
              ))}
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

            {/* Guest Analytics */}
            <div className="grid gap-4 md:grid-cols-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Guests</CardTitle>
                  <Users className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{guestStats.totalGuests}</div>
                  <p className="text-xs text-muted-foreground">Registered guests</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Repeat Guests</CardTitle>
                  <Users className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{guestStats.repeatGuests}</div>
                  <p className="text-xs text-muted-foreground">Returning visitors</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">VIP Guests</CardTitle>
                  <Users className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{guestStats.vipGuests}</div>
                  <p className="text-xs text-muted-foreground">Premium members</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">New Guests</CardTitle>
                  <Users className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{guestStats.newGuests}</div>
                  <p className="text-xs text-muted-foreground">First time bookings</p>
                </CardContent>
              </Card>
            </div>

            {/* Location Performance */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MapPin className="h-4 w-4" />
                  Location Performance
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {locationStats.map((loc, index) => (
                    <div key={index} className="space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span className="font-medium">{loc.locationName}</span>
                        <div className="flex gap-4">
                          <span className="text-muted-foreground">{loc.bookings} bookings</span>
                          <span className="font-semibold">${loc.revenue.toFixed(2)}</span>
                          <span className="text-muted-foreground">{loc.occupancyRate.toFixed(1)}% occupied</span>
                        </div>
                      </div>
                      <div className="h-2 w-full rounded-full bg-muted">
                        <div
                          className="h-full rounded-full bg-primary transition-all"
                          style={{ width: `${loc.occupancyRate}%` }}
                        ></div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Top Performing Rooms */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BedDouble className="h-4 w-4" />
                  Top Performing Rooms
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b">
                        <th className="py-2 text-left font-medium">Room</th>
                        <th className="py-2 text-left font-medium">Location</th>
                        <th className="py-2 text-right font-medium">Revenue</th>
                        <th className="py-2 text-right font-medium">Bookings</th>
                        <th className="py-2 text-right font-medium">Occupancy</th>
                      </tr>
                    </thead>
                    <tbody>
                      {roomPerformance.map((room, index) => (
                        <tr key={index} className="border-b last:border-0">
                          <td className="py-3 font-medium">{room.roomName}</td>
                          <td className="py-3 text-muted-foreground">{room.location}</td>
                          <td className="py-3 text-right font-semibold">${room.revenue.toFixed(2)}</td>
                          <td className="py-3 text-right">{room.bookings}</td>
                          <td className="py-3 text-right">{room.occupancyRate.toFixed(1)}%</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>

            {/* Payment Methods */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CreditCard className="h-4 w-4" />
                  Payment Methods
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {paymentStats.map((stat, index) => {
                    const maxAmount = Math.max(...paymentStats.map((s) => s.amount))
                    const percentage = maxAmount > 0 ? (stat.amount / maxAmount) * 100 : 0

                    return (
                      <div key={index} className="space-y-2">
                        <div className="flex items-center justify-between text-sm">
                          <span className="font-medium capitalize">{stat.method}</span>
                          <div className="flex gap-4">
                            <span className="text-muted-foreground">{stat.count} transactions</span>
                            <span className="font-semibold">${stat.amount.toFixed(2)}</span>
                          </div>
                        </div>
                        <div className="h-2 w-full rounded-full bg-muted">
                          <div
                            className="h-full rounded-full bg-accent transition-all"
                            style={{ width: `${percentage}%` }}
                          ></div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </CardContent>
            </Card>

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
