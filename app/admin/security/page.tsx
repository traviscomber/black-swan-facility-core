import Link from "next/link"
import { ArrowLeft, CheckCircle2, Database, ShieldAlert, TriangleAlert } from "lucide-react"
import { AppLayout } from "@/components/app-layout"
import { PageHeader } from "@/components/page-header"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

const remainingAreas = [
  { name: "Catálogos y módulos auxiliares", risk: "Revisión", examples: "multimedia, activos, catálogos y tablas de soporte" },
] as const

const phaseOneTables = [
  { table: "guests", rows: 4, access: "Sin anon; CRUD separado; DELETE admin", data: "Nombre, email, teléfono, dirección y notas" },
  { table: "reservations", rows: 7, access: "Sin anon; CRUD separado; DELETE admin", data: "Datos de huésped, fechas, solicitudes y montos" },
  { table: "invoices", rows: 0, access: "Sin anon; CRUD separado; DELETE admin", data: "Datos de cliente, líneas, impuestos y totales" },
  { table: "invoice_payments", rows: 0, access: "Sin anon; CRUD separado; DELETE admin", data: "Monto, método, transacción y responsable" },
  { table: "payments", rows: 0, access: "Sin anon; CRUD separado; DELETE admin", data: "Monto, método, estado y transacción" },
  { table: "leads", rows: 0, access: "Acceso público retirado; DELETE admin", data: "Teléfono, nombre, fechas, preferencias y notas" },
  { table: "messages", rows: 0, access: "Acceso público retirado; DELETE admin", data: "Teléfono, contenido, intención y sentimiento" },
  { table: "budgets", rows: 25, access: "Acceso público retirado; DELETE admin", data: "Presupuesto, gasto real, variación y notas" },
] as const

const phases = [
  { step: "1", title: "RPC y funciones privilegiadas", status: "Completado", detail: "Los 13 SECURITY DEFINER fueron inventariados. Ninguno conserva EXECUTE para anon o PUBLIC; las operaciones masivas además verifican rol admin dentro del RPC." },
  { step: "2", title: "Datos personales y financieros", status: "En curso", detail: "Ocho tablas sensibles ya usan políticas separadas por operación, sin privilegios anon y con eliminación exclusiva para admin." },
  { step: "3", title: "Bitácoras inmutables", status: "Completado", detail: "Nueve bitácoras operativas y administrativas son append-only, sin acceso anónimo ni capacidad de alterar o borrar eventos existentes." },
  { step: "4", title: "Permisos operativos", status: "En curso", detail: "GIS, operaciones, infraestructura, energía y once tablas de IA y soberanía ya usan políticas separadas, sin acceso anónimo, sin TRUNCATE y con DELETE exclusivo para admin." },
  { step: "5", title: "Validación integral", status: "Pendiente", detail: "Probar usuarios autenticados, approver, admin y service_role en rutas críticas, desktop y móvil." },
] as const

export default function AdminSecurityPage() {
  return (
    <AppLayout>
      <PageHeader title="Riesgo de acceso a datos" description="Estado verificado de políticas RLS, funciones privilegiadas y dependencias críticas en producción." />
      <div className="space-y-6 p-4 md:p-8">
        <Link href="/admin" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Volver a Administración
        </Link>

        <div className="grid gap-4 md:grid-cols-3">
          <Card className="border-amber-500/50">
            <CardHeader><CardTitle className="flex items-center gap-2"><ShieldAlert className="h-5 w-5" />27 tablas</CardTitle><CardDescription>Aún conservan política ALL amplia y sin restricción efectiva</CardDescription></CardHeader>
          </Card>
          <Card className="border-destructive/40">
            <CardHeader><CardTitle className="flex items-center gap-2"><TriangleAlert className="h-5 w-5" />20 tablas</CardTitle><CardDescription>Política ALL amplia dirigida a PUBLIC</CardDescription></CardHeader>
          </Card>
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><Database className="h-5 w-5" />7 tablas</CardTitle><CardDescription>Política ALL amplia dirigida a authenticated</CardDescription></CardHeader>
          </Card>
        </div>

        <Card className="border-emerald-500/40">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><CheckCircle2 className="h-5 w-5" />IA y soberanía protegidas</CardTitle>
            <CardDescription>Agentes, ejecuciones, sesiones, contexto, eventos, artefactos y planificación de soberanía.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p>Once tablas de IA y soberanía ya no permiten acceso anónimo ni <span className="font-mono">TRUNCATE</span>; usan políticas separadas por operación.</p>
            <p>Usuarios autenticados conservan lectura, creación y actualización. La eliminación queda limitada a <span className="font-mono">admin</span>.</p>
            <p>Se preservaron 8 ejecuciones, 5 agentes, 3 artefactos, 10 eventos, 5 sesiones, 5 capas y 8 métricas. Contexto, dependencias, objetivos y cronología permanecen sin registros.</p>
            <p className="text-muted-foreground">Las cinco reservas con prefijo TEST_ permanecen intactas.</p>
          </CardContent>
        </Card>

        <Card className="border-amber-500/50">
          <CardHeader><CardTitle>Interpretación</CardTitle><CardDescription>RLS habilitado sigue sin equivaler a acceso restringido.</CardDescription></CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p>Las políticas ALL amplias sin restricción efectiva bajaron a 27. El trabajo continúa sobre catálogos, multimedia, activos y módulos de soporte.</p>
            <p className="text-muted-foreground">Estado verificado en pg_policies y privilegios de tabla el 26-07-2026. Las migraciones no modificaron registros operativos.</p>
          </CardContent>
        </Card>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold">Áreas pendientes</h2>
          <div className="grid gap-4 lg:grid-cols-2">
            {remainingAreas.map((area) => (
              <Card key={area.name}>
                <CardHeader>
                  <div className="flex items-start justify-between gap-3">
                    <div><CardTitle className="text-base">{area.name}</CardTitle><CardDescription>{area.examples}</CardDescription></div>
                    <Badge variant={area.risk === "Crítico" ? "destructive" : "outline"}>{area.risk}</Badge>
                  </div>
                </CardHeader>
              </Card>
            ))}
          </div>
        </section>

        <Card>
          <CardHeader><CardTitle>Fase de datos personales y financieros</CardTitle><CardDescription>Conteos verificados y acceso efectivo después de la migración.</CardDescription></CardHeader>
          <CardContent className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-sm">
              <thead><tr className="border-b text-left"><th className="p-3">Tabla</th><th className="p-3">Filas</th><th className="p-3">Acceso vigente</th><th className="p-3">Contenido sensible</th></tr></thead>
              <tbody>
                {phaseOneTables.map((item) => (
                  <tr key={item.table} className="border-b last:border-0">
                    <td className="p-3 font-mono text-xs">{item.table}</td><td className="p-3">{item.rows}</td><td className="p-3">{item.access}</td><td className="p-3 text-muted-foreground">{item.data}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Plan de endurecimiento</CardTitle><CardDescription>Progreso registrado en roadmap.md.</CardDescription></CardHeader>
          <CardContent className="space-y-4">
            {phases.map((phase) => (
              <div key={phase.step} className="flex gap-3 border-b pb-4 last:border-0 last:pb-0">
                <Badge variant="outline" className="h-6 min-w-6 justify-center">{phase.step}</Badge>
                <div className="flex-1"><div className="flex flex-wrap items-center gap-2"><p className="text-sm font-medium">{phase.title}</p><Badge variant={phase.status === "Completado" ? "secondary" : "outline"}>{phase.status}</Badge></div><p className="mt-1 text-sm text-muted-foreground">{phase.detail}</p></div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  )
}
