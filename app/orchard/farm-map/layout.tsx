import type { ReactNode } from "react"
import "leaflet/dist/leaflet.css"
import "./farm-map-calm.css"
import { FarmMapModeNav } from "./farm-map-mode-nav"

export default function FarmMapLayout({ children }: { children: ReactNode }) {
  return <div data-orchard-farm-map-layout className="relative">
    {children}
    <FarmMapModeNav/>
  </div>
}
