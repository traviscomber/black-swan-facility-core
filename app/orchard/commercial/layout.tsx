import type { ReactNode } from "react"
import { OrchardAiFocusedRecord } from "@/components/orchard/orchard-ai-focused-record"

export default function CommercialLayout({ children }: { children: ReactNode }) {
  return <OrchardAiFocusedRecord kind="commercial">{children}</OrchardAiFocusedRecord>
}
