"use client"

import Link from "next/link"
import { AlertTriangle, Box, Building2, FileClock, List, ShieldCheck, UserCog, Users, Wrench } from "lucide-react"
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
  controls: {
    publicTables: number
    rlsEnabled: number
    rlsDisabled: number
    tablesWithoutPolicies: number
    adminUsers: number
    approverUsers: number
    auditRecords: number
    verifiedOn: string
  }
}

const copy = {
  es: {
    title: "Administración y control",
    description: "Resumen operativo, catálogos maestros, acceso interno y trazabilidad.",
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
    security: "Seguridad del esquema público",
    securityDescription: "Fotografía verificada directamente en producción.",
    verified: "Verificado",
    publicTables: "tablas públicas",
    rlsEnabled: "con RLS habilitado",
    rlsDisabled: "con RLS desactivado",
    noPolicies: "sin políticas",
    secureStatus: "Todas las tablas públicas tienen RLS habilitado y al menos una política activa.",
    access: "Acceso interno",
    accessDescription: "Roles almacenados en app_metadata y usados para controlar funciones administrativas y de aprobación.",
    admins: "Administradores",
    approvers: "Aprobadores",
    totalInternal: "Cuentas internas con rol",
    audit: "Trazabilidad administrativa",
    auditDescription: "Registros disponibles en approver_audit_log, procurement_audit_log y audit_actions.",
    auditRecords: "registros de auditoría",
    auditEmpty: "No hay eventos registrados actualmente. Las acciones futuras deben generar trazabilidad antes de considerar este control operativo.",
    auditActive: "Hay eventos registrados en las tablas de auditoría.",
    noDataChanges: "Esta revisión no modificó registros operativos ni permisos.",
  },
  en: {
    title: "Administration and control",
    description: "Operational summary, master catalogs, internal access and traceability.",
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
    security: "Public schema security",
    securityDescription: "Snapshot verified directly in production.",
    verified: "Verified",
    publicTables: "public tables",
    rlsEnabled: "with RLS enabled",
    rlsDisabled: "with RLS disabled",
    noPolicies: "without policies",
    secureStatus: "Every public table has RLS enabled and at least one active policy.",
    access: "Internal access",
    accessDescription: "Roles stored in app_metadata and used to control administrative and approval functions.",
    admins: "Administrators",
    approvers: "Approvers",
    totalInternal: "Internal accounts with a role",
    audit: "Administrative traceability",
    auditDescription: "Records available in approver_audit_log, procurement_audit_log and audit_actions.",
    auditRecords: "audit records",
    auditEmpty: "No events are currently recorded. Future actions must create traceability before this control can be considered operational.",
    auditActive: "Audit events are present in the audit tables.",
    noDataChanges: "This review did not modify operational records or permissions.",
  },
} as const

export function AdminOverview({ counts, controls }: AdminOverviewProps) {
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
  const totalInternalUsers = controls.adminUsers + controls.approverUsers

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

        <div className="grid gap-4 xl:grid-cols-3">
          <Card className="border-border">
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><ShieldCheck className="h-5 w-5" />{text.security}</CardTitle>
              <CardDescription>{text.securityDescription}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap gap-2">
                <Badge>{text.verified} {controls.verifiedOn}</Badge>
                <Badge variant="outline">{controls.publicTables} {text.publicTables}</Badge>
                <Badge variant="outline">{controls.rlsEnabled} {text.rlsEnabled}</Badge>
                <Badge variant="outline">{controls.rlsDisabled} {text.rlsDisabled}</Badge>
                <Badge variant="outline">{controls.tablesWithoutPolicies} {text.noPolicies}</Badge>
              </div>
              <p className="text-sm">{text.secureStatus}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><UserCog className="h-5 w-5" />{text.access}</CardTitle>
              <CardDescription>{text.accessDescription}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-md border p-3"><p className="text-xs text-muted-foreground">{text.admins}</p><p className="text-2xl font-semibold">{controls.adminUsers}</p></div>
                <div className="rounded-md border p-3"><p className="text-xs text-muted-foreground">{text.approvers}</p><p className="text-2xl font-semibold">{controls.approverUsers}</p></div>
              </div>
              <p className="text-sm text-muted-foreground">{totalInternalUsers} {text.totalInternal.toLocaleLowerCase()}</p>
            </CardContent>
          </Card>

          <Card className={controls.auditRecords === 0 ? "border-amber-500/50" : undefined}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><FileClock className="h-5 w-5" />{text.audit}</CardTitle>
              <CardDescription>{text.auditDescription}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="text-2xl font-semibold">{controls.auditRecords}</div>
              <p className="text-xs text-muted-foreground">{text.auditRecords}</p>
              <p className="text-sm">{controls.auditRecords === 0 ? text.auditEmpty : text.auditActive}</p>
            </CardContent>
          </Card>
        </div>

        <p className="text-xs text-muted-foreground">{text.noDataChanges}</p>

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
