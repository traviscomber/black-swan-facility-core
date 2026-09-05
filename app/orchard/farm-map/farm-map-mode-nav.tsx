"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useLanguage } from "@/lib/hooks/use-language"

const copy={en:{operational:"Operational",satellite:"Satellite",label:"Farm map view"},es:{operational:"Operacional",satellite:"Satélite",label:"Vista del mapa de la granja"},de:{operational:"Operativ",satellite:"Satellit",label:"Hofkartenansicht"}} as const

export function FarmMapModeNav(){
 const pathname=usePathname()
 const {language}=useLanguage();const text=copy[language]
 const locale=pathname.split("/").filter(Boolean)[0]
 const prefix=["en","es","de"].includes(locale)?`/${locale}`:""
 const satellite=pathname.includes("/farm-map/satellite")
 return <nav className="absolute right-4 top-[84px] z-[600] flex border border-white/15 bg-[#171715]/94 text-[11px] shadow-xl backdrop-blur-sm" aria-label={text.label}>
  <Link href={`${prefix}/orchard/farm-map`} aria-current={!satellite?"page":undefined} className={`border-r border-white/10 px-3 py-2 hover:bg-white/[.06] ${!satellite?"text-[#8fd6b9]":"text-[#d8d4ca]"}`}>{text.operational}</Link>
  <Link href={`${prefix}/orchard/farm-map/satellite`} aria-current={satellite?"page":undefined} className={`px-3 py-2 hover:bg-white/[.06] ${satellite?"text-[#8fd6b9]":"text-[#d8d4ca]"}`}>{text.satellite}</Link>
 </nav>
}
