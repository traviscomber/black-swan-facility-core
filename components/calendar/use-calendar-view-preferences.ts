"use client"

import { useEffect, useState } from "react"
import type { CalendarLayerKey } from "@/components/calendar/reservation-operational-lanes"

const STORAGE_KEY = "black-swan.booking-calendar.preferences.v1"

export interface CalendarViewPreferences {
  activeLayers: CalendarLayerKey[]
  collapsedLocations: string[]
  collapsedRooms: string[]
  showSummary: boolean
  showLayerToolbar: boolean
}

export function useCalendarViewPreferences(defaultLayers: CalendarLayerKey[]) {
  const [hydrated, setHydrated] = useState(false)
  const [preferences, setPreferences] = useState<CalendarViewPreferences>({
    activeLayers: defaultLayers,
    collapsedLocations: [],
    collapsedRooms: [],
    showSummary: true,
    showLayerToolbar: true,
  })

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY)
      if (raw) {
        const saved = JSON.parse(raw) as Partial<CalendarViewPreferences>
        setPreferences((current) => ({
          activeLayers: Array.isArray(saved.activeLayers) ? saved.activeLayers : current.activeLayers,
          collapsedLocations: Array.isArray(saved.collapsedLocations) ? saved.collapsedLocations : [],
          collapsedRooms: Array.isArray(saved.collapsedRooms) ? saved.collapsedRooms : [],
          showSummary: typeof saved.showSummary === "boolean" ? saved.showSummary : true,
          showLayerToolbar: typeof saved.showLayerToolbar === "boolean" ? saved.showLayerToolbar : true,
        }))
      }
    } catch {
      // Ignore malformed local preferences and preserve safe defaults.
    } finally {
      setHydrated(true)
    }
  }, [])

  useEffect(() => {
    if (!hydrated) return
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(preferences))
  }, [hydrated, preferences])

  return { preferences, setPreferences, hydrated }
}
