"use client"

import type { ReactNode } from "react"
import { AccessGate } from "@/components/access/access-gate"

export default function MaintenanceLayout({ children }: { children: ReactNode }) {
  return <AccessGate action="maintenance.operate" department="maintenance">{children}</AccessGate>
}
