"use client"

import type React from "react"
import { useCallback, useEffect, useMemo, useState } from "react"
import { useSearchParams } from "next/navigation"
import { Percent, Plus, Search, Trash2 } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useLanguage } from "@/lib/hooks/use-language"
import { ratesCopy } from "@/lib/translations/rates"
import { bookingDateKey } from "@/lib/booking/timezone"

interface Room { id: string; room_number: string; location: string | null; rate_per_night: number | null }
interface Rule { id: string; room_id: string | null; season_name: string | null; start_date: string; end_date: string; rate_multiplier: number | null; min_stay: number | null; room?: Room | null }
interface PricingPolicy {
  weekend?: { enabled?: boolean; days?: number[]; multiplier?: number }
  occupancy?: { enabled?: boolean; threshold_pct?: number; multiplier?: number }
  short_stay?: { enabled?: boolean; max_nights?: number; multiplier?: number }
  long_stay?: { enabled?: boolean; min_nights?: number; multiplier?: number }
  children?: { enabled?: boolean; bands?: Array<{ min_age?: number; max_age?: number; price_per_night?: number }> }
}
interface BookingSettings { id: string; currency: string; lodging_tax_rate: number; service_fee: number; pricing_policy?: PricingPolicy | null }

const configurationCopy = {
  en: {
    title: "Price configuration",
    subtitle: "Canonical defaults used by the booking quote engine.",
    currency: "Currency",
    lodgingTax: "Lodging tax",
    serviceFee: "Service fee",
    roomBaseRates: "Room base rates",
    roomBaseRatesHelp: "Base nightly rates used before seasonal multipliers.",
    saveDefaults: "Save defaults",
    saveRoom: "Save",
    saved: "Price configuration saved.",
    roomSaved: "Room base rate saved.",
    invalid: "Use a non-negative tax, service fee and room rate.",
    noRooms: "No rooms configured.",
    currentModel: "Quote model",
    currentModelDetail: "Base room rate × seasonal multiplier × optional weekend / occupancy / stay-length rules, plus child supplements, tax, extras and service fee.",
    advanced: "Advanced pricing",
    weekend: "Weekend pricing",
    occupancy: "Occupancy pricing",
    shortStay: "Short-stay pricing",
    longStay: "Long-stay pricing",
    children: "Children pricing",
    enabled: "Enabled",
    multiplier: "Multiplier",
    threshold: "Occupancy threshold %",
    maxNights: "Max nights",
    minNights: "Min nights",
    child03: "Child 0–3 / night",
    child410: "Child 4–10 / night",
  },
  es: {
    title: "Configuración de precios",
    subtitle: "Valores canónicos usados por el motor de cotización de reservas.",
    currency: "Moneda",
    lodgingTax: "Impuesto de alojamiento",
    serviceFee: "Cargo de servicio",
    roomBaseRates: "Tarifas base por habitación",
    roomBaseRatesHelp: "Tarifa nocturna base antes de aplicar multiplicadores de temporada.",
    saveDefaults: "Guardar valores",
    saveRoom: "Guardar",
    saved: "Configuración de precios guardada.",
    roomSaved: "Tarifa base de habitación guardada.",
    invalid: "Usa impuesto, cargo de servicio y tarifa de habitación no negativos.",
    noRooms: "No hay habitaciones configuradas.",
    currentModel: "Modelo de cotización",
    currentModelDetail: "Tarifa base × temporada × reglas opcionales de fin de semana / ocupación / duración, más suplementos infantiles, impuesto, extras y cargo de servicio.",
    advanced: "Pricing avanzado",
    weekend: "Precio fin de semana",
    occupancy: "Precio por ocupación",
    shortStay: "Precio estadía corta",
    longStay: "Precio estadía larga",
    children: "Precio infantil",
    enabled: "Activo",
    multiplier: "Multiplicador",
    threshold: "Umbral ocupación %",
    maxNights: "Máx. noches",
    minNights: "Mín. noches",
    child03: "Niño 0–3 / noche",
    child410: "Niño 4–10 / noche",
  },
  de: {
    title: "Preiskonfiguration",
    subtitle: "Kanonische Standardwerte für die Buchungskalkulation.",
    currency: "Währung",
    lodgingTax: "Unterkunftssteuer",
    serviceFee: "Servicegebühr",
    roomBaseRates: "Basispreise pro Zimmer",
    roomBaseRatesHelp: "Nächtliche Basispreise vor saisonalen Multiplikatoren.",
    saveDefaults: "Standardwerte speichern",
    saveRoom: "Speichern",
    saved: "Preiskonfiguration gespeichert.",
    roomSaved: "Zimmerbasispreis gespeichert.",
    invalid: "Steuer, Servicegebühr und Zimmerpreis müssen nicht negativ sein.",
    noRooms: "Keine Zimmer konfiguriert.",
    currentModel: "Preismodell",
    currentModelDetail: "Basispreis × Saison × optionale Wochenend-, Belegungs- und Aufenthaltsregeln plus Kinderzuschläge, Steuer, Extras und Servicegebühr.",
    advanced: "Erweiterte Preisregeln",
    weekend: "Wochenendpreis",
    occupancy: "Belegungspreis",
    shortStay: "Kurzaufenthalt",
    longStay: "Langaufenthalt",
    children: "Kinderpreis",
    enabled: "Aktiv",
    multiplier: "Multiplikator",
    threshold: "Belegungsschwelle %",
    maxNights: "Max. Nächte",
    minNights: "Min. Nächte",
    child03: "Kind 0–3 / Nacht",
    child410: "Kind 4–10 / Nacht",
  },
} as const

function money(value: number, currency = "CLP") {
  return new Intl.NumberFormat("es-CL", { style: "currency", currency, maximumFractionDigits: 0 }).format(value)
}

export default function RatesPage() {
  const supabase = useMemo(() => createClient(), [])
  const searchParams = useSearchParams()
  const { language } = useLanguage()
  const copy = ratesCopy[language]
  const configCopy = configurationCopy[language]
  const configurationView = searchParams.get("view") === "configuration"

  const [rooms, setRooms] = useState<Room[]>([])
  const [rules, setRules] = useState<Rule[]>([])
  const [settings, setSettings] = useState<BookingSettings | null>(null)
  const [settingsForm, setSettingsForm] = useState({ currency: "CLP", lodging_tax_rate: "0", service_fee: "0" })
  const [policyForm, setPolicyForm] = useState({
    weekend_enabled: false, weekend_multiplier: "1",
    occupancy_enabled: false, occupancy_threshold: "80", occupancy_multiplier: "1",
    short_enabled: false, short_max_nights: "2", short_multiplier: "1",
    long_enabled: false, long_min_nights: "7", long_multiplier: "1",
    children_enabled: false, child_0_3_price: "0", child_4_10_price: "0",
  })
  const [roomRates, setRoomRates] = useState<Record<string, string>>({})
  const [search, setSearch] = useState("")
  const [roomFilter, setRoomFilter] = useState("all")
  const [open, setOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [savingRoomId, setSavingRoomId] = useState<string | null>(null)
  const [form, setForm] = useState({ room_id: "all", season_name: "", start_date: "", end_date: "", rate_multiplier: "1", min_stay: "1" })

  const load = useCallback(async () => {
    const [roomsResult, rulesResult, settingsResult] = await Promise.all([
      supabase.from("rooms").select("id, room_number, location, rate_per_night").order("room_number"),
      supabase.from("pricing_rules").select("id, room_id, season_name, start_date, end_date, rate_multiplier, min_stay, room:rooms(id, room_number, location, rate_per_night)").order("start_date"),
      supabase.from("booking_settings").select("id, currency, lodging_tax_rate, service_fee, pricing_policy").eq("id", "default").maybeSingle(),
    ])
    const firstError = roomsResult.error || rulesResult.error || settingsResult.error
    if (firstError) {
      setError(firstError.message)
      return
    }

    const loadedRooms = (roomsResult.data ?? []) as Room[]
    const loadedSettings = settingsResult.data as BookingSettings | null
    setError(null)
    setRooms(loadedRooms)
    setRules((rulesResult.data ?? []) as unknown as Rule[])
    setSettings(loadedSettings)
    setRoomRates(Object.fromEntries(loadedRooms.map((room) => [room.id, String(Number(room.rate_per_night ?? 0))])))
    if (loadedSettings) {
      setSettingsForm({
        currency: loadedSettings.currency || "CLP",
        lodging_tax_rate: String(Number(loadedSettings.lodging_tax_rate ?? 0)),
        service_fee: String(Number(loadedSettings.service_fee ?? 0)),
      })
      const policy = loadedSettings.pricing_policy ?? {}
      const bands = policy.children?.bands ?? []
      setPolicyForm({
        weekend_enabled: Boolean(policy.weekend?.enabled),
        weekend_multiplier: String(Number(policy.weekend?.multiplier ?? 1)),
        occupancy_enabled: Boolean(policy.occupancy?.enabled),
        occupancy_threshold: String(Number(policy.occupancy?.threshold_pct ?? 80)),
        occupancy_multiplier: String(Number(policy.occupancy?.multiplier ?? 1)),
        short_enabled: Boolean(policy.short_stay?.enabled),
        short_max_nights: String(Number(policy.short_stay?.max_nights ?? 2)),
        short_multiplier: String(Number(policy.short_stay?.multiplier ?? 1)),
        long_enabled: Boolean(policy.long_stay?.enabled),
        long_min_nights: String(Number(policy.long_stay?.min_nights ?? 7)),
        long_multiplier: String(Number(policy.long_stay?.multiplier ?? 1)),
        children_enabled: Boolean(policy.children?.enabled),
        child_0_3_price: String(Number(bands[0]?.price_per_night ?? 0)),
        child_4_10_price: String(Number(bands[1]?.price_per_night ?? 0)),
      })
    }
  }, [supabase])

  useEffect(() => {
    void load()
    const channel = supabase
      .channel("booking-price-configuration")
      .on("postgres_changes", { event: "*", schema: "public", table: "pricing_rules" }, () => void load())
      .on("postgres_changes", { event: "*", schema: "public", table: "booking_settings" }, () => void load())
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "rooms" }, () => void load())
      .subscribe()
    return () => { void supabase.removeChannel(channel) }
  }, [load, supabase])

  const visible = useMemo(() => {
    const term = search.trim().toLowerCase()
    return rules.filter((rule) => {
      const matchesRoom = roomFilter === "all" || rule.room_id === roomFilter
      const haystack = `${rule.season_name ?? ""} ${rule.room?.room_number ?? copy.all} ${rule.room?.location ?? ""}`.toLowerCase()
      return matchesRoom && (!term || haystack.includes(term))
    })
  }, [copy.all, rules, roomFilter, search])

  const today = bookingDateKey()
  const activeNow = rules.filter((rule) => rule.start_date <= today && rule.end_date > today).length
  const avgMultiplier = rules.length ? rules.reduce((sum, rule) => sum + Number(rule.rate_multiplier ?? 1), 0) / rules.length : 1

  async function createRule() {
    if (!form.season_name || !form.start_date || !form.end_date || form.end_date <= form.start_date) { setError(copy.invalidRange); return }
    setSaving(true); setError(null); setNotice(null)
    const { error: insertError } = await supabase.from("pricing_rules").insert({ room_id: form.room_id === "all" ? null : form.room_id, season_name: form.season_name, start_date: form.start_date, end_date: form.end_date, rate_multiplier: Number(form.rate_multiplier), min_stay: Number(form.min_stay) })
    if (insertError) setError(insertError.message)
    else { setOpen(false); setForm({ room_id: "all", season_name: "", start_date: "", end_date: "", rate_multiplier: "1", min_stay: "1" }); await load() }
    setSaving(false)
  }

  async function removeRule(id: string) {
    const { error: deleteError } = await supabase.from("pricing_rules").delete().eq("id", id)
    if (deleteError) setError(deleteError.message)
    else await load()
  }

  async function saveSettings() {
    const lodgingTax = Number(settingsForm.lodging_tax_rate)
    const serviceFee = Number(settingsForm.service_fee)
    const weekendMultiplier = Number(policyForm.weekend_multiplier)
    const occupancyThreshold = Number(policyForm.occupancy_threshold)
    const occupancyMultiplier = Number(policyForm.occupancy_multiplier)
    const shortMax = Number(policyForm.short_max_nights)
    const shortMultiplier = Number(policyForm.short_multiplier)
    const longMin = Number(policyForm.long_min_nights)
    const longMultiplier = Number(policyForm.long_multiplier)
    const child03 = Number(policyForm.child_0_3_price)
    const child410 = Number(policyForm.child_4_10_price)
    const numericValues = [lodgingTax, serviceFee, weekendMultiplier, occupancyThreshold, occupancyMultiplier, shortMax, shortMultiplier, longMin, longMultiplier, child03, child410]
    if (!settingsForm.currency.trim() || numericValues.some((value) => !Number.isFinite(value) || value < 0) || lodgingTax > 100 || occupancyThreshold > 100 || !Number.isInteger(shortMax) || !Number.isInteger(longMin)) {
      setError(configCopy.invalid)
      return
    }
    setSaving(true); setError(null); setNotice(null)
    const pricing_policy: PricingPolicy = {
      weekend: { enabled: policyForm.weekend_enabled, days: [6, 7], multiplier: weekendMultiplier },
      occupancy: { enabled: policyForm.occupancy_enabled, threshold_pct: occupancyThreshold, multiplier: occupancyMultiplier },
      short_stay: { enabled: policyForm.short_enabled, max_nights: shortMax, multiplier: shortMultiplier },
      long_stay: { enabled: policyForm.long_enabled, min_nights: longMin, multiplier: longMultiplier },
      children: { enabled: policyForm.children_enabled, bands: [
        { min_age: 0, max_age: 3, price_per_night: child03 },
        { min_age: 4, max_age: 10, price_per_night: child410 },
      ] },
    }
    const payload = { id: "default", currency: settingsForm.currency.trim().toUpperCase(), lodging_tax_rate: lodgingTax, service_fee: serviceFee, pricing_policy, updated_at: new Date().toISOString() }
    const { error: updateError } = settings
      ? await supabase.from("booking_settings").update(payload).eq("id", "default")
      : await supabase.from("booking_settings").insert(payload)
    if (updateError) setError(updateError.message)
    else { setNotice(configCopy.saved); await load() }
    setSaving(false)
  }

  async function saveRoomRate(room: Room) {
    const rate = Number(roomRates[room.id])
    if (!Number.isFinite(rate) || rate < 0) { setError(configCopy.invalid); return }
    setSavingRoomId(room.id); setError(null); setNotice(null)
    const { error: updateError } = await supabase.from("rooms").update({ rate_per_night: rate }).eq("id", room.id)
    if (updateError) setError(updateError.message)
    else { setNotice(configCopy.roomSaved); await load() }
    setSavingRoomId(null)
  }

  if (configurationView) {
    return (
      <section className="min-h-screen bg-[#171512] text-[#e7e1d8]">
        <header className="min-h-[58px] bg-[#211e1a] px-4 py-3 md:px-5">
          <h1 className="text-base font-normal tracking-tight">{configCopy.title}</h1>
          <p className="text-xs text-[#b9b0a4]">{configCopy.subtitle}</p>
        </header>

        {error && <div className="bg-[#3a211d] px-4 py-2 text-xs text-[#e7a393]">{error}</div>}
        {notice && <div className="bg-[#253128] px-4 py-2 text-xs text-[#a8c2ad]">{notice}</div>}

        <div className="grid gap-px bg-[#39342d] lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
          <div className="bg-[#211e1a] p-4 md:p-5">
            <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-1">
              <Field label={configCopy.currency}>
                <Input value={settingsForm.currency} maxLength={3} onChange={(event) => setSettingsForm({ ...settingsForm, currency: event.target.value.toUpperCase() })} className="rounded-none" />
              </Field>
              <Field label={`${configCopy.lodgingTax} %`}>
                <Input type="number" min="0" max="100" step="0.1" value={settingsForm.lodging_tax_rate} onChange={(event) => setSettingsForm({ ...settingsForm, lodging_tax_rate: event.target.value })} className="rounded-none" />
              </Field>
              <Field label={configCopy.serviceFee}>
                <Input type="number" min="0" step="1" value={settingsForm.service_fee} onChange={(event) => setSettingsForm({ ...settingsForm, service_fee: event.target.value })} className="rounded-none" />
              </Field>
            </div>
            <div className="mt-6">
              <div className="mb-2 text-[11px] uppercase tracking-[0.08em] text-[#8f867b]">{configCopy.advanced}</div>
              <div className="divide-y divide-[#39342d] bg-[#171512]">
                <PolicyRow label={configCopy.weekend} enabled={policyForm.weekend_enabled} onToggle={() => setPolicyForm((p) => ({ ...p, weekend_enabled: !p.weekend_enabled }))}>
                  <MiniNumber label={configCopy.multiplier} value={policyForm.weekend_multiplier} onChange={(value) => setPolicyForm((p) => ({ ...p, weekend_multiplier: value }))} step="0.01" />
                </PolicyRow>
                <PolicyRow label={configCopy.occupancy} enabled={policyForm.occupancy_enabled} onToggle={() => setPolicyForm((p) => ({ ...p, occupancy_enabled: !p.occupancy_enabled }))}>
                  <MiniNumber label={configCopy.threshold} value={policyForm.occupancy_threshold} onChange={(value) => setPolicyForm((p) => ({ ...p, occupancy_threshold: value }))} />
                  <MiniNumber label={configCopy.multiplier} value={policyForm.occupancy_multiplier} onChange={(value) => setPolicyForm((p) => ({ ...p, occupancy_multiplier: value }))} step="0.01" />
                </PolicyRow>
                <PolicyRow label={configCopy.shortStay} enabled={policyForm.short_enabled} onToggle={() => setPolicyForm((p) => ({ ...p, short_enabled: !p.short_enabled }))}>
                  <MiniNumber label={configCopy.maxNights} value={policyForm.short_max_nights} onChange={(value) => setPolicyForm((p) => ({ ...p, short_max_nights: value }))} />
                  <MiniNumber label={configCopy.multiplier} value={policyForm.short_multiplier} onChange={(value) => setPolicyForm((p) => ({ ...p, short_multiplier: value }))} step="0.01" />
                </PolicyRow>
                <PolicyRow label={configCopy.longStay} enabled={policyForm.long_enabled} onToggle={() => setPolicyForm((p) => ({ ...p, long_enabled: !p.long_enabled }))}>
                  <MiniNumber label={configCopy.minNights} value={policyForm.long_min_nights} onChange={(value) => setPolicyForm((p) => ({ ...p, long_min_nights: value }))} />
                  <MiniNumber label={configCopy.multiplier} value={policyForm.long_multiplier} onChange={(value) => setPolicyForm((p) => ({ ...p, long_multiplier: value }))} step="0.01" />
                </PolicyRow>
                <PolicyRow label={configCopy.children} enabled={policyForm.children_enabled} onToggle={() => setPolicyForm((p) => ({ ...p, children_enabled: !p.children_enabled }))}>
                  <MiniNumber label={configCopy.child03} value={policyForm.child_0_3_price} onChange={(value) => setPolicyForm((p) => ({ ...p, child_0_3_price: value }))} />
                  <MiniNumber label={configCopy.child410} value={policyForm.child_4_10_price} onChange={(value) => setPolicyForm((p) => ({ ...p, child_4_10_price: value }))} />
                </PolicyRow>
              </div>
            </div>

            <Button onClick={() => void saveSettings()} disabled={saving} className="mt-5 rounded-none">{configCopy.saveDefaults}</Button>

            <div className="mt-8 bg-[#2b2722] p-4">
              <div className="text-[11px] uppercase tracking-[0.08em] text-[#8f867b]">{configCopy.currentModel}</div>
              <p className="mt-2 text-xs leading-5 text-[#b9b0a4]">{configCopy.currentModelDetail}</p>
            </div>
          </div>

          <div className="bg-[#171512]">
            <div className="bg-[#211e1a] px-4 py-3 md:px-5">
              <h2 className="text-sm font-normal">{configCopy.roomBaseRates}</h2>
              <p className="text-[11px] text-[#8f867b]">{configCopy.roomBaseRatesHelp}</p>
            </div>
            <div className="divide-y divide-[#39342d]">
              {rooms.map((room) => (
                <div key={room.id} className="grid grid-cols-[minmax(0,1fr)_160px_80px] items-center gap-3 px-4 py-2.5 md:px-5">
                  <div className="min-w-0">
                    <div className="truncate text-xs font-medium">{copy.roomShort} {room.room_number}</div>
                    <div className="truncate text-[11px] text-[#8f867b]">{room.location || "—"}</div>
                  </div>
                  <Input type="number" min="0" step="1" value={roomRates[room.id] ?? "0"} onChange={(event) => setRoomRates((current) => ({ ...current, [room.id]: event.target.value }))} className="h-8 rounded-none text-xs" aria-label={`${configCopy.roomBaseRates} ${room.room_number}`} />
                  <button type="button" disabled={savingRoomId === room.id} onClick={() => void saveRoomRate(room)} className="h-8 bg-[#39342d] px-2 text-[11px] text-[#e7e1d8] disabled:opacity-50">{configCopy.saveRoom}</button>
                </div>
              ))}
              {rooms.length === 0 && <div className="px-4 py-10 text-center text-xs text-[#8f867b]">{configCopy.noRooms}</div>}
            </div>
          </div>
        </div>
      </section>
    )
  }

  return <section className="min-h-screen bg-[#171512] text-[#e7e1d8]">
    <header className="flex min-h-[58px] items-center justify-between gap-3 bg-[#211e1a] px-3"><div><h1 className="text-[15px] font-normal">{copy.title}</h1><p className="text-[11px] text-[#8f867b]">{rules.length} {copy.rules.toLowerCase()} · {activeNow} {copy.activeToday.toLowerCase()} · {avgMultiplier.toFixed(2)}×</p></div><button onClick={() => setOpen(true)} className="inline-flex h-9 items-center gap-2 bg-[#39342d] px-4 text-xs font-medium"><Plus className="h-4 w-4" />{copy.newRule}</button></header>
    <div className="flex min-h-[44px] gap-2 bg-[#211e1a] p-2"><div className="relative min-w-0 flex-1"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#8f867b]" /><input className="h-8 w-full bg-[#171512] pl-9 pr-3 text-xs outline-none placeholder:text-[#8f867b]" value={search} onChange={(e) => setSearch(e.target.value)} placeholder={copy.search} /></div><select value={roomFilter} onChange={(e) => setRoomFilter(e.target.value)} className="h-8 min-w-52 bg-[#171512] px-2 text-xs"><option value="all">{copy.allRooms}</option>{rooms.map((room) => <option key={room.id} value={room.id}>{copy.roomShort} {room.room_number}</option>)}</select></div>
    {error && <div className="bg-[#3a211d] px-4 py-2 text-xs text-[#e7a393]">{error}</div>}
    <div className="overflow-auto"><table className="w-full min-w-[960px] border-collapse text-xs"><thead className="sticky top-0 z-10 bg-[#211e1a] text-left text-[10px] uppercase tracking-[.08em] text-[#8f867b]"><tr><th className="px-4 py-3 font-medium">{copy.season}</th><th className="px-3 py-3 font-medium">{copy.room}</th><th className="px-3 py-3 font-medium">{copy.dates}</th><th className="px-3 py-3 font-medium">{copy.base}</th><th className="px-3 py-3 font-medium">{copy.multiplier}</th><th className="px-3 py-3 font-medium">{copy.effectivePrice}</th><th className="px-3 py-3 font-medium">{copy.minimum}</th><th className="px-4 py-3"></th></tr></thead><tbody>{visible.map((rule) => { const base = Number(rule.room?.rate_per_night ?? 0); return <tr key={rule.id} className="border-b border-[#39342d] hover:bg-[#211e1a]"><td className="px-4 py-3 font-medium">{rule.season_name || copy.unnamed}</td><td className="px-3 py-3 text-[#b9b0a4]">{rule.room ? `${copy.roomShort} ${rule.room.room_number}` : copy.all}</td><td className="px-3 py-3 tabular-nums text-[#8f867b]">{rule.start_date} → {rule.end_date}</td><td className="px-3 py-3 tabular-nums text-[#b9b0a4]">{rule.room ? money(base, settings?.currency || "CLP") : copy.byRoom}</td><td className="px-3 py-3"><span className="inline-flex items-center gap-1 text-[#b9b0a4]"><Percent className="h-3 w-3 text-[#8f867b]" />{Number(rule.rate_multiplier ?? 1).toFixed(2)}×</span></td><td className="px-3 py-3 tabular-nums">{rule.room ? money(base * Number(rule.rate_multiplier ?? 1), settings?.currency || "CLP") : copy.variable}</td><td className="px-3 py-3 text-[#b9b0a4]">{rule.min_stay ?? 1} {copy.nights}</td><td className="px-4 py-3 text-right"><button className="grid h-8 w-8 place-items-center text-[#c9897d] hover:bg-[#3a211d]" onClick={() => void removeRule(rule.id)} aria-label="Delete"><Trash2 className="h-3.5 w-3.5" /></button></td></tr> })}{visible.length === 0 && <tr><td colSpan={8} className="p-12 text-center text-[#8f867b]">{copy.noRules}</td></tr>}</tbody></table></div>

    <Dialog open={open} onOpenChange={setOpen}><DialogContent><DialogHeader><DialogTitle>{copy.newRateRule}</DialogTitle></DialogHeader><div className="grid gap-4 sm:grid-cols-2"><Field label={copy.season}><Input value={form.season_name} onChange={(e) => setForm({ ...form, season_name: e.target.value })} /></Field><Field label={copy.room}><Select value={form.room_id} onValueChange={(value) => setForm({ ...form, room_id: value })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">{copy.all}</SelectItem>{rooms.map((room) => <SelectItem key={room.id} value={room.id}>{copy.roomShort} {room.room_number}</SelectItem>)}</SelectContent></Select></Field><Field label={copy.start}><Input type="date" value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })} /></Field><Field label={copy.end}><Input type="date" value={form.end_date} onChange={(e) => setForm({ ...form, end_date: e.target.value })} /></Field><Field label={copy.multiplier}><Input type="number" min="0.1" step="0.05" value={form.rate_multiplier} onChange={(e) => setForm({ ...form, rate_multiplier: e.target.value })} /></Field><Field label={copy.minStay}><Input type="number" min="1" value={form.min_stay} onChange={(e) => setForm({ ...form, min_stay: e.target.value })} /></Field></div><DialogFooter><Button variant="outline" onClick={() => setOpen(false)}>{copy.cancel}</Button><Button onClick={createRule} disabled={saving}>{saving ? copy.saving : copy.create}</Button></DialogFooter></DialogContent></Dialog>
  </section>
}

function Field({ label, children }: { label: string; children: React.ReactNode }) { return <div className="space-y-2"><Label>{label}</Label>{children}</div> }

function PolicyRow({ label, enabled, onToggle, children }: { label: string; enabled: boolean; onToggle: () => void; children: React.ReactNode }) {
  return <div className="p-3"><div className="mb-2 flex items-center justify-between gap-3"><span className="text-xs font-medium">{label}</span><button type="button" onClick={onToggle} className={`h-7 min-w-16 px-2 text-[11px] ${enabled ? "bg-[#6f8373] text-[#171512]" : "bg-[#2b2722] text-[#8f867b]"}`}>{enabled ? "ON" : "OFF"}</button></div><div className="grid gap-2 sm:grid-cols-2">{children}</div></div>
}

function MiniNumber({ label, value, onChange, step = "1" }: { label: string; value: string; onChange: (value: string) => void; step?: string }) {
  return <label className="text-[11px] text-[#8f867b]"><span className="mb-1 block">{label}</span><input type="number" min="0" step={step} value={value} onChange={(event) => onChange(event.target.value)} className="h-8 w-full bg-[#211e1a] px-2 text-xs text-[#e7e1d8] outline-none focus:ring-1 focus:ring-[#6f8373]" /></label>
}
