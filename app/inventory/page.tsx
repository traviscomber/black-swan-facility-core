"use client"

import { Suspense } from "react"
import { InventoryContent } from "@/components/inventory/inventory-content"
import { InventoryHealthPanel } from "@/components/inventory/inventory-health-panel"
import { InventoryOperationsConsole } from "@/components/inventory/inventory-operations-console"

export default function InventoryPage() {
  return (
    <>
      <InventoryHealthPanel />
      <InventoryOperationsConsole />
      <Suspense fallback={<div className="p-8 text-center text-muted-foreground">Cargando inventario...</div>}>
        <InventoryContent />
      </Suspense>
    </>
  )
}
