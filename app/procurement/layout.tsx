import type { ReactNode } from "react"
import { AccessGate } from "@/components/access/access-gate"
import { ProcurementReadinessPanel } from "@/components/procurement/procurement-readiness-panel"

export default function ProcurementLayout({ children }: { children: ReactNode }) {
  return (
    <AccessGate action="procurement.operate" department="procurement">
      <ProcurementReadinessPanel />
      {children}
    </AccessGate>
  )
}
