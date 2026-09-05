"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"

export function FarmMapModeNav(){
 const pathname=usePathname()
 const locale=pathname.split("/").filter(Boolean)[0]
 const prefix=["en","es","de"].includes(locale)?`/${locale}`:""
 const satellite=pathname.includes("/farm-map/satellite")
 return <nav className="absolute right-4 top-[84px] z-[600] flex border border-white/15 bg-[#171715]/94 text-[11px] shadow-xl backdrop-blur-sm" aria-label="Farm map view">
  <Link href={`${prefix}/orchard/farm-map`} aria-current={!satellite?"page":undefined} className={`border-r border-white/10 px-3 py-2 hover:bg-white/[.06] ${!satellite?"text-[#8fd6b9]":"text-[#d8d4ca]"}`}>Operational</Link>
  <Link href={`${prefix}/orchard/farm-map/satellite`} aria-current={satellite?"page":undefined} className={`px-3 py-2 hover:bg-white/[.06] ${satellite?"text-[#8fd6b9]":"text-[#d8d4ca]"}`}>Satellite</Link>
 </nav>
}
