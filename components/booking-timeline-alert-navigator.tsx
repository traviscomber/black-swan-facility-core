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

const RETRY_DELAY_MS = 200
const MAX_RETRIES = 20

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
  const distance = (target.getTime() - today.getTime()) / 604800000
  return distance < 0 ? Math.floor(distance) : Math.floor(distance)
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

function findVisibleButton(predicate: (button: HTMLButtonElement) => boolean) {
  return visibleButtons().find(predicate)
}

function retryUntilFound(
  find: () => HTMLButtonElement | undefined,
  onFound: (button: HTMLButtonElement) => void,
  attempt = 0,
) {
  const button = find()
  if (button) {
    onFound(button)
    return
  }
  if (attempt >= MAX_RETRIES) return
  window.setTimeout(() => retryUntilFound(find, onFound, attempt + 1), RETRY_DELAY_MS)
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

    if (detail.roomNumber) {
      retryUntilFound(
        () => findVisibleButton((button) => button.textContent?.includes(detail.roomNumber ?? "") ?? false),
        (roomButton) => roomButton.click(),
      )
    }

    if (detail.guestName) {
      retryUntilFound(
        () => findVisibleButton((button) => button.textContent?.includes(detail.guestName ?? "") ?? false),
        (reservationButton) => {
          reservationButton.click()
          reservationButton.scrollIntoView({ behavior: "smooth", block: "center", inline: "center" })
        },
      )
    }
  }, RETRY_DELAY_MS)
}

export function BookingTimelineAlertNavigator() {
  useEffect(() => {
    const listener = (event: Event) => focusTimeline((event as CustomEvent<BookingTimelineFocusDetail>).detail)
    window.addEventListener(BOOKING_TIMELINE_FOCUS_EVENT, listener)
    return () => window.removeEventListener(BOOKING_TIMELINE_FOCUS_EVENT, listener)
  }, [])

  return null
}
