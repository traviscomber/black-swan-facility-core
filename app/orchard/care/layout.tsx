import type { ReactNode } from "react"
import { OrchardAiFocusedRecord } from "@/components/orchard/orchard-ai-focused-record"

export default function CareLayout({ children }: { children: ReactNode }) {
  return <OrchardAiFocusedRecord kind="care">{children}</OrchardAiFocusedRecord>
}
