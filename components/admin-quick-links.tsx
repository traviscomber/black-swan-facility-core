"use client"

import Link from "next/link"
import { Activity, KeyRound } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { useLanguage } from "@/lib/hooks/use-language"

const copy = {
  es: {
    accessTitle: "Administrar accesos y alcance",
    accessDescription: "Roles, suspensión, departamentos, ubicaciones y permisos efectivos.",
    itTitle: "IT Control Center",
    itDescription: "Jobs, freshness, retries, RLS y perfiles leídos en vivo desde producción.",
    open: "Abrir",
  },
  en: {
    accessTitle: "Manage access and scope",
    accessDescription: "Roles, suspension, departments, locations and effective permissions.",
    itTitle: "IT Control Center",
    itDescription: "Jobs, freshness, retries, RLS and profiles read live from production.",
    open: "Open",
  },
  de: {
    accessTitle: "Zugriff und Geltungsbereich verwalten",
    accessDescription: "Rollen, Sperrung, Abteilungen, Standorte und effektive Berechtigungen.",
    itTitle: "IT Control Center",
    itDescription: "Jobs, Aktualität, Retries, RLS und Profile live aus der Produktion.",
    open: "Öffnen",
  },
} as const

export function AdminQuickLinks() {
  const { language } = useLanguage()
  const text = copy[language]

  return (
    <div className="grid gap-4 px-4 pb-8 md:grid-cols-2 md:px-8">
      <Link href={`/${language}/admin/access`}>
        <Card className="h-full border-emerald-500/50 transition-colors hover:border-emerald-500">
          <CardContent className="flex items-center justify-between gap-4 p-4">
            <div className="flex items-center gap-3">
              <KeyRound className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium">{text.accessTitle}</p>
                <p className="text-xs text-muted-foreground">{text.accessDescription}</p>
              </div>
            </div>
            <span className="text-sm">{text.open} →</span>
          </CardContent>
        </Card>
      </Link>
      <Link href={`/${language}/admin/it-control`}>
        <Card className="h-full border-sky-500/50 transition-colors hover:border-sky-500">
          <CardContent className="flex items-center justify-between gap-4 p-4">
            <div className="flex items-center gap-3">
              <Activity className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium">{text.itTitle}</p>
                <p className="text-xs text-muted-foreground">{text.itDescription}</p>
              </div>
            </div>
            <span className="text-sm">{text.open} →</span>
          </CardContent>
        </Card>
      </Link>
    </div>
  )
}
