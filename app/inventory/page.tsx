"use client"

import { Suspense } from "react"
import { InventoryCommandCenter } from "@/components/inventory/inventory-command-center"
import { InventoryContent } from "@/components/inventory/inventory-content"
import { InventoryHealthPanel } from "@/components/inventory/inventory-health-panel"
import { InventoryOperationsConsole } from "@/components/inventory/inventory-operations-console"
import { InventoryAssetMaintenancePanel } from "@/components/inventory/inventory-asset-maintenance-panel"
import { AssetQrLookup } from "@/components/inventory/asset-qr-lookup"
import { InventoryWorkflowNav } from "@/components/inventory/inventory-workflow-nav"
import { useLanguage } from "@/lib/hooks/use-language"

const loadingCopy = {
  en: "Loading inventory…",
  es: "Cargando inventario…",
  de: "Inventar wird geladen…",
} as const

export default function InventoryPage() {
  const { language } = useLanguage()

  return (
    <>
      <InventoryCommandCenter />
      <InventoryHealthPanel />
      <InventoryWorkflowNav />
      <AssetQrLookup />
      <InventoryOperationsConsole />
      <InventoryAssetMaintenancePanel />
      <Suspense fallback={<div className="p-8 text-center text-muted-foreground">{loadingCopy[language]}</div>}>
        <InventoryContent />
      </Suspense>
    </>
  )
}
