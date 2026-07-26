import Link from "next/link"
import { ArrowLeft, Database, ShieldAlert, TriangleAlert } from "lucide-react"
import { AppLayout } from "@/components/app-layout"
import { PageHeader } from "@/components/page-header"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

const domains = [
  { name: "Hospitalidad y finanzas", tables: 10, anon: 3, authenticated: 10, risk: "Crítico", examples: "guests, reservations, invoices, payments, leads, messages" },
  { name: "Bitácoras y auditoría", tables: 7, anon: 7, authenticated: 7, risk: "Crítico", examples: "activity_logs, asset_logs, task_status_history, ai_events" },
  { name: "Finanzas y energía", tables: 3, anon: 3, authenticated: 3, risk: "Alto", examples: "budgets, utilities, vehicles" },
  { name: "GIS e infraestructura", tables: 2, anon: 2, authenticated: 2, risk: "Alto", examples: "operation_kmz_files, ports_boats" },
  { name: "Operaciones", tables: 5, anon: 5, authenticated: 5, risk: "Alto", examples: "activities, checklists, incidents, maintenance_tasks, task_assignments" },
  { name: "IA y soberanía", tables: 9, anon: 9, authenticated: 9, risk: "Medio", examples: "ai_agents, ai_context, ai_sessions, sovereignty_layers" },
  { name: "Otros catálogos y módulos", tables: 39, anon: 34, authenticated: 39, risk: "Revisión", examples: "catálogos, multimedia, activos y módulos auxiliares" },
] as const

const phases = [
  { step: "1", title: "Proteger datos personales y financieros", detail: "Retirar acceso anónimo y limitar escritura en huéspedes, leads, mensajes, reservas, facturas, pagos y presupuestos." },
  { step: "2", title: "Hacer inmutables las bitácoras", detail: "Separar lectura de escritura y evitar UPDATE, DELETE y TRUNCATE en tablas de auditoría e historial." },
  { step: "3", title: "Alinear operación con roles internos", detail: "Aplicar app_metadata.procurement_role o reglas equivalentes donde exista una función administrativa real." },
  { step: "4", title: "Endurecer GIS y catálogos", detail: "Mantener lectura operativa donde corresponda, pero restringir cambios de capas, infraestructura y catálogos maestros." },
  { step: "5", title: "Probar por rol antes de producción", detail: "Validar anon, authenticated, approver y admin con consultas SELECT y pruebas de escritura antes de aplicar cada migración." },
] as const

export default function AdminSecurityPage() {
  return (
    <AppLayout>
      <PageHeader title="Riesgo de acceso a datos" description="Clasificación verificada de políticas RLS amplias y privilegios efectivos en producción." />
      <div className="space-y-6 p-4 md:p-8">
        <Link href="/admin" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="h-4 w-4" /> Volver a Administración</Link>

        <div className="grid gap-4 md:grid-cols-3">
          <Card className="border-amber-500/50"><CardHeader><CardTitle className="flex items-center gap-2"><ShieldAlert className="h-5 w-5" />75 tablas</CardTitle><CardDescription>Política ALL sin restricción efectiva</CardDescription></CardHeader></Card>
          <Card className="border-destructive/40"><CardHeader><CardTitle className="flex items-center gap-2"><TriangleAlert className="h-5 w-5" />60 tablas</CardTitle><CardDescription>Privilegios concedidos al rol anónimo</CardDescription></CardHeader></Card>
          <Card><CardHeader><CardTitle className="flex items-center gap-2"><Database className="h-5 w-5" />75 tablas</CardTitle><CardDescription>Accesibles a usuarios autenticados</CardDescription></CardHeader></Card>
        </div>

        <Card className="border-amber-500/50">
          <CardHeader><CardTitle>Interpretación correcta</CardTitle><CardDescription>RLS habilitado no equivale a acceso restringido.</CardDescription></CardHeader>
          <CardContent className="space-y-2 text-sm"><p>Estas tablas combinan políticas que aceptan todas las filas con privilegios efectivos de SELECT, INSERT, UPDATE o DELETE.</p><p className="text-muted-foreground">La clasificación se verificó directamente en pg_policies e information_schema.role_table_grants el 26-07-2026. No se modificaron políticas ni datos.</p></CardContent>
        </Card>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold">Clasificación por dominio</h2>
          <div className="grid gap-4 lg:grid-cols-2">
            {domains.map((domain) => <Card key={domain.name}><CardHeader><div className="flex items-start justify-between gap-3"><div><CardTitle className="text-base">{domain.name}</CardTitle><CardDescription>{domain.examples}</CardDescription></div><Badge variant={domain.risk === "Crítico" ? "destructive" : "outline"}>{domain.risk}</Badge></div></CardHeader><CardContent className="grid grid-cols-3 gap-3"><div><p className="text-2xl font-semibold">{domain.tables}</p><p className="text-xs text-muted-foreground">tablas amplias</p></div><div><p className="text-2xl font-semibold">{domain.anon}</p><p className="text-xs text-muted-foreground">con acceso anon</p></div><div><p className="text-2xl font-semibold">{domain.authenticated}</p><p className="text-xs text-muted-foreground">con acceso autenticado</p></div></CardContent></Card>)}
          </div>
        </section>

        <Card>
          <CardHeader><CardTitle>Plan de endurecimiento por fases</CardTitle><CardDescription>No se aplicará ninguna fase sin revisar dependencias y autorizar la migración correspondiente.</CardDescription></CardHeader>
          <CardContent className="space-y-4">{phases.map((phase) => <div key={phase.step} className="flex gap-3 border-b pb-4 last:border-0 last:pb-0"><Badge variant="outline" className="h-6 min-w-6 justify-center">{phase.step}</Badge><div><p className="text-sm font-medium">{phase.title}</p><p className="mt-1 text-sm text-muted-foreground">{phase.detail}</p></div></div>)}</CardContent>
        </Card>
      </div>
    </AppLayout>
  )
}
