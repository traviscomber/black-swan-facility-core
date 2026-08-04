"use client"

import { useCallback, useEffect, useMemo } from "react"
import { createClient } from "@/lib/supabase/client"

type RoomIdentity = {
  id: string
  room_number: string
  location: { name: string } | null
}

type BedIdentity = {
  id: string
  room_id: string
  bed_number: string
}

type ReservationIdentity = {
  id: string
  bed_id: string | null
  room_id: string | null
  guest_name: string
  check_in: string
}

type IdentityIndex = {
  rooms: RoomIdentity[]
  beds: BedIdentity[]
  reservations: ReservationIdentity[]
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

function leftPosition(button: HTMLButtonElement) {
  return Number.parseFloat(button.style.left || "0")
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
      const room = index.rooms.find((item) => item.room_number === roomNumber && normalize(item.location?.name) === normalize(locationName))
        ?? index.rooms.find((item) => item.room_number === roomNumber)
      if (!room) return

      header.dataset.roomId = room.id
      header.dataset.roomNumber = room.room_number

      const reservationButtons = Array.from(container.querySelectorAll<HTMLButtonElement>("button.absolute.bottom-2.z-20"))
      const grouped = new Map<string, HTMLButtonElement[]>()

      reservationButtons.forEach((button) => {
        const row = button.parentElement?.parentElement
        const bedLabel = row?.querySelector<HTMLElement>(":scope > div:first-child p.font-medium")?.textContent ?? ""
        const bedNumber = bedLabel.replace(/^Cama\s+/i, "").trim()
        const guestName = guestNameFromReservationButton(button)
        const key = `${room.id}|${bedNumber}|${normalize(guestName)}`
        grouped.set(key, [...(grouped.get(key) ?? []), button])
      })

      grouped.forEach((buttons, key) => {
        const [, bedNumber, normalizedGuest] = key.split("|")
        const bed = index.beds.find((item) => item.room_id === room.id && item.bed_number === bedNumber)
        if (!bed) return
        const reservations = index.reservations
          .filter((item) => item.bed_id === bed.id && normalize(item.guest_name) === normalizedGuest)
          .sort((a, b) => a.check_in.localeCompare(b.check_in))
        buttons.sort((a, b) => leftPosition(a) - leftPosition(b))
        buttons.forEach((button, position) => {
          const reservation = reservations[position]
          if (!reservation) return
          button.dataset.reservationId = reservation.id
          button.dataset.roomId = room.id
          button.dataset.bedId = bed.id
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
        supabase.from("rooms").select("id, room_number, location:locations(name)"),
        supabase.from("beds").select("id, room_id, bed_number"),
        supabase.from("reservations").select("id, bed_id, room_id, guest_name, check_in").not("status", "in", "(cancelled,canceled,void,voided)"),
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

    return () => {
      disposed = true
      observer.disconnect()
      if (timer !== null) window.clearTimeout(timer)
    }
  }, [annotate, supabase])

  return null
}
