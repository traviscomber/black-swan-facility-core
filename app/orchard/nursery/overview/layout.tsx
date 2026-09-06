"use client"

import type { ReactNode } from "react"
import { FormEvent, useEffect, useMemo, useState } from "react"
import { createBrowserClient } from "@/lib/supabase/client"
import { useLanguage } from "@/lib/hooks/use-language"

type Locale = "en" | "es" | "de"
type FarmSettings = { id: string; nursery_usable_surface_m2: number | string | null }

const copy = {
  en: {
    title: "Welcome to the new nursery page",
    body: "Enter the total usable nursery surface area in square metres. This represents the space available for nursery trays, not the physical footprint of the building. If you use multi-level tables, include the usable surface area of all levels. For example, a 5 m² table with 3 levels equals 15 m² of usable nursery space.",
    label: "Dimension in square metres",
    remind: "Remind me later",
    confirm: "Confirm",
    error: "Could not save nursery space.",
  },
  es: {
    title: "Bienvenido a la nueva página de almácigo",
    body: "Ingresa la superficie útil total del almácigo en metros cuadrados. Esto representa el espacio disponible para bandejas, no la huella física del edificio. Si usas mesas de varios niveles, incluye la superficie utilizable de todos los niveles. Por ejemplo, una mesa de 5 m² con 3 niveles equivale a 15 m² de superficie útil de almácigo.",
    label: "Dimensión en metros cuadrados",
    remind: "Recordármelo más tarde",
    confirm: "Confirmar",
    error: "No fue posible guardar el espacio de almácigo.",
  },
  de: {
    title: "Willkommen auf der neuen Anzuchtseite",
    body: "Gib die gesamte nutzbare Anzuchtfläche in Quadratmetern ein. Gemeint ist die für Anzuchtbehälter verfügbare Fläche, nicht die Gebäudegrundfläche. Bei mehrstöckigen Tischen zählt die nutzbare Fläche jeder Ebene. Ein 5-m²-Tisch mit 3 Ebenen entspricht zum Beispiel 15 m² nutzbarer Anzuchtfläche.",
    label: "Fläche in Quadratmetern",
    remind: "Später erinnern",
    confirm: "Bestätigen",
    error: "Anzuchtfläche konnte nicht gespeichert werden.",
  },
} as const

export default function NurseryOverviewLayout({ children }: { children: ReactNode }) {
  const supabase = useMemo(() => createBrowserClient(), [])
  const { language } = useLanguage()
  const text = copy[language as Locale]
  const [settings, setSettings] = useState<FarmSettings | null>(null)
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState("0")
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let live = true
    void supabase
      .from("orchard_farm_settings")
      .select("id,nursery_usable_surface_m2")
      .eq("farm_key", "black_swan_orchard")
      .single()
      .then(({ data, error: loadError }) => {
        if (!live || loadError || !data) return
        const row = data as FarmSettings
        setSettings(row)
        if (row.nursery_usable_surface_m2 == null) setOpen(true)
      })
    return () => { live = false }
  }, [supabase])

  const value = Number(draft)
  const valid = Number.isFinite(value) && value > 0

  async function confirm(event: FormEvent) {
    event.preventDefault()
    if (!settings || !valid || saving) return
    setSaving(true)
    setError(null)
    const result = await supabase
      .from("orchard_farm_settings")
      .update({ nursery_usable_surface_m2: value })
      .eq("id", settings.id)
    if (result.error) {
      setError(text.error)
      setSaving(false)
      return
    }
    setOpen(false)
    window.location.reload()
  }

  return <div data-heirloom-nursery-parity="true" className="contents">
    <style>{`
      @media (min-width: 1024px) {
        [data-heirloom-nursery-parity="true"] main > main {
          display: grid !important;
          grid-template-columns: minmax(0, 1fr) 300px !important;
          column-gap: 20px !important;
          row-gap: 16px !important;
          max-width: none !important;
          padding: 18px 24px 36px !important;
        }

        [data-heirloom-nursery-parity="true"] main > main > header,
        [data-heirloom-nursery-parity="true"] main > main > section:nth-of-type(1) {
          display: none !important;
        }

        [data-heirloom-nursery-parity="true"] main > main > section:nth-of-type(4) {
          grid-column: 1 !important;
          grid-row: 1 !important;
          margin: 0 !important;
          align-self: start !important;
        }

        [data-heirloom-nursery-parity="true"] main > main > section:nth-of-type(3) {
          grid-column: 2 !important;
          grid-row: 1 / span 2 !important;
          margin: 0 !important;
          align-self: start !important;
        }

        [data-heirloom-nursery-parity="true"] main > main > section:nth-of-type(2) {
          grid-column: 1 !important;
          grid-row: 2 !important;
          margin: 0 !important;
        }

        [data-heirloom-nursery-parity="true"] main > main > section:nth-of-type(5) {
          grid-column: 1 / -1 !important;
          grid-row: 3 !important;
          margin: 0 !important;
        }

        [data-heirloom-nursery-parity="true"] main > main > footer {
          grid-column: 1 / -1 !important;
          grid-row: 4 !important;
          margin-top: 0 !important;
        }

        [data-heirloom-nursery-parity="true"] main > main section {
          border-color: #302f2b !important;
          background: #11110f !important;
          box-shadow: none !important;
        }

        [data-heirloom-nursery-parity="true"] main > main table th,
        [data-heirloom-nursery-parity="true"] main > main table td {
          padding-top: 9px !important;
          padding-bottom: 9px !important;
        }

        [data-heirloom-nursery-parity="true"] main > main input {
          border-radius: 6px !important;
          background: #151513 !important;
        }
      }
    `}</style>
    {children}
    {open ? <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/70 p-4" role="presentation">
      <form onSubmit={confirm} role="dialog" aria-modal="true" aria-labelledby="nursery-onboarding-title" className="w-full max-w-[600px] rounded-2xl border border-white/80 bg-[#171714] p-5 shadow-2xl sm:p-6">
        <h2 id="nursery-onboarding-title" className="text-xl font-semibold text-foreground">{text.title}</h2>
        <p className="mt-4 text-sm leading-6 text-muted-foreground">{text.body}</p>
        <label className="mt-5 block text-xs text-muted-foreground">
          <span>{text.label}</span>
          <div className="mt-1 flex h-11 items-center rounded-md border border-[var(--orchard-line)] bg-[var(--bs-bg-primary)] px-3">
            <input autoFocus type="number" min="0" step="0.01" value={draft} onChange={(event) => setDraft(event.target.value)} className="min-w-0 flex-1 bg-transparent text-sm text-foreground outline-none" />
            <span className="text-xs text-muted-foreground">m²</span>
          </div>
        </label>
        {error ? <p className="mt-3 text-xs text-red-300">{error}</p> : null}
        <div className="mt-5 flex justify-end gap-2">
          <button type="button" onClick={() => setOpen(false)} className="min-h-10 rounded-md border border-[var(--orchard-line)] px-4 text-sm text-foreground hover:bg-white/5">{text.remind}</button>
          <button type="submit" disabled={!valid || saving} className="min-h-10 rounded-md bg-[var(--orchard-green)] px-4 text-sm font-medium text-[#10130f] disabled:cursor-not-allowed disabled:opacity-35">{saving ? "…" : text.confirm}</button>
        </div>
      </form>
    </div> : null}
  </div>
}
