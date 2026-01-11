"use client"

import { useState, useEffect } from "react"
import { createBrowserClient } from "@supabase/ssr"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Plus, Trash2 } from "lucide-react"

export default function CostCentersPage() {
  const [costCenters, setCostCenters] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [newCenter, setNewCenter] = useState({ name: "", code: "", description: "" })

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  )

  useEffect(() => {
    fetchCostCenters()
  }, [])

  const fetchCostCenters = async () => {
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

  const handleAdd = async () => {
    if (!newCenter.name || !newCenter.code) return

    try {
      const { data, error } = await supabase.from("cost_centers").insert([newCenter]).select()

      if (error) throw error
      setCostCenters([...costCenters, data[0]])
      setNewCenter({ name: "", code: "", description: "" })
    } catch (error) {
      console.error("Error adding cost center:", error)
    }
  }

  const handleDelete = async (id: string) => {
    try {
      const { error } = await supabase.from("cost_centers").delete().eq("id", id)

      if (error) throw error
      setCostCenters(costCenters.filter((cc) => cc.id !== id))
    } catch (error) {
      console.error("Error deleting cost center:", error)
    }
  }

  return (
    <div className="p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-8">Cost Centers</h1>

        {/* Add new */}
        <div className="bg-card rounded-lg p-6 border border-border mb-8">
          <h2 className="text-lg font-semibold mb-4">Add New Cost Center</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Input
              placeholder="Name"
              value={newCenter.name}
              onChange={(e) => setNewCenter({ ...newCenter, name: e.target.value })}
            />
            <Input
              placeholder="Code (e.g., MM)"
              value={newCenter.code}
              onChange={(e) => setNewCenter({ ...newCenter, code: e.target.value })}
              maxLength={5}
            />
            <Button onClick={handleAdd} className="gap-2">
              <Plus className="w-4 h-4" /> Add
            </Button>
          </div>
          <textarea
            placeholder="Description"
            className="w-full mt-4 p-2 border rounded-lg text-sm"
            value={newCenter.description}
            onChange={(e) => setNewCenter({ ...newCenter, description: e.target.value })}
          />
        </div>

        {/* List */}
        {loading ? (
          <div className="text-center py-12">Loading...</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {costCenters.map((center) => (
              <div
                key={center.id}
                className="bg-card rounded-lg p-4 border border-border hover:border-accent transition-colors"
              >
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <h3 className="font-semibold text-foreground">{center.name}</h3>
                    <p className="text-sm text-muted-foreground">{center.code}</p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDelete(center.id)}
                    className="text-destructive hover:bg-destructive/10"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
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
