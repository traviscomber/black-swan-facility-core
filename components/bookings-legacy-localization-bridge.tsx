"use client"

import { useEffect } from "react"
import { useLanguage, type Language } from "@/lib/hooks/use-language"
import { translateBookingOperationsValue } from "@/lib/translations/booking-operations"
import { translateLegacyCalendarValue } from "@/lib/translations/bookings-calendar-legacy"

const ROUTE_LOCALES = new Set(["en", "es", "de"])

function localizeLegacyHref(value: string, locale: Language) {
  if (!value.startsWith("/bookings")) return value
  const firstSegment = value.split("/").filter(Boolean)[0]
  if (ROUTE_LOCALES.has(firstSegment)) return value
  return `/${locale}${value}`
}

function translateValue(value: string, locale: Language) {
  const operations = translateBookingOperationsValue(value, locale)
  return translateLegacyCalendarValue(operations, locale)
}

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
    const translated = translateValue(value, locale)
    if (translated !== value) node.nodeValue = `${leading}${translated}${trailing}`
  }

  for (const element of Array.from(root.querySelectorAll<HTMLElement>("[placeholder], [aria-label], [title]"))) {
    for (const attribute of ["placeholder", "aria-label", "title"] as const) {
      const value = element.getAttribute(attribute)
      if (!value) continue
      const translated = translateValue(value, locale)
      if (translated !== value) element.setAttribute(attribute, translated)
    }
  }

  for (const anchor of Array.from(root.querySelectorAll<HTMLAnchorElement>("a[href]"))) {
    const href = anchor.getAttribute("href")
    if (!href) continue
    const localized = localizeLegacyHref(href, locale)
    if (localized !== href) anchor.setAttribute("href", localized)
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
      attributeFilter: ["placeholder", "aria-label", "title", "href"],
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
