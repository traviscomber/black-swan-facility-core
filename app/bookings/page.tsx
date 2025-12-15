"use client"

import { useEffect, useState } from "react"
import { createBrowserClient } from "@supabase/ssr"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { ChevronLeft, ChevronRight, AlertCircle } from "lucide-react"
import { format, addDays, subDays, isWithinInterval, parseISO } from "date-fns"

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
}

export default function BookingsPage() {
  const [beds, setBeds] = useState<Bed[]>([])
  const [reservations, setReservations] = useState<Reservation[]>([])
  const [startDate, setStartDate] = useState(new Date())
  const [loading, setLoading] = useState(true)

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  )

  const PRAIRY_HOUSE_2_ID = "c6bf266b-7a34-43db-ad48-6c2d6b9bc63d"
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

      const { data: bedsData, error: bedsError } = await supabase
        .from("beds")
        .select(
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
        .eq("room.location_id", PRAIRY_HOUSE_2_ID)

      if (bedsError) throw bedsError
      setBeds(bedsData || [])

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
          end: new Date(new Date(r.check_out).getTime() - 86400000), // Exclude checkout day
        }),
    )
  }

  const endDate = addDays(startDate, CALENDAR_DAYS)
  const dateArray = Array.from({ length: CALENDAR_DAYS }, (_, i) => addDays(startDate, i))
  const roomGroups = Array.from(new Map(beds.map((b) => [b.room.room_number, b.room])).values())

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center space-y-4">
          <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="text-muted-foreground">Loading your booking calendar...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="border-b border-secondary bg-gradient-to-r from-secondary/50 to-transparent">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="space-y-6">
            <div className="space-y-2">
              <h1 className="text-3xl font-bold text-accent">Booking Calendar</h1>
              <p className="text-muted-foreground">
                Manage reservations for Prairy House 2 - {beds.length} beds across {roomGroups.length} rooms
              </p>
            </div>

            <div className="grid gap-4 md:grid-cols-4">
              <Card className="border-0 bg-white/60 backdrop-blur">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Total Beds</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-accent">{beds.length}</div>
                </CardContent>
              </Card>

              <Card className="border-0 bg-white/60 backdrop-blur">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Active Bookings</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-accent">
                    {reservations.filter((r) => r.status === "confirmed").length}
                  </div>
                </CardContent>
              </Card>

              <Card className="border-0 bg-white/60 backdrop-blur">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Occupancy</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-accent">
                    {beds.length > 0 ? Math.round((reservations.length / beds.length) * 100) : 0}%
                  </div>
                </CardContent>
              </Card>

              <Card className="border-0 bg-white/60 backdrop-blur">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Pending</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-accent">
                    {reservations.filter((r) => r.status === "pending").length}
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-lg font-semibold text-accent">
              {format(startDate, "MMMM yyyy")} - {format(endDate, "MMMM yyyy")}
            </h2>
            <p className="text-sm text-muted-foreground mt-1">Showing {CALENDAR_DAYS} days of availability</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setStartDate(subDays(startDate, 7))} className="gap-2">
              <ChevronLeft className="h-4 w-4" />
              Previous Week
            </Button>
            <Button variant="outline" size="sm" onClick={() => setStartDate(new Date())}>
              Today
            </Button>
            <Button variant="outline" size="sm" onClick={() => setStartDate(addDays(startDate, 7))} className="gap-2">
              Next Week
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <Card className="mb-6 border-primary/20 bg-primary/5">
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <AlertCircle className="h-4 w-4" />
              How to Use This Calendar
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground space-y-2">
            <p>
              • <strong>Green dates</strong> show available beds with no bookings
            </p>
            <p>
              • <strong>Colored blocks</strong> show active reservations with guest names
            </p>
            <p>
              • <strong>Hover over a reservation</strong> to see full booking details
            </p>
            <p>
              • <strong>Click the + button</strong> on any date to create a new reservation
            </p>
          </CardContent>
        </Card>

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
                  {beds.map((bed) => (
                    <tr key={bed.id} className="border-b border-secondary/30 hover:bg-secondary/20 transition-colors">
                      <td className="text-left font-medium text-accent px-4 py-4 sticky left-0 bg-white">
                        <div>{bed.room.room_number}</div>
                        <div className="text-xs text-muted-foreground">{bed.bed_number}</div>
                      </td>
                      {dateArray.map((date) => {
                        const reservation = getReservationForDate(bed.id, date)
                        return (
                          <td key={date.toISOString()} className="text-center px-2 py-4 min-w-20">
                            {reservation ? (
                              <div
                                className={`rounded p-2 text-xs font-semibold border ${getStatusColor(reservation.status)} truncate`}
                              >
                                {reservation.guest_name}
                              </div>
                            ) : (
                              <div className="flex items-center justify-center">
                                <div className="text-green-600 text-lg">✓</div>
                              </div>
                            )}
                          </td>
                        )
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

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
  )
}
