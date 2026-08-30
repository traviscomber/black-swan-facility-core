"use client"

import type React from "react"
import { AlertTriangle, LayoutDashboard, MessageSquare, Users } from "lucide-react"
import { usePathname, useRouter } from "next/navigation"
import { AppLayout } from "@/components/app-layout"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useLanguage } from "@/lib/hooks/use-language"

const COPY={en:{dashboard:"Dashboard",leads:"Leads",messages:"Messages",incidents:"Incidents"},es:{dashboard:"Panel",leads:"Contactos",messages:"Mensajes",incidents:"Incidencias"},de:{dashboard:"Übersicht",leads:"Kontakte",messages:"Nachrichten",incidents:"Vorfälle"}} as const
export default function ConciergeLayout({children}:{children:React.ReactNode}){const router=useRouter();const pathname=usePathname();const{language}=useLanguage();const c=COPY[(language in COPY?language:"en") as keyof typeof COPY];const activeTab=pathname==="/concierge"?"dashboard":pathname?.includes("/leads")?"leads":pathname?.includes("/messages")?"messages":pathname?.includes("/incidents")?"incidents":"dashboard";function handleTabChange(value:string){const paths:Record<string,string>={dashboard:"/concierge",leads:"/concierge/leads",messages:"/concierge/messages",incidents:"/concierge/incidents"};if(paths[value])router.push(paths[value])}return <AppLayout><div className="flex h-screen flex-col"><div className="border-b bg-card px-6 py-3"><Tabs value={activeTab} onValueChange={handleTabChange}><TabsList><TabsTrigger value="dashboard" className="gap-2"><LayoutDashboard className="h-4 w-4"/>{c.dashboard}</TabsTrigger><TabsTrigger value="leads" className="gap-2"><Users className="h-4 w-4"/>{c.leads}</TabsTrigger><TabsTrigger value="messages" className="gap-2"><MessageSquare className="h-4 w-4"/>{c.messages}</TabsTrigger><TabsTrigger value="incidents" className="gap-2"><AlertTriangle className="h-4 w-4"/>{c.incidents}</TabsTrigger></TabsList></Tabs></div><div className="flex-1 overflow-auto p-6">{children}</div></div></AppLayout>}
