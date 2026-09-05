import type { ReactNode } from "react"
import Link from "next/link"
import "leaflet/dist/leaflet.css"
import "./farm-map-calm.css"

export default function FarmMapLayout({ children }: { children: ReactNode }) {
  return <div data-orchard-farm-map-layout className="relative">
    {children}
    <nav className="absolute right-4 top-[84px] z-[600] flex border border-white/15 bg-[#171715]/94 text-[11px] shadow-xl backdrop-blur-sm" aria-label="Farm map view">
      <Link href="/en/orchard/farm-map" className="border-r border-white/10 px-3 py-2 text-[#d8d4ca] hover:bg-white/[.06]">Operational</Link>
      <Link href="/en/orchard/farm-map/satellite" className="px-3 py-2 text-[#8fd6b9] hover:bg-white/[.06]">Satellite</Link>
    </nav>
  </div>
}
