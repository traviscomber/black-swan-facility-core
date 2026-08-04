"use client"

import { useEffect } from "react"

export type BookingTimelineFocusDetail = {
  date?: string | null
  guestName?: string | null
  locationName?: string | null
  reservationId?: string | null
  roomNumber?: string | null
}

export const BOOKING_TIMELINE_FOCUS_EVENT = "booking:timeline-focus"

function setControlledValue(element: HTMLInputElement | HTMLSelectElement, value: string) {
  const prototype = element instanceof HTMLInputElement ? HTMLInputElement.prototype : HTMLSelectElement.prototype
  const descriptor = Object.getOwnPropertyDescriptor(prototype, "value")
  descriptor?.set?.call(element, value)
  element.dispatchEvent(new Event("input", { bubbles: true }))
  element.dispatchEvent(new Event("change", { bubbles: true }))
}

function visibleButtons() {
  return Array.from(document.querySelectorAll<HTMLButtonElement>("button")).filter((button) => button.offsetParent !== null)
}

function findButtonByText(text: string) {
  return visibleButtons().find((button) => button.textContent?.trim() === text)
}

function weekDistance(targetDate: string) {
  const target = new Date(`${targetDate}T12:00:00`)
  const today = new Date()
  today.setHours(12, 0, 0, 0)
  return Math.trunc((target.getTime() - today.getTime()) / 604800000)
}

function navigateToDate(date: string | null | undefined) {
  if (!date) return
  const todayButton = findButtonByText("Hoy")
  if (!todayButton) return
  todayButton.click()

  const controls = todayButton.parentElement
  if (!controls) return
  const buttons = Array.from(controls.querySelectorAll<HTMLButtonElement>("button"))
  const todayIndex = buttons.indexOf(todayButton)
  const previous = buttons[todayIndex - 1]
  const next = buttons[todayIndex + 1]
  const weeks = weekDistance(date)
  const direction = weeks < 0 ? previous : next
  if (!direction) return
  for (let index = 0; index < Math.abs(weeks); index += 1) direction.click()
}

function focusTimeline(detail: BookingTimelineFocusDetail) {
  window.scrollTo({ top: 0, behavior: "smooth" })
  navigateToDate(detail.date)

  window.setTimeout(() => {
    const locationSelect = Array.from(document.querySelectorAll<HTMLSelectElement>("select")).find((select) =>
      Array.from(select.options).some((option) => option.textContent?.trim() === detail.locationName),
    )
    if (locationSelect && detail.locationName) {
      const option = Array.from(locationSelect.options).find((item) => item.textContent?.trim() === detail.locationName)
      if (option) setControlledValue(locationSelect, option.value)
    }

    const searchInput = document.querySelector<HTMLInputElement>('input[placeholder="Buscar propiedad, habitación, cama o estado"]')
    const searchValue = detail.roomNumber ?? detail.guestName ?? ""
    if (searchInput && searchValue) setControlledValue(searchInput, searchValue)

    window.setTimeout(() => {
      if (detail.roomNumber) {
        const roomButton = visibleButtons().find((button) => button.textContent?.includes(detail.roomNumber ?? ""))
        roomButton?.click()
      }

      window.setTimeout(() => {
        if (detail.guestName) {
          const reservationButton = visibleButtons().find((button) => button.textContent?.includes(detail.guestName ?? ""))
          reservationButton?.click()
          reservationButton?.scrollIntoView({ behavior: "smooth", block: "center", inline: "center" })
        }
      }, 250)
    }, 250)
  }, 250)
}

export function BookingTimelineAlertNavigator() {
  useEffect(() => {
    const listener = (event: Event) => focusTimeline((event as CustomEvent<BookingTimelineFocusDetail>).detail)
    window.addEventListener(BOOKING_TIMELINE_FOCUS_EVENT, listener)
    return () => window.removeEventListener(BOOKING_TIMELINE_FOCUS_EVENT, listener)
  }, [])

  return null
}
