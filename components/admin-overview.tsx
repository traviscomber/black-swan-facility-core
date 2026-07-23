"use client"

import Link from "next/link"
import { AlertTriangle, Box, Building2, List, ShieldAlert, Users, Wrench } from "lucide-react"
import { useLanguage } from "@/lib/hooks/use-language"
import { PageHeader } from "@/components/page-header"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"

interface AdminOverviewProps {
  counts: {
    assets: number
    criticalAssets: number
    employees: number
    openIssues: number
    pendingMaintenance: number
    checklists: number
    assetTypes: number
    locations: number
    issueTypes: number
  }
}

const copy = {
  es: {
    title: "Administración y control",
    description: "Resumen operativo, catálogos maestros y estado de seguridad verificado.",
    overview: "Resumen del sistema",
    assets: "Activos registrados",
    critical: "críticos",
    employees: "Personas activas",
    issues: "Incidencias abiertas",
    maintenance: "Mantenimientos pendientes",
    checklists: "Listas de verificación",
    catalogs: "Catálogos operativos",
    assetTypes: "Tipos de activo",
    locations: "Ubicaciones",
    issueTypes: "Tipos de incidencia",
    manage: "Administrar",
    security: "Estado de seguridad de datos",
    securityDescription: "Auditoría directa del esquema público realizada el 22 de julio de 2026.",
    totalTables: "112 tablas públicas",
    enabled: "91 con RLS habilitado",
    disabled: "21 con RLS desactivado",
    noPolicies: "7 con RLS habilitado pero sin políticas",
    warning: "La base de datos no está protegida de forma uniforme. Esta pantalla no debe afirmar que RLS está completamente configurado hasta corregir y validar las políticas tabla por tabla.",
    noChanges: "Este estado es informativo. No se aplicaron cambios de seguridad ni permisos desde esta pantalla.",
  },
  en: {
    title: "Administration and control",
    description: "Operational summary, master catalogs and verified security status.",
    overview: "System overview",
    assets: "Registered assets",
    critical: "critical",
    employees: "Active people",
    issues: "Open issues",
    maintenance: "Pending maintenance",
    checklists: "Checklists",
    catalogs: "Operational catalogs",
    assetTypes: "Asset types",
    locations: "Locations",
    issueTypes: "Issue types",
    manage: "Manage",
    security: "Data security status",
    securityDescription: "Direct audit of the public schema performed on July 22, 2026.",
    totalTables: "112 public tables",
    enabled: "91 with RLS enabled",
    disabled: "21 with RLS disabled",
    noPolicies: "7 with RLS enabled but no policies",
    warning: "Database protection is not uniform. This screen must not claim that RLS is fully configured until policies are corrected and validated table by table.",
    noChanges: "This status is informational. No security or permission changes were applied from this screen.",
  },
} as const

export function AdminOverview({ counts }: AdminOverviewProps) {
  const { language } = useLanguage()
  const text = copy[language === "es" ? "es" : "en"]
  const metrics = [
    [text.assets, counts.assets, `${counts.criticalAssets} ${text.critical}`, Box],
    [text.employees, counts.employees, "", Users],
    [text.issues, counts.openIssues, "", AlertTriangle],
    [text.maintenance, counts.pendingMaintenance, "", Wrench],
    [text.checklists, counts.checklists, "", List],
  ] as const
  const catalogs = [
    [text.assetTypes, counts.assetTypes, "/admin/asset-types", List],
    [text.locations, counts.locations, "/admin/locations", Building2],
    [text.issueTypes, counts.issueTypes, "/admin/issue-types", AlertTriangle],
  ] as const

  return (
    <>
      <PageHeader title={text.title} description={text.description} />
      <div className="space-y-8 p-4 md:p-8">
        <section>
          <h2 className="mb-4 text-lg font-semibold">{text.overview}</h2>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
            {metrics.map(([label, value, detail, Icon]) => (
              <Card key={label}><CardHeader className="flex flex-row items-center justify-between pb-2"><CardTitle className="text-sm font-medium">{label}</CardTitle><Icon className="h-4 w-4 text-muted-foreground" /></CardHeader><CardContent><div className="text-2xl font-semibold">{value}</div>{detail && <p className="mt-1 text-xs text-muted-foreground">{detail}</p>}</CardContent></Card>
            ))}
          </div>
        </section>

        <Card className="border-amber-300">
          <CardHeader><CardTitle className="flex items-center gap-2"><ShieldAlert className="h-5 w-5" />{text.security}</CardTitle><CardDescription>{text.securityDescription}</CardDescription></CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-2"><Badge variant="outline">{text.totalTables}</Badge><Badge variant="outline">{text.enabled}</Badge><Badge variant="destructive">{text.disabled}</Badge><Badge variant="destructive">{text.noPolicies}</Badge></div>
            <p className="text-sm">{text.warning}</p><p className="text-xs text-muted-foreground">{text.noChanges}</p>
          </CardContent>
        </Card>

        <section>
          <h2 className="mb-4 text-lg font-semibold">{text.catalogs}</h2>
          <div className="grid gap-4 md:grid-cols-3">
            {catalogs.map(([label, value, href, Icon]) => (
              <Link key={href} href={href}><Card className="h-full transition-colors hover:border-foreground/30"><CardHeader className="flex flex-row items-center justify-between pb-2"><CardTitle className="text-sm font-medium">{label}</CardTitle><Icon className="h-4 w-4 text-muted-foreground" /></CardHeader><CardContent><div className="text-2xl font-semibold">{value}</div><p className="mt-2 text-sm text-muted-foreground">{text.manage} →</p></CardContent></Card></Link>
            ))}
          </div>
        </section>
      </div>
    </>
  )
}
