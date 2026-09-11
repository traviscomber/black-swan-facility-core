"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { useLanguage } from "@/lib/hooks/use-language"

const copy = {
  en: { title: "Prepayment", subtitle: "Canonical booking prepayment policy.", percent: "Required prepayment", due: "Due before arrival", days: "days", save: "Save policy", saved: "Prepayment policy saved.", invalid: "Use a percentage from 0 to 100 and a non-negative number of days.", loading: "Loading…", current: "Current policy" },
  es: { title: "Prepago", subtitle: "Política canónica de prepago para reservas.", percent: "Prepago requerido", due: "Vence antes de la llegada", days: "días", save: "Guardar política", saved: "Política de prepago guardada.", invalid: "Usa un porcentaje entre 0 y 100 y una cantidad de días no negativa.", loading: "Cargando…", current: "Política actual" },
  de: { title: "Vorauszahlung", subtitle: "Kanonische Vorauszahlungsrichtlinie für Buchungen.", percent: "Erforderliche Vorauszahlung", due: "Fällig vor Anreise", days: "Tage", save: "Richtlinie speichern", saved: "Vorauszahlungsrichtlinie gespeichert.", invalid: "Prozentsatz zwischen 0 und 100 und nicht negative Tage verwenden.", loading: "Lädt…", current: "Aktuelle Richtlinie" },
} as const

type Settings = { id: string; prepayment_percent: number | string | null; prepayment_due_days_before_arrival: number | null }

export default function BookingPrepaymentPage() {
  const { language } = useLanguage()
  const c = copy[language]
  const supabase = useMemo(() => createClient(), [])
  const [settings, setSettings] = useState<Settings | null>(null)
  const [percent, setPercent] = useState("0")
  const [days, setDays] = useState("0")
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const load = useCallback(async () => {
    const { data, error: loadError } = await supabase.from("booking_settings").select("id, prepayment_percent, prepayment_due_days_before_arrival").eq("id", "default").maybeSingle()
    if (loadError) { setError(loadError.message); return }
    const row = data as Settings | null
    setSettings(row)
    setPercent(String(Number(row?.prepayment_percent ?? 0)))
    setDays(String(Number(row?.prepayment_due_days_before_arrival ?? 0)))
    setError(null)
  }, [supabase])

  useEffect(() => { void load() }, [load])

  async function save() {
    const nextPercent = Number(percent)
    const nextDays = Number(days)
    if (!Number.isFinite(nextPercent) || nextPercent < 0 || nextPercent > 100 || !Number.isInteger(nextDays) || nextDays < 0) { setError(c.invalid); return }
    setSaving(true); setError(null); setNotice(null)
    const payload = { prepayment_percent: nextPercent, prepayment_due_days_before_arrival: nextDays, updated_at: new Date().toISOString() }
    const { error: saveError } = settings
      ? await supabase.from("booking_settings").update(payload).eq("id", "default")
      : await supabase.from("booking_settings").insert({ id: "default", ...payload })
    if (saveError) setError(saveError.message)
    else { setNotice(c.saved); await load() }
    setSaving(false)
  }

  return <section className="min-h-screen bg-[#171512] text-[#e7e1d8]">
    <header className="min-h-[58px] bg-[#211e1a] px-4 py-3 md:px-5"><h1 className="text-base font-normal">{c.title}</h1><p className="text-xs text-[#b9b0a4]">{c.subtitle}</p></header>
    {error && <div className="bg-[#3a211d] px-4 py-2 text-xs text-[#e7a393]">{error}</div>}
    {notice && <div className="bg-[#253128] px-4 py-2 text-xs text-[#a8c2ad]">{notice}</div>}
    {!settings && !error ? <div className="px-5 py-10 text-sm text-[#8f867b]">{c.loading}</div> : <div className="max-w-2xl p-5">
      <div className="mb-4 text-[11px] uppercase tracking-[0.08em] text-[#8f867b]">{c.current}</div>
      <div className="grid gap-px bg-[#39342d] sm:grid-cols-2">
        <label className="bg-[#211e1a] p-4"><span className="mb-2 block text-xs text-[#b9b0a4]">{c.percent} %</span><input type="number" min="0" max="100" step="1" value={percent} onChange={(e) => setPercent(e.target.value)} className="h-9 w-full bg-[#171512] px-3 text-sm outline-none focus:ring-1 focus:ring-[#6f8373]" /></label>
        <label className="bg-[#211e1a] p-4"><span className="mb-2 block text-xs text-[#b9b0a4]">{c.due}</span><div className="flex items-center gap-2"><input type="number" min="0" step="1" value={days} onChange={(e) => setDays(e.target.value)} className="h-9 w-full bg-[#171512] px-3 text-sm outline-none focus:ring-1 focus:ring-[#6f8373]" /><span className="text-xs text-[#8f867b]">{c.days}</span></div></label>
      </div>
      <button type="button" disabled={saving} onClick={() => void save()} className="mt-5 h-9 bg-[#6f8373] px-4 text-xs font-medium text-[#171512] disabled:opacity-50">{c.save}</button>
    </div>}
  </section>
}
