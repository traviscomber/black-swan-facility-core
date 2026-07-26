import Link from "next/link"
import { ArrowLeft, CheckCircle2, Database, ShieldCheck } from "lucide-react"
import { AppLayout } from "@/components/app-layout"
import { PageHeader } from "@/components/page-header"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

const phaseOneTables = [
  { table: "guests", rows: 4, access: "Sin anon; CRUD separado; DELETE admin", data: "Nombre, email, teléfono, dirección y notas" },
  { table: "reservations", rows: 7, access: "Sin anon; CRUD separado; DELETE admin", data: "Datos de huésped, fechas, solicitudes y montos" },
  { table: "invoices", rows: 0, access: "Sin anon; CRUD separado; DELETE admin", data: "Datos de cliente, líneas, impuestos y totales" },
  { table: "invoice_payments", rows: 0, access: "Sin anon; CRUD separado; DELETE admin", data: "Monto, método, transacción y responsable" },
  { table: "payments", rows: 0, access: "Sin anon; CRUD separado; DELETE admin", data: "Monto, método, estado y transacción" },
  { table: "leads", rows: 0, access: "Acceso público retirado; DELETE admin", data: "Teléfono, nombre, fechas, preferencias y notas" },
  { table: "messages", rows: 0, access: "Acceso público retirado; DELETE admin", data: "Teléfono, contenido, intención y sentimiento" },
  { table: "budgets", rows: 25, access: "Acceso público retirado; DELETE admin", data: "Presupuesto, gasto real, variación y notas en contexto CLP" },
  { table: "reviews", rows: 0, access: "Sin anon; operaciones autenticadas; DELETE admin", data: "Evaluación y comentario asociado a reserva" },
  { table: "volunteers", rows: 1, access: "Sin anon; operaciones autenticadas; DELETE admin", data: "Identidad, contacto, disponibilidad, habilidades y notas" },
] as const

const phases = [
  { step: "1", title: "RPC y funciones privilegiadas", status: "Completado", detail: "Los 13 SECURITY DEFINER fueron inventariados. Ninguno conserva EXECUTE para anon o PUBLIC; las operaciones masivas además verifican rol admin dentro del RPC." },
  { step: "2", title: "Datos personales y financieros", status: "Completado", detail: "Las políticas ALL amplias quedaron en cero. Reviews y volunteers ya no permiten acceso anónimo ni TRUNCATE; DELETE queda limitado a admin." },
  { step: "3", title: "Bitácoras inmutables", status: "Completado", detail: "Nueve bitácoras operativas y administrativas son append-only, sin acceso anónimo ni capacidad de alterar o borrar eventos existentes." },
  { step: "4", title: "Permisos operativos", status: "En curso", detail: "Bed-booking aplica validación previa, ejecución atómica, historial y deshacer. Continúa la matriz final de permisos por módulo." },
  { step: "5", title: "Validación integral", status: "Pendiente", detail: "Probar usuarios autenticados, approver, admin y service_role en rutas críticas, desktop y móvil." },
] as const

export default function AdminSecurityPage() {
  return (
    <AppLayout>
      <PageHeader title="Riesgo de acceso a datos" description="Estado verificado de políticas RLS, funciones privilegiadas y dependencias críticas en producción para Fundo Corcovado, Chile." />
      <div className="space-y-6 p-4 md:p-8">
        <Link href="/admin" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Volver a Administración
        </Link>

        <div className="grid gap-4 md:grid-cols-3">
          <Card className="border-emerald-500/40"><CardHeader><CardTitle className="flex items-center gap-2"><ShieldCheck className="h-5 w-5" />0 tablas</CardTitle><CardDescription>Políticas ALL amplias sin restricción efectiva</CardDescription></CardHeader></Card>
          <Card className="border-emerald-500/40"><CardHeader><CardTitle className="flex items-center gap-2"><CheckCircle2 className="h-5 w-5" />0 tablas</CardTitle><CardDescription>Política ALL amplia dirigida a PUBLIC</CardDescription></CardHeader></Card>
          <Card><CardHeader><CardTitle className="flex items-center gap-2"><Database className="h-5 w-5" />0 tablas</CardTitle><CardDescription>Política ALL amplia dirigida a authenticated</CardDescription></CardHeader></Card>
        </div>

        <Card className="border-emerald-500/40">
          <CardHeader><CardTitle>Últimos accesos amplios cerrados</CardTitle><CardDescription>Reviews y volunteers ahora usan políticas separadas por operación.</CardDescription></CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p><span className="font-mono">reviews</span> conserva lectura, creación y actualización para usuarios autenticados; la eliminación exige rol administrador.</p>
            <p><span className="font-mono">volunteers</span> conserva el flujo interno de alta, edición y consulta para usuarios autenticados; la eliminación exige rol administrador.</p>
            <p>Ambas tablas perdieron acceso <span className="font-mono">anon</span>, <span className="font-mono">TRUNCATE</span>, políticas <span className="font-mono">ALL</span> y privilegios genéricos innecesarios.</p>
            <p className="text-muted-foreground">Se preservó 1 registro de voluntariado. Reviews permanece sin registros. No se modificaron filas.</p>
          </CardContent>
        </Card>

        <Card className="border-emerald-500/40">
          <CardHeader><CardTitle className="flex items-center gap-2"><CheckCircle2 className="h-5 w-5" />Operaciones masivas de reservas protegidas</CardTitle><CardDescription>Lógica alineada con bed-booking: prevalidación, ejecución atómica, historial y deshacer.</CardDescription></CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p><span className="font-mono">bulk_operations</span> no permite acceso anónimo, escritura directa ni <span className="font-mono">TRUNCATE</span>. Solo administradores consultan sus 3 registros históricos.</p>
            <p>Las rutas validan sesión, rol administrador, UUID, fechas, estados y correspondencia entre reservas seleccionadas y actualizaciones.</p>
            <p className="text-muted-foreground">Las cinco reservas con prefijo TEST_ permanecen intactas.</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Datos sensibles revisados</CardTitle><CardDescription>Conteos verificados y acceso efectivo después de las migraciones.</CardDescription></CardHeader>
          <CardContent className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-sm">
              <thead><tr className="border-b text-left"><th className="p-3">Tabla</th><th className="p-3">Filas</th><th className="p-3">Acceso vigente</th><th className="p-3">Contenido sensible</th></tr></thead>
              <tbody>{phaseOneTables.map((item) => <tr key={item.table} className="border-b last:border-0"><td className="p-3 font-mono text-xs">{item.table}</td><td className="p-3">{item.rows}</td><td className="p-3">{item.access}</td><td className="p-3 text-muted-foreground">{item.data}</td></tr>)}</tbody>
            </table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Plan de endurecimiento</CardTitle><CardDescription>Progreso registrado en roadmap.md.</CardDescription></CardHeader>
          <CardContent className="space-y-4">{phases.map((phase) => <div key={phase.step} className="flex gap-3 border-b pb-4 last:border-0 last:pb-0"><Badge variant="outline" className="h-6 min-w-6 justify-center">{phase.step}</Badge><div className="flex-1"><div className="flex flex-wrap items-center gap-2"><p className="text-sm font-medium">{phase.title}</p><Badge variant={phase.status === "Completado" ? "secondary" : "outline"}>{phase.status}</Badge></div><p className="mt-1 text-sm text-muted-foreground">{phase.detail}</p></div></div>)}</CardContent>
        </Card>
      </div>
    </AppLayout>
  )
}
