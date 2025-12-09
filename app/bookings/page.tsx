"use client"

import { useState, useEffect } from "react"
import { createBrowserClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { ChevronLeft, ChevronRight, Calendar, Plus, Edit, Trash2 } from "lucide-react"
import { format, addDays, startOfMonth, eachDayOfInterval, addMonths, subMonths, isSameDay, isToday } from "date-fns"
import { AddReservationDialog } from "@/components/add-reservation-dialog"
import { EditReservationDialog } from "@/components/edit-reservation-dialog"

interface Room {
  id: string
  room_number: string
  room_type: string
  status: string
}

interface Reservation {
  id: string
  room_id: string
  guest_name: string
  check_in: string
  check_out: string
  status: string
  num_guests: number
}

export default function BookingsPage() {
  const [rooms, setRooms] = useState<Room[]>([])
  const [reservations, setReservations] = useState<Reservation[]>([])
  const [currentDate, setCurrentDate] = useState(new Date())
  const [viewDays, setViewDays] = useState(31)
  const [loading, setLoading] = useState(true)
  const [showAddDialog, setShowAddDialog] = useState(false)
  const [showEditDialog, setShowEditDialog] = useState(false)
  const [selectedReservation, setSelectedReservation] = useState<Reservation | null>(null)

  const supabase = createBrowserClient()

  // Calculate date range
  const startDate = startOfMonth(currentDate)
  const endDate = addDays(startDate, viewDays - 1)
  const dateRange = eachDayOfInterval({ start: startDate, end: endDate })

  useEffect(() => {
    loadData()
  }, [currentDate])

  async function loadData() {
    setLoading(true)

    // Load rooms
    const { data: roomsData } = await supabase.from("rooms").select("*").order("room_number")

    // Load reservations for the current month
    const { data: reservationsData } = await supabase
      .from("reservations")
      .select("*")
      .gte("check_in", format(startDate, "yyyy-MM-dd"))
      .lte("check_out", format(endDate, "yyyy-MM-dd"))

    setRooms(roomsData || [])
    setReservations(reservationsData || [])
    setLoading(false)
  }

  function getReservationForRoomAndDate(roomId: string, date: Date): Reservation | null {
    return (
      reservations.find((res) => {
        const checkIn = new Date(res.check_in)
        const checkOut = new Date(res.check_out)
        return res.room_id === roomId && date >= checkIn && date < checkOut
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
    setSelectedReservation(reservation)
    setShowEditDialog(true)
  }

  async function handleDeleteReservation(reservationId: string) {
    if (!confirm("Are you sure you want to delete this reservation?")) return

    const { error } = await supabase.from("reservations").delete().eq("id", reservationId)

    if (error) {
      console.error("Error deleting reservation:", error)
      alert("Failed to delete reservation")
    } else {
      loadData()
    }
  }

  return (
    <div className="flex h-screen flex-col bg-background">
      {/* Header */}
      <div className="flex items-center justify-between border-b bg-card px-6 py-4">
        <div>
          <h1 className="text-2xl font-bold">Booking Calendar</h1>
          <p className="text-sm text-muted-foreground">Room availability and reservations</p>
        </div>
        <Button className="gap-2" onClick={() => setShowAddDialog(true)}>
          <Plus className="h-4 w-4" />
          Add Reservation
        </Button>
      </div>

      {/* Calendar Controls */}
      <div className="flex items-center gap-4 border-b bg-card px-6 py-3">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={() => setCurrentDate(subMonths(currentDate, 1))}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="outline" className="min-w-[200px] bg-transparent" onClick={() => setCurrentDate(new Date())}>
            <Calendar className="mr-2 h-4 w-4" />
            {format(currentDate, "MMMM yyyy")}
          </Button>
          <Button variant="outline" size="icon" onClick={() => setCurrentDate(addMonths(currentDate, 1))}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        <div className="ml-auto flex gap-2">
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

      {/* Calendar Grid */}
      <div className="flex-1 overflow-auto">
        <div className="inline-block min-w-full">
          {/* Date Headers */}
          <div className="sticky top-0 z-20 flex bg-card">
            <div className="sticky left-0 z-30 w-40 border-r bg-card"></div>
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
            rooms.map((room) => (
              <div key={room.id} className="flex border-b hover:bg-accent/50">
                {/* Room Info */}
                <div className="sticky left-0 z-10 flex w-40 flex-col justify-center border-r bg-card px-4 py-3">
                  <div className="font-semibold">{room.room_number}</div>
                  <div className="text-xs text-muted-foreground">{room.room_type}</div>
                </div>

                {/* Date Cells */}
                <div className="flex">
                  {dateRange.map((date) => {
                    const reservation = getReservationForRoomAndDate(room.id, date)
                    const position = reservation ? getReservationPosition(reservation, date) : null

                    return (
                      <div key={`${room.id}-${date.toISOString()}`} className="relative min-w-[120px] border-r p-1">
                        {reservation && position === "start" && (
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
            ))
          )}
        </div>
      </div>

      {/* Dialogs */}
      <AddReservationDialog open={showAddDialog} onOpenChange={setShowAddDialog} onSuccess={loadData} />

      {selectedReservation && (
        <EditReservationDialog
          open={showEditDialog}
          onOpenChange={setShowEditDialog}
          reservation={selectedReservation}
          onSuccess={loadData}
        />
      )}
    </div>
  )
}
