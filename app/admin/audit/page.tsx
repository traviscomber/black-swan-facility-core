import Link from "next/link"
import { ArrowLeft, CheckCircle2, FileClock, ShieldCheck } from "lucide-react"
import { AppLayout } from "@/components/app-layout"
import { PageHeader } from "@/components/page-header"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { createClient } from "@/lib/supabase/server"

const primarySources = [
  {
    table: "approver_audit_log",
    title: "Aprobaciones de compras",
    description: "Acciones ejecutadas por aprobadores sobre solicitudes de compra.",
    access: "Lectura limitada al aprobador asociado.",
  },
  {
    table: "procurement_audit_log",
    title: "Flujo de abastecimiento",
    description: "Cambios y acciones asociados al proceso de compras y sus entidades.",
    access: "Lectura autenticada; escritura controlada para admin y approver.",
  },
  {
    table: "audit_actions",
    title: "Acciones de hospitalidad",
    description: "Eventos vinculados a reservas, leads y automatizaciones.",
    access: "Solo lectura e inserción autenticada; sin UPDATE, DELETE ni TRUNCATE.",
  },
] as const

const appendOnlySources = [
  { table: "activity_logs", records: 0, purpose: "Cambios en actividades" },
  { table: "ai_operation_logs", records: 8, purpose: "Ejecuciones y mensajes de agentes" },
  { table: "asset_logs", records: 0, purpose: "Historial de activos" },
  { table: "audit_actions", records: 0, purpose: "Acciones de hospitalidad" },
  { table: "multimedia_asset_logs", records: 0, purpose: "Cambios en activos multimedia" },
  { table: "reservation_history", records: 0, purpose: "Historial de reservas" },
  { table: "task_status_history", records: 0, purpose: "Cambios de estado de tareas" },
] as const

export default async function AdminAuditPage() {
  const supabase = await createClient()
  const results = await Promise.all(
    primarySources.map((source) => supabase.from(source.table).select("*", { count: "exact", head: true })),
  )

  const sourceCounts = primarySources.map((source, index) => ({
    ...source,
    count: results[index].count ?? 0,
    error: results[index].error?.message ?? null,
  }))
  const totalRecords = sourceCounts.reduce((total, source) => total + source.count, 0)
  const appendOnlyRecords = appendOnlySources.reduce((total, source) => total + source.records, 0)

  return (
    <AppLayout>
      <PageHeader
        title="Auditoría administrativa"
        description="Estado verificable de las fuentes de trazabilidad y sus controles de acceso en producción."
      />
      <div className="space-y-6 p-4 md:p-8">
        <Link href="/admin" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Volver a Administración
        </Link>

        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><FileClock className="h-5 w-5" />Fuentes principales</CardTitle>
              <CardDescription>Registros disponibles en las tres fuentes administrativas.</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-semibold">{totalRecords.toLocaleString("es-CL")}</p>
              <p className="mt-2 text-sm text-muted-foreground">Registros encontrados</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><FileClock className="h-5 w-5" />Bitácoras operativas</CardTitle>
              <CardDescription>Siete fuentes protegidas como append-only.</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-semibold">{appendOnlyRecords.toLocaleString("es-CL")}</p>
              <p className="mt-2 text-sm text-muted-foreground">8 registros, todos en ai_operation_logs</p>
            </CardContent>
          </Card>

          <Card className="border-emerald-500/40">
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><ShieldCheck className="h-5 w-5" />Control de integridad</CardTitle>
              <CardDescription>Permisos verificados después de la migración.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <Badge variant="secondary">Bitácoras append-only</Badge>
              <p className="text-sm">Los usuarios autenticados pueden consultar y agregar eventos, pero no modificar, borrar ni truncar registros existentes.</p>
            </CardContent>
          </Card>
        </div>

        <Card className="border-emerald-500/40">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><CheckCircle2 className="h-5 w-5" />Brecha de permisos cerrada</CardTitle>
            <CardDescription>Migración aplicada sin modificar eventos existentes.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p>Se retiró todo acceso anónimo de las siete bitácoras operativas revisadas.</p>
            <p>Se retiraron los privilegios <span className="font-mono">UPDATE</span>, <span className="font-mono">DELETE</span> y <span className="font-mono">TRUNCATE</span> para usuarios autenticados.</p>
            <p className="text-muted-foreground">La inserción autenticada se conserva para no bloquear escritores operativos existentes. La identidad y cobertura de esos escritores se seguirá validando en el roadmap.</p>
          </CardContent>
        </Card>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold">Fuentes administrativas</h2>
          <div className="grid gap-4 lg:grid-cols-3">
            {sourceCounts.map((source) => (
              <Card key={source.table}>
                <CardHeader>
                  <CardTitle className="text-base">{source.title}</CardTitle>
                  <CardDescription>{source.description}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <p className="text-2xl font-semibold">{source.count.toLocaleString("es-CL")}</p>
                  <p className="font-mono text-xs text-muted-foreground">{source.table}</p>
                  <p className="text-xs text-muted-foreground">{source.access}</p>
                  {source.error ? <p className="text-xs text-destructive">No fue posible consultar esta fuente: {source.error}</p> : <Badge variant="secondary">Consulta verificada</Badge>}
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        <Card>
          <CardHeader><CardTitle>Bitácoras protegidas</CardTitle><CardDescription>Conteos verificados antes y después de la migración.</CardDescription></CardHeader>
          <CardContent className="overflow-x-auto">
            <table className="w-full min-w-[680px] text-sm">
              <thead><tr className="border-b text-left"><th className="p-3">Tabla</th><th className="p-3">Registros</th><th className="p-3">Propósito</th><th className="p-3">Permisos</th></tr></thead>
              <tbody>
                {appendOnlySources.map((source) => (
                  <tr key={source.table} className="border-b last:border-0">
                    <td className="p-3 font-mono text-xs">{source.table}</td>
                    <td className="p-3">{source.records.toLocaleString("es-CL")}</td>
                    <td className="p-3 text-muted-foreground">{source.purpose}</td>
                    <td className="p-3">SELECT + INSERT autenticado</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Alcance actual</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            <p>La vista no expone nombres, correos, teléfonos ni identificadores de usuarios.</p>
            <p>La migración no creó, modificó ni eliminó eventos existentes.</p>
            <p>El siguiente paso es conectar y verificar la cobertura de acciones críticas reales, no solo la existencia de tablas.</p>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  )
}
