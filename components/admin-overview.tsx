"use client"

import Link from "next/link"
import { AlertTriangle, Box, Building2, Check, FileClock, List, ShieldAlert, UserCog, Users, Wrench, X } from "lucide-react"
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
    permissiveTables: number
    publicRoleTables: number
    authenticatedRoleTables: number
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
    broadPolicies: "tablas con política ALL sin restricción",
    publicRole: "asignadas al rol public",
    authenticatedRole: "asignadas a authenticated",
    securityWarning: "RLS está habilitado en todas las tablas, pero esto no significa que el acceso sea restrictivo. Existen políticas amplias que permiten todas las operaciones sin validar propietario ni rol interno.",
    access: "Acceso interno",
    accessDescription: "Roles almacenados en app_metadata y aplicados por middleware.",
    admins: "Administradores",
    approvers: "Aprobadores",
    totalInternal: "Cuentas internas con rol",
    permissions: "Matriz de permisos de rutas",
    permissionScope: "Esta matriz describe el middleware de la aplicación. Las políticas de base de datos pueden ser más amplias y deben revisarse por separado.",
    role: "Rol",
    operations: "Operación general",
    procurement: "Compras y aprobaciones",
    administration: "Administración",
    adminRole: "Admin",
    approverRole: "Approver",
    authenticatedRoleName: "Autenticado sin rol",
    requestsOnly: "Solo solicitudes",
    audit: "Trazabilidad administrativa",
    auditDescription: "Registros disponibles en approver_audit_log, procurement_audit_log y audit_actions.",
    auditRecords: "registros de auditoría",
    auditEmpty: "No hay eventos registrados actualmente. La trazabilidad todavía no puede considerarse operativa.",
    auditActive: "Hay eventos registrados en las tablas de auditoría.",
    viewAudit: "Revisar auditoría",
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
    broadPolicies: "tables with unrestricted ALL policies",
    publicRole: "assigned to public role",
    authenticatedRole: "assigned to authenticated",
    securityWarning: "RLS is enabled on every table, but this does not mean access is restrictive. Broad policies allow every operation without validating ownership or internal role.",
    access: "Internal access",
    accessDescription: "Roles stored in app_metadata and enforced by middleware.",
    admins: "Administrators",
    approvers: "Approvers",
    totalInternal: "Internal accounts with a role",
    permissions: "Route permission matrix",
    permissionScope: "This matrix describes application middleware. Database policies may be broader and require separate review.",
    role: "Role",
    operations: "General operations",
    procurement: "Procurement and approvals",
    administration: "Administration",
    adminRole: "Admin",
    approverRole: "Approver",
    authenticatedRoleName: "Authenticated without role",
    requestsOnly: "Requests only",
    audit: "Administrative traceability",
    auditDescription: "Records available in approver_audit_log, procurement_audit_log and audit_actions.",
    auditRecords: "audit records",
    auditEmpty: "No events are currently recorded. Traceability cannot yet be considered operational.",
    auditActive: "Audit events are present in the audit tables.",
    viewAudit: "Review audit",
    noDataChanges: "This review did not modify operational records or permissions.",
  },
} as const

function Permission({ allowed, label }: { allowed: boolean; label?: string }) {
  return <span className="inline-flex items-center gap-1 text-xs">{allowed ? <Check className="h-3.5 w-3.5" /> : <X className="h-3.5 w-3.5 text-muted-foreground" />}{label}</span>
}

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
              <Card key={label}><CardHeader className="flex flex-row items-center justify-between pb-2"><CardTitle className="text-sm font-medium">{label}</CardTitle><Icon className="h-4 w-4 text-muted-foreground" /></CardHeader><CardContent><div className="text-2xl font-semibold">{value}</div>{detail && <p className="mt-1 text-xs text-muted-foreground">{detail}</p>}</CardContent></Card>
            ))}
          </div>
        </section>

        <div className="grid gap-4 xl:grid-cols-3">
          <Card className="border-amber-500/50"><CardHeader><CardTitle className="flex items-center gap-2"><ShieldAlert className="h-5 w-5" />{text.security}</CardTitle><CardDescription>{text.securityDescription}</CardDescription></CardHeader><CardContent className="space-y-4"><div className="flex flex-wrap gap-2"><Badge>{text.verified} {controls.verifiedOn}</Badge><Badge variant="outline">{controls.publicTables} {text.publicTables}</Badge><Badge variant="outline">{controls.rlsEnabled} {text.rlsEnabled}</Badge><Badge variant="outline">{controls.rlsDisabled} {text.rlsDisabled}</Badge><Badge variant="outline">{controls.tablesWithoutPolicies} {text.noPolicies}</Badge></div><div className="grid grid-cols-3 gap-2"><div className="rounded-md border p-2"><p className="text-xl font-semibold">{controls.permissiveTables}</p><p className="text-xs text-muted-foreground">{text.broadPolicies}</p></div><div className="rounded-md border p-2"><p className="text-xl font-semibold">{controls.publicRoleTables}</p><p className="text-xs text-muted-foreground">{text.publicRole}</p></div><div className="rounded-md border p-2"><p className="text-xl font-semibold">{controls.authenticatedRoleTables}</p><p className="text-xs text-muted-foreground">{text.authenticatedRole}</p></div></div><p className="text-sm">{text.securityWarning}</p></CardContent></Card>

          <Card><CardHeader><CardTitle className="flex items-center gap-2"><UserCog className="h-5 w-5" />{text.access}</CardTitle><CardDescription>{text.accessDescription}</CardDescription></CardHeader><CardContent className="space-y-3"><div className="grid grid-cols-2 gap-3"><div className="rounded-md border p-3"><p className="text-xs text-muted-foreground">{text.admins}</p><p className="text-2xl font-semibold">{controls.adminUsers}</p></div><div className="rounded-md border p-3"><p className="text-xs text-muted-foreground">{text.approvers}</p><p className="text-2xl font-semibold">{controls.approverUsers}</p></div></div><p className="text-sm text-muted-foreground">{totalInternalUsers} {text.totalInternal.toLocaleLowerCase()}</p></CardContent></Card>

          <Card className={controls.auditRecords === 0 ? "border-amber-500/50" : undefined}><CardHeader><CardTitle className="flex items-center gap-2"><FileClock className="h-5 w-5" />{text.audit}</CardTitle><CardDescription>{text.auditDescription}</CardDescription></CardHeader><CardContent className="space-y-3"><div className="text-2xl font-semibold">{controls.auditRecords}</div><p className="text-xs text-muted-foreground">{text.auditRecords}</p><p className="text-sm">{controls.auditRecords === 0 ? text.auditEmpty : text.auditActive}</p><Link href="/admin/audit" className="inline-flex text-sm font-medium underline-offset-4 hover:underline">{text.viewAudit} →</Link></CardContent></Card>
        </div>

        <Card>
          <CardHeader><CardTitle>{text.permissions}</CardTitle><CardDescription>{text.permissionScope}</CardDescription></CardHeader>
          <CardContent className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead><tr className="border-b text-left"><th className="p-3 font-medium">{text.role}</th><th className="p-3 font-medium">{text.operations}</th><th className="p-3 font-medium">{text.procurement}</th><th className="p-3 font-medium">{text.administration}</th></tr></thead>
              <tbody>
                <tr className="border-b"><td className="p-3 font-medium">{text.adminRole}</td><td className="p-3"><Permission allowed /></td><td className="p-3"><Permission allowed /></td><td className="p-3"><Permission allowed /></td></tr>
                <tr className="border-b"><td className="p-3 font-medium">{text.approverRole}</td><td className="p-3"><Permission allowed /></td><td className="p-3"><Permission allowed /></td><td className="p-3"><Permission allowed={false} /></td></tr>
                <tr><td className="p-3 font-medium">{text.authenticatedRoleName}</td><td className="p-3"><Permission allowed /></td><td className="p-3"><Permission allowed label={text.requestsOnly} /></td><td className="p-3"><Permission allowed={false} /></td></tr>
              </tbody>
            </table>
          </CardContent>
        </Card>

        <p className="text-xs text-muted-foreground">{text.noDataChanges}</p>

        <section><h2 className="mb-4 text-lg font-semibold">{text.catalogs}</h2><div className="grid gap-4 md:grid-cols-3">{catalogs.map(([label, value, href, Icon]) => <Link key={href} href={href}><Card className="h-full transition-colors hover:border-foreground/30"><CardHeader className="flex flex-row items-center justify-between pb-2"><CardTitle className="text-sm font-medium">{label}</CardTitle><Icon className="h-4 w-4 text-muted-foreground" /></CardHeader><CardContent><div className="text-2xl font-semibold">{value}</div><p className="mt-2 text-sm text-muted-foreground">{text.manage} →</p></CardContent></Card></Link>)}</div></section>
      </div>
    </>
  )
}
