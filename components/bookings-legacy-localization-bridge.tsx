"use client"

import { useEffect } from "react"
import { useLanguage, type Language } from "@/lib/hooks/use-language"
import { translateBookingOperationsValue } from "@/lib/translations/booking-operations"

function translateTree(root: HTMLElement, locale: Language) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
  const textNodes: Text[] = []
  while (walker.nextNode()) textNodes.push(walker.currentNode as Text)

  for (const node of textNodes) {
    const parent = node.parentElement
    if (!parent || parent.closest("script, style")) continue
    const raw = node.nodeValue ?? ""
    const leading = raw.match(/^\s*/)?.[0] ?? ""
    const trailing = raw.match(/\s*$/)?.[0] ?? ""
    const value = raw.trim()
    if (!value) continue
    const translated = translateBookingOperationsValue(value, locale)
    if (translated !== value) node.nodeValue = `${leading}${translated}${trailing}`
  }

  for (const element of Array.from(root.querySelectorAll<HTMLElement>("[placeholder], [aria-label], [title]"))) {
    for (const attribute of ["placeholder", "aria-label", "title"] as const) {
      const value = element.getAttribute(attribute)
      if (!value) continue
      const translated = translateBookingOperationsValue(value, locale)
      if (translated !== value) element.setAttribute(attribute, translated)
    }
  }
}

export function BookingsLegacyLocalizationBridge() {
  const { language } = useLanguage()

  useEffect(() => {
    const workspace = document.querySelector<HTMLElement>(".booking-workspace")
    if (!workspace) return

    const translateWorkspace = () => translateTree(workspace, language)
    translateWorkspace()
    const workspaceObserver = new MutationObserver(translateWorkspace)
    workspaceObserver.observe(workspace, {
      childList: true,
      subtree: true,
      characterData: true,
      attributes: true,
      attributeFilter: ["placeholder", "aria-label", "title"],
    })

    const translateToasts = () => {
      for (const toast of Array.from(document.querySelectorAll<HTMLElement>("[data-sonner-toast]"))) {
        translateTree(toast, language)
      }
    }
    translateToasts()
    const toastObserver = new MutationObserver(translateToasts)
    toastObserver.observe(document.body, { childList: true, subtree: true })

    return () => {
      workspaceObserver.disconnect()
      toastObserver.disconnect()
    }
  }, [language])

  return null
}
