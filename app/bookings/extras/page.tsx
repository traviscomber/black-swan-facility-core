"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { Plus, Search, Trash2 } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"

interface Extra {
  id: string
  name: string
  description: string | null
  unit: string
  price: number
  tax_rate: number
  is_active: boolean
}

const UNIT_LABELS: Record<string, string> = {
  unit: "Unidad",
  night: "Noche",
  person: "Persona",
  person_night: "Persona/noche",
  stay: "Estadía",
}

function formatClp(value: number) {
  return new Intl.NumberFormat("es-CL", { style: "currency", currency: "CLP", maximumFractionDigits: 0 }).format(value)
}

export default function BookingExtrasPage() {
  const supabase = useMemo(() => createClient(), [])
  const [extras, setExtras] = useState<Extra[]>([])
  const [search, setSearch] = useState("")
  const [status, setStatus] = useState("active")
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [form, setForm] = useState({ name: "", description: "", unit: "unit", price: "", tax_rate: "0" })

  const loadData = useCallback(async () => {
    setLoading(true)
    const { data, error: loadError } = await supabase
      .from("booking_extras")
      .select("id, name, description, unit, price, tax_rate, is_active")
      .order("name")

    if (loadError) setError(loadError.message)
    else {
      setError(null)
      setExtras((data ?? []) as Extra[])
    }
    setLoading(false)
  }, [supabase])

  useEffect(() => {
    loadData()
    const channel = supabase
      .channel("booking-extras-board")
      .on("postgres_changes", { event: "*", schema: "public", table: "booking_extras" }, loadData)
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [loadData, supabase])

  const visibleExtras = useMemo(() => {
    const term = search.trim().toLowerCase()
    return extras.filter((extra) => {
      const matchesSearch = !term || extra.name.toLowerCase().includes(term) || (extra.description ?? "").toLowerCase().includes(term)
      const matchesStatus = status === "all" || (status === "active" ? extra.is_active : !extra.is_active)
      return matchesSearch && matchesStatus
    })
  }, [extras, search, status])

  async function createExtra() {
    if (!form.name.trim() || Number(form.price) < 0) return
    setSaving(true)
    const { error: insertError } = await supabase.from("booking_extras").insert({
      name: form.name.trim(),
      description: form.description.trim() || null,
      unit: form.unit,
      price: Number(form.price),
      tax_rate: Number(form.tax_rate),
    })
    if (insertError) setError(insertError.message)
    else {
      setOpen(false)
      setForm({ name: "", description: "", unit: "unit", price: "", tax_rate: "0" })
      await loadData()
    }
    setSaving(false)
  }

  async function toggleExtra(extra: Extra) {
    const { error: updateError } = await supabase.from("booking_extras").update({ is_active: !extra.is_active }).eq("id", extra.id)
    if (updateError) setError(updateError.message)
    else await loadData()
  }

  async function deleteExtra(extra: Extra) {
    if (!window.confirm(`Eliminar ${extra.name}?`)) return
    const { error: deleteError } = await supabase.from("booking_extras").delete().eq("id", extra.id)
    if (deleteError) setError(deleteError.message)
    else await loadData()
  }

  const activeCount = extras.filter((extra) => extra.is_active).length
  const averagePrice = extras.length ? extras.reduce((sum, extra) => sum + Number(extra.price), 0) / extras.length : 0

  return (
    <div className="min-h-screen bg-background p-4 md:p-6">
      <div className="mx-auto max-w-7xl space-y-5">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Extras y servicios</h1>
            <p className="text-sm text-muted-foreground">Catálogo comercial para cargos adicionales en reservas.</p>
          </div>
          <Button onClick={() => setOpen(true)}><Plus className="mr-2 h-4 w-4" /> Nuevo extra</Button>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <Metric title="Extras activos" value={String(activeCount)} />
          <Metric title="Total catálogo" value={String(extras.length)} />
          <Metric title="Precio promedio" value={formatClp(averagePrice)} />
        </div>

        <Card>
          <CardContent className="flex flex-col gap-3 p-4 md:flex-row">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input value={search} onChange={(event) => setSearch(event.target.value)} className="pl-9" placeholder="Buscar extra o servicio" />
            </div>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger className="md:w-48"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="active">Activos</SelectItem>
                <SelectItem value="inactive">Inactivos</SelectItem>
                <SelectItem value="all">Todos</SelectItem>
              </SelectContent>
            </Select>
          </CardContent>
        </Card>

        {error && <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-600">{error}</div>}

        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="border-b text-left"><th className="p-4">Nombre</th><th className="p-4">Unidad</th><th className="p-4">Precio</th><th className="p-4">IVA</th><th className="p-4">Estado</th><th className="p-4 text-right">Acciones</th></tr></thead>
                <tbody>
                  {loading ? <tr><td colSpan={6} className="p-10 text-center text-muted-foreground">Cargando catálogo...</td></tr> : visibleExtras.length === 0 ? <tr><td colSpan={6} className="p-10 text-center text-muted-foreground">No hay extras para los filtros seleccionados.</td></tr> : visibleExtras.map((extra) => (
                    <tr key={extra.id} className="border-b last:border-0">
                      <td className="p-4"><div className="font-medium">{extra.name}</div><div className="text-xs text-muted-foreground">{extra.description || "Sin descripción"}</div></td>
                      <td className="p-4">{UNIT_LABELS[extra.unit] ?? extra.unit}</td>
                      <td className="p-4 font-medium">{formatClp(Number(extra.price))}</td>
                      <td className="p-4">{Number(extra.tax_rate)}%</td>
                      <td className="p-4"><Button size="sm" variant={extra.is_active ? "outline" : "secondary"} onClick={() => toggleExtra(extra)}>{extra.is_active ? "Activo" : "Inactivo"}</Button></td>
                      <td className="p-4 text-right"><Button size="icon" variant="ghost" onClick={() => deleteExtra(extra)}><Trash2 className="h-4 w-4" /></Button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Nuevo extra</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2"><Label>Nombre</Label><Input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /></div>
            <div className="space-y-2"><Label>Descripción</Label><Textarea value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} /></div>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-2"><Label>Unidad</Label><Select value={form.unit} onValueChange={(value) => setForm({ ...form, unit: value })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{Object.entries(UNIT_LABELS).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent></Select></div>
              <div className="space-y-2"><Label>Precio</Label><Input type="number" min="0" value={form.price} onChange={(event) => setForm({ ...form, price: event.target.value })} /></div>
              <div className="space-y-2"><Label>IVA %</Label><Input type="number" min="0" max="100" value={form.tax_rate} onChange={(event) => setForm({ ...form, tax_rate: event.target.value })} /></div>
            </div>
            <div className="flex justify-end gap-2"><Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button><Button disabled={saving || !form.name.trim() || form.price === ""} onClick={createExtra}>{saving ? "Guardando..." : "Crear extra"}</Button></div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function Metric({ title, value }: { title: string; value: string }) {
  return <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold">{value}</div></CardContent></Card>
}
