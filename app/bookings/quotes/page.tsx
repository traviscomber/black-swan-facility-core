"use client"

import { useEffect, useMemo, useState } from "react"
import { Calculator, Plus, Search, Trash2 } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useLanguage } from "@/lib/hooks/use-language"
import { quoteCopy } from "@/lib/translations/quotes"

interface Extra { id: string; name: string; unit: string; price: number; tax_rate: number }
interface SelectedExtra { extra_id: string; quantity: number }
interface NightlyRate { date: string; season: string | null; multiplier: number; rate: number }
interface QuoteOption { room_id: string; room_number: string; room_type: string; location: string | null; capacity: number; nights: number; base_rate: number; required_min_stay: number; nightly_rates: NightlyRate[]; lodging_subtotal: number; child_supplement?: number; lodging_tax: number; extras_subtotal: number; extras_tax: number; service_fee: number; total: number }
interface QuoteResponse { check_in: string; check_out: string; nights: number; adults?: number; children_0_3?: number; children_4_10?: number; guests: number; currency: string; options: QuoteOption[] }

function money(value: number, currency = "CLP") { return new Intl.NumberFormat("es-CL", { style: "currency", currency, maximumFractionDigits: 0 }).format(value) }

export default function BookingQuotesPage() {
  const supabase = useMemo(() => createClient(), [])
  const { language } = useLanguage()
  const copy = quoteCopy[language]
  const [extras, setExtras] = useState<Extra[]>([])
  const [selectedExtras, setSelectedExtras] = useState<SelectedExtra[]>([])
  const [selectedExtraId, setSelectedExtraId] = useState("")
  const [search, setSearch] = useState("")
  const [form, setForm] = useState({ check_in: "", check_out: "", adults: "1", children_0_3: "0", children_4_10: "0" })
  const [quote, setQuote] = useState<QuoteResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => { async function loadExtras() { const { data, error: extrasError } = await supabase.from("booking_extras").select("id, name, unit, price, tax_rate").eq("is_active", true).order("name"); if (extrasError) setError(extrasError.message); else setExtras((data ?? []) as Extra[]) } void loadExtras() }, [supabase])

  const filteredOptions = useMemo(() => { const term = search.trim().toLowerCase(); return (quote?.options ?? []).filter((option) => !term || `${option.room_number} ${option.room_type} ${option.location ?? ""}`.toLowerCase().includes(term)) }, [quote, search])
  function addExtra() { if (!selectedExtraId || selectedExtras.some((item) => item.extra_id === selectedExtraId)) return; setSelectedExtras([...selectedExtras, { extra_id: selectedExtraId, quantity: 1 }]); setSelectedExtraId("") }
  function updateExtra(extraId: string, quantity: number) { setSelectedExtras((items) => items.map((item) => item.extra_id === extraId ? { ...item, quantity: Math.max(quantity, 0) } : item)) }
  function removeExtra(extraId: string) { setSelectedExtras((items) => items.filter((item) => item.extra_id !== extraId)) }

  async function calculate() {
    setError(null); setQuote(null)
    if (!form.check_in || !form.check_out || form.check_out <= form.check_in) return setError(copy.invalidRange)
    setLoading(true)
    try {
      const response = await fetch("/api/bookings/quote", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ check_in: form.check_in, check_out: form.check_out, adults: Number(form.adults), children_0_3: Number(form.children_0_3), children_4_10: Number(form.children_4_10), extras: selectedExtras }) })
      const payload = await response.json()
      if (!response.ok) throw new Error(payload.error || copy.calculateFailed)
      setQuote(payload as QuoteResponse)
    } catch (quoteError) { setError(quoteError instanceof Error ? quoteError.message : copy.calculateFailed) } finally { setLoading(false) }
  }

  return <section className="min-h-screen bg-[#171512] text-[#e7e1d8]"><header className="min-h-[58px] bg-[#211e1a] px-4 py-2 md:px-5"><h1 className="text-[15px] font-medium tracking-tight">{copy.title}</h1><p className="mt-0.5 text-[11px] text-[#8f867b]">{copy.subtitle}</p></header><div className="space-y-3 p-3">
    <Card className="rounded-none border-white/[0.06] bg-[#211e1a]"><CardHeader className="px-3 py-2"><CardTitle className="text-xs font-medium">{copy.parameters}</CardTitle></CardHeader><CardContent className="space-y-3 px-3 pb-3">
      <div className="grid gap-2 md:grid-cols-5"><Field label="Check-in"><Input type="date" value={form.check_in} onChange={(event) => setForm({ ...form, check_in: event.target.value })} /></Field><Field label="Check-out"><Input type="date" value={form.check_out} onChange={(event) => setForm({ ...form, check_out: event.target.value })} /></Field><Field label={copy.adults}><Input type="number" min="1" value={form.adults} onChange={(event) => setForm({ ...form, adults: event.target.value })} /></Field><Field label={copy.children03}><Input type="number" min="0" value={form.children_0_3} onChange={(event) => setForm({ ...form, children_0_3: event.target.value })} /></Field><Field label={copy.children410}><Input type="number" min="0" value={form.children_4_10} onChange={(event) => setForm({ ...form, children_4_10: event.target.value })} /></Field></div>
      <div className="space-y-2"><Label className="text-[11px] text-[#8f867b]">{copy.extras}</Label><div className="flex gap-2"><Select value={selectedExtraId} onValueChange={setSelectedExtraId}><SelectTrigger className="max-w-md"><SelectValue placeholder={copy.selectExtra} /></SelectTrigger><SelectContent>{extras.map((extra) => <SelectItem key={extra.id} value={extra.id}>{extra.name} · {money(Number(extra.price))}</SelectItem>)}</SelectContent></Select><Button type="button" variant="outline" onClick={addExtra} disabled={!selectedExtraId}><Plus className="mr-2 h-4 w-4" />{copy.add}</Button></div>
      {selectedExtras.length > 0 && <div className="space-y-2">{selectedExtras.map((item) => { const extra = extras.find((candidate) => candidate.id === item.extra_id); if (!extra) return null; return <div key={item.extra_id} className="flex items-center gap-3 border border-white/[0.06] bg-[#171512] p-2.5"><div className="flex-1"><div className="font-medium">{extra.name}</div><div className="text-xs text-muted-foreground">{extra.unit} · {copy.tax} {Number(extra.tax_rate)}%</div></div><Input className="w-28" type="number" min="0" step="1" value={item.quantity} onChange={(event) => updateExtra(item.extra_id, Number(event.target.value))} /><Button size="icon" variant="ghost" onClick={() => removeExtra(item.extra_id)}><Trash2 className="h-4 w-4" /></Button></div> })}</div>}</div>
      <Button onClick={calculate} disabled={loading}><Calculator className="mr-2 h-4 w-4" />{loading ? copy.calculating : copy.calculate}</Button>
    </CardContent></Card>
    {error && <div className="border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs text-red-300">{error}</div>}
    {quote && <div className="space-y-3"><div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between"><div><h2 className="text-sm font-medium">{copy.availableOptions}</h2><p className="text-sm text-muted-foreground">{quote.nights} {copy.nights} · {quote.guests} {copy.guestCount} · {quote.options.length} {copy.alternatives}</p></div><div className="relative w-full md:w-80"><Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" /><Input className="pl-9" value={search} onChange={(event) => setSearch(event.target.value)} placeholder={copy.search} /></div></div>
      {filteredOptions.length === 0 ? <Card><CardContent className="p-10 text-center text-muted-foreground">{copy.noOptions}</CardContent></Card> : <div className="grid gap-2 lg:grid-cols-2">{filteredOptions.map((option) => <Card key={option.room_id} className="rounded-none border-white/[0.06] bg-[#211e1a]"><CardHeader><CardTitle className="flex items-center justify-between gap-3"><span>{copy.room} {option.room_number} · {option.room_type}</span><span>{money(Number(option.total), quote.currency)}</span></CardTitle><p className="text-sm text-muted-foreground">{option.location || copy.noLocation} · {copy.capacity} {option.capacity}</p></CardHeader><CardContent className="space-y-4 text-sm"><div className="grid grid-cols-2 gap-3"><Metric label={copy.lodging} value={money(Number(option.lodging_subtotal), quote.currency)} /><Metric label={copy.children03} value={money(Number(option.child_supplement ?? 0), quote.currency)} /><Metric label={copy.lodgingTax} value={money(Number(option.lodging_tax), quote.currency)} /><Metric label={copy.extras} value={money(Number(option.extras_subtotal), quote.currency)} /><Metric label={copy.extrasTax} value={money(Number(option.extras_tax), quote.currency)} /></div><div className="border border-white/[0.06] bg-[#171512] p-2.5"><div className="mb-2 font-medium">{copy.nightlyDetail}</div><div className="space-y-1 text-xs text-muted-foreground">{option.nightly_rates.map((night) => <div key={night.date} className="flex justify-between"><span>{night.date}{night.season ? ` · ${night.season}` : ""}</span><span>{money(Number(night.rate), quote.currency)}</span></div>)}</div></div></CardContent></Card>)}</div>}
    </div>}
  </div></section>
}

function Field({ label, children }: { label: string; children: React.ReactNode }) { return <div className="space-y-2"><Label>{label}</Label>{children}</div> }
function Metric({ label, value }: { label: string; value: string }) { return <div className="border border-white/[0.06] bg-[#171512] p-2.5"><div className="text-xs text-muted-foreground">{label}</div><div className="font-semibold">{value}</div></div> }
