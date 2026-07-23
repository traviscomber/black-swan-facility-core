"use client"

import Link from "next/link"
import { AlertTriangle, Box, Building2, List, ShieldCheck, Users, Wrench } from "lucide-react"
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
    description: "Resumen operativo, catálogos maestros y preparación para producción.",
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
    security: "Postura de seguridad del entorno",
    securityDescription: "Configuración observada en el esquema público durante la etapa de desarrollo.",
    environment: "Entorno de desarrollo",
    totalTables: "112 tablas públicas",
    enabled: "91 con RLS habilitado",
    disabled: "21 con RLS desactivado",
    noPolicies: "7 con RLS sin políticas",
    status: "RLS se mantiene deliberadamente incompleto durante desarrollo. Antes del paso a producción deberá existir una revisión, definición de roles, matriz de acceso, políticas por tabla y prueba de regresión.",
    noChanges: "No se aplicaron cambios de RLS ni permisos. Este panel registra el estado actual para preparar el checklist de producción.",
  },
  en: {
    title: "Administration and control",
    description: "Operational summary, master catalogs and production readiness.",
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
    security: "Environment security posture",
    securityDescription: "Configuration observed in the public schema during the development stage.",
    environment: "Development environment",
    totalTables: "112 public tables",
    enabled: "91 with RLS enabled",
    disabled: "21 with RLS disabled",
    noPolicies: "7 with RLS and no policies",
    status: "RLS is intentionally incomplete during development. Before production, the system will require a review, defined roles, an access matrix, table-level policies and regression testing.",
    noChanges: "No RLS or permission changes were applied. This panel records the current state for the production readiness checklist.",
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
              <Card key={label}>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium">{label}</CardTitle>
                  <Icon className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-semibold">{value}</div>
                  {detail && <p className="mt-1 text-xs text-muted-foreground">{detail}</p>}
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        <Card className="border-border">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><ShieldCheck className="h-5 w-5" />{text.security}</CardTitle>
            <CardDescription>{text.securityDescription}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <Badge>{text.environment}</Badge>
              <Badge variant="outline">{text.totalTables}</Badge>
              <Badge variant="outline">{text.enabled}</Badge>
              <Badge variant="outline">{text.disabled}</Badge>
              <Badge variant="outline">{text.noPolicies}</Badge>
            </div>
            <p className="text-sm">{text.status}</p>
            <p className="text-xs text-muted-foreground">{text.noChanges}</p>
          </CardContent>
        </Card>

        <section>
          <h2 className="mb-4 text-lg font-semibold">{text.catalogs}</h2>
          <div className="grid gap-4 md:grid-cols-3">
            {catalogs.map(([label, value, href, Icon]) => (
              <Link key={href} href={href}>
                <Card className="h-full transition-colors hover:border-foreground/30">
                  <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className="text-sm font-medium">{label}</CardTitle>
                    <Icon className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-semibold">{value}</div>
                    <p className="mt-2 text-sm text-muted-foreground">{text.manage} →</p>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        </section>
      </div>
    </>
  )
}
