"use client"

import { Suspense } from "react"
import { InventoryContent } from "@/components/inventory/inventory-content"

export default function InventoryPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-muted-foreground">Loading inventory...</div>}>
      <InventoryContent />
    </Suspense>
  )
}
