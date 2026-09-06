"use client"

import { useEffect } from "react"
import { usePathname, useSearchParams } from "next/navigation"
import { useLanguage } from "@/lib/hooks/use-language"

const createCycleLabel = {
  en: "Create crop cycle",
  es: "Crear ciclo",
  de: "Kulturzyklus erstellen",
} as const

export function GamePlanRouteFocus() {
  const pathname = usePathname() ?? ""
  const searchParams = useSearchParams()
  const { language } = useLanguage()
  const planId = searchParams.get("game_plan")
  const focus = searchParams.get("focus")

  useEffect(() => {
    const internalPath = pathname.replace(/^\/(en|es|de)(?=\/|$)/, "")
    if (internalPath !== "/orchard/game-plan") return

    let planSelected = !planId
    let focusApplied = focus !== "add-cycle"

    const apply = () => {
      if (!planSelected && planId) {
        const targetId = `entity-${planId}`
        const target = Array.from(document.querySelectorAll<HTMLElement>("[id^='entity-']")).find(node => node.id === targetId && node instanceof HTMLButtonElement)
        if (target instanceof HTMLButtonElement) {
          target.click()
          planSelected = true
        }
      }

      if (planSelected && !focusApplied) {
        const buttons = Array.from(document.querySelectorAll<HTMLButtonElement>("form button"))
        const submit = buttons.find(button => button.textContent?.trim().includes(createCycleLabel[language]))
        const form = submit?.closest("form")
        if (form) {
          form.scrollIntoView({ behavior: "smooth", block: "center" })
          const firstInput = form.querySelector<HTMLInputElement>("input")
          window.setTimeout(() => firstInput?.focus({ preventScroll: true }), 350)
          focusApplied = true
        }
      }

      return planSelected && focusApplied
    }

    if (apply()) return
    const observer = new MutationObserver(() => {
      if (apply()) observer.disconnect()
    })
    observer.observe(document.body, { childList: true, subtree: true })
    const timeout = window.setTimeout(() => observer.disconnect(), 8000)
    return () => {
      observer.disconnect()
      window.clearTimeout(timeout)
    }
  }, [focus, language, pathname, planId])

  return null
}
