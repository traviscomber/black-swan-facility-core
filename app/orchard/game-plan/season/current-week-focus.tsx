"use client"

import { useEffect } from "react"
import { useLanguage } from "@/lib/hooks/use-language"

const labels = { en:"Today", es:"Hoy", de:"Heute" } as const

export function CurrentWeekFocus() {
  const { language } = useLanguage()

  useEffect(() => {
    const id = window.requestAnimationFrame(() => {
      const marker = document.querySelector<HTMLElement>(`[title="${labels[language]}"]`)
      const scroller = marker?.closest<HTMLElement>(".overflow-x-auto")
      if (!marker || !scroller) return

      const markerRect = marker.getBoundingClientRect()
      const scrollerRect = scroller.getBoundingClientRect()
      const markerCenter = markerRect.left - scrollerRect.left + scroller.scrollLeft
      const target = Math.max(0, markerCenter - scroller.clientWidth * 0.55)

      scroller.scrollTo({ left: target, behavior: "smooth" })
    })

    return () => window.cancelAnimationFrame(id)
  }, [language])

  return null
}
