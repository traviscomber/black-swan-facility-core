"use client"

import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { createClient } from "@/lib/supabase/client"
import { toast } from "sonner"

interface KmzEditDialogProps {
  open: boolean
  kmz: { id: string; name: string } | null
  onOpenChange: (open: boolean) => void
  onSave: () => void
}

export function KmzEditDialog({ open, kmz, onOpenChange, onSave }: KmzEditDialogProps) {
  const [name, setName] = useState(kmz?.name || "")
  const [saving, setSaving] = useState(false)
  const supabase = createClient()

  useEffect(() => {
    if (kmz) setName(kmz.name || "")
  }, [kmz, open])

  const handleSave = async () => {
    if (!kmz || !name.trim()) return
    setSaving(true)
    try {
      const { error } = await supabase
        .from("gis_overlays")
        .update({ name: name.trim() })
        .eq("id", kmz.id)
      if (error) throw error
      toast.success("Nombre actualizado")
      onSave()
      onOpenChange(false)
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error)
      toast.error("Error al guardar: " + msg)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Renombrar KMZ</DialogTitle>
        </DialogHeader>
        <div>
          <Label htmlFor="name" className="text-sm font-medium">Nombre</Label>
          <Input
            id="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.nativeEvent.isComposing) handleSave() }}
            placeholder="Nombre del KMZ"
            className="mt-1"
            autoFocus
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleSave} disabled={saving || !name.trim()}>
            {saving ? "Guardando..." : "Guardar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
