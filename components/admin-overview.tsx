"use client"

import Link from "next/link"
import { AlertTriangle, Box, Building2, FileClock, List, Users, Wrench } from "lucide-react"
import { useLanguage } from "@/lib/hooks/use-language"
import { PageHeader } from "@/components/page-header"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

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
  auditRecords: number
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
    audit: "Trazabilidad administrativa",
    auditDescription: "Registros reales en approver_audit_log, procurement_audit_log y audit_actions.",
    auditRecords: "registros de auditoría",
    auditEmpty: "No hay eventos registrados actualmente.",
    auditActive: "Hay eventos registrados en las tablas de auditoría.",
    viewAudit: "Revisar auditoría",
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
    audit: "Administrative traceability",
    auditDescription: "Real records in approver_audit_log, procurement_audit_log and audit_actions.",
    auditRecords: "audit records",
    auditEmpty: "No events are currently recorded.",
    auditActive: "Audit events are present in the audit tables.",
    viewAudit: "Review audit",
  },
  de: {
    title: "Administration und Kontrolle",
    description: "Betriebsübersicht, Stammdaten, interner Zugriff und Nachverfolgbarkeit.",
    overview: "Systemübersicht",
    assets: "Registrierte Anlagen",
    critical: "kritisch",
    employees: "Aktive Personen",
    issues: "Offene Vorfälle",
    maintenance: "Ausstehende Wartung",
    checklists: "Checklisten",
    catalogs: "Betriebskataloge",
    assetTypes: "Anlagentypen",
    locations: "Standorte",
    issueTypes: "Vorfalltypen",
    manage: "Verwalten",
    audit: "Administrative Nachverfolgbarkeit",
    auditDescription: "Reale Einträge in approver_audit_log, procurement_audit_log und audit_actions.",
    auditRecords: "Audit-Einträge",
    auditEmpty: "Derzeit sind keine Ereignisse erfasst.",
    auditActive: "In den Audit-Tabellen sind Ereignisse vorhanden.",
    viewAudit: "Audit prüfen",
  },
} as const

export function AdminOverview({ counts, auditRecords }: AdminOverviewProps) {
  const { language } = useLanguage()
  const text = copy[language]
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

        <Card className={auditRecords === 0 ? "border-amber-500/50" : undefined}>
          <CardHeader><CardTitle className="flex items-center gap-2"><FileClock className="h-5 w-5" />{text.audit}</CardTitle><CardDescription>{text.auditDescription}</CardDescription></CardHeader>
          <CardContent className="space-y-3"><div className="text-2xl font-semibold">{auditRecords}</div><p className="text-xs text-muted-foreground">{text.auditRecords}</p><p className="text-sm">{auditRecords === 0 ? text.auditEmpty : text.auditActive}</p><Link href="/admin/audit" className="inline-flex text-sm font-medium underline-offset-4 hover:underline">{text.viewAudit} →</Link></CardContent>
        </Card>

        <section>
          <h2 className="mb-4 text-lg font-semibold">{text.catalogs}</h2>
          <div className="grid gap-4 md:grid-cols-3">{catalogs.map(([label, value, href, Icon]) => <Link key={href} href={href}><Card className="h-full transition-colors hover:border-foreground/30"><CardHeader className="flex flex-row items-center justify-between pb-2"><CardTitle className="text-sm font-medium">{label}</CardTitle><Icon className="h-4 w-4 text-muted-foreground" /></CardHeader><CardContent><div className="text-2xl font-semibold">{value}</div><p className="mt-2 text-sm text-muted-foreground">{text.manage} →</p></CardContent></Card></Link>)}</div>
        </section>
      </div>
    </>
  )
}
