import type { ReactNode } from "react"
import "./seed-orders-scan.css"

export default function SeedOrdersLayout({ children }: { children: ReactNode }) {
  return <div data-orchard-seed-orders-layout>{children}</div>
}
