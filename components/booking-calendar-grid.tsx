"use client"

import type React from "react"
import type { RefObject } from "react"
import { format } from "date-fns"
import { Badge } from "@/components/ui/badge"
import { Card } from "@/components/ui/card"
import { BookingCalendarInteractionFeedback } from "@/components/booking-calendar-interaction-feedback"
import { BookingCalendarRoomGroup } from "@/components/booking-calendar-room-group"
import {
  iso,
  type BookingCalendarBed,
  type BookingCalendarBlock,
  type BookingCalendarHospitality,
  type BookingCalendarHousekeeping,
  type BookingCalendarLocationGroup,
  type BookingCalendarReservation,
  type Feedback,
  type Validation,
} from "@/components/booking-calendar-model"

type CreateState = { bedId: string; first: number; last: number; state: "valid" | "invalid" }
type DragVisual = { reservationId: string; transform: string; width: number }
type Geometry = { left: number; width: number }

type BookingCalendarGridProps = {
  hierarchy: BookingCalendarLocationGroup[]
  housekeeping: BookingCalendarHousekeeping[]
  hospitality: BookingCalendarHospitality[]
  dates: Date[]
  dayWidth: number
  labelWidth: number
  expandedRooms: Set<string>
  loading: boolean
  onToggleRoom: (roomId: string) => void
  scrollRef: RefObject<HTMLDivElement | null>
  onRootPointerMove: (event: React.PointerEvent) => void
  onRootPointerUp: (event: React.PointerEvent) => void
  cancelAll: () => void
  blocksByRoom: Map<string, BookingCalendarBlock[]>
  reservationByBed: Map<string, BookingCalendarReservation[]>
  candidateStates: Record<string, Validation["state"]>
  dropTargetBedId: string | null
  createState: CreateState | null
  dragVisual: DragVisual | null
  pendingIds: Set<string>
  keyboardReservationId: string | null
  feedback: Feedback | null
  setRowRef: (bedId: string, element: HTMLDivElement | null) => void
  onCellPointerDown: (event: React.PointerEvent<HTMLButtonElement>, bed: BookingCalendarBed, index: number) => void
  onCellClick: (bed: BookingCalendarBed, date: Date) => void
  onReservationPointerDown: (event: React.PointerEvent<HTMLButtonElement>, reservation: BookingCalendarReservation, bed: BookingCalendarBed) => void
  onReservationKeyDown: (event: React.KeyboardEvent<HTMLButtonElement>, reservation: BookingCalendarReservation, bed: BookingCalendarBed) => void
  onReservationClick: (reservation: BookingCalendarReservation, bed: BookingCalendarBed) => void
  housekeepingForReservation: (reservation: BookingCalendarReservation) => BookingCalendarHousekeeping[]
  hospitalityForReservation: (reservation: BookingCalendarReservation) => BookingCalendarHospitality[]
  geometry: (start: string, end: string) => Geometry
}

export function BookingCalendarGrid({
  hierarchy,
  housekeeping,
  hospitality,
  dates,
  dayWidth,
  labelWidth,
  expandedRooms,
  loading,
  onToggleRoom,
  scrollRef,
  onRootPointerMove,
  onRootPointerUp,
  cancelAll,
  blocksByRoom,
  reservationByBed,
  candidateStates,
  dropTargetBedId,
  createState,
  dragVisual,
  pendingIds,
  keyboardReservationId,
  feedback,
  setRowRef,
  onCellPointerDown,
  onCellClick,
  onReservationPointerDown,
  onReservationKeyDown,
  onReservationClick,
  housekeepingForReservation,
  hospitalityForReservation,
  geometry,
}: BookingCalendarGridProps) {
  return (
    <>
      <Card
        data-testid="booking-calendar-root"
        className="overflow-hidden"
        onPointerMove={onRootPointerMove}
        onPointerUp={onRootPointerUp}
        onPointerCancel={cancelAll}
      >
        <div ref={scrollRef} className="overflow-auto" data-booking-scroll-container="true">
          <div style={{ minWidth: labelWidth + dates.length * dayWidth }}>
            <div className="sticky top-0 z-30 flex border-b bg-background">
              <div
                className="sticky left-0 z-40 flex h-16 shrink-0 items-center border-r bg-background px-4 font-medium"
                style={{ width: labelWidth }}
              >
                Propiedad / habitación / cama
              </div>
              <div className="flex">
                {dates.map((date) => {
                  const today = iso(date) === iso(new Date())
                  return (
                    <div
                      key={date.toISOString()}
                      className={`flex h-16 shrink-0 flex-col items-center justify-center border-r text-xs ${today ? "bg-primary/10" : ""}`}
                      style={{ width: dayWidth }}
                    >
                      <span className="font-medium">{format(date, "EEE")}</span>
                      <span className={today ? "font-semibold text-primary" : "text-muted-foreground"}>
                        {format(date, "dd MMM")}
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>

            {loading ? (
              <div className="p-12 text-center text-sm text-muted-foreground">Cargando operación…</div>
            ) : hierarchy.length === 0 ? (
              <div className="p-12 text-center text-sm text-muted-foreground">
                No hay habitaciones para los filtros seleccionados.
              </div>
            ) : hierarchy.map((locationGroup) => (
              <div key={locationGroup.location.id} data-booking-location-id={locationGroup.location.id}>
                <div
                  className="sticky left-0 z-20 flex h-11 items-center border-b bg-muted/70 px-4 text-sm font-semibold"
                  style={{ width: labelWidth + dates.length * dayWidth }}
                >
                  {locationGroup.location.name}
                  <Badge variant="outline" className="ml-2">{locationGroup.rooms.length} habitaciones</Badge>
                </div>
                {locationGroup.rooms.map((roomGroup) => (
                  <BookingCalendarRoomGroup
                    key={roomGroup.room.id}
                    locationId={locationGroup.location.id}
                    roomGroup={roomGroup}
                    housekeeping={housekeeping}
                    hospitality={hospitality}
                    dates={dates}
                    dayWidth={dayWidth}
                    labelWidth={labelWidth}
                    expandedRooms={expandedRooms}
                    onToggleRoom={onToggleRoom}
                    blocks={blocksByRoom.get(roomGroup.room.id) ?? []}
                    reservationByBed={reservationByBed}
                    candidateStates={candidateStates}
                    dropTargetBedId={dropTargetBedId}
                    createState={createState}
                    dragVisual={dragVisual}
                    pendingIds={pendingIds}
                    keyboardReservationId={keyboardReservationId}
                    setRowRef={setRowRef}
                    onCellPointerDown={onCellPointerDown}
                    onCellClick={onCellClick}
                    onReservationPointerDown={onReservationPointerDown}
                    onReservationKeyDown={onReservationKeyDown}
                    onReservationClick={onReservationClick}
                    housekeepingForReservation={housekeepingForReservation}
                    hospitalityForReservation={hospitalityForReservation}
                    geometry={geometry}
                  />
                ))}
              </div>
            ))}
          </div>
        </div>
      </Card>
      <BookingCalendarInteractionFeedback feedback={feedback} />
    </>
  )
}
