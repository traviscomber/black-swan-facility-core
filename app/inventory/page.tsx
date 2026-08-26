"use client"

import { Suspense } from "react"
import { InventoryCommandCenter } from "@/components/inventory/inventory-command-center"
import { InventoryContent } from "@/components/inventory/inventory-content"
import { InventoryHealthPanel } from "@/components/inventory/inventory-health-panel"
import { InventoryOperationsConsole } from "@/components/inventory/inventory-operations-console"
import { AssetQrLookup } from "@/components/inventory/asset-qr-lookup"
import { InventoryWorkflowNav } from "@/components/inventory/inventory-workflow-nav"

export default function InventoryPage() {
  return (
    <>
      <InventoryCommandCenter />
      <InventoryHealthPanel />
      <InventoryWorkflowNav />
      <AssetQrLookup />
      <InventoryOperationsConsole />
      <Suspense fallback={<div className="p-8 text-center text-muted-foreground">Cargando inventario...</div>}>
        <InventoryContent />
      </Suspense>
    </>
  )
}
