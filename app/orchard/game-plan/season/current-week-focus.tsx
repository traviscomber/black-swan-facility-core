"use client"

import { useEffect } from "react"
import { useLanguage } from "@/lib/hooks/use-language"

const labels = { en:"Today", es:"Hoy", de:"Heute" } as const

export function CurrentWeekFocus() {
  const { language } = useLanguage()

  useEffect(() => {
    let centered = false

    const focusCurrentWeek = () => {
      if (centered) return true
      const marker = document.querySelector<HTMLElement>(`[title="${labels[language]}"]`)
      const scroller = marker?.closest<HTMLElement>(".overflow-x-auto")
      if (!marker || !scroller) return false

      const markerRect = marker.getBoundingClientRect()
      const scrollerRect = scroller.getBoundingClientRect()
      const markerCenter = markerRect.left - scrollerRect.left + scroller.scrollLeft
      const target = Math.max(0, markerCenter - scroller.clientWidth * 0.55)

      centered = true
      scroller.scrollTo({ left: target, behavior: "smooth" })
      return true
    }

    if (focusCurrentWeek()) return

    const observer = new MutationObserver(() => {
      if (focusCurrentWeek()) observer.disconnect()
    })
    observer.observe(document.body, { childList:true, subtree:true })

    const timeout = window.setTimeout(() => observer.disconnect(), 8000)
    return () => {
      observer.disconnect()
      window.clearTimeout(timeout)
    }
  }, [language])

  return null
}
