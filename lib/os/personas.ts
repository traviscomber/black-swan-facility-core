import type { OsAreaKey } from "@/lib/os/navigation"

export type OsPersonaKey = "executive" | "field_admin" | "general"
export type OsPersonaLanguage = "en" | "es" | "de"

const personaLabels: Record<OsPersonaLanguage, Record<OsPersonaKey, string>> = {
  en: {
    executive: "Executive",
    field_admin: "Field operations",
    general: "Operations",
  },
  es: {
    executive: "Dirección",
    field_admin: "Operación en terreno",
    general: "Operación",
  },
  de: {
    executive: "Leitung",
    field_admin: "Betrieb vor Ort",
    general: "Betrieb",
  },
}

const areaPriorities: Record<OsPersonaKey, OsAreaKey[]> = {
  executive: ["operations", "today", "finance", "places-assets", "people", "network"],
  field_admin: ["today", "operations", "places-assets", "people", "finance", "network"],
  general: ["today", "operations", "places-assets", "people", "finance", "network"],
}

export function normalizeOsPersona(value: unknown): OsPersonaKey {
  return value === "executive" || value === "field_admin" || value === "general" ? value : "general"
}

export function getOsPersonaLabel(persona: OsPersonaKey, primaryDomain?: string | null, language: OsPersonaLanguage = "es") {
  if (persona === "executive" && primaryDomain === "hospitality") return "CEO · Hospitality"
  return personaLabels[language][persona]
}

/**
 * UX-only ordering. This function MUST receive an already-authorized list and
 * MUST preserve every entry. Authorization remains role/capability/scope/RLS.
 */
export function rankAreasForPersona<T extends { key: OsAreaKey }>(areas: T[], persona: OsPersonaKey): T[] {
  const priority = new Map(areaPriorities[persona].map((key, index) => [key, index]))
  return areas
    .map((area, index) => ({ area, index }))
    .sort((a, b) => (priority.get(a.area.key) ?? 99) - (priority.get(b.area.key) ?? 99) || a.index - b.index)
    .map(({ area }) => area)
}
