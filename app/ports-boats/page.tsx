"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { Anchor, Loader2, MapPin, Pencil, Plus, Ship, Trash2, Wrench } from "lucide-react"
import { AppLayout } from "@/components/app-layout"
import { PageHeader } from "@/components/page-header"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { createClient } from "@/lib/supabase/client"
import { useToast } from "@/hooks/use-toast"

type PortBoatType = "port" | "boat"
type PortBoatStatus = "operational" | "maintenance" | "inactive"

type PortBoat = {
  id: string
  name: string
  type: PortBoatType
  location: string
  capacity: string | null
  status: PortBoatStatus
  description: string | null
  last_maintenance: string | null
  created_at: string | null
  updated_at: string | null
}

type PortBoatForm = {
  name: string
  type: PortBoatType
  location: string
  capacity: string
  status: PortBoatStatus
  description: string
  last_maintenance: string
}

const EMPTY_FORM: PortBoatForm = {
  name: "",
  type: "boat",
  location: "",
  capacity: "",
  status: "operational",
  description: "",
  last_maintenance: "",
}

const STATUS_LABEL: Record<PortBoatStatus, string> = {
  operational: "Operativo",
  maintenance: "Mantenimiento",
  inactive: "Inactivo",
}

const STATUS_CLASS: Record<PortBoatStatus, string> = {
  operational: "border-emerald-500/30 bg-emerald-500/10 text-emerald-700",
  maintenance: "border-amber-500/30 bg-amber-500/10 text-amber-700",
  inactive: "border-slate-500/30 bg-slate-500/10 text-slate-600",
}

export default function PortsBoatsPage() {
  const supabase = useMemo(() => createClient(), [])
  const { toast } = useToast()
  const [items, setItems] = useState<PortBoat[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [filter, setFilter] = useState<"all" | PortBoatType>("all")
  const [form, setForm] = useState<PortBoatForm>(EMPTY_FORM)

  const load = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from("ports_boats")
      .select("id,name,type,location,capacity,status,description,last_maintenance,created_at,updated_at")
      .order("type")
      .order("name")

    if (error) {
      toast({ title: "No fue posible cargar puertos y embarcaciones", description: error.message, variant: "destructive" })
      setItems([])
    } else {
      const normalized = (data ?? []).flatMap((row) => {
        if ((row.type !== "port" && row.type !== "boat") || !["operational", "maintenance", "inactive"].includes(row.status)) return []
        return [{
          id: row.id,
          name: row.name,
          type: row.type as PortBoatType,
          location: row.location,
          capacity: row.capacity,
          status: row.status as PortBoatStatus,
          description: row.description,
          last_maintenance: row.last_maintenance,
          created_at: row.created_at,
          updated_at: row.updated_at,
        } satisfies PortBoat]
      })
      setItems(normalized)
    }
    setLoading(false)
  }, [supabase, toast])

  useEffect(() => { void load() }, [load])

  const visibleItems = useMemo(() => filter === "all" ? items : items.filter((item) => item.type === filter), [filter, items])
  const metrics = useMemo(() => ({
    ports: items.filter((item) => item.type === "port").length,
    boats: items.filter((item) => item.type === "boat").length,
    operational: items.filter((item) => item.status === "operational").length,
    maintenance: items.filter((item) => item.status === "maintenance").length,
  }), [items])

  const openNew = () => {
    setEditingId(null)
    setForm(EMPTY_FORM)
    setDialogOpen(true)
  }

  const openEdit = (item: PortBoat) => {
    setEditingId(item.id)
    setForm({
      name: item.name,
      type: item.type,
      location: item.location,
      capacity: item.capacity ?? "",
      status: item.status,
      description: item.description ?? "",
      last_maintenance: item.last_maintenance ?? "",
    })
    setDialogOpen(true)
  }

  async function save() {
    if (!form.name.trim() || !form.location.trim() || saving) return
    setSaving(true)
    const payload = {
      name: form.name.trim(),
      type: form.type,
      location: form.location.trim(),
      capacity: form.capacity.trim() || null,
      status: form.status,
      description: form.description.trim() || null,
      last_maintenance: form.last_maintenance.trim() || null,
      updated_at: new Date().toISOString(),
    }

    const result = editingId
      ? await supabase.from("ports_boats").update(payload).eq("id", editingId)
      : await supabase.from("ports_boats").insert(payload)

    setSaving(false)
    if (result.error) {
      toast({ title: editingId ? "No fue posible actualizar" : "No fue posible crear", description: result.error.message, variant: "destructive" })
      return
    }
    toast({ title: editingId ? "Registro actualizado" : "Registro creado" })
    setDialogOpen(false)
    await load()
  }

  async function remove(item: PortBoat) {
    if (!window.confirm(`Eliminar ${item.type === "port" ? "el puerto" : "la embarcación"} “${item.name}”?`)) return
    const { error } = await supabase.from("ports_boats").delete().eq("id", item.id)
    if (error) return toast({ title: "No fue posible eliminar", description: error.message, variant: "destructive" })
    toast({ title: "Registro eliminado" })
    await load()
  }

  return (
    <AppLayout>
      <PageHeader
        title="Puertos y embarcaciones"
        description="Inventario operativo real de muelles, puertos y flota vinculada al Fundo Corcovado."
        icon={Anchor}
        actions={<Button onClick={openNew}><Plus className="mr-2 h-4 w-4" />Nuevo registro</Button>}
      />

      <div className="space-y-5 p-4 md:p-8">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Metric icon={Anchor} label="Puertos" value={metrics.ports} />
          <Metric icon={Ship} label="Embarcaciones" value={metrics.boats} />
          <Metric icon={MapPin} label="Operativos" value={metrics.operational} />
          <Metric icon={Wrench} label="En mantenimiento" value={metrics.maintenance} />
        </div>

        <Card>
          <CardHeader className="gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <CardTitle className="text-base">Activos marítimos</CardTitle>
              <p className="mt-1 text-sm text-muted-foreground">{visibleItems.length} registros visibles · datos persistidos en `ports_boats`.</p>
            </div>
            <Select value={filter} onValueChange={(value: "all" | PortBoatType) => setFilter(value)}>
              <SelectTrigger className="w-full md:w-48"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="port">Puertos</SelectItem>
                <SelectItem value="boat">Embarcaciones</SelectItem>
              </SelectContent>
            </Select>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex min-h-48 items-center justify-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Cargando inventario marítimo…</div>
            ) : visibleItems.length === 0 ? (
              <div className="min-h-48 place-content-center text-center text-sm text-muted-foreground">No hay registros para este filtro.</div>
            ) : (
              <div className="grid gap-3 lg:grid-cols-2">
                {visibleItems.map((item) => {
                  const Icon = item.type === "port" ? Anchor : Ship
                  return (
                    <article key={item.id} className="rounded-lg border bg-card p-4 shadow-sm">
                      <div className="flex items-start gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary"><Icon className="h-5 w-5" /></div>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="truncate font-semibold">{item.name}</h3>
                            <Badge variant="outline" className={STATUS_CLASS[item.status]}>{STATUS_LABEL[item.status]}</Badge>
                          </div>
                          <p className="mt-1 flex items-center gap-1 text-sm text-muted-foreground"><MapPin className="h-3.5 w-3.5" />{item.location}</p>
                          {item.capacity && <p className="mt-2 text-xs text-muted-foreground">Capacidad / dimensión: <span className="text-foreground">{item.capacity}</span></p>}
                          {item.description && <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">{item.description}</p>}
                          {item.last_maintenance && <p className="mt-2 text-xs text-muted-foreground">Último mantenimiento: {item.last_maintenance}</p>}
                        </div>
                        <div className="flex shrink-0 gap-1">
                          <Button variant="ghost" size="icon" onClick={() => openEdit(item)} aria-label={`Editar ${item.name}`}><Pencil className="h-4 w-4" /></Button>
                          <Button variant="ghost" size="icon" onClick={() => void remove(item)} aria-label={`Eliminar ${item.name}`}><Trash2 className="h-4 w-4" /></Button>
                        </div>
                      </div>
                    </article>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={dialogOpen} onOpenChange={(open) => !saving && setDialogOpen(open)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingId ? "Editar registro" : "Nuevo puerto o embarcación"}</DialogTitle>
            <DialogDescription>Los campos se guardan directamente en el inventario marítimo canónico.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2"><Label>Tipo</Label><Select value={form.type} onValueChange={(value: PortBoatType) => setForm((current) => ({ ...current, type: value }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="port">Puerto</SelectItem><SelectItem value="boat">Embarcación</SelectItem></SelectContent></Select></div>
            <div className="space-y-2"><Label>Estado</Label><Select value={form.status} onValueChange={(value: PortBoatStatus) => setForm((current) => ({ ...current, status: value }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="operational">Operativo</SelectItem><SelectItem value="maintenance">Mantenimiento</SelectItem><SelectItem value="inactive">Inactivo</SelectItem></SelectContent></Select></div>
            <div className="space-y-2 sm:col-span-2"><Label htmlFor="port-boat-name">Nombre</Label><Input id="port-boat-name" value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} maxLength={120} required /></div>
            <div className="space-y-2"><Label htmlFor="port-boat-location">Ubicación</Label><Input id="port-boat-location" value={form.location} onChange={(event) => setForm((current) => ({ ...current, location: event.target.value }))} maxLength={160} required /></div>
            <div className="space-y-2"><Label htmlFor="port-boat-capacity">Capacidad / dimensión</Label><Input id="port-boat-capacity" value={form.capacity} onChange={(event) => setForm((current) => ({ ...current, capacity: event.target.value }))} maxLength={120} /></div>
            <div className="space-y-2 sm:col-span-2"><Label htmlFor="port-boat-maintenance">Último mantenimiento</Label><Input id="port-boat-maintenance" value={form.last_maintenance} onChange={(event) => setForm((current) => ({ ...current, last_maintenance: event.target.value }))} maxLength={160} placeholder="Fecha o nota operacional" /></div>
            <div className="space-y-2 sm:col-span-2"><Label htmlFor="port-boat-description">Descripción</Label><Textarea id="port-boat-description" value={form.description} onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))} rows={3} maxLength={600} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={saving}>Cancelar</Button>
            <Button onClick={() => void save()} disabled={saving || !form.name.trim() || !form.location.trim()}>{saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{saving ? "Guardando…" : "Guardar"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  )
}

function Metric({ icon: Icon, label, value }: { icon: typeof Anchor; label: string; value: number }) {
  return <Card><CardContent className="flex items-center gap-3 p-4"><Icon className="h-5 w-5 text-muted-foreground" /><div><p className="text-xs text-muted-foreground">{label}</p><p className="text-2xl font-semibold tracking-tight">{value}</p></div></CardContent></Card>
}
