"use client"

import type React from "react"
import { BedDouble, ChevronDown, ChevronRight, ConciergeBell, Sparkles } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { BookingCalendarReservationBar } from "@/components/booking-calendar-reservation-bar"
import {
  ROOM_STATUS_CLASSES,
  ROOM_STATUS_LABELS,
  iso,
  roomReady,
  type BookingCalendarBed,
  type BookingCalendarBlock,
  type BookingCalendarHospitality,
  type BookingCalendarHousekeeping,
  type BookingCalendarRoomGroup as RoomGroup,
  type BookingCalendarReservation,
  type Validation,
} from "@/components/booking-calendar-model"
import { useLanguage } from "@/lib/hooks/use-language"
import { translateBookingOperationsValue } from "@/lib/translations/booking-operations"

type CreateState = { bedId: string; first: number; last: number; state: "valid" | "invalid" }
type DragVisual = { reservationId: string; transform: string; width: number }
type Geometry = { left: number; width: number }

type BookingCalendarRoomGroupProps = {
  locationId: string
  roomGroup: RoomGroup
  housekeeping: BookingCalendarHousekeeping[]
  hospitality: BookingCalendarHospitality[]
  dates: Date[]
  dayWidth: number
  labelWidth: number
  expandedRooms: Set<string>
  onToggleRoom: (roomId: string) => void
  blocks: BookingCalendarBlock[]
  reservationByBed: Map<string, BookingCalendarReservation[]>
  candidateStates: Record<string, Validation["state"]>
  dropTargetBedId: string | null
  createState: CreateState | null
  dragVisual: DragVisual | null
  pendingIds: Set<string>
  keyboardReservationId: string | null
  setRowRef: (bedId: string, element: HTMLDivElement | null) => void
  onCellPointerDown: (event: React.PointerEvent<HTMLButtonElement>, bed: BookingCalendarBed, index: number) => void
  onCellClick: (bed: BookingCalendarBed, date: Date) => void
  onReservationPointerDown: (event: React.PointerEvent<HTMLButtonElement>, reservation: BookingCalendarReservation, bed: BookingCalendarBed) => void
  onReservationPointerMove: (event: React.PointerEvent<HTMLButtonElement>) => void
  onReservationPointerUp: (event: React.PointerEvent<HTMLButtonElement>) => void
  onReservationPointerCancel: (event: React.PointerEvent<HTMLButtonElement>) => void
  onReservationKeyDown: (event: React.KeyboardEvent<HTMLButtonElement>, reservation: BookingCalendarReservation, bed: BookingCalendarBed) => void
  onReservationClick: (reservation: BookingCalendarReservation, bed: BookingCalendarBed) => void
  housekeepingForReservation: (reservation: BookingCalendarReservation) => BookingCalendarHousekeeping[]
  hospitalityForReservation: (reservation: BookingCalendarReservation) => BookingCalendarHospitality[]
  geometry: (start: string, end: string) => Geometry
}

export function BookingCalendarRoomGroup({
  locationId,
  roomGroup,
  housekeeping,
  hospitality,
  dates,
  dayWidth,
  labelWidth,
  expandedRooms,
  onToggleRoom,
  blocks,
  reservationByBed,
  candidateStates,
  dropTargetBedId,
  createState,
  dragVisual,
  pendingIds,
  keyboardReservationId,
  setRowRef,
  onCellPointerDown,
  onCellClick,
  onReservationPointerDown,
  onReservationPointerMove,
  onReservationPointerUp,
  onReservationPointerCancel,
  onReservationKeyDown,
  onReservationClick,
  housekeepingForReservation,
  hospitalityForReservation,
  geometry,
}: BookingCalendarRoomGroupProps) {
  const { language } = useLanguage()
  const tr = (value: string) => translateBookingOperationsValue(value, language)
  const multi = roomGroup.beds.length > 1
  const expanded = !multi || expandedRooms.has(roomGroup.room.id)
  const roomHousekeeping = housekeeping.filter((task) => task.room_id === roomGroup.room.id)
  const roomHospitality = hospitality.filter((request) => request.room_id === roomGroup.room.id)
  const readinessClass = ROOM_STATUS_CLASSES[roomGroup.room.operational_status]
    ?? "border-border bg-muted text-muted-foreground"

  const bedCountLabel = language === "de"
    ? `${roomGroup.beds.length} ${roomGroup.beds.length === 1 ? "Bett" : "Betten"}`
    : language === "en"
      ? `${roomGroup.beds.length} ${roomGroup.beds.length === 1 ? "bed" : "beds"}`
      : `${roomGroup.beds.length} ${roomGroup.beds.length === 1 ? "cama" : "camas"}`

  const createReservationLabel = (bedNumber: string, date: Date) => {
    if (language === "de") return `Reservierung in ${roomGroup.room.room_number}, Bett ${bedNumber}, am ${iso(date)} erstellen`
    if (language === "en") return `Create reservation in ${roomGroup.room.room_number}, bed ${bedNumber}, on ${iso(date)}`
    return `Crear reserva en ${roomGroup.room.room_number}, cama ${bedNumber}, el ${iso(date)}`
  }

  return (
    <div data-booking-room-id={roomGroup.room.id}>
      <div className="flex border-b bg-background">
        <button
          type="button"
          onClick={() => multi && onToggleRoom(roomGroup.room.id)}
          className="sticky left-0 z-20 flex h-16 shrink-0 items-center justify-between gap-3 border-r bg-background px-4 text-left"
          style={{ width: labelWidth }}
          data-booking-room-header="true"
          data-room-id={roomGroup.room.id}
          data-room-number={roomGroup.room.room_number}
          data-room-status={roomGroup.room.operational_status}
          data-location-id={locationId}
        >
          <div className="flex min-w-0 items-center gap-2">
            {multi
              ? expanded
                ? <ChevronDown className="h-4 w-4 shrink-0" />
                : <ChevronRight className="h-4 w-4 shrink-0" />
              : <BedDouble className="h-4 w-4 shrink-0 text-muted-foreground" />}
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">{roomGroup.room.room_number}</p>
              <p className="truncate text-xs text-muted-foreground">
                {roomGroup.room.room_type ?? tr("Sin tipo")} · {bedCountLabel}
              </p>
            </div>
          </div>
          <div className="flex max-w-[145px] flex-wrap justify-end gap-1">
            <Badge variant="outline" className={`text-[10px] ${readinessClass}`}>
              {tr(ROOM_STATUS_LABELS[roomGroup.room.operational_status] ?? roomGroup.room.operational_status)}
            </Badge>
            {roomHousekeeping.length > 0 && (
              <Badge variant="secondary" className="gap-1"><Sparkles className="h-3 w-3" />{roomHousekeeping.length}</Badge>
            )}
            {roomHospitality.length > 0 && (
              <Badge variant="secondary" className="gap-1"><ConciergeBell className="h-3 w-3" />{roomHospitality.length}</Badge>
            )}
          </div>
        </button>
        <div
          className={`relative h-16 ${roomReady(roomGroup.room.operational_status) ? "" : "bg-muted/25"}`}
          style={{ width: dates.length * dayWidth }}
        >
          {blocks.map((block) => (
            <div
              key={block.id}
              className="absolute top-4 z-10 h-7 rounded border border-slate-400 bg-slate-200 px-2 text-xs leading-6 text-slate-800"
              style={geometry(block.start_date, block.end_date)}
            >
              <span className="block truncate">{tr("Bloqueo")} · {block.reason}</span>
            </div>
          ))}
        </div>
      </div>

      {expanded && roomGroup.beds.map((bed) => {
        const bedReservations = reservationByBed.get(bed.id) ?? []
        const candidate = candidateStates[bed.id]
        const dropState = dropTargetBedId === bed.id ? candidate : undefined
        return (
          <div
            key={bed.id}
            ref={(element) => setRowRef(bed.id, element)}
            className="flex border-b"
            data-booking-bed-row="true"
            data-booking-bed-id={bed.id}
            data-booking-room-id={bed.room_id}
            data-booking-location-id={bed.room.location_id}
            data-booking-candidate-state={candidate}
            data-booking-drop-state={dropState}
            data-testid={`booking-bed-${bed.id}`}
          >
            <div
              className="sticky left-0 z-20 flex min-h-16 shrink-0 items-center border-r bg-background px-4 pl-10"
              style={{ width: labelWidth }}
            >
              <div>
                <p className="text-sm font-medium">{tr(`Cama ${bed.bed_number}`)}</p>
                <p className="text-xs text-muted-foreground">{bed.bed_type ?? tr("Sin tipo")}</p>
              </div>
            </div>
            <div
              className="relative min-h-16"
              style={{ width: dates.length * dayWidth }}
              data-booking-timeline-row="true"
              data-booking-bed-id={bed.id}
              data-booking-room-id={bed.room_id}
            >
              <div className="absolute inset-0 flex">
                {dates.map((date, index) => {
                  const selectedForCreate = createState?.bedId === bed.id
                    && index >= createState.first
                    && index <= createState.last
                  return (
                    <button
                      key={date.toISOString()}
                      type="button"
                      onPointerDown={(event) => onCellPointerDown(event, bed, index)}
                      onClick={() => onCellClick(bed, date)}
                      className={`h-full shrink-0 border-r hover:bg-muted/60 ${iso(date) === iso(new Date()) ? "bg-primary/5" : ""}`}
                      style={{ width: dayWidth }}
                      aria-label={createReservationLabel(bed.bed_number, date)}
                      data-booking-date={iso(date)}
                      data-booking-create-state={selectedForCreate ? createState.state : undefined}
                      data-testid={`booking-cell-${bed.id}-${iso(date)}`}
                    />
                  )
                })}
              </div>

              {bedReservations.map((reservation) => (
                <BookingCalendarReservationBar
                  key={reservation.id}
                  reservation={reservation}
                  bed={bed}
                  roomStatus={roomGroup.room.operational_status}
                  requestCount={hospitalityForReservation(reservation).length}
                  housekeepingCount={housekeepingForReservation(reservation).length}
                  geometry={geometry}
                  dragVisual={dragVisual}
                  pending={pendingIds.has(reservation.id)}
                  keyboardReservationId={keyboardReservationId}
                  onPointerDown={onReservationPointerDown}
                  onPointerMove={onReservationPointerMove}
                  onPointerUp={onReservationPointerUp}
                  onPointerCancel={onReservationPointerCancel}
                  onKeyDown={onReservationKeyDown}
                  onClick={onReservationClick}
                />
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}
