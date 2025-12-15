"use client"

import { useEffect, useState } from "react"
import { createBrowserClient } from "@supabase/ssr"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { ChevronLeft, ChevronRight, AlertCircle, MapPin, Home, Plus } from "lucide-react"
import Link from "next/link"
import {
  format,
  addDays,
  subDays,
  isWithinInterval,
  parseISO,
  startOfMonth,
  endOfMonth,
  getDaysInMonth,
  isSameDay,
} from "date-fns"
import { AddReservationDialog } from "@/components/add-reservation-dialog"
import { EditReservationModal } from "@/components/edit-reservation-modal"
import { GuestHistoryModal } from "@/components/guest-history-modal"

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

export default function BookingsPage() {
  const [beds, setBeds] = useState<Bed[]>([])
  const [locations, setLocations] = useState<Location[]>([])
  const [reservations, setReservations] = useState<Reservation[]>([])
  const [selectedLocationId, setSelectedLocationId] = useState<string>("")
  const [startDate, setStartDate] = useState(new Date())
  const [loading, setLoading] = useState(true)
  const [newReservationOpen, setNewReservationOpen] = useState(false)
  const [selectedDateForReservation, setSelectedDateForReservation] = useState<Date | null>(null)
  const [selectedBedForReservation, setSelectedBedForReservation] = useState<Bed | null>(null)
  const [editingReservation, setEditingReservation] = useState<any>(null)
  const [selectedGuestForHistory, setSelectedGuestForHistory] = useState<any>(null)
  const [guestHistoryData, setGuestHistoryData] = useState<any[]>([])
  const [resizingReservation, setResizingReservation] = useState<any>(null)
  const [resizeStart, setResizeStart] = useState<{ x: number; y: number; originalCheckOut: string } | null>(null)

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  )

  const firstDayOfMonth = startOfMonth(startDate)
  const lastDayOfMonth = endOfMonth(startDate)
  const daysInMonth = getDaysInMonth(startDate)
  const dateArray = Array.from({ length: daysInMonth }, (_, i) => addDays(firstDayOfMonth, i))
  const endDate = lastDayOfMonth
  const today = new Date() // Get today's date for highlighting

  useEffect(() => {
    fetchData()

    const bedsSubscription = supabase
      .channel("beds-changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "beds" }, fetchData)
      .subscribe()

    const reservationsSubscription = supabase
      .channel("reservations-changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "reservations" }, fetchData)
      .subscribe()

    return () => {
      bedsSubscription.unsubscribe()
      reservationsSubscription.unsubscribe()
    }
  }, [])

  const fetchData = async () => {
    try {
      setLoading(true)

      // Fetch all locations
      const { data: locationsData, error: locationsError } = await supabase
        .from("locations")
        .select("id, name, description")
        .eq("is_active", true)

      if (locationsError) throw locationsError
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
          end: new Date(new Date(r.check_out).getTime() - 86400000),
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

  const loadGuestHistory = async (guestName: string) => {
    try {
      const { data, error } = await supabase
        .from("reservations")
        .select("*")
        .eq("guest_name", guestName)
        .order("check_in", { ascending: false })

      if (error) throw error
      setGuestHistoryData(data || [])
      setSelectedGuestForHistory({ name: guestName, email: "", phone: "", vip_status: false })
    } catch (error) {
      console.error("Error loading guest history:", error)
    }
  }

  const handleReservationClick = (reservation: Reservation) => {
    const bed = beds.find((b) => b.id === reservation.bed_id)
    setEditingReservation({
      ...reservation,
      bed_info: bed ? `${bed.room?.room_number} - ${bed.bed_number}` : "Unknown",
    })
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

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center space-y-4">
          <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="text-muted-foreground">Loading your booking system...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-background">
      {/* Header with back button */}
      <div className="border-b border-secondary bg-gradient-to-r from-secondary/50 to-transparent sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-4 py-6 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-accent">Booking Management</h1>
            <p className="text-muted-foreground mt-2">Manage reservations across all properties</p>
          </div>
          <Link href="/" className="text-muted-foreground hover:text-accent transition-colors">
            ← Back to Home
          </Link>
        </div>
      </div>

      {/* Two-column layout: Locations sidebar + Calendar */}
      <div className="flex">
        {/* Left Sidebar - Locations List */}
        <div className="w-64 border-r border-secondary bg-secondary/30 overflow-y-auto">
          <div className="p-4 space-y-2">
            <h2 className="text-sm font-semibold text-accent px-3 py-2">Properties</h2>
            {locations.map((location) => (
              <button
                key={location.id}
                onClick={() => {
                  setSelectedLocationId(location.id)
                  setStartDate(new Date())
                }}
                className={`w-full text-left px-3 py-2 rounded-lg transition-colors ${
                  selectedLocationId === location.id
                    ? "bg-primary text-white shadow-md"
                    : "hover:bg-secondary text-accent"
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

        {/* Right Content - Calendar and Details */}
        <div className="flex-1 overflow-y-auto">
          <div className="max-w-7xl mx-auto px-4 py-6">
            {/* Property Overview Cards */}
            {selectedLocation && (
              <div className="grid gap-4 md:grid-cols-4 mb-6">
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
                            (reservations.filter((r) => selectedLocationBeds.some((b) => b.id === r.bed_id)).length /
                              selectedLocationBeds.length) *
                              100,
                          )
                        : 0}
                      %
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-0 bg-white/60 backdrop-blur">
                  <CardHeader>
                    <CardTitle className="text-sm flex items-center gap-2">
                      <AlertCircle className="h-4 w-4" />
                      How to Use This Calendar
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="text-sm text-muted-foreground space-y-2">
                    <p>
                      • <strong>Green checkmarks</strong> show available beds with no bookings
                    </p>
                    <p>
                      • <strong>Colored blocks</strong> show active reservations with guest names
                    </p>
                    <p>
                      • <strong>Click a reservation</strong> to view full booking details
                    </p>
                    <p>
                      • <strong>Switch properties</strong> in the left sidebar to see different locations
                    </p>
                  </CardContent>
                </Card>
              </div>
            )}

            {/* Calendar Controls */}
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-lg font-semibold text-accent">{format(startDate, "MMMM yyyy")}</h2>
                <p className="text-sm text-muted-foreground mt-1">
                  Showing {daysInMonth} days in {format(startDate, "MMMM")}
                </p>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="default"
                  size="sm"
                  onClick={() => {
                    setSelectedDateForReservation(new Date())
                    setSelectedBedForReservation(null)
                    setNewReservationOpen(true)
                  }}
                  className="gap-2"
                >
                  <Plus className="h-4 w-4" />
                  New Reservation
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setStartDate(subDays(startDate, 7))}
                  className="gap-2"
                >
                  <ChevronLeft className="h-4 w-4" />
                  Previous Week
                </Button>
                <Button variant="outline" size="sm" onClick={() => setStartDate(new Date())}>
                  Today
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setStartDate(addDays(startDate, 7))}
                  className="gap-2"
                >
                  Next Week
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* Helper Card */}
            <Card className="mb-6 border-primary/20 bg-primary/5">
              <CardHeader>
                <CardTitle className="text-sm flex items-center gap-2">
                  <AlertCircle className="h-4 w-4" />
                  How to Use This Calendar
                </CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground space-y-2">
                <p>
                  • <strong>Green checkmarks</strong> show available beds with no bookings
                </p>
                <p>
                  • <strong>Colored blocks</strong> show active reservations with guest names
                </p>
                <p>
                  • <strong>Click a reservation</strong> to view full booking details
                </p>
                <p>
                  • <strong>Switch properties</strong> in the left sidebar to see different locations
                </p>
              </CardContent>
            </Card>

            {/* Calendar Table */}
            {selectedLocationBeds.length > 0 ? (
              <Card className="border-0 shadow-lg">
                <CardContent className="p-0">
                  <div className="overflow-x-auto bg-white rounded-b-lg">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-secondary/50 border-b border-secondary">
                          <th className="text-left font-semibold text-accent px-4 py-3 sticky left-0 bg-secondary/50 w-32 min-w-32 z-10">
                            Room
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
                        {selectedLocationBeds.map((bed) => {
                          const reservationRanges = getReservationRanges(bed.id)
                          const renderedIndices = new Set<number>()

                          return (
                            <tr
                              key={bed.id}
                              className="border-b border-secondary/30 hover:bg-secondary/20 transition-colors"
                            >
                              <td className="text-left font-medium text-accent px-4 py-4 sticky left-0 bg-white z-10 w-32 min-w-32">
                                <div>{bed.room.room_number}</div>
                                <div className="text-xs text-muted-foreground">{bed.bed_number}</div>
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
                                      className="text-center px-1.5 py-4"
                                    >
                                      <div
                                        className={`rounded p-2 text-xs font-semibold border ${getStatusColor(
                                          reservation.status,
                                        )} cursor-pointer hover:shadow-md transition-shadow h-full flex items-center justify-center relative group`}
                                        title={`${reservation.guest_name} - ${format(
                                          parseISO(reservation.check_in),
                                          "MMM d",
                                        )} to ${format(
                                          new Date(parseISO(reservation.check_out).getTime() - 86400000),
                                          "MMM d",
                                        )} - ${reservation.guest_email || ""}`}
                                        onClick={() => handleReservationClick(reservation)}
                                        onMouseDown={(e) => {
                                          if (e.clientX > e.currentTarget.getBoundingClientRect().right - 10) {
                                            setResizingReservation(reservation)
                                            setResizeStart({
                                              x: e.clientX,
                                              y: e.clientY,
                                              originalCheckOut: reservation.check_out,
                                            })
                                          }
                                        }}
                                      >
                                        {reservation.guest_name}
                                        <div className="text-xs opacity-75 mt-1">
                                          ({colspan} {colspan === 1 ? "night" : "nights"})
                                        </div>
                                        {/* Drag handle at the right edge */}
                                        <div className="absolute right-0 top-0 bottom-0 w-1.5 bg-green-600 hover:bg-green-700 cursor-col-resize opacity-0 group-hover:opacity-100" />
                                      </div>
                                    </td>
                                  )
                                }

                                return (
                                  <td key={`${bed.id}-${dateIndex}`} className="text-center px-1.5 py-4 w-16 min-w-16">
                                    <button
                                      onClick={() => handleCalendarCellClick(bed, date)}
                                      className="flex items-center justify-center w-full h-full hover:bg-green-50 rounded transition-colors cursor-pointer group"
                                      title="Click to create reservation"
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
                        })}
                      </tbody>
                    </table>
                  </div>

                  <div className="bg-secondary/20 px-4 py-2 text-xs text-muted-foreground italic">
                    ← Scroll right to see remaining days →
                  </div>
                </CardContent>
              </Card>
            ) : (
              <Card className="border-0 shadow-lg">
                <CardContent className="p-8 text-center">
                  <MapPin className="h-12 w-12 text-muted-foreground mx-auto mb-2 opacity-50" />
                  <p className="text-muted-foreground">No beds found for this location</p>
                </CardContent>
              </Card>
            )}

            {/* Legend */}
            <div className="mt-6 flex flex-wrap gap-4 text-sm">
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
              <div className="flex items-center gap-2">
                <div className="text-green-600 text-lg">✓</div>
                <span className="text-muted-foreground">Available</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Reservation Dialog */}
      <AddReservationDialog
        open={newReservationOpen}
        onOpenChange={setNewReservationOpen}
        preselectedBed={selectedBedForReservation?.id}
        preselectedDate={selectedDateForReservation || undefined}
        preselectedLocation={selectedLocation?.name} // pass location name to auto-fill
        onSuccess={() => {
          setNewReservationOpen(false)
          fetchData()
        }}
      />

      {/* Edit Modal */}
      {editingReservation && (
        <EditReservationModal
          open={!!editingReservation}
          onOpenChange={(open) => !open && setEditingReservation(null)}
          reservation={editingReservation}
          onUpdate={updateReservation}
          onDelete={() => {
            deleteReservation(editingReservation.id)
            setEditingReservation(null)
          }}
        />
      )}

      {/* Guest History Modal */}
      {selectedGuestForHistory && (
        <GuestHistoryModal
          open={!!selectedGuestForHistory}
          onOpenChange={(open) => !open && setSelectedGuestForHistory(null)}
          guest={selectedGuestForHistory}
          reservationHistory={guestHistoryData}
        />
      )}
    </div>
  )
}
