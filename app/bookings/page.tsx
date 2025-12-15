"use client"

import { useEffect, useState } from "react"
import { createBrowserClient } from "@supabase/ssr"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { ChevronLeft, ChevronRight, AlertCircle, MapPin, Home, Plus } from "lucide-react"
import { format, addDays, subDays, isWithinInterval, parseISO } from "date-fns"
import { AddReservationDialog } from "@/components/add-reservation-dialog"

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

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  )

  const CALENDAR_DAYS = 35

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
  const endDate = addDays(startDate, CALENDAR_DAYS)
  const dateArray = Array.from({ length: CALENDAR_DAYS }, (_, i) => addDays(startDate, i))
  const roomGroups = Array.from(new Map(selectedLocationBeds.map((b) => [b.room.room_number, b.room])).values())

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      confirmed: "bg-green-100 text-green-800 border-green-300",
      "checked-in": "bg-blue-100 text-blue-800 border-blue-300",
      pending: "bg-yellow-100 text-yellow-800 border-yellow-300",
      cancelled: "bg-red-100 text-red-800 border-red-300",
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
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b border-secondary bg-gradient-to-r from-secondary/50 to-transparent">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <h1 className="text-3xl font-bold text-accent">Booking Management</h1>
          <p className="text-muted-foreground mt-2">Manage reservations across all properties</p>
        </div>
      </div>

      {/* Two-column layout: Locations sidebar + Calendar */}
      <div className="flex min-h-[calc(100vh-200px)]">
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
                <h2 className="text-lg font-semibold text-accent">
                  {format(startDate, "MMMM yyyy")} - {format(endDate, "MMMM yyyy")}
                </h2>
                <p className="text-sm text-muted-foreground mt-1">Showing {CALENDAR_DAYS} days of availability</p>
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
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-secondary/50 border-b border-secondary">
                          <th className="text-left font-semibold text-accent px-4 py-3 sticky left-0 bg-secondary/50 w-32">
                            Room
                          </th>
                          {dateArray.map((date) => (
                            <th
                              key={date.toISOString()}
                              className="text-center font-semibold text-accent px-2 py-3 min-w-20 whitespace-nowrap"
                            >
                              <div className="text-xs font-semibold text-muted-foreground">{format(date, "EEE")}</div>
                              <div className="text-sm font-bold text-accent">{format(date, "d")}</div>
                            </th>
                          ))}
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
                              <td className="text-left font-medium text-accent px-4 py-4 sticky left-0 bg-white">
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
                                      className="text-center px-2 py-4"
                                    >
                                      <div
                                        className={`rounded p-3 text-xs font-semibold border ${getStatusColor(
                                          reservation.status,
                                        )} cursor-pointer hover:shadow-md transition-shadow h-full flex items-center justify-center`}
                                        title={`${reservation.guest_name} - ${format(
                                          parseISO(reservation.check_in),
                                          "MMM d",
                                        )} to ${format(
                                          new Date(parseISO(reservation.check_out).getTime() - 86400000),
                                          "MMM d",
                                        )} - ${reservation.guest_email || ""}`}
                                      >
                                        {reservation.guest_name}
                                        <div className="text-xs opacity-75 mt-1">
                                          ({colspan} {colspan === 1 ? "night" : "nights"})
                                        </div>
                                      </div>
                                    </td>
                                  )
                                }

                                return (
                                  <td key={`${bed.id}-${dateIndex}`} className="text-center px-2 py-4 min-w-20">
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
                <div className="w-4 h-4 bg-green-100 border border-green-300 rounded"></div>
                <span className="text-muted-foreground">Confirmed</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 bg-blue-100 border border-blue-300 rounded"></div>
                <span className="text-muted-foreground">Checked In</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 bg-yellow-100 border border-yellow-300 rounded"></div>
                <span className="text-muted-foreground">Pending</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 bg-red-100 border border-red-300 rounded"></div>
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
    </div>
  )
}
