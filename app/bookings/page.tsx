"use client"

import { useState, useEffect } from "react"
import { createBrowserClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { ChevronLeft, ChevronRight, Calendar, Plus, Edit, Trash2, Search, Download, List, Grid } from "lucide-react"
import { format, addDays, startOfMonth, eachDayOfInterval, addMonths, subMonths, isSameDay, isToday } from "date-fns"
import { AddReservationDialog } from "@/components/add-reservation-dialog"
import { EditReservationDialog } from "@/components/edit-reservation-dialog"
import { AppLayout } from "@/components/app-layout"
import { Tabs } from "@/components/ui/tabs"

interface Room {
  id: string
  room_number: string
  room_type: string
  capacity: number
  location: string | null
}

interface Bed {
  id: string
  room_id: string
  bed_number: string
  bed_type: string
  status: string
  room?: Room
}

interface Reservation {
  id: string
  bed_id: string
  guest_name: string
  check_in: string
  check_out: string
  status: string
  num_guests: number
}

interface Location {
  id: string
  name: string
  description: string | null
}

export default function BookingsPage() {
  const [beds, setBeds] = useState<Bed[]>([])
  const [reservations, setReservations] = useState<Reservation[]>([])
  const [locations, setLocations] = useState<Location[]>([])
  const [searchTerm, setSearchTerm] = useState("")
  const [selectedLocation, setSelectedLocation] = useState<string>("all")
  const [selectedStatus, setSelectedStatus] = useState<string>("all")
  const [view, setView] = useState<"calendar" | "list">("calendar")
  const [currentDate, setCurrentDate] = useState(new Date())
  const [viewDays, setViewDays] = useState(31)
  const [loading, setLoading] = useState(true)
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [reservationToEdit, setReservationToEdit] = useState<Reservation | null>(null)

  const supabase = createBrowserClient()

  const startDate = startOfMonth(currentDate)
  const endDate = addDays(startDate, viewDays - 1)
  const dateRange = eachDayOfInterval({ start: startDate, end: endDate })

  useEffect(() => {
    fetchData()
    loadLocations()
  }, [currentDate])

  async function loadLocations() {
    const { data } = await supabase.from("locations").select("*").eq("is_active", true).order("name")
    setLocations(data || [])
  }

  async function fetchData() {
    setLoading(true)

    const { data: bedsData } = await supabase
      .from("beds")
      .select(`
        *,
        room:rooms(*)
      `)
      .order("room_id")

    const { data: reservationsData } = await supabase
      .from("reservations")
      .select("*")
      .gte("check_in", format(startDate, "yyyy-MM-dd"))
      .lte("check_out", format(endDate, "yyyy-MM-dd"))

    console.log("[v0] Loaded beds:", bedsData?.length)
    console.log("[v0] Loaded reservations:", reservationsData?.length)

    setBeds(bedsData || [])
    setReservations(reservationsData || [])
    setLoading(false)
  }

  function getReservationForBedAndDate(bedId: string, date: Date): Reservation | null {
    return (
      reservations.find((res) => {
        const checkIn = new Date(res.check_in)
        const checkOut = new Date(res.check_out)
        return res.bed_id === bedId && date >= checkIn && date < checkOut
      }) || null
    )
  }

  function getReservationPosition(reservation: Reservation, date: Date): "start" | "middle" | "end" | null {
    const checkIn = new Date(reservation.check_in)
    const checkOut = addDays(new Date(reservation.check_out), -1)

    if (isSameDay(date, checkIn)) return "start"
    if (isSameDay(date, checkOut)) return "end"
    if (date > checkIn && date < checkOut) return "middle"
    return null
  }

  function getStatusColor(status: string): string {
    const colors = {
      confirmed: "bg-blue-400",
      checked_in: "bg-green-400",
      checked_out: "bg-gray-300",
      cancelled: "bg-red-300",
      pending: "bg-yellow-300",
    }
    return colors[status as keyof typeof colors] || "bg-purple-400"
  }

  function handleReservationClick(reservation: Reservation) {
    setReservationToEdit(reservation)
    setIsEditDialogOpen(true)
  }

  async function handleDeleteReservation(reservationId: string) {
    if (!confirm("Are you sure you want to delete this reservation?")) return

    const { error } = await supabase.from("reservations").delete().eq("id", reservationId)

    if (error) {
      console.error("Error deleting reservation:", error)
      alert("Error deleting reservation")
    } else {
      fetchData()
    }
  }

  const filteredBeds = selectedLocation === "all" ? beds : beds.filter((bed) => bed.room?.location === selectedLocation)

  const bedsByRoom = filteredBeds.reduce(
    (acc, bed) => {
      const roomId = bed.room_id
      if (!acc[roomId]) {
        acc[roomId] = []
      }
      acc[roomId].push(bed)
      return acc
    },
    {} as Record<string, Bed[]>,
  )

  function calculateStats() {
    const totalBeds = filteredBeds.length
    const occupiedBeds = new Set(
      reservations
        .filter((r) => {
          const checkIn = new Date(r.check_in)
          const checkOut = new Date(r.check_out)
          const today = new Date()
          return today >= checkIn && today < checkOut && r.status === "confirmed"
        })
        .map((r) => r.bed_id),
    ).size

    const occupancyRate = totalBeds > 0 ? ((occupiedBeds / totalBeds) * 100).toFixed(1) : "0"

    const confirmedReservations = reservations.filter((r) => r.status === "confirmed").length
    const pendingReservations = reservations.filter((r) => r.status === "pending").length

    return {
      totalBeds,
      occupiedBeds,
      occupancyRate,
      confirmedReservations,
      pendingReservations,
      totalReservations: reservations.length,
    }
  }

  const stats = calculateStats()

  const filteredReservations = reservations.filter((res) => {
    const matchesSearch = searchTerm === "" || res.guest_name.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesStatus = selectedStatus === "all" || res.status === selectedStatus
    return matchesSearch && matchesStatus
  })

  function exportToCSV() {
    const csvContent = [
      ["Room", "Bed", "Guest", "Check-in", "Check-out", "Status", "Guests"].join(","),
      ...filteredReservations.map((res) => {
        const bed = beds.find((b) => b.id === res.bed_id)
        return [
          bed?.room?.room_number || "",
          bed?.bed_number || "",
          res.guest_name,
          format(new Date(res.check_in), "yyyy-MM-dd"),
          format(new Date(res.check_out), "yyyy-MM-dd"),
          res.status,
          res.num_guests,
        ].join(",")
      }),
    ].join("\n")

    const blob = new Blob([csvContent], { type: "text/csv" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `reservations-${format(currentDate, "yyyy-MM")}.csv`
    a.click()
  }

  async function handleQuickAction(reservationId: string, action: "check_in" | "check_out") {
    const newStatus = action === "check_in" ? "checked_in" : "checked_out"
    const { error } = await supabase.from("reservations").update({ status: newStatus }).eq("id", reservationId)

    if (error) {
      console.error("Error updating reservation:", error)
      alert("Error updating reservation")
    } else {
      fetchData()
    }
  }

  return (
    <AppLayout>
      <div className="flex flex-col h-full">
        {/* Tabs */}
        <Tabs defaultValue="calendar" className="flex-1 flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between border-b bg-card px-6 py-4">
            <div>
              <h1 className="text-2xl font-bold">Bed Reservations Calendar</h1>
              <p className="text-sm text-muted-foreground">Individual bed availability</p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" className="gap-2 bg-transparent" onClick={exportToCSV}>
                <Download className="h-4 w-4" />
                Export
              </Button>
              <Button className="gap-2" onClick={() => setIsAddDialogOpen(true)}>
                <Plus className="h-4 w-4" />
                New Reservation
              </Button>
            </div>
          </div>

          {/* Stats Bar */}
          <div className="flex items-center gap-4 border-b bg-card px-6 py-3">
            <div className="flex items-center gap-2">
              <div className="text-sm font-medium">Occupancy:</div>
              <Badge variant="secondary" className="text-base font-bold">
                {stats.occupancyRate}%
              </Badge>
            </div>
            <div className="h-4 w-px bg-border" />
            <div className="text-sm">
              <span className="font-medium">{stats.occupiedBeds}</span>
              <span className="text-muted-foreground">/{stats.totalBeds} beds</span>
            </div>
            <div className="h-4 w-px bg-border" />
            <div className="text-sm">
              <span className="font-medium">{stats.confirmedReservations}</span>
              <span className="text-muted-foreground"> confirmed</span>
            </div>
            <div className="text-sm">
              <span className="font-medium">{stats.pendingReservations}</span>
              <span className="text-muted-foreground"> pending</span>
            </div>
          </div>

          {/* Filters & Controls */}
          <div className="flex items-center gap-4 border-b bg-card px-6 py-3">
            <div className="flex items-center gap-2">
              <Button variant="outline" size="icon" onClick={() => setCurrentDate(subMonths(currentDate, 1))}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                className="min-w-[200px] bg-transparent"
                onClick={() => setCurrentDate(new Date())}
              >
                <Calendar className="mr-2 h-4 w-4" />
                {format(currentDate, "MMMM yyyy")}
              </Button>
              <Button variant="outline" size="icon" onClick={() => setCurrentDate(addMonths(currentDate, 1))}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>

            <div className="h-6 w-px bg-border" />

            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search guest..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-[200px] pl-9"
              />
            </div>

            {/* Location Filter */}
            <select
              value={selectedLocation}
              onChange={(e) => setSelectedLocation(e.target.value)}
              className="rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              <option value="all">All Locations</option>
              {locations.map((loc) => (
                <option key={loc.id} value={loc.name}>
                  {loc.name}
                </option>
              ))}
            </select>

            {/* Status Filter */}
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              <option value="all">All Statuses</option>
              <option value="confirmed">Confirmed</option>
              <option value="pending">Pending</option>
              <option value="checked_in">Checked In</option>
              <option value="checked_out">Checked Out</option>
              <option value="cancelled">Cancelled</option>
            </select>

            <div className="ml-auto flex gap-2">
              {/* View Mode Toggle */}
              <div className="flex rounded-md border">
                <Button
                  variant={view === "calendar" ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setView("calendar")}
                  className="rounded-r-none"
                >
                  <Grid className="h-4 w-4" />
                </Button>
                <Button
                  variant={view === "list" ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setView("list")}
                  className="rounded-l-none"
                >
                  <List className="h-4 w-4" />
                </Button>
              </div>

              <div className="h-6 w-px bg-border" />

              {/* Time Range Buttons */}
              <Button variant={viewDays === 7 ? "default" : "outline"} size="sm" onClick={() => setViewDays(7)}>
                Week
              </Button>
              <Button variant={viewDays === 14 ? "default" : "outline"} size="sm" onClick={() => setViewDays(14)}>
                2 Weeks
              </Button>
              <Button variant={viewDays === 31 ? "default" : "outline"} size="sm" onClick={() => setViewDays(31)}>
                Month
              </Button>
            </div>
          </div>

          {/* Status Legend */}
          <div className="flex items-center gap-4 border-b bg-muted/30 px-6 py-2 text-xs">
            <span className="font-medium">Legend:</span>
            <div className="flex items-center gap-1.5">
              <div className="h-3 w-3 rounded bg-blue-400" />
              <span>Confirmed</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="h-3 w-3 rounded bg-green-400" />
              <span>Checked In</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="h-3 w-3 rounded bg-gray-300" />
              <span>Checked Out</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="h-3 w-3 rounded bg-yellow-300" />
              <span>Pending</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="h-3 w-3 rounded bg-red-300" />
              <span>Cancelled</span>
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-auto">
            {view === "calendar" ? (
              <div className="inline-block min-w-full">
                {/* Date Headers */}
                <div className="sticky top-0 z-20 flex bg-card">
                  <div className="sticky left-0 z-30 w-48 border-r bg-card"></div>
                  <div className="flex">
                    {dateRange.map((date) => (
                      <div
                        key={date.toISOString()}
                        className={`flex min-w-[120px] flex-col items-center border-r py-2 ${
                          isToday(date) ? "bg-primary/10" : ""
                        }`}
                      >
                        <div className="text-xs text-muted-foreground">{format(date, "EEE")}</div>
                        <div className={`text-lg font-semibold ${isToday(date) ? "text-primary" : ""}`}>
                          {format(date, "d")}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Room Rows */}
                {loading ? (
                  <div className="flex items-center justify-center p-8">
                    <div className="text-muted-foreground">Loading...</div>
                  </div>
                ) : (
                  Object.entries(bedsByRoom).map(([roomId, roomBeds]) => (
                    <div key={roomId}>
                      {/* Room Header */}
                      {roomBeds[0]?.room && (
                        <div className="sticky left-0 z-10 border-b bg-accent/30 px-4 py-2">
                          <div className="flex items-center justify-between">
                            <div className="font-bold text-sm">
                              {roomBeds[0].room.room_number} - {roomBeds[0].room.room_type}
                            </div>
                            {roomBeds[0].room.location && (
                              <Badge variant="outline" className="text-xs">
                                {roomBeds[0].room.location}
                              </Badge>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Bed Rows */}
                      {roomBeds.map((bed) => (
                        <div key={bed.id} className="flex border-b hover:bg-accent/50">
                          <div className="sticky left-0 z-10 flex w-48 flex-col justify-center border-r bg-card px-4 py-2">
                            <div className="font-medium text-sm">{bed.bed_number}</div>
                            <div className="text-xs text-muted-foreground capitalize">{bed.bed_type}</div>
                          </div>

                          <div className="flex">
                            {dateRange.map((date) => {
                              const reservation = getReservationForBedAndDate(bed.id, date)
                              const position = reservation ? getReservationPosition(reservation, date) : null
                              const isFiltered = reservation && !filteredReservations.includes(reservation)

                              return (
                                <div
                                  key={`${bed.id}-${date.toISOString()}`}
                                  className="relative min-w-[120px] border-r p-1"
                                >
                                  {reservation && position === "start" && !isFiltered && (
                                    <div
                                      className={`group absolute left-1 top-1 z-10 flex h-[calc(100%-8px)] cursor-pointer items-center justify-between rounded-l px-2 text-xs font-medium text-white transition-all hover:shadow-lg ${getStatusColor(
                                        reservation.status,
                                      )}`}
                                      style={{
                                        width: `calc(${
                                          Math.min(
                                            Math.ceil(
                                              (new Date(reservation.check_out).getTime() -
                                                new Date(reservation.check_in).getTime()) /
                                                (1000 * 60 * 60 * 24),
                                            ),
                                            dateRange.length - dateRange.findIndex((d) => isSameDay(d, date)),
                                          ) * 120
                                        }px - 8px)`,
                                      }}
                                      onClick={() => handleReservationClick(reservation)}
                                    >
                                      <div className="truncate">{reservation.guest_name}</div>
                                      <div className="ml-2 hidden gap-1 group-hover:flex">
                                        {reservation.status === "confirmed" && (
                                          <Button
                                            size="icon"
                                            variant="ghost"
                                            className="h-6 w-6 text-white hover:bg-white/20"
                                            onClick={(e) => {
                                              e.stopPropagation()
                                              handleQuickAction(reservation.id, "check_in")
                                            }}
                                            title="Check-in"
                                          >
                                            ✓
                                          </Button>
                                        )}
                                        {reservation.status === "checked_in" && (
                                          <Button
                                            size="icon"
                                            variant="ghost"
                                            className="h-6 w-6 text-white hover:bg-white/20"
                                            onClick={(e) => {
                                              e.stopPropagation()
                                              handleQuickAction(reservation.id, "check_out")
                                            }}
                                            title="Check-out"
                                          >
                                            ✓✓
                                          </Button>
                                        )}
                                        <Button
                                          size="icon"
                                          variant="ghost"
                                          className="h-6 w-6 text-white hover:bg-white/20"
                                          onClick={(e) => {
                                            e.stopPropagation()
                                            handleReservationClick(reservation)
                                          }}
                                        >
                                          <Edit className="h-3 w-3" />
                                        </Button>
                                        <Button
                                          size="icon"
                                          variant="ghost"
                                          className="h-6 w-6 text-white hover:bg-white/20"
                                          onClick={(e) => {
                                            e.stopPropagation()
                                            handleDeleteReservation(reservation.id)
                                          }}
                                        >
                                          <Trash2 className="h-3 w-3" />
                                        </Button>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              )
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                  ))
                )}
              </div>
            ) : (
              <div className="p-6">
                <div className="space-y-3">
                  {filteredReservations.map((reservation) => {
                    const bed = beds.find((b) => b.id === reservation.bed_id)
                    return (
                      <div
                        key={reservation.id}
                        className="flex items-center justify-between rounded-lg border bg-card p-4 hover:shadow-md"
                      >
                        <div className="flex items-center gap-4">
                          <div className={`h-12 w-1 rounded ${getStatusColor(reservation.status)}`} />
                          <div>
                            <div className="font-semibold">{reservation.guest_name}</div>
                            <div className="text-sm text-muted-foreground">
                              {bed?.room?.room_number} - {bed?.bed_number}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-6">
                          <div className="text-sm">
                            <div className="text-muted-foreground">Check-in</div>
                            <div className="font-medium">{format(new Date(reservation.check_in), "dd MMM yyyy")}</div>
                          </div>
                          <div className="text-sm">
                            <div className="text-muted-foreground">Check-out</div>
                            <div className="font-medium">{format(new Date(reservation.check_out), "dd MMM yyyy")}</div>
                          </div>
                          <Badge variant="secondary" className="capitalize">
                            {reservation.status}
                          </Badge>
                          <div className="flex gap-2">
                            {reservation.status === "confirmed" && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleQuickAction(reservation.id, "check_in")}
                              >
                                Check-in
                              </Button>
                            )}
                            {reservation.status === "checked_in" && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleQuickAction(reservation.id, "check_out")}
                              >
                                Check-out
                              </Button>
                            )}
                            <Button size="sm" variant="ghost" onClick={() => handleReservationClick(reservation)}>
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button size="sm" variant="ghost" onClick={() => handleDeleteReservation(reservation.id)}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        </Tabs>

        {/* Dialogs */}
        <AddReservationDialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen} onReservationAdded={fetchData} />

        {reservationToEdit && (
          <EditReservationDialog
            open={isEditDialogOpen}
            onOpenChange={setIsEditDialogOpen}
            onReservationUpdated={() => {
              fetchData()
              setReservationToEdit(null)
            }}
            reservation={reservationToEdit}
          />
        )}
      </div>
    </AppLayout>
  )
}
