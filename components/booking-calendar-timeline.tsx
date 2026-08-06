"use client"

import { useCallback } from "react"
import { differenceInCalendarDays, parseISO } from "date-fns"
import { BookingCalendarGrid } from "@/components/booking-calendar-grid"
import { useBookingCalendarContext } from "@/components/use-booking-calendar-context"
import { useBookingCalendarInteractions } from "@/components/use-booking-calendar-interactions"
import {
  normalizeName,
  type BookingCalendarReservation,
  type BookingCalendarTimelineProps,
} from "@/components/booking-calendar-model"

export type {
  BookingCalendarBed,
  BookingCalendarBlock,
  BookingCalendarHospitality,
  BookingCalendarHousekeeping,
  BookingCalendarLocation,
  BookingCalendarLocationGroup,
  BookingCalendarReservation,
  BookingCalendarRoom,
  BookingCalendarRoomGroup,
  BookingCalendarTransport,
} from "@/components/booking-calendar-model"

export function BookingCalendarTimeline({
  hierarchy,
  reservations,
  blocks,
  housekeeping,
  hospitality,
  dates,
  startDate,
  endDate,
  dayWidth,
  labelWidth,
  expandedRooms,
  loading,
  onToggleRoom,
  onOpenReservation,
  onOpenNewReservation,
  onRefresh,
  transport,
}: BookingCalendarTimelineProps) {
  const calendarContext = useBookingCalendarContext({ hierarchy, reservations, blocks, transport })
  const interactions = useBookingCalendarInteractions({
    activeTransport: calendarContext.activeTransport,
    loadContext: calendarContext.loadContext,
    setContext: calendarContext.setContext,
    onRefresh,
    scrollRef: calendarContext.scrollRef,
    rowRefs: calendarContext.rowRefs,
    dates,
    dayWidth,
    context: calendarContext.context,
    blocksForValidation: calendarContext.blocksForValidation,
    unavailableBedIds: calendarContext.unavailableBedIds,
    bedOrder: calendarContext.bedOrder,
    pendingIds: calendarContext.pendingIds,
    bedAtPoint: calendarContext.bedAtPoint,
    validateProposal: calendarContext.validateProposal,
    onOpenReservation,
    onOpenNewReservation,
  })

  const geometry = useCallback((start: string, end: string) => {
    const visibleStart = parseISO(start) < startDate ? startDate : parseISO(start)
    const visibleEnd = parseISO(end) > endDate ? endDate : parseISO(end)
    return {
      left: differenceInCalendarDays(visibleStart, startDate) * dayWidth + 4,
      width: Math.max(36, differenceInCalendarDays(visibleEnd, visibleStart) * dayWidth - 8),
    }
  }, [dayWidth, endDate, startDate])

  const housekeepingForReservation = useCallback((reservation: BookingCalendarReservation) =>
    housekeeping.filter((task) => task.reservation_id
      ? task.reservation_id === reservation.id
      : Boolean(task.room_id && reservation.room_id && task.room_id === reservation.room_id)),
  [housekeeping])

  const hospitalityForReservation = useCallback((reservation: BookingCalendarReservation) =>
    hospitality.filter((request) => request.reservation_id
      ? request.reservation_id === reservation.id
      : Boolean(
        request.room_id
          && reservation.room_id
          && request.room_id === reservation.room_id
          && normalizeName(request.guest_name) === normalizeName(reservation.guest_name),
      )),
  [hospitality])

  return (
    <BookingCalendarGrid
      hierarchy={hierarchy}
      housekeeping={housekeeping}
      hospitality={hospitality}
      dates={dates}
      dayWidth={dayWidth}
      labelWidth={labelWidth}
      expandedRooms={expandedRooms}
      loading={loading}
      onToggleRoom={onToggleRoom}
      scrollRef={calendarContext.scrollRef}
      onRootPointerMove={interactions.onRootPointerMove}
      onRootPointerUp={interactions.onRootPointerUp}
      cancelAll={interactions.cancelAll}
      blocksByRoom={calendarContext.blocksByRoom}
      reservationByBed={calendarContext.reservationByBed}
      candidateStates={interactions.candidateStates}
      dropTargetBedId={interactions.dropTargetBedId}
      createState={interactions.createState}
      dragVisual={interactions.dragVisual}
      pendingIds={calendarContext.pendingIds}
      keyboardReservationId={interactions.keyboardReservationId}
      feedback={interactions.feedback}
      setRowRef={calendarContext.setRowRef}
      onCellPointerDown={interactions.onCellPointerDown}
      onCellClick={interactions.onCellClick}
      onReservationPointerDown={interactions.onReservationPointerDown}
      onReservationKeyDown={interactions.onReservationKeyDown}
      onReservationClick={interactions.onReservationClick}
      housekeepingForReservation={housekeepingForReservation}
      hospitalityForReservation={hospitalityForReservation}
      geometry={geometry}
    />
  )
}
