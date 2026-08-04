"use client"

import { Suspense } from "react"
import { InventoryContent } from "@/components/inventory/inventory-content"
import { InventoryHealthPanel } from "@/components/inventory/inventory-health-panel"

export default function InventoryPage() {
  return (
    <>
      <InventoryHealthPanel />
      <Suspense fallback={<div className="p-8 text-center text-muted-foreground">Cargando inventario...</div>}>
        <InventoryContent />
      </Suspense>
    </>
  )
}
