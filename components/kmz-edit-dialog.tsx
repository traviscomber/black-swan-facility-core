"use client"

import React, { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { createClient } from "@/lib/supabase/client"
import { toast } from "sonner"

interface KmzEditDialogProps {
  open: boolean
  kmz: {
    id: string
    name: string
    color?: string
  } | null
  onOpenChange: (open: boolean) => void
  onSave: () => void
}

export function KmzEditDialog({ open, kmz, onOpenChange, onSave }: KmzEditDialogProps) {
  const [name, setName] = useState(kmz?.name || "")
  const [color, setColor] = useState(kmz?.color || "#3388ff")
  const [saving, setSaving] = useState(false)
  const supabase = createClient()

  // Update state when kmz changes
  useEffect(() => {
    if (kmz) {
      setName(kmz.name || "")
      setColor(kmz.color || "#3388ff")
    }
  }, [kmz, open])

  const handleSave = async () => {
    if (!kmz) return

    setSaving(true)
    try {
      const { error } = await supabase
        .from("gis_overlays")
        .update({
          name,
          color,
          updated_at: new Date().toISOString(),
        })
        .eq("id", kmz.id)

      if (error) throw error

      toast.success("KMZ actualizado")
      onSave()
      onOpenChange(false)
    } catch (error) {
      console.error("[v0] Error saving KMZ:", error)
      toast.error("Error al guardar")
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Editar KMZ</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label htmlFor="name" className="text-sm font-medium">
              Nombre
            </Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Nombre del KMZ"
              className="mt-1"
            />
          </div>

          <div>
            <Label htmlFor="color" className="text-sm font-medium">
              Color del Polígono
            </Label>
            <div className="flex gap-2 mt-1">
              <input
                id="color"
                type="color"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                className="h-10 w-16 rounded border cursor-pointer"
              />
              <Input
                value={color}
                onChange={(e) => setColor(e.target.value)}
                placeholder="#3388ff"
                className="flex-1"
              />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={saving} className="bg-primary">
            {saving ? "Guardando..." : "Guardar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
