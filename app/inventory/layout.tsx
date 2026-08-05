"use client"

import type React from "react"
import { AccessGate } from "@/components/access/access-gate"

export default function InventoryLayout({ children }: { children: React.ReactNode }) {
  return (
    <AccessGate action="inventory.process" department="inventory">
      <div className="min-h-screen bg-background">
        <div className="flex h-screen overflow-hidden">
          <main className="flex-1 overflow-auto">{children}</main>
        </div>
      </div>
    </AccessGate>
  )
}
