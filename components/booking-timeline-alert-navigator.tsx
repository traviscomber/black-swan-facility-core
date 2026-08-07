"use client"

import { useEffect } from "react"

export type BookingTimelineFocusDetail = { date?: string | null; guestName?: string | null; locationName?: string | null; reservationId?: string | null; roomNumber?: string | null }
export const BOOKING_TIMELINE_FOCUS_EVENT = "booking:timeline-focus"
const RETRY_DELAY_MS = 200
const MAX_RETRIES = 24
const TODAY_LABELS = new Set(["Hoy", "Today", "Heute"])
const SEARCH_PLACEHOLDERS = [
  "Buscar propiedad, habitación, cama o estado",
  "Search property, room, bed or status",
  "Unterkunft, Zimmer, Bett oder Status suchen",
]

function setControlledValue(element: HTMLInputElement | HTMLSelectElement, value: string) {
  const prototype = element instanceof HTMLInputElement ? HTMLInputElement.prototype : HTMLSelectElement.prototype
  const descriptor = Object.getOwnPropertyDescriptor(prototype, "value")
  descriptor?.set?.call(element, value)
  element.dispatchEvent(new Event("input", { bubbles: true }))
  element.dispatchEvent(new Event("change", { bubbles: true }))
}
function visibleButtons() { return Array.from(document.querySelectorAll<HTMLButtonElement>("button")).filter((button) => button.offsetParent !== null) }
function findTodayButton() { return visibleButtons().find((button) => TODAY_LABELS.has(button.textContent?.trim() ?? "")) }
function weekDistance(targetDate: string) { const target = new Date(`${targetDate}T12:00:00`); const today = new Date(); today.setHours(12, 0, 0, 0); return Math.floor((target.getTime() - today.getTime()) / 604800000) }
function navigateToDate(date: string | null | undefined) {
  if (!date) return
  const todayButton = findTodayButton()
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
function findVisibleButton(predicate: (button: HTMLButtonElement) => boolean) { return visibleButtons().find(predicate) }
function retryUntilFound(find: () => HTMLButtonElement | undefined, onFound: (button: HTMLButtonElement) => void, attempt = 0) {
  const button = find()
  if (button) { onFound(button); return }
  if (attempt >= MAX_RETRIES) return
  window.setTimeout(() => retryUntilFound(find, onFound, attempt + 1), RETRY_DELAY_MS)
}
function findRoomButton(roomNumber: string | null | undefined) { if (!roomNumber) return undefined; return findVisibleButton((button) => button.dataset.roomNumber === roomNumber) ?? findVisibleButton((button) => button.textContent?.includes(roomNumber) ?? false) }
function findReservationButton(detail: BookingTimelineFocusDetail) {
  if (detail.reservationId) { const byId = findVisibleButton((button) => button.dataset.reservationId === detail.reservationId); if (byId) return byId }
  if (!detail.guestName) return undefined
  return findVisibleButton((button) => button.textContent?.includes(detail.guestName ?? "") ?? false)
}
function findSearchInput() {
  return Array.from(document.querySelectorAll<HTMLInputElement>("input[placeholder]")).find((input) => SEARCH_PLACEHOLDERS.includes(input.placeholder))
}
function focusTimeline(detail: BookingTimelineFocusDetail) {
  window.scrollTo({ top: 0, behavior: "smooth" })
  navigateToDate(detail.date)
  window.setTimeout(() => {
    const locationSelect = Array.from(document.querySelectorAll<HTMLSelectElement>("select")).find((select) => Array.from(select.options).some((option) => option.textContent?.trim() === detail.locationName))
    if (locationSelect && detail.locationName) { const option = Array.from(locationSelect.options).find((item) => item.textContent?.trim() === detail.locationName); if (option) setControlledValue(locationSelect, option.value) }
    const searchInput = findSearchInput()
    const searchValue = detail.roomNumber ?? detail.guestName ?? ""
    if (searchInput && searchValue) setControlledValue(searchInput, searchValue)
    if (detail.roomNumber) retryUntilFound(() => findRoomButton(detail.roomNumber), (roomButton) => { if (roomButton.getAttribute("aria-expanded") !== "true") roomButton.click() })
    if (detail.reservationId || detail.guestName) retryUntilFound(() => findReservationButton(detail), (reservationButton) => { reservationButton.click(); reservationButton.scrollIntoView({ behavior: "smooth", block: "center", inline: "center" }) })
  }, RETRY_DELAY_MS)
}

export function BookingTimelineAlertNavigator() {
  useEffect(() => { const listener = (event: Event) => focusTimeline((event as CustomEvent<BookingTimelineFocusDetail>).detail); window.addEventListener(BOOKING_TIMELINE_FOCUS_EVENT, listener); return () => window.removeEventListener(BOOKING_TIMELINE_FOCUS_EVENT, listener) }, [])
  return null
}
