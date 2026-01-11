"use client"

import { useState, useEffect } from "react"
import { createBrowserClient } from "@supabase/ssr"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Plus, Trash2 } from "lucide-react"

const COLOR_OPTIONS = [
  "#3b82f6",
  "#ec4899",
  "#8b5cf6",
  "#f59e0b",
  "#06b6d4",
  "#10b981",
  "#6366f1",
  "#6b7280",
  "#ef4444",
  "#14b8a6",
]
const ICON_OPTIONS = [
  "monitor",
  "camera",
  "headphones",
  "presentation",
  "tv",
  "router",
  "hard-drive",
  "box",
  "cpu",
  "wifi",
]

export default function CategoriesPage() {
  const [categories, setCategories] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [newCategory, setNewCategory] = useState({ name: "", icon: "box", color: "#726658" })

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  )

  useEffect(() => {
    fetchCategories()
  }, [])

  const fetchCategories = async () => {
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

  const handleAdd = async () => {
    if (!newCategory.name) return

    try {
      const { data, error } = await supabase.from("asset_categories").insert([newCategory]).select()

      if (error) throw error
      setCategories([...categories, data[0]])
      setNewCategory({ name: "", icon: "box", color: "#726658" })
    } catch (error) {
      console.error("Error adding category:", error)
    }
  }

  const handleDelete = async (id: string) => {
    try {
      const { error } = await supabase.from("asset_categories").delete().eq("id", id)

      if (error) throw error
      setCategories(categories.filter((c) => c.id !== id))
    } catch (error) {
      console.error("Error deleting category:", error)
    }
  }

  return (
    <div className="p-8">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-3xl font-bold mb-8">Asset Categories</h1>

        {/* Add new */}
        <div className="bg-card rounded-lg p-6 border border-border mb-8">
          <h2 className="text-lg font-semibold mb-4">Add New Category</h2>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Input
              placeholder="Category Name"
              value={newCategory.name}
              onChange={(e) => setNewCategory({ ...newCategory, name: e.target.value })}
            />
            <select
              className="px-3 py-2 border rounded-lg bg-background text-foreground"
              value={newCategory.icon}
              onChange={(e) => setNewCategory({ ...newCategory, icon: e.target.value })}
            >
              {ICON_OPTIONS.map((icon) => (
                <option key={icon} value={icon}>
                  {icon}
                </option>
              ))}
            </select>
            <div className="flex gap-2">
              <input
                type="color"
                value={newCategory.color}
                onChange={(e) => setNewCategory({ ...newCategory, color: e.target.value })}
                className="w-12 h-10 rounded-lg cursor-pointer"
              />
              <div className="grid grid-cols-5 gap-1">
                {COLOR_OPTIONS.map((color) => (
                  <button
                    key={color}
                    onClick={() => setNewCategory({ ...newCategory, color })}
                    className="w-6 h-6 rounded border-2"
                    style={{
                      backgroundColor: color,
                      borderColor: newCategory.color === color ? "#fff" : "transparent",
                    }}
                  />
                ))}
              </div>
            </div>
            <Button onClick={handleAdd} className="gap-2">
              <Plus className="w-4 h-4" /> Add
            </Button>
          </div>
        </div>

        {/* List */}
        {loading ? (
          <div className="text-center py-12">Loading...</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {categories.map((cat) => (
              <div
                key={cat.id}
                className="bg-card rounded-lg p-4 border border-border hover:border-accent transition-colors"
              >
                <div className="flex justify-between items-start">
                  <div className="flex items-center gap-3">
                    <div
                      className="w-10 h-10 rounded-lg flex items-center justify-center text-white font-bold"
                      style={{ backgroundColor: cat.color }}
                    >
                      {cat.icon?.charAt(0).toUpperCase() || "📦"}
                    </div>
                    <h3 className="font-semibold text-foreground">{cat.name}</h3>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDelete(cat.id)}
                    className="text-destructive hover:bg-destructive/10"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
