"use client"

import { useEffect, useMemo, useState } from "react"
import { createBrowserClient } from "@supabase/ssr"
import { Plus, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useLanguage } from "@/lib/hooks/use-language"

const COLOR_OPTIONS = ["#3b82f6", "#ec4899", "#8b5cf6", "#f59e0b", "#06b6d4", "#10b981", "#6366f1", "#6b7280", "#ef4444", "#14b8a6"]
const ICON_OPTIONS = ["monitor", "camera", "headphones", "presentation", "tv", "router", "hard-drive", "box", "cpu", "wifi"]

const COPY = {
  en: { title: "Asset categories", addTitle: "Add category", name: "Category name", add: "Add", loading: "Loading...", deleteLabel: "Delete category" },
  es: { title: "Categorías de activos", addTitle: "Agregar categoría", name: "Nombre de la categoría", add: "Agregar", loading: "Cargando...", deleteLabel: "Eliminar categoría" },
  de: { title: "Anlagenkategorien", addTitle: "Kategorie hinzufügen", name: "Kategoriename", add: "Hinzufügen", loading: "Wird geladen...", deleteLabel: "Kategorie löschen" },
} as const

export default function CategoriesPage() {
  const { language } = useLanguage()
  const copy = COPY[language]
  const [categories, setCategories] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [newCategory, setNewCategory] = useState({ name: "", icon: "box", color: "#726658" })
  const supabase = useMemo(() => createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!), [])

  useEffect(() => { void fetchCategories() }, [])

  async function fetchCategories() {
    try {
      const { data, error } = await supabase.from("asset_categories").select("*").order("name")
      if (error) throw error
      setCategories(data || [])
    } catch (error) {
      console.error("Error fetching categories:", error)
    } finally {
      setLoading(false)
    }
  }

  async function handleAdd() {
    if (!newCategory.name) return
    try {
      const { data, error } = await supabase.from("asset_categories").insert([newCategory]).select()
      if (error) throw error
      setCategories((current) => [...current, data[0]])
      setNewCategory({ name: "", icon: "box", color: "#726658" })
    } catch (error) {
      console.error("Error adding category:", error)
    }
  }

  async function handleDelete(id: string) {
    try {
      const { error } = await supabase.from("asset_categories").delete().eq("id", id)
      if (error) throw error
      setCategories((current) => current.filter((category) => category.id !== id))
    } catch (error) {
      console.error("Error deleting category:", error)
    }
  }

  return (
    <div className="p-8">
      <div className="mx-auto max-w-6xl">
        <h1 className="mb-8 text-3xl font-bold">{copy.title}</h1>
        <div className="mb-8 rounded-lg border border-border bg-card p-6">
          <h2 className="mb-4 text-lg font-semibold">{copy.addTitle}</h2>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
            <Input placeholder={copy.name} value={newCategory.name} onChange={(event) => setNewCategory({ ...newCategory, name: event.target.value })} />
            <select className="rounded-lg border bg-background px-3 py-2 text-foreground" value={newCategory.icon} onChange={(event) => setNewCategory({ ...newCategory, icon: event.target.value })}>
              {ICON_OPTIONS.map((icon) => <option key={icon} value={icon}>{icon}</option>)}
            </select>
            <div className="flex gap-2">
              <input type="color" value={newCategory.color} onChange={(event) => setNewCategory({ ...newCategory, color: event.target.value })} className="h-10 w-12 cursor-pointer rounded-lg" />
              <div className="grid grid-cols-5 gap-1">
                {COLOR_OPTIONS.map((color) => <button key={color} type="button" aria-label={color} onClick={() => setNewCategory({ ...newCategory, color })} className="h-6 w-6 rounded border-2" style={{ backgroundColor: color, borderColor: newCategory.color === color ? "#fff" : "transparent" }} />)}
              </div>
            </div>
            <Button onClick={handleAdd} className="gap-2"><Plus className="h-4 w-4" />{copy.add}</Button>
          </div>
        </div>
        {loading ? <div className="py-12 text-center">{copy.loading}</div> : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {categories.map((category) => (
              <div key={category.id} className="rounded-lg border border-border bg-card p-4 transition-colors hover:border-accent">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg font-bold text-white" style={{ backgroundColor: category.color }}>{category.icon?.charAt(0).toUpperCase() || "📦"}</div>
                    <h3 className="font-semibold text-foreground">{category.name}</h3>
                  </div>
                  <Button variant="ghost" size="sm" aria-label={copy.deleteLabel} onClick={() => handleDelete(category.id)} className="text-destructive hover:bg-destructive/10"><Trash2 className="h-4 w-4" /></Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
