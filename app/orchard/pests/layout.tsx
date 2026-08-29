import type { ReactNode } from "react"
import { OrchardAiFocusedRecord } from "@/components/orchard/orchard-ai-focused-record"

export default function HealthLayout({ children }: { children: ReactNode }) {
  return <OrchardAiFocusedRecord kind="health">{children}</OrchardAiFocusedRecord>
}
