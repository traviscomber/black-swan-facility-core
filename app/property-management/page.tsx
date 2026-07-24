"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { AlertTriangle, Building2, MapPin, Pencil, Plus, RefreshCw, Search } from "lucide-react"
import { AppLayout } from "@/components/app-layout"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { createBrowserClient } from "@/lib/supabase/client"

interface Location {
  id: string
  name: string
  description: string | null
  latitude: number | null
  longitude: number | null
  is_active: boolean | null
  facility_type: string | null
  rooms?: { count: number }[]
}

const TYPE_LABELS: Record<string, string> = {
  rental: "Hospedaje / clasificación heredada",
  storage: "Almacenamiento",
  laundry: "Lavandería",
  garden: "Jardines y exteriores",
  office: "Oficina",
  utility: "Servicios e infraestructura",
  parking: "Estacionamiento o acceso",
  other: "Otro",
}

export default function PropertyManagementPage() {
  const supabase = useMemo(() => createBrowserClient(), [])
  const [locations, setLocations] = useState<Location[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState("")
  const [editing, setEditing] = useState<Location | null>(null)
  const [creating, setCreating] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({ name: "", description: "", facility_type: "other", latitude: "", longitude: "" })

  const loadLocations = useCallback(async () => {
    setLoading(true)
    setError(null)
    const { data, error: loadError } = await supabase
      .from("locations")
      .select("id, name, description, latitude, longitude, is_active, facility_type, rooms(count)")
      .order("name")

    if (loadError) {
      setError(loadError.message)
      setLocations([])
    } else {
      setLocations((data ?? []) as Location[])
    }
    setLoading(false)
  }, [supabase])

  useEffect(() => { void loadLocations() }, [loadLocations])

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase()
    return locations.filter((location) => !term || location.name.toLowerCase().includes(term) || location.description?.toLowerCase().includes(term) || location.facility_type?.toLowerCase().includes(term))
  }, [locations, search])

  const active = locations.filter((location) => location.is_active).length
  const withCoordinates = locations.filter((location) => location.latitude != null && location.longitude != null).length
  const withRooms = locations.filter((location) => Number(location.rooms?.[0]?.count ?? 0) > 0).length
  const rentalClassified = locations.filter((location) => location.facility_type === "rental").length
  const classificationWarning = locations.length > 0 && rentalClassified / locations.length >= 0.8

  const beginCreate = () => {
    setEditing(null)
    setForm({ name: "", description: "", facility_type: "other", latitude: "", longitude: "" })
    setCreating(true)
  }

  const beginEdit = (location: Location) => {
    setCreating(false)
    setEditing(location)
    setForm({
      name: location.name,
      description: location.description ?? "",
      facility_type: location.facility_type ?? "other",
      latitude: location.latitude?.toString() ?? "",
      longitude: location.longitude?.toString() ?? "",
    })
  }

  const closeForm = () => {
    setCreating(false)
    setEditing(null)
  }

  const saveLocation = async () => {
    if (!form.name.trim()) return
    setSaving(true)
    setError(null)
    const payload = {
      name: form.name.trim(),
      description: form.description.trim() || null,
      facility_type: form.facility_type,
      latitude: form.latitude ? Number(form.latitude) : null,
      longitude: form.longitude ? Number(form.longitude) : null,
      is_active: editing?.is_active ?? true,
    }
    const result = editing
      ? await supabase.from("locations").update(payload).eq("id", editing.id)
      : await supabase.from("locations").insert(payload)

    if (result.error) setError(result.error.message)
    else {
      closeForm()
      await loadLocations()
    }
    setSaving(false)
  }

  const toggleActive = async (location: Location) => {
    const { error: updateError } = await supabase.from("locations").update({ is_active: !location.is_active }).eq("id", location.id)
    if (updateError) setError(updateError.message)
    else await loadLocations()
  }

  return (
    <AppLayout>
      <div className="space-y-6 p-4 md:p-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <p className="mb-1 text-xs font-semibold uppercase tracking-[0.16em] text-primary">Infraestructura · Fundo Corcovado</p>
            <h1 className="text-3xl font-semibold tracking-tight">Propiedades y ubicaciones</h1>
            <p className="mt-1 max-w-3xl text-sm text-muted-foreground">Directorio interno de casas, oficinas, accesos, almacenamiento, jardines y áreas de servicio. La clasificación corresponde al dato registrado en Supabase.</p>
          </div>
          <Button onClick={beginCreate}><Plus className="mr-2 h-4 w-4" />Registrar ubicación</Button>
        </div>

        {classificationWarning && <Card className="border-amber-300"><CardContent className="flex gap-3 p-4"><AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" /><div><p className="font-medium">Clasificación pendiente de normalización</p><p className="mt-1 text-sm text-muted-foreground">{rentalClassified} de {locations.length} ubicaciones están marcadas como “rental”, aunque los nombres incluyen oficinas, lavandería, acceso, jardín y almacenamiento. La interfaz no corrige esos datos automáticamente.</p></div></CardContent></Card>}

        {error && <Card className="border-destructive/50"><CardContent className="flex items-center justify-between gap-4 p-4"><p className="text-sm text-destructive">No fue posible completar la operación: {error}</p><Button variant="outline" size="sm" onClick={() => void loadLocations()}><RefreshCw className="mr-2 h-4 w-4" />Reintentar</Button></CardContent></Card>}

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Metric title="Ubicaciones registradas" value={locations.length} />
          <Metric title="Ubicaciones activas" value={active} />
          <Metric title="Con habitaciones configuradas" value={withRooms} />
          <Metric title="Con coordenadas" value={withCoordinates} alert={withCoordinates < locations.length} />
        </div>

        {(creating || editing) && <Card><CardHeader><CardTitle>{editing ? `Editar ${editing.name}` : "Nueva ubicación"}</CardTitle></CardHeader><CardContent className="grid gap-4 md:grid-cols-2">
          <label className="text-sm font-medium">Nombre<Input className="mt-1" value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} /></label>
          <label className="text-sm font-medium">Tipo<select className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm" value={form.facility_type} onChange={(event) => setForm((current) => ({ ...current, facility_type: event.target.value }))}>{Object.entries(TYPE_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
          <label className="text-sm font-medium md:col-span-2">Descripción<Input className="mt-1" value={form.description} onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))} /></label>
          <label className="text-sm font-medium">Latitud<Input className="mt-1" type="number" step="any" value={form.latitude} onChange={(event) => setForm((current) => ({ ...current, latitude: event.target.value }))} /></label>
          <label className="text-sm font-medium">Longitud<Input className="mt-1" type="number" step="any" value={form.longitude} onChange={(event) => setForm((current) => ({ ...current, longitude: event.target.value }))} /></label>
          <div className="flex gap-2 md:col-span-2"><Button onClick={() => void saveLocation()} disabled={saving || !form.name.trim()}>{saving ? "Guardando…" : "Guardar"}</Button><Button variant="outline" onClick={closeForm}>Cancelar</Button></div>
        </CardContent></Card>}

        <Card>
          <CardHeader><CardTitle className="text-base">Directorio operativo</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="relative max-w-xl"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input className="pl-9" placeholder="Buscar por nombre, descripción o tipo" value={search} onChange={(event) => setSearch(event.target.value)} /></div>
            {loading ? <p className="py-10 text-center text-sm text-muted-foreground">Cargando propiedades…</p> : filtered.length === 0 ? <p className="py-10 text-center text-sm text-muted-foreground">No hay ubicaciones para la búsqueda actual.</p> : <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{filtered.map((location) => {
              const roomCount = Number(location.rooms?.[0]?.count ?? 0)
              return <Card key={location.id} className={!location.is_active ? "opacity-65" : undefined}><CardHeader className="pb-3"><div className="flex items-start justify-between gap-3"><div><CardTitle className="text-base">{location.name}</CardTitle><p className="mt-1 text-xs text-muted-foreground">{TYPE_LABELS[location.facility_type ?? "other"] ?? location.facility_type ?? "Sin clasificar"}</p></div><Button variant="ghost" size="sm" onClick={() => beginEdit(location)} aria-label={`Editar ${location.name}`}><Pencil className="h-4 w-4" /></Button></div></CardHeader><CardContent className="space-y-3 text-sm"><p className="min-h-10 text-muted-foreground">{location.description || "Sin descripción operativa."}</p><div className="flex items-center gap-2"><Building2 className="h-4 w-4 text-muted-foreground" /><span>{roomCount} habitación{roomCount === 1 ? "" : "es"} configurada{roomCount === 1 ? "" : "s"}</span></div><div className="flex items-center gap-2"><MapPin className="h-4 w-4 text-muted-foreground" /><span>{location.latitude != null && location.longitude != null ? `${location.latitude}, ${location.longitude}` : "Sin coordenadas"}</span></div><div className="flex items-center justify-between border-t pt-3"><span className={location.is_active ? "font-medium" : "text-muted-foreground"}>{location.is_active ? "Activa" : "Inactiva"}</span><Button variant="outline" size="sm" onClick={() => void toggleActive(location)}>{location.is_active ? "Desactivar" : "Activar"}</Button></div></CardContent></Card>
            })}</div>}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  )
}

function Metric({ title, value, alert = false }: { title: string; value: number; alert?: boolean }) {
  return <Card className={alert ? "border-amber-300" : undefined}><CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle></CardHeader><CardContent><div className="text-3xl font-semibold">{value.toLocaleString("es-CL")}</div></CardContent></Card>
}
