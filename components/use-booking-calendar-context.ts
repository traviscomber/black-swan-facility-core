"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { toast } from "sonner"
import { createClient } from "@/lib/supabase/client"
import { bookingStaysOverlap, type BookingDragMode } from "@/lib/booking-drag"
import { bookingSourcePolicy, bookingSourcePolicyLabel } from "@/lib/booking-source-policy"
import {
  activeInventoryConflict,
  createSupabaseTransport,
  futureEditable,
  stableContextReservation,
  type BookingCalendarBed,
  type BookingCalendarBlock,
  type BookingCalendarLocationGroup,
  type BookingCalendarReservation,
  type BookingCalendarTransport,
  type CalendarContext,
  type Validation,
} from "@/components/booking-calendar-model"
import { useLanguage } from "@/lib/hooks/use-language"
import { bookingCalendarInteractionCopy, interpolateBookingCopy } from "@/lib/translations/booking-calendar-interactions"

type UseBookingCalendarContextInput = {
  hierarchy: BookingCalendarLocationGroup[]
  reservations: BookingCalendarReservation[]
  blocks: BookingCalendarBlock[]
  transport?: BookingCalendarTransport
}

export function useBookingCalendarContext({
  hierarchy,
  reservations,
  blocks,
  transport,
}: UseBookingCalendarContextInput) {
  const { language } = useLanguage()
  const copy = bookingCalendarInteractionCopy[language]
  const activeTransport = useMemo(
    () => transport ?? createSupabaseTransport(),
    [transport],
  )
  const scrollRef = useRef<HTMLDivElement | null>(null)
  const rowRefs = useRef(new Map<string, HTMLDivElement>())
  const [context, setContext] = useState<CalendarContext>({
    pendingReservationIds: [],
    unavailableBedIds: [],
    activeReservations: [],
    blocks,
  })

  const bedOrder = useMemo(
    () => hierarchy.flatMap((location) => location.rooms.flatMap((room) => room.beds)),
    [hierarchy],
  )
  const bedById = useMemo(() => new Map(bedOrder.map((bed) => [bed.id, bed])), [bedOrder])
  const reservationByBed = useMemo(() => {
    const index = new Map<string, BookingCalendarReservation[]>()
    reservations.forEach((reservation) => {
      if (!reservation.bed_id) return
      index.set(reservation.bed_id, [...(index.get(reservation.bed_id) ?? []), reservation])
    })
    return index
  }, [reservations])
  const blocksByRoom = useMemo(() => {
    const index = new Map<string, BookingCalendarBlock[]>()
    blocks.forEach((block) => index.set(block.room_id, [...(index.get(block.room_id) ?? []), block]))
    return index
  }, [blocks])
  const pendingIds = useMemo(() => new Set(context.pendingReservationIds), [context.pendingReservationIds])
  const unavailableBedIds = useMemo(() => new Set(context.unavailableBedIds), [context.unavailableBedIds])

  const loadContext = useCallback(async () => {
    try {
      setContext(await activeTransport.loadContext())
    } catch (error) {
      toast.error(error instanceof Error ? error.message : copy.inventoryValidationFailed)
    }
  }, [activeTransport, copy.inventoryValidationFailed])

  useEffect(() => { void loadContext() }, [loadContext])

  useEffect(() => {
    if (transport) return
    const supabase = createClient()
    const channel = supabase
      .channel("booking-calendar-native-interactions")
      .on("postgres_changes", { event: "*", schema: "public", table: "reservations" }, () => void loadContext())
      .on("postgres_changes", { event: "*", schema: "public", table: "beds" }, () => void loadContext())
      .on("postgres_changes", { event: "*", schema: "public", table: "room_blocks" }, () => void loadContext())
      .on("postgres_changes", { event: "*", schema: "public", table: "operational_approval_requests" }, () => void loadContext())
      .subscribe()
    return () => { void supabase.removeChannel(channel) }
  }, [loadContext, transport])

  useEffect(() => {
    setContext((current) => ({ ...current, blocks }))
  }, [blocks])

  const setRowRef = useCallback((bedId: string, element: HTMLDivElement | null) => {
    if (element) rowRefs.current.set(bedId, element)
    else rowRefs.current.delete(bedId)
  }, [])

  const bedAtPoint = useCallback((clientY: number) => {
    let nearest: { bed: BookingCalendarBed; distance: number } | null = null
    rowRefs.current.forEach((row, bedId) => {
      const bed = bedById.get(bedId)
      if (!bed) return
      const rect = row.getBoundingClientRect()
      if (clientY >= rect.top && clientY <= rect.bottom) {
        nearest = { bed, distance: 0 }
        return
      }
      const distance = Math.min(Math.abs(clientY - rect.top), Math.abs(clientY - rect.bottom))
      if (distance <= 60 && (!nearest || distance < nearest.distance)) nearest = { bed, distance }
    })
    return nearest?.bed ?? null
  }, [bedById])

  const blocksForValidation = context.blocks.length ? context.blocks : blocks

  const reverseSwapValid = useCallback((
    movingReservation: ReturnType<typeof stableContextReservation>,
    conflict: ReturnType<typeof stableContextReservation>,
    sourceBed: BookingCalendarBed,
  ) => {
    if (!futureEditable(conflict)) return false
    if (bookingSourcePolicy(conflict.source) === "external-read-only") return false
    if (!sourceBed.is_available || unavailableBedIds.has(sourceBed.id)) return false
    if (["out_of_service", "out_of_inventory"].includes(sourceBed.room.operational_status)) return false
    const otherConflict = context.activeReservations.some((reservation) => {
      if (reservation.id === movingReservation.id || reservation.id === conflict.id) return false
      return activeInventoryConflict(reservation, sourceBed, conflict.check_in, conflict.check_out)
    })
    if (otherConflict) return false
    return !blocksForValidation.some(
      (block) => block.room_id === sourceBed.room_id
        && bookingStaysOverlap(conflict.check_in, conflict.check_out, block.start_date, block.end_date),
    )
  }, [blocksForValidation, context.activeReservations, unavailableBedIds])

  const validateProposal = useCallback((
    reservation: BookingCalendarReservation,
    sourceBed: BookingCalendarBed,
    targetBed: BookingCalendarBed,
    checkIn: string,
    checkOut: string,
    mode: BookingDragMode,
  ): Validation => {
    const sourcePolicy = bookingSourcePolicy(reservation.source)
    const intent = mode === "move" ? "move" : "resize"
    if (sourcePolicy === "external-read-only") {
      return { valid: false, state: "invalid", message: bookingSourcePolicyLabel(reservation.source, language), intent, swapReservation: null }
    }
    if (!futureEditable(reservation)) {
      return { valid: false, state: "invalid", message: copy.reservationNotEditable, intent, swapReservation: null }
    }
    if (checkOut <= checkIn) {
      return { valid: false, state: "invalid", message: copy.checkoutAfterCheckin, intent, swapReservation: null }
    }
    if (!targetBed.is_available || unavailableBedIds.has(targetBed.id)) {
      return { valid: false, state: "invalid", message: copy.bedDisabled, intent, swapReservation: null }
    }
    if (["out_of_service", "out_of_inventory"].includes(targetBed.room.operational_status)) {
      return { valid: false, state: "invalid", message: copy.roomUnavailable, intent, swapReservation: null }
    }

    const movingContext = stableContextReservation(reservation)
    const conflicts = context.activeReservations.filter((item) =>
      item.id !== reservation.id && activeInventoryConflict(item, targetBed, checkIn, checkOut),
    )
    const blockConflict = blocksForValidation.some(
      (block) => block.room_id === targetBed.room_id
        && bookingStaysOverlap(checkIn, checkOut, block.start_date, block.end_date),
    )
    if (blockConflict) {
      return { valid: false, state: "invalid", message: copy.blockConflict, intent, swapReservation: null }
    }
    if (conflicts.length === 0) {
      const reviewSuffix = sourcePolicy === "review" ? copy.sourceReviewSuffix : ""
      return { valid: true, state: "valid", message: `${copy.destinationAvailable}${reviewSuffix}`, intent, swapReservation: null }
    }

    const directBedConflicts = conflicts.filter((item) => item.bed_id === targetBed.id)
    const swapCandidate = mode === "move"
      && targetBed.id !== sourceBed.id
      && conflicts.length === 1
      && directBedConflicts.length === 1
      && reverseSwapValid(movingContext, directBedConflicts[0], sourceBed)
    if (swapCandidate) {
      return {
        valid: true,
        state: "warning",
        message: interpolateBookingCopy(copy.swapOccupied, { guest: directBedConflicts[0].guest_name }),
        intent: "swap",
        swapReservation: directBedConflicts[0],
      }
    }
    return { valid: false, state: "invalid", message: copy.inventoryConflict, intent, swapReservation: null }
  }, [blocksForValidation, context.activeReservations, copy, language, reverseSwapValid, unavailableBedIds])

  return {
    activeTransport,
    scrollRef,
    rowRefs,
    context,
    setContext,
    bedOrder,
    reservationByBed,
    blocksByRoom,
    pendingIds,
    unavailableBedIds,
    loadContext,
    setRowRef,
    bedAtPoint,
    blocksForValidation,
    validateProposal,
  }
}
