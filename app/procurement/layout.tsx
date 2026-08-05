import type { ReactNode } from "react"
import { ProcurementReadinessPanel } from "@/components/procurement/procurement-readiness-panel"

export default function ProcurementLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <ProcurementReadinessPanel />
      {children}
    </>
  )
}
