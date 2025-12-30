"use client"

import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ChevronLeft, ChevronRight, MapPin, Home, Calendar, TrendingUp } from "lucide-react"
import { format, addDays, isWithinInterval, parseISO, isSameDay } from "date-fns"
import { AddReservationDialog } from "@/components/add-reservation-dialog"
import { EditReservationModal } from "@/components/edit-reservation-modal"
import { GuestHistoryModal } from "@/components/guest-history-modal"
import { ReservationConfirmationModal } from "@/components/reservation-confirmation-modal"
import { DailySummaryModal } from "@/components/daily-summary-modal" // Import DailySummaryModal

interface Location {
  id: string
  name: string
  description: string | null
}

interface Bed {
  id: string
  bed_number: string
  bed_type: string
  room_id: string
  room: {
    id: string
    room_number: string
    location_id: string
    location_ref?: { id: string; name: string }
  }
}

interface Reservation {
  id: string
  bed_id: string
  guest_name: string
  check_in: string
  check_out: string
  status: string
  guest_email?: string
  guest_phone?: string
  num_guests?: number
  special_requests?: string
  total_amount?: number
}

const FACILITY_COLORS = [
  { bg: "bg-red-200", border: "border-red-300", text: "text-red-900", hover: "hover:bg-red-100" },
  { bg: "bg-blue-200", border: "border-blue-300", text: "text-blue-900", hover: "hover:bg-blue-100" },
  { bg: "bg-emerald-200", border: "border-emerald-300", text: "text-emerald-900", hover: "hover:bg-emerald-100" },
  { bg: "bg-amber-200", border: "border-amber-300", text: "text-amber-900", hover: "hover:bg-amber-100" },
  { bg: "bg-violet-200", border: "border-violet-300", text: "text-violet-900", hover: "hover:bg-violet-100" },
  { bg: "bg-rose-200", border: "border-rose-300", text: "text-rose-900", hover: "hover:bg-rose-100" },
  { bg: "bg-indigo-200", border: "border-indigo-300", text: "text-indigo-900", hover: "hover:bg-indigo-100" },
  { bg: "bg-teal-200", border: "border-teal-300", text: "text-teal-900", hover: "hover:bg-teal-100" },
]

export default function BookingManagement() {
  const supabase = createClient()

  const [viewMode, setViewMode] = useState<"single" | "multi">("multi")
  const [locations, setLocations] = useState<Location[]>([])
  const [beds, setBeds] = useState<Bed[]>([])
  const [reservations, setReservations] = useState<Reservation[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedLocationId, setSelectedLocationId] = useState<string | null>(null)
  const [startDate, setStartDate] = useState(new Date())
  const [selectedReservation, setSelectedReservation] = useState<Reservation | null>(null)
  const [newReservationOpen, setNewReservationOpen] = useState(false)
  const [selectedBedForReservation, setSelectedBedForReservation] = useState<Bed | null>(null)
  const [selectedDateForReservation, setSelectedDateForReservation] = useState<Date | null>(null)
  const [guestHistoryOpen, setGuestHistoryOpen] = useState(false)
  const [confirmationOpen, setConfirmationOpen] = useState(false)
  const [showLocationsPicker, setShowLocationsPicker] = useState(false)
  const [resizingReservation, setResizingReservation] = useState<Reservation | null>(null)
  const [resizeStart, setResizeStart] = useState<{ x: number; y: number; originalCheckOut: string } | null>(null)
  const [guestHistoryData, setGuestHistoryData] = useState<Reservation[]>([])
  const [selectedGuestForHistory, setSelectedGuestForHistory] = useState<{
    name: string
    email: string
    phone: string
    vip_status: boolean
  }>({ name: "", email: "", phone: "", vip_status: false })

  const [dailySummaryOpen, setDailySummaryOpen] = useState(false)

  const [singlePropertyDateRange] = useState(365) // Added full-year date range for single property view
  const dateRange = viewMode === "single" ? singlePropertyDateRange : 14 // Use 365 days for single property, 14 for multi
  const dateArray = Array.from({ length: dateRange }, (_, i) => addDays(startDate, i))
  const today = new Date() // Get today's date for highlighting

  useEffect(() => {
    console.log("[v0] Dashboard component rendering")
    fetchData()

    const bedsSubscription = supabase
      .channel("beds-changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "beds" }, fetchData)
      .subscribe()

    const reservationsSubscription = supabase
      .channel("reservations-changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "reservations" }, fetchData)
      .subscribe()

    console.log("[v0] Dashboard mounted successfully")
    return () => {
      bedsSubscription.unsubscribe()
      reservationsSubscription.unsubscribe()
    }
  }, [])

  const fetchData = async () => {
    try {
      setLoading(true)

      console.log("[v0] Fetching locations...")
      // Fetch all locations
      const { data: locationsData, error: locationsError } = await supabase
        .from("locations")
        .select("id, name, description")
        .eq("is_active", true)

      if (locationsError) throw locationsError
      console.log("[v0] Locations fetched:", locationsData)
      setLocations(locationsData || [])

      // Set first location as selected if not already set
      if (!selectedLocationId && locationsData && locationsData.length > 0) {
        setSelectedLocationId(locationsData[0].id)
      }

      // Fetch beds for all locations
      const { data: bedsData, error: bedsError } = await supabase.from("beds").select(
        `
          id,
          bed_number,
          bed_type,
          room_id,
          room:rooms!inner(
            id,
            room_number,
            location_id,
            location_ref:locations(id, name)
          )
        `,
      )

      if (bedsError) throw bedsError
      setBeds(bedsData || [])

      // Fetch all reservations
      const { data: reservationsData, error: reservationsError } = await supabase
        .from("reservations")
        .select("*")
        .order("check_in", { ascending: true })

      if (reservationsError) throw reservationsError
      setReservations(reservationsData || [])
    } catch (error) {
      console.error("[v0] Error fetching data:", error)
    } finally {
      setLoading(false)
    }
  }

  const getFacilityColor = (locationId: string) => {
    const index = locations.findIndex((loc) => loc.id === locationId)
    return FACILITY_COLORS[index % FACILITY_COLORS.length]
  }

  const selectedLocationBeds = beds.filter((bed) => bed.room.location_id === selectedLocationId)
  const selectedLocation = locations.find((loc) => loc.id === selectedLocationId)
  const roomGroups = Array.from(new Map(selectedLocationBeds.map((b) => [b.room.room_number, b.room])).values())

  // - Confirmed: Cool Pope (purple #834693)
  // - Checked-in: Warm Princess (light pink #FDD7D4)
  // - Pending: Warm Orange (#FFA114)
  // - Cancelled: Warm Fire (red #EC2B02)
  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      confirmed: "bg-[#834693] text-white border-[#6d3878]",
      "checked-in": "bg-[#FDD7D4] text-[#834693] border-[#FDBBB7]",
      pending: "bg-[#FFA114] text-white border-[#FF8C00]",
      cancelled: "bg-[#EC2B02] text-white border-[#D42301]",
    }
    return colors[status] || "bg-gray-100 text-gray-800 border-gray-300"
  }

  const getReservationForDate = (bedId: string, date: Date) => {
    return reservations.find(
      (r) =>
        r.bed_id === bedId &&
        isWithinInterval(date, {
          start: parseISO(r.check_in),
          end: new Date(new Date(r.check_out).getTime() - 86400000), // Last day of stay
        }),
    )
  }

  const handleCalendarCellClick = (bed: Bed, date: Date) => {
    const existingReservation = getReservationForDate(bed.id, date)
    if (!existingReservation) {
      setSelectedBedForReservation(bed)
      setSelectedDateForReservation(date)
      setNewReservationOpen(true)
    }
  }

  // Helper function to get reservation ranges for each bed
  const getReservationRanges = (bedId: string) => {
    const bedReservations = reservations.filter((r) => r.bed_id === bedId)
    const ranges: Array<{ reservation: Reservation; startIndex: number; endIndex: number; colspan: number }> = []

    bedReservations.forEach((reservation) => {
      const checkIn = parseISO(reservation.check_in)
      const checkOut = new Date(parseISO(reservation.check_out).getTime() - 86400000) // Last day of stay

      const startIndex = dateArray.findIndex((d) => d.toDateString() === checkIn.toDateString())
      const endIndex = dateArray.findIndex((d) => d.toDateString() === checkOut.toDateString())

      if (startIndex !== -1 && endIndex !== -1 && endIndex >= startIndex) {
        ranges.push({
          reservation,
          startIndex,
          endIndex,
          colspan: endIndex - startIndex + 1,
        })
      }
    })

    return ranges
  }

  const getReservationAtIndex = (bedId: string, dateIndex: number) => {
    const ranges = getReservationRanges(bedId)
    return ranges.find((r) => dateIndex >= r.startIndex && dateIndex <= r.endIndex)
  }

  const loadGuestHistory = async (guestName: string, guestEmail?: string) => {
    try {
      const { data, error } = await supabase
        .from("reservations")
        .select("*")
        .eq("guest_name", guestName)
        .order("check_in", { ascending: false })

      if (error) throw error
      setGuestHistoryData(data || [])
      setSelectedGuestForHistory({ name: guestName, email: guestEmail ?? "", phone: "", vip_status: false }) // Assuming email might be available
    } catch (error) {
      console.error("Error loading guest history:", error)
    }
  }

  const handleReservationClick = (reservation: Reservation) => {
    setSelectedReservation(reservation)
  }

  const updateReservation = async (data: any) => {
    try {
      const { error } = await supabase
        .from("reservations")
        .update({
          guest_name: data.guest_name,
          guest_email: data.guest_email,
          guest_phone: data.guest_phone,
          check_in: data.check_in,
          check_out: data.check_out,
          status: data.status,
          special_requests: data.special_requests,
          num_guests: data.num_guests,
          total_amount: data.total_amount,
        })
        .eq("id", data.id)

      if (error) throw error
      fetchData()
    } catch (error) {
      console.error("Error updating reservation:", error)
      alert("Error updating reservation")
    }
  }

  const deleteReservation = async (reservationId: string) => {
    try {
      const { error } = await supabase.from("reservations").delete().eq("id", reservationId)

      if (error) throw error
      fetchData()
    } catch (error) {
      console.error("Error deleting reservation:", error)
      alert("Error deleting reservation")
    }
  }

  // Added handleSaveReservation, handleNewReservationSuccess, goToPreviousPeriod, goToNextPeriod, goToToday
  const handleSaveReservation = async () => {
    await fetchData()
    setSelectedReservation(null)
  }

  const handleNewReservationSuccess = () => {
    fetchData()
    setConfirmationOpen(true)
  }

  const goToPreviousPeriod = () => setStartDate(addDays(startDate, -dateRange))
  const goToNextPeriod = () => setStartDate(addDays(startDate, dateRange))
  const goToToday = () => setStartDate(new Date())

  if (loading) {
    return (
      <div className="min-h-screen bg-background p-8">
        <div className="max-w-7xl mx-auto">
          <div className="animate-pulse space-y-4">
            <div className="h-12 bg-secondary rounded w-1/3"></div>
            <div className="h-64 bg-secondary rounded"></div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-[calc(100vw-2rem)] mx-auto px-4 py-6">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-3xl font-bold text-accent">Booking Management</h1>
            <p className="text-muted-foreground mt-2">Manage reservations across all properties</p>
          </div>
          <div className="flex gap-2">
            <Button
              variant={viewMode === "single" ? "default" : "outline"}
              size="sm"
              onClick={() => setViewMode("single")}
            >
              <Home className="h-4 w-4 mr-2" />
              Single Property
            </Button>
            <Button
              variant={viewMode === "multi" ? "default" : "outline"}
              size="sm"
              onClick={() => setViewMode("multi")}
            >
              <MapPin className="h-4 w-4 mr-2" />
              All Properties
            </Button>
          </div>
        </div>

        {viewMode === "single" ? (
          /* Single facility view - now shows full year in table format like multi-property view */
          <div className="space-y-6">
            {/* Left Sidebar - Locations List */}
            <div className="flex flex-col md:flex-row gap-6">
              <div className="w-full md:w-48 lg:w-64 border-r border-secondary bg-card rounded-lg md:rounded-none">
                <div className="p-4 space-y-2">
                  <h2 className="text-sm font-semibold text-foreground px-3 py-2 flex items-center gap-2">
                    <Home className="h-4 w-4" />
                    Properties ({locations.length})
                  </h2>
                  {locations.length === 0 && !loading && (
                    <div className="text-sm text-muted-foreground px-3 py-4 text-center">
                      No properties found. Add locations first.
                    </div>
                  )}
                  {locations.map((location) => (
                    <button
                      key={location.id}
                      onClick={() => {
                        setSelectedLocationId(location.id)
                        setStartDate(new Date())
                        setShowLocationsPicker(false)
                      }}
                      className={`w-full text-left px-3 py-2 rounded-lg transition-colors ${
                        selectedLocationId === location.id
                          ? "bg-primary text-primary-foreground shadow-md"
                          : "hover:bg-secondary text-foreground"
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <Home className="h-4 w-4" />
                        <span className="font-medium text-sm">{location.name}</span>
                      </div>
                      {location.description && <p className="text-xs mt-1 opacity-75 ml-6">{location.description}</p>}
                    </button>
                  ))}
                </div>
              </div>

              {/* Right Content - Full Year Calendar Table */}
              <div className="flex-1 space-y-6">
                {/* Property Overview Cards */}
                {selectedLocation && (
                  <div className="grid gap-4 md:grid-cols-4">
                    <Card className="border-0 bg-white/60 backdrop-blur">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">Total Beds</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="text-2xl font-bold text-accent">{selectedLocationBeds.length}</div>
                      </CardContent>
                    </Card>

                    <Card className="border-0 bg-white/60 backdrop-blur">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">Active Bookings</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="text-2xl font-bold text-accent">
                          {
                            reservations.filter(
                              (r) => r.status === "confirmed" && selectedLocationBeds.some((b) => b.id === r.bed_id),
                            ).length
                          }
                        </div>
                      </CardContent>
                    </Card>

                    <Card className="border-0 bg-white/60 backdrop-blur">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">Occupancy</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="text-2xl font-bold text-accent">
                          {selectedLocationBeds.length > 0
                            ? Math.round(
                                (reservations.filter(
                                  (r) =>
                                    r.status === "confirmed" && selectedLocationBeds.some((b) => b.id === r.bed_id),
                                ).length /
                                  selectedLocationBeds.length) *
                                  100,
                              )
                            : 0}
                          %
                        </div>
                      </CardContent>
                    </Card>

                    <Card className="border-0 bg-white/60 backdrop-blur">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">Revenue (Est.)</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="text-2xl font-bold text-accent">
                          $
                          {reservations
                            .filter(
                              (r) => r.status === "confirmed" && selectedLocationBeds.some((b) => b.id === r.bed_id),
                            )
                            .reduce((sum, r) => sum + (r.total_amount || 0), 0)
                            .toFixed(2)}
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                )}

                {/* Navigation Controls */}
                <div className="flex justify-between items-center">
                  <Button variant="outline" size="sm" onClick={goToPreviousPeriod}>
                    <ChevronLeft className="h-4 w-4" />
                    Previous Year
                  </Button>
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" onClick={goToToday}>
                      <Calendar className="h-4 w-4 mr-2" />
                      Today
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setDailySummaryOpen(true)}
                      className="bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100"
                    >
                      <TrendingUp className="h-4 w-4 mr-2" />
                      Daily Summary
                    </Button>
                    <Badge variant="outline" className="text-sm font-semibold px-4 py-2">
                      {format(startDate, "MMM d")} - {format(dateArray[dateArray.length - 1], "MMM d, yyyy")}
                    </Badge>
                  </div>
                  <Button variant="outline" size="sm" onClick={goToNextPeriod}>
                    Next Year
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>

                {/* Full Year Calendar Table */}
                <Card className="border-0 shadow-lg overflow-hidden">
                  <CardContent className="p-0">
                    <div className="overflow-x-auto">
                      <table className="w-full border-collapse">
                        <thead>
                          <tr className="border-b-2 border-secondary bg-secondary/50">
                            <th className="text-left font-semibold text-accent px-4 py-3 sticky left-0 bg-secondary/50 w-48 min-w-48 z-20">
                              Room / Bed
                            </th>
                            {dateArray.map((date) => {
                              const isToday = isSameDay(date, today)
                              return (
                                <th
                                  key={date.toISOString()}
                                  className={`text-center font-semibold px-1.5 py-3 w-16 min-w-16 whitespace-nowrap ${
                                    isToday ? "bg-amber-100 border-2 border-amber-400 rounded" : "text-accent"
                                  }`}
                                >
                                  <div
                                    className={`text-xs font-semibold ${isToday ? "text-amber-900" : "text-muted-foreground"}`}
                                  >
                                    {format(date, "EEE")}
                                  </div>
                                  <div className={`text-sm font-bold ${isToday ? "text-amber-900" : "text-accent"}`}>
                                    {format(date, "d")}
                                  </div>
                                  {isToday && <div className="text-xs font-semibold text-amber-900 mt-1">TODAY</div>}
                                </th>
                              )
                            })}
                          </tr>
                        </thead>
                        <tbody>
                          {selectedLocationBeds.map((bed, bedIndex) => {
                            const reservationRanges = getReservationRanges(bed.id)
                            const renderedIndices = new Set<number>()
                            const facilityColor = getFacilityColor(selectedLocationId!)

                            return (
                              <tr
                                key={bed.id}
                                className={`border-b border-secondary/30 ${facilityColor.hover} transition-colors`}
                              >
                                <td
                                  className={`text-left font-medium px-4 py-3 sticky left-0 ${facilityColor.bg} z-10 w-48 min-w-48 border-r-2 ${facilityColor.border}`}
                                >
                                  <div className={`text-sm ${facilityColor.text}`}>{bed.room.room_number}</div>
                                  <div className={`text-xs ${facilityColor.text} opacity-70`}>{bed.bed_number}</div>
                                </td>
                                {dateArray.map((date, dateIndex) => {
                                  if (renderedIndices.has(dateIndex)) return null

                                  const reservationRange = reservationRanges.find(
                                    (r) => dateIndex >= r.startIndex && dateIndex <= r.endIndex,
                                  )

                                  if (reservationRange) {
                                    for (let i = reservationRange.startIndex; i <= reservationRange.endIndex; i++) {
                                      renderedIndices.add(i)
                                    }

                                    const { reservation, colspan } = reservationRange
                                    return (
                                      <td
                                        key={`${bed.id}-${dateIndex}`}
                                        colSpan={colspan}
                                        className="text-center px-1.5 py-3"
                                      >
                                        <div
                                          className={`rounded p-2 text-xs font-semibold border-2 ${getStatusColor(
                                            reservation.status,
                                          )} cursor-pointer hover:shadow-lg transition-all h-full flex flex-col items-center justify-center relative group`}
                                          title={`${bed.room.room_number}\n${reservation.guest_name}\n${format(
                                            parseISO(reservation.check_in),
                                            "MMM d",
                                          )} to ${format(
                                            new Date(parseISO(reservation.check_out).getTime() - 86400000),
                                            "MMM d",
                                          )}`}
                                          onClick={() => handleReservationClick(reservation)}
                                        >
                                          <div className="font-bold">{reservation.guest_name}</div>
                                          <div className="text-xs opacity-75 mt-0.5">
                                            {colspan} {colspan === 1 ? "night" : "nights"}
                                          </div>
                                        </div>
                                      </td>
                                    )
                                  }

                                  return (
                                    <td
                                      key={`${bed.id}-${dateIndex}`}
                                      className="text-center px-1.5 py-3 cursor-pointer hover:bg-accent/10 transition-colors border border-secondary/20"
                                      onClick={() => handleCalendarCellClick(bed, date)}
                                    >
                                      <div className="text-lg text-muted-foreground">+</div>
                                    </td>
                                  )
                                })}
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </div>
        ) : (
          /* Multi-facility unified calendar view */
          <div className="space-y-6">
            {/* Navigation Controls */}
            <div className="flex justify-between items-center">
              <Button variant="outline" size="sm" onClick={goToPreviousPeriod}>
                <ChevronLeft className="h-4 w-4" />
                Previous
              </Button>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={goToToday}>
                  <Calendar className="h-4 w-4 mr-2" />
                  Today
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setDailySummaryOpen(true)}
                  className="bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100"
                >
                  <TrendingUp className="h-4 w-4 mr-2" />
                  Daily Summary
                </Button>
                <Badge variant="outline" className="text-sm font-semibold px-4 py-2">
                  {format(startDate, "MMM d")} - {format(dateArray[dateArray.length - 1], "MMM d, yyyy")}
                </Badge>
              </div>
              <Button variant="outline" size="sm" onClick={goToNextPeriod}>
                Next
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>

            {/* Multi-facility Calendar */}
            <Card className="border-0 shadow-lg overflow-hidden">
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse">
                    <thead>
                      <tr className="border-b-2 border-secondary bg-secondary/50">
                        <th className="text-left font-semibold text-accent px-4 py-3 sticky left-0 bg-secondary/50 w-48 min-w-48 z-20">
                          Property / Room
                        </th>
                        {dateArray.map((date) => {
                          const isToday = isSameDay(date, today)
                          return (
                            <th
                              key={date.toISOString()}
                              className={`text-center font-semibold px-1.5 py-3 w-16 min-w-16 whitespace-nowrap ${
                                isToday ? "bg-amber-100 border-2 border-amber-400 rounded" : "text-accent"
                              }`}
                            >
                              <div
                                className={`text-xs font-semibold ${isToday ? "text-amber-900" : "text-muted-foreground"}`}
                              >
                                {format(date, "EEE")}
                              </div>
                              <div className={`text-sm font-bold ${isToday ? "text-amber-900" : "text-accent"}`}>
                                {format(date, "d")}
                              </div>
                              {isToday && <div className="text-xs font-semibold text-amber-900 mt-1">TODAY</div>}
                            </th>
                          )
                        })}
                      </tr>
                    </thead>
                    <tbody>
                      {locations.map((location) => {
                        const locationBeds = beds.filter((bed) => bed.room.location_id === location.id)
                        const facilityColor = getFacilityColor(location.id)

                        return locationBeds.map((bed, bedIndex) => {
                          const reservationRanges = getReservationRanges(bed.id)
                          const renderedIndices = new Set<number>()

                          return (
                            <tr
                              key={bed.id}
                              className={`border-b border-secondary/30 ${facilityColor.hover} transition-colors`}
                            >
                              <td
                                className={`text-left font-medium px-4 py-3 sticky left-0 ${facilityColor.bg} z-10 w-48 min-w-48 border-r-2 ${facilityColor.border}`}
                              >
                                {bedIndex === 0 && (
                                  <div className={`font-bold text-sm ${facilityColor.text} mb-1`}>{location.name}</div>
                                )}
                                <div className={`text-sm ${facilityColor.text}`}>{bed.room.room_number}</div>
                                <div className={`text-xs ${facilityColor.text} opacity-70`}>{bed.bed_number}</div>
                              </td>
                              {dateArray.map((date, dateIndex) => {
                                if (renderedIndices.has(dateIndex)) return null

                                const reservationRange = reservationRanges.find(
                                  (r) => dateIndex >= r.startIndex && dateIndex <= r.endIndex,
                                )

                                if (reservationRange) {
                                  for (let i = reservationRange.startIndex; i <= reservationRange.endIndex; i++) {
                                    renderedIndices.add(i)
                                  }

                                  const { reservation, colspan } = reservationRange
                                  return (
                                    <td
                                      key={`${bed.id}-${dateIndex}`}
                                      colSpan={colspan}
                                      className="text-center px-1.5 py-3"
                                    >
                                      <div
                                        className={`rounded p-2 text-xs font-semibold border-2 ${getStatusColor(
                                          reservation.status,
                                        )} cursor-pointer hover:shadow-lg transition-all h-full flex flex-col items-center justify-center relative group`}
                                        title={`${location.name} - ${bed.room.room_number}\n${reservation.guest_name}\n${format(
                                          parseISO(reservation.check_in),
                                          "MMM d",
                                        )} to ${format(
                                          new Date(parseISO(reservation.check_out).getTime() - 86400000),
                                          "MMM d",
                                        )}`}
                                        onClick={() => handleReservationClick(reservation)}
                                      >
                                        <div className="font-bold">{reservation.guest_name}</div>
                                        <div className="text-xs opacity-75 mt-0.5">
                                          {colspan} {colspan === 1 ? "night" : "nights"}
                                        </div>
                                      </div>
                                    </td>
                                  )
                                }

                                return (
                                  <td
                                    key={`${bed.id}-${dateIndex}`}
                                    className={`text-center px-1.5 py-3 w-16 min-w-16 ${facilityColor.bg}`}
                                  >
                                    <button
                                      onClick={() => handleCalendarCellClick(bed, date)}
                                      className="flex items-center justify-center w-full h-full hover:bg-green-100 rounded transition-colors cursor-pointer group"
                                      title={`Book ${location.name} - ${bed.room.room_number}`}
                                    >
                                      <div className="text-green-600 text-lg group-hover:scale-125 transition-transform">
                                        ✓
                                      </div>
                                    </button>
                                  </td>
                                )
                              })}
                            </tr>
                          )
                        })
                      })}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>

            {/* Legend */}
            <div className="grid grid-cols-2 gap-6">
              {/* Status Legend */}
              <div>
                <h3 className="text-sm font-semibold text-foreground mb-3">Reservation Status</h3>
                <div className="flex flex-wrap gap-4 text-sm">
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 bg-[#834693] border border-[#6d3878] rounded"></div>
                    <span className="text-muted-foreground">Confirmed</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 bg-[#FDD7D4] border border-[#FDBBB7] rounded"></div>
                    <span className="text-muted-foreground">Checked In</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 bg-[#FFA114] border border-[#FF8C00] rounded"></div>
                    <span className="text-muted-foreground">Pending</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 bg-[#EC2B02] border border-[#D42301] rounded"></div>
                    <span className="text-muted-foreground">Cancelled</span>
                  </div>
                </div>
              </div>

              {/* Facility Colors Legend */}
              <div>
                <h3 className="text-sm font-semibold text-foreground mb-3">Properties</h3>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  {locations.map((location) => {
                    const facilityColor = getFacilityColor(location.id)
                    return (
                      <div key={location.id} className="flex items-center gap-2">
                        <div className={`w-4 h-4 ${facilityColor.bg} border-2 ${facilityColor.border} rounded`}></div>
                        <span className="text-muted-foreground">{location.name}</span>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Reservation Dialog */}
      <AddReservationDialog
        open={newReservationOpen}
        onOpenChange={setNewReservationOpen}
        bed={selectedBedForReservation} // Pass the bed object
        preSelectedDate={selectedDateForReservation}
        onSuccess={handleNewReservationSuccess}
      />

      <DailySummaryModal open={dailySummaryOpen} onOpenChange={setDailySummaryOpen} />

      {/* Edit Modal */}
      {selectedReservation && (
        <EditReservationModal
          reservation={selectedReservation}
          onClose={() => setSelectedReservation(null)}
          onSave={handleSaveReservation}
          onViewGuestHistory={() => {
            setGuestHistoryOpen(true)
          }}
        />
      )}

      {/* Guest History Modal */}
      {selectedReservation && (
        <GuestHistoryModal
          open={guestHistoryOpen}
          onOpenChange={setGuestHistoryOpen}
          guestEmail={selectedReservation.guest_email || ""}
        />
      )}

      <ReservationConfirmationModal open={confirmationOpen} onOpenChange={setConfirmationOpen} />
    </div>
  )
}
