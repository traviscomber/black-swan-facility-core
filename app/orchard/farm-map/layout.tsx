import type { ReactNode } from "react"
import "./farm-map-calm.css"

export default function FarmMapLayout({ children }: { children: ReactNode }) {
  return <div data-orchard-farm-map-layout>{children}</div>
}
