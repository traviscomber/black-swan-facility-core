import Link from "next/link"
import { ArrowLeft, FileClock, ShieldAlert } from "lucide-react"
import { AppLayout } from "@/components/app-layout"
import { PageHeader } from "@/components/page-header"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { createClient } from "@/lib/supabase/server"

const sources = [
  {
    table: "approver_audit_log",
    title: "Aprobaciones de compras",
    description: "Acciones ejecutadas por aprobadores sobre solicitudes de compra.",
  },
  {
    table: "procurement_audit_log",
    title: "Flujo de abastecimiento",
    description: "Cambios y acciones asociados al proceso de compras y sus entidades.",
  },
  {
    table: "audit_actions",
    title: "Acciones de hospitalidad",
    description: "Eventos registrados por automatizaciones vinculadas a reservas y leads.",
  },
] as const

export default async function AdminAuditPage() {
  const supabase = await createClient()
  const results = await Promise.all(
    sources.map((source) => supabase.from(source.table).select("*", { count: "exact", head: true })),
  )

  const sourceCounts = sources.map((source, index) => ({
    ...source,
    count: results[index].count ?? 0,
    error: results[index].error?.message ?? null,
  }))
  const totalRecords = sourceCounts.reduce((total, source) => total + source.count, 0)

  return (
    <AppLayout>
      <PageHeader
        title="Auditoría administrativa"
        description="Estado verificable de las fuentes de trazabilidad disponibles en producción."
      />
      <div className="space-y-6 p-4 md:p-8">
        <Link href="/admin" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Volver a Administración
        </Link>

        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><FileClock className="h-5 w-5" />Registros disponibles</CardTitle>
              <CardDescription>Suma de las tres fuentes de auditoría configuradas.</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-semibold">{totalRecords.toLocaleString("es-CL")}</p>
              <p className="mt-2 text-sm text-muted-foreground">Registros encontrados en producción</p>
            </CardContent>
          </Card>

          <Card className={totalRecords === 0 ? "border-amber-500/50" : undefined}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><ShieldAlert className="h-5 w-5" />Estado del control</CardTitle>
              <CardDescription>Evaluación basada únicamente en registros existentes.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <Badge variant={totalRecords === 0 ? "outline" : "default"}>{totalRecords === 0 ? "Sin trazabilidad registrada" : "Trazabilidad con actividad"}</Badge>
              <p className="text-sm">{totalRecords === 0 ? "Las tablas existen, pero todavía no contienen eventos. No es posible confirmar una auditoría operativa hasta que las acciones relevantes escriban registros." : "Existen eventos registrados. La calidad y cobertura de cada flujo debe revisarse antes de considerar el control completo."}</p>
            </CardContent>
          </Card>
        </div>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold">Fuentes configuradas</h2>
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
                  {source.error ? <p className="text-xs text-destructive">No fue posible consultar esta fuente: {source.error}</p> : <Badge variant="outline">Consulta verificada</Badge>}
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        <Card>
          <CardHeader>
            <CardTitle>Alcance actual</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            <p>La vista no expone nombres, correos, teléfonos ni identificadores de usuarios.</p>
            <p>No crea eventos, no modifica permisos y no altera registros operativos.</p>
            <p>La implementación futura de trazabilidad debe conectarse a las acciones críticas reales antes de habilitar una bitácora detallada.</p>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  )
}
