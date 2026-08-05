"use client"

import type { ReactNode } from "react"
import { AccessGate } from "@/components/access/access-gate"

export default function FuelLayout({ children }: { children: ReactNode }) {
  return <AccessGate action="fuel.review" department="fuel">{children}</AccessGate>
}
