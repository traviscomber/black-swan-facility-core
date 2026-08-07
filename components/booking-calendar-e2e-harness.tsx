"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { addDays, parseISO } from "date-fns"
import {
  BookingCalendarTimeline,
  type BookingCalendarBed,
  type BookingCalendarLocationGroup,
  type BookingCalendarReservation,
  type BookingCalendarTransport,
} from "@/components/booking-calendar-timeline"

type ChangeSnapshot = {
  before: BookingCalendarReservation[]
  after: BookingCalendarReservation[]
}

const location = { id: "00000000-0000-0000-0000-000000000101", name: "E2E Lodge" }
const roomA = {
  id: "00000000-0000-0000-0000-000000000201",
  room_number: "101",
  room_type: "Doble",
  location_id: location.id,
  operational_status: "ready",
  location,
}
const roomB = {
  id: "00000000-0000-0000-0000-000000000202",
  room_number: "102",
  room_type: "Doble",
  location_id: location.id,
  operational_status: "ready",
  location,
}
const beds: BookingCalendarBed[] = [
  {
    id: "00000000-0000-0000-0000-000000000301",
    room_id: roomA.id,
    bed_number: "1",
    bed_type: "Queen",
    is_available: true,
    room: roomA,
  },
  {
    id: "00000000-0000-0000-0000-000000000302",
    room_id: roomB.id,
    bed_number: "1",
    bed_type: "Queen",
    is_available: true,
    room: roomB,
  },
  {
    id: "00000000-0000-0000-0000-000000000303",
    room_id: roomB.id,
    bed_number: "2",
    bed_type: "Single",
    is_available: true,
    room: roomB,
  },
]

const initialReservations: BookingCalendarReservation[] = [
  {
    id: "00000000-0000-0000-0000-000000000401",
    bed_id: beds[0].id,
    room_id: roomA.id,
    location_id: location.id,
    booking_type: "BED",
    guest_name: "Reserva Alpha",
    check_in: "2026-08-10",
    check_out: "2026-08-13",
    status: "confirmed",
    arrival_status: "not_arrived",
    num_guests: 2,
    source: "internal",
  },
  {
    id: "00000000-0000-0000-0000-000000000402",
    bed_id: beds[1].id,
    room_id: roomB.id,
    location_id: location.id,
    booking_type: "BED",
    guest_name: "Reserva Beta",
    check_in: "2026-08-10",
    check_out: "2026-08-13",
    status: "confirmed",
    arrival_status: "not_arrived",
    num_guests: 1,
    source: "internal",
  },
]

function cloneReservations(value: BookingCalendarReservation[]) {
  return value.map((reservation) => ({ ...reservation }))
}

export function BookingCalendarE2EHarness() {
  const [hydrated, setHydrated] = useState(false)
  const [reservations, setReservations] = useState(cloneReservations(initialReservations))
  const reservationsRef = useRef(reservations)
  reservationsRef.current = reservations
  const changesRef = useRef(new Map<string, ChangeSnapshot>())
  const [lastAction, setLastAction] = useState("ready")
  const [selected, setSelected] = useState<string | null>(null)
  const startDate = parseISO("2026-08-08")
  const dates = useMemo(() => Array.from({ length: 14 }, (_, index) => addDays(startDate, index)), [startDate])
  const hierarchy = useMemo<BookingCalendarLocationGroup[]>(() => [{
    location,
    rooms: [
      { room: roomA, beds: [beds[0]] },
      { room: roomB, beds: [beds[1], beds[2]] },
    ],
  }], [])

  useEffect(() => {
    setHydrated(true)
  }, [])

  const transport = useMemo<BookingCalendarTransport>(() => ({
    async loadContext() {
      return {
        pendingReservationIds: [],
        unavailableBedIds: [],
        activeReservations: cloneReservations(reservationsRef.current),
        blocks: [],
      }
    },
    async applyChange(input) {
      const before = cloneReservations(reservationsRef.current)
      const next = reservationsRef.current.map((reservation) => {
        if (reservation.id !== input.reservationId) return reservation
        const targetBed = beds.find((bed) => bed.id === input.targetBedId)
        if (!targetBed) throw new Error("E2E target bed not found")
        return {
          ...reservation,
          bed_id: targetBed.id,
          room_id: targetBed.room_id,
          location_id: targetBed.room.location_id,
          check_in: input.checkIn,
          check_out: input.checkOut,
        }
      })
      const changeId = `change-${Date.now()}`
      changesRef.current.set(changeId, { before, after: cloneReservations(next) })
      setReservations(next)
      setLastAction(`changed:${input.reservationId}:${input.targetBedId}:${input.checkIn}:${input.checkOut}`)
      return {
        result: "applied",
        message: "Cambio E2E aplicado",
        change_id: changeId,
        undo_until: new Date(Date.now() + 12_000).toISOString(),
      }
    },
    async applySwap(input) {
      const before = cloneReservations(reservationsRef.current)
      const reservationA = before.find((item) => item.id === input.reservationAId)
      const reservationB = before.find((item) => item.id === input.reservationBId)
      if (!reservationA || !reservationB) throw new Error("E2E swap reservation not found")
      const next = before.map((reservation) => {
        if (reservation.id === reservationA.id) {
          return {
            ...reservation,
            bed_id: reservationB.bed_id,
            room_id: reservationB.room_id,
            location_id: reservationB.location_id,
          }
        }
        if (reservation.id === reservationB.id) {
          return {
            ...reservation,
            bed_id: reservationA.bed_id,
            room_id: reservationA.room_id,
            location_id: reservationA.location_id,
          }
        }
        return reservation
      })
      const changeId = `swap-${Date.now()}`
      changesRef.current.set(changeId, { before, after: cloneReservations(next) })
      setReservations(next)
      setLastAction(`swapped:${reservationA.id}:${reservationB.id}`)
      return {
        result: "applied",
        message: "Intercambio E2E aplicado",
        change_id: changeId,
        undo_until: new Date(Date.now() + 12_000).toISOString(),
      }
    },
    async undoChange(changeId) {
      const change = changesRef.current.get(changeId)
      if (!change) throw new Error("E2E change not found")
      setReservations(cloneReservations(change.before))
      setLastAction(`undone:${changeId}`)
      return { result: "applied", message: "Cambio E2E deshecho" }
    },
  }), [])

  return (
    <main className="min-h-screen bg-background p-4 text-foreground">
      <div className="mb-4 flex flex-wrap gap-4 text-sm">
        <output data-testid="e2e-hydrated">{hydrated ? "ready" : "booting"}</output>
        <output data-testid="e2e-last-action">{lastAction}</output>
        <output data-testid="e2e-selected">{selected ?? "none"}</output>
      </div>
      <BookingCalendarTimeline
        hierarchy={hierarchy}
        reservations={reservations}
        blocks={[]}
        housekeeping={[]}
        hospitality={[]}
        dates={dates}
        startDate={startDate}
        endDate={addDays(startDate, dates.length)}
        dayWidth={92}
        labelWidth={260}
        expandedRooms={new Set([roomA.id, roomB.id])}
        loading={false}
        onToggleRoom={() => undefined}
        onOpenReservation={(reservation) => setSelected(reservation.id)}
        onOpenNewReservation={(bed, checkIn, checkOut) => {
          setLastAction(`create:${bed.id}:${checkIn.toISOString().slice(0, 10)}:${checkOut.toISOString().slice(0, 10)}`)
        }}
        onRefresh={() => undefined}
        transport={transport}
      />
    </main>
  )
}
