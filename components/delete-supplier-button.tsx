"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { createBrowserClient } from "@/lib/supabase/client"
import { Archive } from "lucide-react"

interface DeleteSupplierButtonProps {
  supplierId: string
  supplierName: string
  onDeleted: () => void
}

export function DeleteSupplierButton({ supplierId, supplierName, onDeleted }: DeleteSupplierButtonProps) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleDeactivate = async () => {
    setLoading(true)
    setError(null)
    const supabase = createBrowserClient()
    const { error: updateError } = await supabase.from("suppliers").update({
      is_active: false,
      approval_status: "rejected",
      approved_at: null,
      approved_by: null,
      updated_at: new Date().toISOString(),
    }).eq("id", supplierId)

    if (updateError) {
      setError(updateError.message)
      setLoading(false)
      return
    }

    onDeleted()
    setOpen(false)
    setLoading(false)
  }

  return (
    <>
      <Button variant="ghost" size="sm" onClick={() => setOpen(true)} aria-label={`Desactivar ${supplierName}`} title="Desactivar">
        <Archive className="h-4 w-4" />
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Desactivar proveedor</DialogTitle>
            <DialogDescription>“{supplierName}” quedará inactivo y rechazado. Su registro y cualquier relación histórica se conservarán.</DialogDescription>
          </DialogHeader>
          {error && <p className="text-sm text-destructive">No fue posible desactivar: {error}</p>}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button type="button" onClick={handleDeactivate} disabled={loading}>{loading ? "Desactivando…" : "Desactivar proveedor"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
