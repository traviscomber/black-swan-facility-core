import type { ReactNode } from "react"
import { AccessGate } from "@/components/access/access-gate"

export default function ProcurementLayout({ children }: { children: ReactNode }) {
  return (
    <AccessGate action="procurement.operate" department="procurement">
      {children}
    </AccessGate>
  )
}
