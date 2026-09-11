"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { useLanguage } from "@/lib/hooks/use-language"

const copy = {
  en: { title: "Reservation system", subtitle: "Canonical stay and service defaults.", stay: "Stay times", checkIn: "Check-in", checkOut: "Check-out", cancellation: "Cancellation", free: "Free cancellation until", paid: "Paid cancellation window", days: "days before arrival", operations: "Stay operations", towels: "Towels", bedding: "Bedding", cleaning: "Cleaning", every: "every", afterCheckout: "after checkout", save: "Save configuration", saved: "Reservation configuration saved.", invalid: "Use valid times and non-negative whole-day values.", loading: "Loading…" },
  es: { title: "Sistema de reservas", subtitle: "Valores canónicos de estadía y servicio.", stay: "Horarios de estadía", checkIn: "Check-in", checkOut: "Check-out", cancellation: "Cancelación", free: "Cancelación gratuita hasta", paid: "Ventana de cancelación pagada", days: "días antes de la llegada", operations: "Operación de estadía", towels: "Toallas", bedding: "Ropa de cama", cleaning: "Limpieza", every: "cada", afterCheckout: "después del check-out", save: "Guardar configuración", saved: "Configuración de reservas guardada.", invalid: "Usa horarios válidos y valores enteros de días no negativos.", loading: "Cargando…" },
  de: { title: "Reservierungssystem", subtitle: "Kanonische Aufenthalts- und Servicewerte.", stay: "Aufenthaltszeiten", checkIn: "Check-in", checkOut: "Check-out", cancellation: "Stornierung", free: "Kostenlose Stornierung bis", paid: "Kostenpflichtiges Stornierungsfenster", days: "Tage vor Anreise", operations: "Aufenthaltsbetrieb", towels: "Handtücher", bedding: "Bettwäsche", cleaning: "Reinigung", every: "alle", afterCheckout: "nach Check-out", save: "Konfiguration speichern", saved: "Reservierungskonfiguration gespeichert.", invalid: "Gültige Zeiten und nicht negative ganze Tage verwenden.", loading: "Lädt…" },
} as const

type Settings = {
  id: string
  check_in_time: string | null
  check_out_time: string | null
  free_cancellation_days_before: number | null
  paid_cancellation_days_before: number | null
  towels_enabled: boolean | null
  towels_every_days: number | null
  towels_after_checkout: boolean | null
  bedding_enabled: boolean | null
  bedding_every_days: number | null
  bedding_after_checkout: boolean | null
  cleaning_enabled: boolean | null
}

function normalizeTime(value: string | null, fallback: string) { return (value || fallback).slice(0, 5) }

export default function BookingReservationSettingsPage() {
  const { language } = useLanguage()
  const c = copy[language]
  const supabase = useMemo(() => createClient(), [])
  const [settings, setSettings] = useState<Settings | null>(null)
  const [form, setForm] = useState({ check_in_time: "14:00", check_out_time: "10:00", free_cancellation_days_before: "0", paid_cancellation_days_before: "0", towels_enabled: true, towels_every_days: "3", towels_after_checkout: true, bedding_enabled: true, bedding_every_days: "5", bedding_after_checkout: true, cleaning_enabled: true })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const load = useCallback(async () => {
    const { data, error: loadError } = await supabase.from("booking_settings").select("id, check_in_time, check_out_time, free_cancellation_days_before, paid_cancellation_days_before, towels_enabled, towels_every_days, towels_after_checkout, bedding_enabled, bedding_every_days, bedding_after_checkout, cleaning_enabled").eq("id", "default").maybeSingle()
    if (loadError) { setError(loadError.message); return }
    const row = data as Settings | null
    setSettings(row)
    if (row) setForm({ check_in_time: normalizeTime(row.check_in_time, "14:00"), check_out_time: normalizeTime(row.check_out_time, "10:00"), free_cancellation_days_before: String(Number(row.free_cancellation_days_before ?? 0)), paid_cancellation_days_before: String(Number(row.paid_cancellation_days_before ?? 0)), towels_enabled: Boolean(row.towels_enabled), towels_every_days: String(Number(row.towels_every_days ?? 0)), towels_after_checkout: Boolean(row.towels_after_checkout), bedding_enabled: Boolean(row.bedding_enabled), bedding_every_days: String(Number(row.bedding_every_days ?? 0)), bedding_after_checkout: Boolean(row.bedding_after_checkout), cleaning_enabled: Boolean(row.cleaning_enabled) })
    setError(null)
  }, [supabase])

  useEffect(() => { void load() }, [load])

  async function save() {
    const freeDays = Number(form.free_cancellation_days_before)
    const paidDays = Number(form.paid_cancellation_days_before)
    const towelDays = Number(form.towels_every_days)
    const beddingDays = Number(form.bedding_every_days)
    if (![freeDays, paidDays, towelDays, beddingDays].every((v) => Number.isInteger(v) && v >= 0) || !/^\d{2}:\d{2}$/.test(form.check_in_time) || !/^\d{2}:\d{2}$/.test(form.check_out_time)) { setError(c.invalid); return }
    setSaving(true); setError(null); setNotice(null)
    const payload = { check_in_time: form.check_in_time, check_out_time: form.check_out_time, free_cancellation_days_before: freeDays, paid_cancellation_days_before: paidDays, towels_enabled: form.towels_enabled, towels_every_days: towelDays, towels_after_checkout: form.towels_after_checkout, bedding_enabled: form.bedding_enabled, bedding_every_days: beddingDays, bedding_after_checkout: form.bedding_after_checkout, cleaning_enabled: form.cleaning_enabled, updated_at: new Date().toISOString() }
    const { error: saveError } = settings ? await supabase.from("booking_settings").update(payload).eq("id", "default") : await supabase.from("booking_settings").insert({ id: "default", ...payload })
    if (saveError) setError(saveError.message)
    else { setNotice(c.saved); await load() }
    setSaving(false)
  }

  const toggle = (key: "towels_enabled" | "towels_after_checkout" | "bedding_enabled" | "bedding_after_checkout" | "cleaning_enabled") => setForm((current) => ({ ...current, [key]: !current[key] }))

  return <section className="min-h-screen bg-[#171512] text-[#e7e1d8]">
    <header className="min-h-[58px] bg-[#211e1a] px-4 py-3 md:px-5"><h1 className="text-base font-normal">{c.title}</h1><p className="text-xs text-[#b9b0a4]">{c.subtitle}</p></header>
    {error && <div className="bg-[#3a211d] px-4 py-2 text-xs text-[#e7a393]">{error}</div>}
    {notice && <div className="bg-[#253128] px-4 py-2 text-xs text-[#a8c2ad]">{notice}</div>}
    {!settings && !error ? <div className="px-5 py-10 text-sm text-[#8f867b]">{c.loading}</div> : <div className="max-w-4xl p-5">
      <Block title={c.stay}><div className="grid gap-px bg-[#39342d] sm:grid-cols-2"><TimeField label={c.checkIn} value={form.check_in_time} onChange={(value) => setForm({ ...form, check_in_time: value })} /><TimeField label={c.checkOut} value={form.check_out_time} onChange={(value) => setForm({ ...form, check_out_time: value })} /></div></Block>
      <Block title={c.cancellation}><div className="grid gap-px bg-[#39342d] sm:grid-cols-2"><NumberField label={c.free} value={form.free_cancellation_days_before} suffix={c.days} onChange={(value) => setForm({ ...form, free_cancellation_days_before: value })} /><NumberField label={c.paid} value={form.paid_cancellation_days_before} suffix={c.days} onChange={(value) => setForm({ ...form, paid_cancellation_days_before: value })} /></div></Block>
      <Block title={c.operations}><div className="divide-y divide-[#39342d] bg-[#211e1a]"><OperationRow label={c.towels} enabled={form.towels_enabled} every={form.towels_every_days} after={form.towels_after_checkout} onEnabled={() => toggle("towels_enabled")} onEvery={(value) => setForm({ ...form, towels_every_days: value })} onAfter={() => toggle("towels_after_checkout")} everyLabel={c.every} daysLabel={c.days} afterLabel={c.afterCheckout} /><OperationRow label={c.bedding} enabled={form.bedding_enabled} every={form.bedding_every_days} after={form.bedding_after_checkout} onEnabled={() => toggle("bedding_enabled")} onEvery={(value) => setForm({ ...form, bedding_every_days: value })} onAfter={() => toggle("bedding_after_checkout")} everyLabel={c.every} daysLabel={c.days} afterLabel={c.afterCheckout} /><div className="flex items-center justify-between px-4 py-3"><span className="text-xs">{c.cleaning}</span><button type="button" onClick={() => toggle("cleaning_enabled")} className={`h-7 min-w-16 px-2 text-[11px] ${form.cleaning_enabled ? "bg-[#6f8373] text-[#171512]" : "bg-[#2b2722] text-[#8f867b]"}`}>{form.cleaning_enabled ? "ON" : "OFF"}</button></div></div></Block>
      <button type="button" disabled={saving} onClick={() => void save()} className="h-9 bg-[#6f8373] px-4 text-xs font-medium text-[#171512] disabled:opacity-50">{c.save}</button>
    </div>}
  </section>
}

function Block({ title, children }: { title: string; children: React.ReactNode }) { return <div className="mb-5"><h2 className="mb-2 text-[11px] uppercase tracking-[0.08em] text-[#8f867b]">{title}</h2>{children}</div> }
function TimeField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) { return <label className="bg-[#211e1a] p-4"><span className="mb-2 block text-xs text-[#b9b0a4]">{label}</span><input type="time" value={value} onChange={(e) => onChange(e.target.value)} className="h-9 w-full bg-[#171512] px-3 text-sm outline-none focus:ring-1 focus:ring-[#6f8373]" /></label> }
function NumberField({ label, value, suffix, onChange }: { label: string; value: string; suffix: string; onChange: (value: string) => void }) { return <label className="bg-[#211e1a] p-4"><span className="mb-2 block text-xs text-[#b9b0a4]">{label}</span><div className="flex items-center gap-2"><input type="number" min="0" step="1" value={value} onChange={(e) => onChange(e.target.value)} className="h-9 w-24 bg-[#171512] px-3 text-sm outline-none focus:ring-1 focus:ring-[#6f8373]" /><span className="text-xs text-[#8f867b]">{suffix}</span></div></label> }
function OperationRow({ label, enabled, every, after, onEnabled, onEvery, onAfter, everyLabel, daysLabel, afterLabel }: { label: string; enabled: boolean; every: string; after: boolean; onEnabled: () => void; onEvery: (value: string) => void; onAfter: () => void; everyLabel: string; daysLabel: string; afterLabel: string }) { return <div className="grid items-center gap-3 px-4 py-3 sm:grid-cols-[150px_72px_1fr_160px]"><span className="text-xs">{label}</span><button type="button" onClick={onEnabled} className={`h-7 px-2 text-[11px] ${enabled ? "bg-[#6f8373] text-[#171512]" : "bg-[#2b2722] text-[#8f867b]"}`}>{enabled ? "ON" : "OFF"}</button><label className="flex items-center gap-2 text-[11px] text-[#8f867b]">{everyLabel}<input type="number" min="0" step="1" value={every} onChange={(e) => onEvery(e.target.value)} className="h-7 w-16 bg-[#171512] px-2 text-[#e7e1d8] outline-none" />{daysLabel}</label><button type="button" onClick={onAfter} className={`h-7 px-2 text-[11px] ${after ? "bg-[#2b2722] text-[#e7e1d8]" : "bg-[#171512] text-[#8f867b]"}`}>{afterLabel}: {after ? "ON" : "OFF"}</button></div> }
