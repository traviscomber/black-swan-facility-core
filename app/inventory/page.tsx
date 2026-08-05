"use client"

import { Suspense } from "react"
import { InventoryContent } from "@/components/inventory/inventory-content"
import { InventoryHealthPanel } from "@/components/inventory/inventory-health-panel"
import { InventoryOperationsConsole } from "@/components/inventory/inventory-operations-console"
import { AssetQrLookup } from "@/components/inventory/asset-qr-lookup"

export default function InventoryPage() {
  return (
    <>
      <InventoryHealthPanel />
      <AssetQrLookup />
      <InventoryOperationsConsole />
      <Suspense fallback={<div className="p-8 text-center text-muted-foreground">Cargando inventario...</div>}>
        <InventoryContent />
      </Suspense>
    </>
  )
}
