"use client"

import { useCallback, useEffect, useMemo } from "react"
import { addDays, differenceInCalendarDays, format, parseISO } from "date-fns"
import { createClient } from "@/lib/supabase/client"

type RoomIdentity = {
  id: string
  room_number: string
  operational_status: string
  location: { id: string; name: string } | null
}

type BedIdentity = {
  id: string
  room_id: string
  bed_number: string
  is_available: boolean
}

type ReservationIdentity = {
  id: string
  bed_id: string | null
  room_id: string | null
  guest_name: string
  check_in: string
  check_out: string
  status: string
}

type IdentityIndex = {
  rooms: RoomIdentity[]
  beds: BedIdentity[]
  reservations: ReservationIdentity[]
}

type Geometry = {
  left: number
  width: number
}

function normalize(value: string | null | undefined) {
  return (value ?? "").trim().toLocaleLowerCase("es-CL")
}

function directRoomHeader(container: Element) {
  return container.querySelector<HTMLButtonElement>(":scope > div:first-child > button")
}

function roomNumberFromHeader(button: HTMLButtonElement) {
  return button.querySelector("p.font-semibold")?.textContent?.trim() ?? ""
}

function locationNameForRoomContainer(container: Element) {
  const locationContainer = container.parentElement
  const heading = locationContainer?.querySelector<HTMLElement>(":scope > div:first-child")
  if (!heading) return ""
  const badgeText = heading.querySelector("span")?.textContent ?? ""
  return heading.textContent?.replace(badgeText, "").trim() ?? ""
}

function guestNameFromReservationButton(button: HTMLButtonElement) {
  return button.querySelector<HTMLSpanElement>("span.flex > span.truncate")?.textContent?.trim() ?? ""
}

function numericStyle(value: string, fallback = 0) {
  const parsed = Number.parseFloat(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

function bedRows(container: Element) {
  return Array.from(container.querySelectorAll<HTMLElement>("div.flex.border-b")).filter((row) => {
    const label = row.querySelector<HTMLElement>(":scope > div:first-child p.font-medium")?.textContent ?? ""
    return /^Cama\s+/i.test(label)
  })
}

function timelineDayCells(timeline: HTMLElement) {
  return Array.from(
    timeline.querySelectorAll<HTMLButtonElement>(":scope > div.absolute.inset-0.flex > button"),
  )
}

function dateFromCell(cell: HTMLButtonElement) {
  const match = cell.getAttribute("aria-label")?.match(/(\d{4}-\d{2}-\d{2})$/)
  return match?.[1] ?? null
}

function reservationButtons(timeline: HTMLElement) {
  return Array.from(timeline.children).filter(
    (element): element is HTMLButtonElement => element instanceof HTMLButtonElement
      && element.classList.contains("absolute"),
  )
}

function expectedGeometry(
  reservation: ReservationIdentity,
  visibleStart: Date,
  visibleEnd: Date,
  dayWidth: number,
): Geometry {
  const checkIn = parseISO(reservation.check_in)
  const checkOut = parseISO(reservation.check_out)
  const clippedStart = checkIn < visibleStart ? visibleStart : checkIn
  const clippedEnd = checkOut > visibleEnd ? visibleEnd : checkOut
  return {
    left: differenceInCalendarDays(clippedStart, visibleStart) * dayWidth + 4,
    width: Math.max(36, differenceInCalendarDays(clippedEnd, clippedStart) * dayWidth - 8),
  }
}

function matchReservation(
  button: HTMLButtonElement,
  reservations: ReservationIdentity[],
  usedIds: Set<string>,
  visibleStart: Date,
  visibleEnd: Date,
  dayWidth: number,
) {
  const buttonLeft = numericStyle(button.style.left)
  const buttonWidth = numericStyle(button.style.width, button.getBoundingClientRect().width)
  const guestName = normalize(guestNameFromReservationButton(button))

  return reservations
    .filter((reservation) => !usedIds.has(reservation.id))
    .map((reservation) => {
      const geometry = expectedGeometry(reservation, visibleStart, visibleEnd, dayWidth)
      const geometryDistance = Math.abs(buttonLeft - geometry.left) + Math.abs(buttonWidth - geometry.width)
      const guestPenalty = normalize(reservation.guest_name) === guestName ? 0 : dayWidth * 4
      return { reservation, score: geometryDistance + guestPenalty }
    })
    .sort((a, b) => a.score - b.score)[0]?.reservation ?? null
}

export function BookingTimelineDomIdentity() {
  const supabase = useMemo(() => createClient(), [])

  const annotate = useCallback((index: IdentityIndex) => {
    const roomContainers = Array.from(document.querySelectorAll<HTMLElement>("div")).filter((container) => {
      const header = directRoomHeader(container)
      return Boolean(header && roomNumberFromHeader(header))
    })

    roomContainers.forEach((container) => {
      const header = directRoomHeader(container)
      if (!header) return
      const roomNumber = roomNumberFromHeader(header)
      const locationName = locationNameForRoomContainer(container)
      const room = index.rooms.find(
        (item) => item.room_number === roomNumber
          && normalize(item.location?.name) === normalize(locationName),
      ) ?? index.rooms.find((item) => item.room_number === roomNumber)
      if (!room) return

      header.dataset.roomId = room.id
      header.dataset.roomNumber = room.room_number
      header.dataset.roomStatus = room.operational_status
      if (room.location?.id) header.dataset.locationId = room.location.id

      bedRows(container).forEach((row) => {
        const bedLabel = row.querySelector<HTMLElement>(":scope > div:first-child p.font-medium")?.textContent ?? ""
        const bedNumber = bedLabel.replace(/^Cama\s+/i, "").trim()
        const bed = index.beds.find((item) => item.room_id === room.id && item.bed_number === bedNumber)
        const timeline = row.children.item(1) as HTMLElement | null
        if (!bed || !timeline) return

        const dayCells = timelineDayCells(timeline)
        const visibleStartValue = dayCells[0] ? dateFromCell(dayCells[0]) : null
        if (!visibleStartValue || dayCells.length === 0) return
        const visibleStart = parseISO(visibleStartValue)
        const visibleEnd = addDays(visibleStart, dayCells.length)
        const dayWidth = timeline.getBoundingClientRect().width / dayCells.length

        row.dataset.bookingBedRow = "true"
        row.dataset.bedId = bed.id
        row.dataset.bedNumber = bed.bed_number
        row.dataset.bedAvailable = bed.is_available ? "true" : "false"
        row.dataset.roomId = room.id
        row.dataset.roomNumber = room.room_number
        row.dataset.roomStatus = room.operational_status
        row.dataset.locationName = room.location?.name ?? locationName
        if (room.location?.id) row.dataset.locationId = room.location.id

        timeline.dataset.bookingTimelineRow = "true"
        timeline.dataset.bedId = bed.id
        timeline.dataset.roomId = room.id
        if (room.location?.id) timeline.dataset.locationId = room.location.id

        const availableReservations = index.reservations
          .filter((reservation) => reservation.bed_id === bed.id)
          .filter((reservation) => reservation.check_in < visibleEndValue(visibleEnd))
          .filter((reservation) => reservation.check_out > visibleStartValue)
        const usedIds = new Set<string>()

        reservationButtons(timeline)
          .sort((a, b) => numericStyle(a.style.left) - numericStyle(b.style.left))
          .forEach((button) => {
            const reservation = matchReservation(
              button,
              availableReservations,
              usedIds,
              visibleStart,
              visibleEnd,
              dayWidth,
            )
            if (!reservation) return
            usedIds.add(reservation.id)
            button.dataset.bookingReservation = "true"
            button.dataset.reservationId = reservation.id
            button.dataset.roomId = room.id
            button.dataset.bedId = bed.id
            button.dataset.guestName = reservation.guest_name
            button.dataset.checkIn = reservation.check_in
            button.dataset.checkOut = reservation.check_out
            button.dataset.reservationStatus = reservation.status
          })
      })
    })
  }, [])

  useEffect(() => {
    let disposed = false
    let timer: number | null = null
    let index: IdentityIndex = { rooms: [], beds: [], reservations: [] }

    const scheduleAnnotation = () => {
      if (timer !== null) window.clearTimeout(timer)
      timer = window.setTimeout(() => annotate(index), 80)
    }

    const load = async () => {
      const [roomsResult, bedsResult, reservationsResult] = await Promise.all([
        supabase.from("rooms").select("id, room_number, operational_status, location:locations(id, name)"),
        supabase.from("beds").select("id, room_id, bed_number, is_available"),
        supabase
          .from("reservations")
          .select("id, bed_id, room_id, guest_name, check_in, check_out, status")
          .not("status", "in", "(cancelled,canceled,void,voided)"),
      ])
      if (disposed || roomsResult.error || bedsResult.error || reservationsResult.error) return
      index = {
        rooms: (roomsResult.data ?? []) as unknown as RoomIdentity[],
        beds: (bedsResult.data ?? []) as BedIdentity[],
        reservations: (reservationsResult.data ?? []) as ReservationIdentity[],
      }
      scheduleAnnotation()
    }

    void load()
    const observer = new MutationObserver(scheduleAnnotation)
    observer.observe(document.body, { childList: true, subtree: true })

    const channel = supabase
      .channel("booking-timeline-dom-identity")
      .on("postgres_changes", { event: "*", schema: "public", table: "reservations" }, () => void load())
      .on("postgres_changes", { event: "*", schema: "public", table: "rooms" }, () => void load())
      .on("postgres_changes", { event: "*", schema: "public", table: "beds" }, () => void load())
      .subscribe()

    return () => {
      disposed = true
      observer.disconnect()
      if (timer !== null) window.clearTimeout(timer)
      void supabase.removeChannel(channel)
    }
  }, [annotate, supabase])

  return null
}

function visibleEndValue(value: Date) {
  return format(value, "yyyy-MM-dd")
}
