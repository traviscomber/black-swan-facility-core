import type { Language } from "@/lib/hooks/use-language"
import { translations } from "@/lib/language-context"
import { deTranslations } from "@/lib/translations/de"

const ATTRIBUTES = ["placeholder", "title", "aria-label", "aria-description"] as const
const SKIP_TAGS = new Set(["SCRIPT", "STYLE", "CODE", "PRE", "TEXTAREA"])

type LegacyCatalog = Record<string, string>

type TranslationIndex = {
  en: Map<string, string>
  es: Map<string, string>
  de: Map<string, string>
}

const en = translations.en as LegacyCatalog
const es = translations.es as LegacyCatalog

function normalize(value: string) {
  return value.replace(/\s+/g, " ").trim()
}

function buildIndex(): TranslationIndex {
  const index: TranslationIndex = {
    en: new Map<string, string>(),
    es: new Map<string, string>(),
    de: new Map<string, string>(),
  }

  const keys = new Set([...Object.keys(en), ...Object.keys(es), ...Object.keys(deTranslations)])
  for (const key of keys) {
    const values: Partial<Record<Language, string>> = {
      en: en[key],
      es: es[key],
      de: deTranslations[key],
    }

    for (const source of Object.values(values)) {
      if (!source || source.length > 500) continue
      const normalized = normalize(source)
      if (!normalized) continue
      for (const locale of ["en", "es", "de"] as const) {
        const target = values[locale]
        if (target) index[locale].set(normalized, target)
      }
    }
  }

  return index
}

const INDEX = buildIndex()

export function translateKnownText(value: string, locale: Language) {
  const normalized = normalize(value)
  if (!normalized) return value
  return INDEX[locale].get(normalized) ?? value
}

function translateTextNode(node: Text, locale: Language) {
  const parent = node.parentElement
  if (!parent || SKIP_TAGS.has(parent.tagName) || parent.closest("[data-no-translate]")) return
  const source = node.nodeValue ?? ""
  const trimmed = source.trim()
  if (!trimmed) return
  const translated = translateKnownText(trimmed, locale)
  if (translated === trimmed) return
  const leading = source.match(/^\s*/)?.[0] ?? ""
  const trailing = source.match(/\s*$/)?.[0] ?? ""
  node.nodeValue = `${leading}${translated}${trailing}`
}

function translateElementAttributes(element: Element, locale: Language) {
  if (element.closest("[data-no-translate]")) return
  for (const attribute of ATTRIBUTES) {
    const value = element.getAttribute(attribute)
    if (!value) continue
    const translated = translateKnownText(value, locale)
    if (translated !== value) element.setAttribute(attribute, translated)
  }
}

export function translateDocument(root: ParentNode, locale: Language) {
  if (typeof document === "undefined") return

  if (root instanceof Element) translateElementAttributes(root, locale)

  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT)
  let current = walker.nextNode()
  while (current) {
    if (current.nodeType === Node.TEXT_NODE) translateTextNode(current as Text, locale)
    else if (current.nodeType === Node.ELEMENT_NODE) translateElementAttributes(current as Element, locale)
    current = walker.nextNode()
  }
}

export function installRuntimeTranslationBridge(locale: Language) {
  if (typeof document === "undefined") return () => {}

  translateDocument(document.body, locale)
  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      if (mutation.type === "characterData" && mutation.target.nodeType === Node.TEXT_NODE) {
        translateTextNode(mutation.target as Text, locale)
      }
      for (const node of mutation.addedNodes) {
        if (node.nodeType === Node.TEXT_NODE) translateTextNode(node as Text, locale)
        else if (node.nodeType === Node.ELEMENT_NODE) translateDocument(node as Element, locale)
      }
    }
  })

  observer.observe(document.body, { subtree: true, childList: true, characterData: true })
  return () => observer.disconnect()
}
