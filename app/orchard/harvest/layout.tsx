import type { ReactNode } from "react"
import { OrchardAiFocusedRecord } from "@/components/orchard/orchard-ai-focused-record"

export default function HarvestLayout({ children }: { children: ReactNode }) {
  return <OrchardAiFocusedRecord kind="harvest">{children}</OrchardAiFocusedRecord>
}
