"use client"

import Link from "next/link"
import { useCallback, useEffect, useMemo, useState } from "react"
import { AlertTriangle, Brain, Edit2, Plus, RefreshCw, Trash2, X } from "lucide-react"
import { AppLayout } from "@/components/app-layout"
import { PageHeader } from "@/components/page-header"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { createBrowserClient } from "@/lib/supabase/client"

interface CattleArea {
  id: string
  name: string
  description: string | null
  status: string
  priority: string
  specifications: {
    hectares?: number
    capacity?: number
    grass_type?: string
    breeding_type?: string
    business_unit?: string
  } | null
  notes: string | null
}

interface CattleAreaFormData {
  name: string
  description: string
  status: string
  priority: string
  business_unit: string
  hectares: number
  capacity: number
  grass_type: string
  breeding_type: string
  notes: string
}

const EMPTY_FORM: CattleAreaFormData = {
  name: "",
  description: "",
  status: "active",
  priority: "medium",
  business_unit: "Fattening",
  hectares: 0,
  capacity: 0,
  grass_type: "",
  breeding_type: "",
  notes: "",
}

const STATUS_LABELS: Record<string, string> = {
  active: "Activa",
  inactive: "Inactiva",
  planned: "Planificada",
}

const PRIORITY_LABELS: Record<string, string> = {
  high: "Alta",
  medium: "Media",
  low: "Baja",
}

const BUSINESS_LABELS: Record<string, string> = {
  Fattening: "Engorda",
  Breeding: "Crianza",
}

export default function CattlePage() {
  const supabase = useMemo(() => createBrowserClient(), [])
  const [areas, setAreas] = useState<CattleArea[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [formData, setFormData] = useState<CattleAreaFormData>(EMPTY_FORM)

  const loadCattleAreas = useCallback(async () => {
    setLoading(true)
    setError(null)
    const { data, error: loadError } = await supabase
      .from("infrastructure_plans")
      .select("id, name, description, status, priority, specifications, notes")
      .eq("category", "Cattle")
      .order("name")

    if (loadError) {
      setError(loadError.message)
      setAreas([])
    } else {
      setAreas((data ?? []) as CattleArea[])
    }
    setLoading(false)
  }, [supabase])

  useEffect(() => {
    loadCattleAreas()
  }, [loadCattleAreas])

  const totalHectares = areas.reduce((sum, area) => sum + Number(area.specifications?.hectares ?? 0), 0)
  const totalCapacity = areas.reduce((sum, area) => sum + Number(area.specifications?.capacity ?? 0), 0)
  const fatteningAreas = areas.filter((area) => area.specifications?.business_unit === "Fattening")
  const breedingAreas = areas.filter((area) => area.specifications?.business_unit === "Breeding")
  const recordsToValidate = areas.filter((area) => /2024|facility|pasture/i.test(`${area.name} ${area.description ?? ""} ${area.notes ?? ""}`)).length

  const openNew = () => {
    setEditingId(null)
    setFormData(EMPTY_FORM)
    setShowForm(true)
  }

  const openEdit = (area: CattleArea) => {
    setEditingId(area.id)
    setFormData({
      name: area.name,
      description: area.description ?? "",
      status: area.status,
      priority: area.priority,
      business_unit: area.specifications?.business_unit ?? "Fattening",
      hectares: Number(area.specifications?.hectares ?? 0),
      capacity: Number(area.specifications?.capacity ?? 0),
      grass_type: area.specifications?.grass_type ?? "",
      breeding_type: area.specifications?.breeding_type ?? "",
      notes: area.notes ?? "",
    })
    setShowForm(true)
  }

  const saveArea = async () => {
    if (!formData.name.trim()) {
      setError("Ingresa el nombre del potrero o área ganadera.")
      return
    }

    setSaving(true)
    setError(null)
    const payload = {
      name: formData.name.trim(),
      description: formData.description.trim(),
      status: formData.status,
      priority: formData.priority,
      category: "Cattle",
      specifications: {
        hectares: formData.hectares,
        capacity: formData.capacity,
        grass_type: formData.grass_type.trim(),
        breeding_type: formData.breeding_type.trim(),
        business_unit: formData.business_unit,
      },
      notes: formData.notes.trim(),
    }

    const result = editingId
      ? await supabase.from("infrastructure_plans").update(payload).eq("id", editingId)
      : await supabase.from("infrastructure_plans").insert(payload)

    if (result.error) {
      setError(result.error.message)
    } else {
      setShowForm(false)
      await loadCattleAreas()
    }
    setSaving(false)
  }

  const deleteArea = async (area: CattleArea) => {
    if (!window.confirm(`¿Eliminar el registro “${area.name}”? Esta acción no se puede deshacer.`)) return
    setError(null)
    const { error: deleteError } = await supabase.from("infrastructure_plans").delete().eq("id", area.id)
    if (deleteError) setError(deleteError.message)
    else await loadCattleAreas()
  }

  return (
    <AppLayout>
      <PageHeader
        title="Ganadería · Fundo Corcovado"
        description="Planificación y control de potreros destinados a crianza y engorda en la operación de Valdivia."
        actions={
          <Button onClick={openNew}>
            <Plus className="mr-2 h-4 w-4" />
            Registrar área
          </Button>
        }
      />

      <div className="space-y-6 p-4 md:p-8">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Contexto operativo</CardTitle>
            <CardDescription>
              Esta sección consolida superficie, capacidad estimada, tipo de explotación, pradera y estado de cada área ganadera del Fundo Corcovado.
            </CardDescription>
          </CardHeader>
        </Card>

        {recordsToValidate > 0 && (
          <div className="flex gap-3 rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <div>
              <p className="font-medium">Hay {recordsToValidate} registros con referencias históricas o nombres genéricos.</p>
              <p className="mt-1">Los datos se mantienen sin cambios, pero deben validarse en terreno antes de utilizarlos para decisiones de carga animal o inversión.</p>
            </div>
          </div>
        )}

        {error && (
          <div className="flex items-center justify-between gap-4 rounded-lg border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">
            <span>No fue posible completar la operación: {error}</span>
            <Button variant="outline" size="sm" onClick={loadCattleAreas}>
              <RefreshCw className="mr-2 h-4 w-4" />Reintentar
            </Button>
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Metric title="Superficie registrada" value={`${totalHectares.toLocaleString("es-CL")} ha`} detail="Suma declarada en los registros" />
          <Metric title="Capacidad estimada" value={totalCapacity.toLocaleString("es-CL")} detail="Cabezas declaradas, no inventario real" />
          <Metric title="Áreas de engorda" value={String(fatteningAreas.length)} detail="Potreros clasificados para engorda" />
          <Metric title="Áreas de crianza" value={String(breedingAreas.length)} detail="Potreros clasificados para crianza" />
        </div>

        {loading ? (
          <Card><CardContent className="py-12 text-center text-sm text-muted-foreground">Cargando información ganadera…</CardContent></Card>
        ) : areas.length === 0 ? (
          <Card><CardContent className="py-12 text-center"><p className="font-medium">No hay áreas ganaderas registradas.</p><p className="mt-1 text-sm text-muted-foreground">Registra el primer potrero o unidad de manejo del Fundo Corcovado.</p></CardContent></Card>
        ) : (
          <div className="space-y-8">
            <AreaGroup title="Engorda" description="Áreas destinadas al crecimiento y terminación del ganado." areas={fatteningAreas} onEdit={openEdit} onDelete={deleteArea} />
            <AreaGroup title="Crianza" description="Áreas destinadas a vientres, reproducción y desarrollo de animales jóvenes." areas={breedingAreas} onEdit={openEdit} onDelete={deleteArea} />
          </div>
        )}

        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2"><Brain className="h-5 w-5" /><CardTitle className="text-base">Asistente ganadero</CardTitle></div>
              <CardDescription>Consulta análisis y recomendaciones basadas en los registros disponibles. Las respuestas deben validarse con el responsable técnico.</CardDescription>
            </CardHeader>
            <CardContent><Button asChild variant="outline"><Link href="/cattle/expert-agent">Abrir asistente</Link></Button></CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Planificación económica</CardTitle>
              <CardDescription>Consulta costos, supuestos y proyecciones de la unidad ganadera del Fundo Corcovado.</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-2">
              <Button asChild variant="outline"><Link href="/cattle/pricing-costs">Costos y precios</Link></Button>
              <Button asChild variant="outline"><Link href="/cattle/business-plan">Plan de negocio</Link></Button>
            </CardContent>
          </Card>
        </div>
      </div>

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <Card className="max-h-[92vh] w-full max-w-2xl overflow-y-auto">
            <CardHeader className="flex flex-row items-center justify-between">
              <div><CardTitle>{editingId ? "Editar área ganadera" : "Registrar área ganadera"}</CardTitle><CardDescription>Usa nombres reconocibles en terreno y datos verificados.</CardDescription></div>
              <Button variant="ghost" size="icon" onClick={() => setShowForm(false)} aria-label="Cerrar"><X className="h-5 w-5" /></Button>
            </CardHeader>
            <CardContent className="space-y-4">
              <Field label="Nombre del potrero o área" required><input className="field" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} placeholder="Ej.: Potrero Norte" /></Field>
              <Field label="Descripción"><input className="field" value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} placeholder="Ubicación y función operativa" /></Field>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Unidad de manejo"><select className="field" value={formData.business_unit} onChange={(e) => setFormData({ ...formData, business_unit: e.target.value })}><option value="Fattening">Engorda</option><option value="Breeding">Crianza</option></select></Field>
                <Field label="Estado"><select className="field" value={formData.status} onChange={(e) => setFormData({ ...formData, status: e.target.value })}><option value="active">Activa</option><option value="inactive">Inactiva</option><option value="planned">Planificada</option></select></Field>
                <Field label="Superficie (ha)"><input className="field" type="number" min="0" step="0.1" value={formData.hectares} onChange={(e) => setFormData({ ...formData, hectares: Number(e.target.value) || 0 })} /></Field>
                <Field label="Capacidad estimada (cabezas)"><input className="field" type="number" min="0" value={formData.capacity} onChange={(e) => setFormData({ ...formData, capacity: Number(e.target.value) || 0 })} /></Field>
                <Field label="Tipo de pradera"><input className="field" value={formData.grass_type} onChange={(e) => setFormData({ ...formData, grass_type: e.target.value })} placeholder="Ej.: ballica perenne" /></Field>
                <Field label="Tipo de ganado o sistema"><input className="field" value={formData.breeding_type} onChange={(e) => setFormData({ ...formData, breeding_type: e.target.value })} placeholder="Ej.: ganado de carne" /></Field>
                <Field label="Prioridad"><select className="field" value={formData.priority} onChange={(e) => setFormData({ ...formData, priority: e.target.value })}><option value="low">Baja</option><option value="medium">Media</option><option value="high">Alta</option></select></Field>
              </div>
              <Field label="Notas"><textarea className="field min-h-24" value={formData.notes} onChange={(e) => setFormData({ ...formData, notes: e.target.value })} placeholder="Agua, drenaje, cercos, rotación o validaciones pendientes" /></Field>
              <div className="flex justify-end gap-2 border-t pt-4"><Button variant="outline" onClick={() => setShowForm(false)}>Cancelar</Button><Button onClick={saveArea} disabled={saving}>{saving ? "Guardando…" : "Guardar"}</Button></div>
            </CardContent>
          </Card>
        </div>
      )}

      <style jsx global>{`
        .field { width: 100%; border: 1px solid hsl(var(--border)); border-radius: 0.375rem; background: hsl(var(--background)); padding: 0.5rem 0.75rem; font-size: 0.875rem; }
        .field:focus { outline: 2px solid hsl(var(--ring)); outline-offset: 2px; }
      `}</style>
    </AppLayout>
  )
}

function Metric({ title, value, detail }: { title: string; value: string; detail: string }) {
  return <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle></CardHeader><CardContent><div className="text-2xl font-semibold">{value}</div><p className="mt-1 text-xs text-muted-foreground">{detail}</p></CardContent></Card>
}

function AreaGroup({ title, description, areas, onEdit, onDelete }: { title: string; description: string; areas: CattleArea[]; onEdit: (area: CattleArea) => void; onDelete: (area: CattleArea) => void }) {
  if (!areas.length) return null
  return <section><div className="mb-4"><div className="flex items-center gap-2"><h2 className="text-lg font-semibold">{title}</h2><Badge variant="outline">{areas.length} áreas</Badge></div><p className="mt-1 text-sm text-muted-foreground">{description}</p></div><div className="grid gap-4 lg:grid-cols-2">{areas.map((area) => <Card key={area.id}><CardHeader><div className="flex items-start justify-between gap-3"><div><CardTitle className="text-base">{area.name}</CardTitle><CardDescription className="mt-1">{area.description || "Sin descripción operativa"}</CardDescription></div><Badge variant="outline">{STATUS_LABELS[area.status] ?? area.status}</Badge></div></CardHeader><CardContent className="space-y-4"><div className="grid grid-cols-2 gap-4"><Data label="Superficie" value={`${Number(area.specifications?.hectares ?? 0).toLocaleString("es-CL")} ha`} /><Data label="Capacidad estimada" value={`${Number(area.specifications?.capacity ?? 0).toLocaleString("es-CL")} cabezas`} /></div>{area.specifications?.grass_type && <Data label="Pradera" value={area.specifications.grass_type} />}{area.specifications?.breeding_type && <Data label="Sistema o ganado" value={area.specifications.breeding_type.replaceAll("_", " ")} />}<Data label="Notas" value={area.notes || "Sin notas"} /><Badge variant="outline">Prioridad {PRIORITY_LABELS[area.priority] ?? area.priority}</Badge><div className="flex gap-2 border-t pt-4"><Button variant="outline" size="sm" onClick={() => onEdit(area)}><Edit2 className="mr-2 h-4 w-4" />Editar</Button><Button variant="outline" size="sm" onClick={() => onDelete(area)} className="text-destructive"><Trash2 className="mr-2 h-4 w-4" />Eliminar</Button></div></CardContent></Card>)}</div></section>
}

function Data({ label, value }: { label: string; value: string }) {
  return <div><p className="text-xs font-medium text-muted-foreground">{label}</p><p className="mt-1 text-sm capitalize">{value}</p></div>
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return <label className="block"><span className="mb-1 block text-sm font-medium">{label}{required ? " *" : ""}</span>{children}</label>
}
