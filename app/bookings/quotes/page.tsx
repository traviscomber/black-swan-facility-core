"use client"

import { useEffect, useMemo, useState } from "react"
import { Calculator, Plus, Search, Trash2 } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

interface Extra {
  id: string
  name: string
  unit: string
  price: number
  tax_rate: number
}

interface SelectedExtra {
  extra_id: string
  quantity: number
}

interface NightlyRate {
  date: string
  season: string | null
  multiplier: number
  rate: number
}

interface QuoteOption {
  room_id: string
  room_number: string
  room_type: string
  location: string | null
  capacity: number
  nights: number
  base_rate: number
  required_min_stay: number
  nightly_rates: NightlyRate[]
  lodging_subtotal: number
  lodging_tax: number
  extras_subtotal: number
  extras_tax: number
  service_fee: number
  total: number
}

interface QuoteResponse {
  check_in: string
  check_out: string
  nights: number
  guests: number
  currency: string
  options: QuoteOption[]
}

function money(value: number, currency = "CLP") {
  return new Intl.NumberFormat("es-CL", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(value)
}

export default function BookingQuotesPage() {
  const supabase = useMemo(() => createClient(), [])
  const [extras, setExtras] = useState<Extra[]>([])
  const [selectedExtras, setSelectedExtras] = useState<SelectedExtra[]>([])
  const [selectedExtraId, setSelectedExtraId] = useState("")
  const [search, setSearch] = useState("")
  const [form, setForm] = useState({ check_in: "", check_out: "", guests: "1" })
  const [quote, setQuote] = useState<QuoteResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function loadExtras() {
      const { data, error: extrasError } = await supabase
        .from("booking_extras")
        .select("id, name, unit, price, tax_rate")
        .eq("is_active", true)
        .order("name")

      if (extrasError) setError(extrasError.message)
      else setExtras((data ?? []) as Extra[])
    }

    loadExtras()
  }, [supabase])

  const filteredOptions = useMemo(() => {
    const term = search.trim().toLowerCase()
    return (quote?.options ?? []).filter((option) => {
      const haystack = `${option.room_number} ${option.room_type} ${option.location ?? ""}`.toLowerCase()
      return !term || haystack.includes(term)
    })
  }, [quote, search])

  function addExtra() {
    if (!selectedExtraId || selectedExtras.some((item) => item.extra_id === selectedExtraId)) return
    setSelectedExtras([...selectedExtras, { extra_id: selectedExtraId, quantity: 1 }])
    setSelectedExtraId("")
  }

  function updateExtra(extraId: string, quantity: number) {
    setSelectedExtras((items) =>
      items.map((item) => (item.extra_id === extraId ? { ...item, quantity: Math.max(quantity, 0) } : item)),
    )
  }

  function removeExtra(extraId: string) {
    setSelectedExtras((items) => items.filter((item) => item.extra_id !== extraId))
  }

  async function calculate() {
    setError(null)
    setQuote(null)

    if (!form.check_in || !form.check_out || form.check_out <= form.check_in) {
      setError("Selecciona un rango de fechas válido.")
      return
    }

    setLoading(true)
    try {
      const response = await fetch("/api/bookings/quote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          check_in: form.check_in,
          check_out: form.check_out,
          guests: Number(form.guests),
          extras: selectedExtras,
        }),
      })
      const payload = await response.json()
      if (!response.ok) throw new Error(payload.error || "No se pudo calcular la cotización")
      setQuote(payload as QuoteResponse)
    } catch (quoteError) {
      setError(quoteError instanceof Error ? quoteError.message : "No se pudo calcular la cotización")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-background p-4 md:p-6">
      <div className="mx-auto max-w-7xl space-y-5">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Cotizador central</h1>
          <p className="text-sm text-muted-foreground">
            Disponibilidad, temporadas, estadía mínima, extras, impuestos y total final en una sola operación.
          </p>
        </div>

        <Card>
          <CardHeader><CardTitle>Parámetros</CardTitle></CardHeader>
          <CardContent className="space-y-5">
            <div className="grid gap-4 md:grid-cols-3">
              <Field label="Check-in"><Input type="date" value={form.check_in} onChange={(event) => setForm({ ...form, check_in: event.target.value })} /></Field>
              <Field label="Check-out"><Input type="date" value={form.check_out} onChange={(event) => setForm({ ...form, check_out: event.target.value })} /></Field>
              <Field label="Huéspedes"><Input type="number" min="1" value={form.guests} onChange={(event) => setForm({ ...form, guests: event.target.value })} /></Field>
            </div>

            <div className="space-y-3">
              <Label>Extras</Label>
              <div className="flex gap-2">
                <Select value={selectedExtraId} onValueChange={setSelectedExtraId}>
                  <SelectTrigger className="max-w-md"><SelectValue placeholder="Seleccionar extra" /></SelectTrigger>
                  <SelectContent>{extras.map((extra) => <SelectItem key={extra.id} value={extra.id}>{extra.name} · {money(Number(extra.price))}</SelectItem>)}</SelectContent>
                </Select>
                <Button type="button" variant="outline" onClick={addExtra} disabled={!selectedExtraId}><Plus className="mr-2 h-4 w-4" />Agregar</Button>
              </div>

              {selectedExtras.length > 0 && (
                <div className="space-y-2">
                  {selectedExtras.map((item) => {
                    const extra = extras.find((candidate) => candidate.id === item.extra_id)
                    if (!extra) return null
                    return (
                      <div key={item.extra_id} className="flex items-center gap-3 rounded-lg border p-3">
                        <div className="flex-1"><div className="font-medium">{extra.name}</div><div className="text-xs text-muted-foreground">{extra.unit} · IVA {Number(extra.tax_rate)}%</div></div>
                        <Input className="w-28" type="number" min="0" step="1" value={item.quantity} onChange={(event) => updateExtra(item.extra_id, Number(event.target.value))} />
                        <Button size="icon" variant="ghost" onClick={() => removeExtra(item.extra_id)}><Trash2 className="h-4 w-4" /></Button>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            <Button onClick={calculate} disabled={loading}><Calculator className="mr-2 h-4 w-4" />{loading ? "Calculando..." : "Calcular cotización"}</Button>
          </CardContent>
        </Card>

        {error && <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-600">{error}</div>}

        {quote && (
          <div className="space-y-4">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <h2 className="text-xl font-semibold">Opciones disponibles</h2>
                <p className="text-sm text-muted-foreground">{quote.nights} noche(s) · {quote.guests} huésped(es) · {quote.options.length} alternativa(s)</p>
              </div>
              <div className="relative w-full md:w-80"><Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" /><Input className="pl-9" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar habitación o ubicación" /></div>
            </div>

            {filteredOptions.length === 0 ? (
              <Card><CardContent className="p-10 text-center text-muted-foreground">No hay habitaciones disponibles que cumplan capacidad, bloqueos, reservas y estadía mínima.</CardContent></Card>
            ) : (
              <div className="grid gap-4 lg:grid-cols-2">
                {filteredOptions.map((option) => (
                  <Card key={option.room_id}>
                    <CardHeader>
                      <CardTitle className="flex items-center justify-between gap-3"><span>Hab. {option.room_number} · {option.room_type}</span><span>{money(Number(option.total), quote.currency)}</span></CardTitle>
                      <p className="text-sm text-muted-foreground">{option.location || "Sin ubicación"} · capacidad {option.capacity}</p>
                    </CardHeader>
                    <CardContent className="space-y-4 text-sm">
                      <div className="grid grid-cols-2 gap-3">
                        <Metric label="Alojamiento" value={money(Number(option.lodging_subtotal), quote.currency)} />
                        <Metric label="Impuesto alojamiento" value={money(Number(option.lodging_tax), quote.currency)} />
                        <Metric label="Extras" value={money(Number(option.extras_subtotal), quote.currency)} />
                        <Metric label="Impuestos extras" value={money(Number(option.extras_tax), quote.currency)} />
                      </div>
                      <div className="rounded-lg border p-3">
                        <div className="mb-2 font-medium">Detalle por noche</div>
                        <div className="space-y-1 text-xs text-muted-foreground">
                          {option.nightly_rates.map((night) => <div key={night.date} className="flex justify-between"><span>{night.date}{night.season ? ` · ${night.season}` : ""}</span><span>{money(Number(night.rate), quote.currency)}</span></div>)}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="space-y-2"><Label>{label}</Label>{children}</div>
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div className="rounded-lg border p-3"><div className="text-xs text-muted-foreground">{label}</div><div className="font-semibold">{value}</div></div>
}
