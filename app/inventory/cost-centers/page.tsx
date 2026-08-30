"use client"

import { useEffect, useMemo, useState } from "react"
import { createBrowserClient } from "@supabase/ssr"
import { Plus, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useLanguage } from "@/lib/hooks/use-language"

const COPY = {
  en: { title: "Cost centers", addTitle: "Add cost center", name: "Name", code: "Code (e.g. MM)", description: "Description", add: "Add", loading: "Loading...", deleteLabel: "Delete cost center" },
  es: { title: "Centros de costo", addTitle: "Agregar centro de costo", name: "Nombre", code: "Código (ej. MM)", description: "Descripción", add: "Agregar", loading: "Cargando...", deleteLabel: "Eliminar centro de costo" },
  de: { title: "Kostenstellen", addTitle: "Kostenstelle hinzufügen", name: "Name", code: "Code (z. B. MM)", description: "Beschreibung", add: "Hinzufügen", loading: "Wird geladen...", deleteLabel: "Kostenstelle löschen" },
} as const

export default function CostCentersPage() {
  const { language } = useLanguage()
  const copy = COPY[language]
  const [costCenters, setCostCenters] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [newCenter, setNewCenter] = useState({ name: "", code: "", description: "" })
  const supabase = useMemo(() => createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!), [])

  useEffect(() => { void fetchCostCenters() }, [])

  async function fetchCostCenters() {
    try {
      const { data, error } = await supabase.from("cost_centers").select("*").order("name")
      if (error) throw error
      setCostCenters(data || [])
    } catch (error) {
      console.error("Error fetching cost centers:", error)
    } finally {
      setLoading(false)
    }
  }

  async function handleAdd() {
    if (!newCenter.name || !newCenter.code) return
    try {
      const { data, error } = await supabase.from("cost_centers").insert([newCenter]).select()
      if (error) throw error
      setCostCenters((current) => [...current, data[0]])
      setNewCenter({ name: "", code: "", description: "" })
    } catch (error) {
      console.error("Error adding cost center:", error)
    }
  }

  async function handleDelete(id: string) {
    try {
      const { error } = await supabase.from("cost_centers").delete().eq("id", id)
      if (error) throw error
      setCostCenters((current) => current.filter((center) => center.id !== id))
    } catch (error) {
      console.error("Error deleting cost center:", error)
    }
  }

  return (
    <div className="p-8">
      <div className="mx-auto max-w-4xl">
        <h1 className="mb-8 text-3xl font-bold">{copy.title}</h1>
        <div className="mb-8 rounded-lg border border-border bg-card p-6">
          <h2 className="mb-4 text-lg font-semibold">{copy.addTitle}</h2>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <Input placeholder={copy.name} value={newCenter.name} onChange={(event) => setNewCenter({ ...newCenter, name: event.target.value })} />
            <Input placeholder={copy.code} value={newCenter.code} onChange={(event) => setNewCenter({ ...newCenter, code: event.target.value })} maxLength={5} />
            <Button onClick={handleAdd} className="gap-2"><Plus className="h-4 w-4" />{copy.add}</Button>
          </div>
          <textarea placeholder={copy.description} className="mt-4 w-full rounded-lg border p-2 text-sm" value={newCenter.description} onChange={(event) => setNewCenter({ ...newCenter, description: event.target.value })} />
        </div>
        {loading ? <div className="py-12 text-center">{copy.loading}</div> : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {costCenters.map((center) => (
              <div key={center.id} className="rounded-lg border border-border bg-card p-4 transition-colors hover:border-accent">
                <div className="mb-2 flex items-start justify-between">
                  <div><h3 className="font-semibold text-foreground">{center.name}</h3><p className="text-sm text-muted-foreground">{center.code}</p></div>
                  <Button variant="ghost" size="sm" aria-label={copy.deleteLabel} onClick={() => handleDelete(center.id)} className="text-destructive hover:bg-destructive/10"><Trash2 className="h-4 w-4" /></Button>
                </div>
                {center.description && <p className="text-sm text-muted-foreground">{center.description}</p>}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
