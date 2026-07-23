import { AlertTriangle, Mail, Phone, UserCheck, Users } from "lucide-react"
import { AppLayout } from "@/components/app-layout"
import { PageHeader } from "@/components/page-header"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { createClient } from "@/lib/supabase/server"
import type { Employee } from "@/lib/types"
import { AddEmployeeDialog } from "@/components/add-employee-dialog"
import { EmployeeCard } from "@/components/employee-card"

export const dynamic = "force-dynamic"

export default async function EmployeesPage() {
  const supabase = await createClient()
  const { data, error } = await supabase.from("employees").select("id, name, role, phone, email, is_active, photo_url, created_at").order("is_active", { ascending: false }).order("name")
  const employees = (data ?? []) as Employee[]

  const active = employees.filter((employee) => employee.is_active).length
  const inactive = employees.length - active
  const missingRole = employees.filter((employee) => !employee.role?.trim()).length
  const missingEmail = employees.filter((employee) => !employee.email?.trim()).length
  const missingPhone = employees.filter((employee) => !employee.phone?.trim()).length
  const normalizedNames = employees.map((employee) => employee.name.trim().toLocaleLowerCase("es-CL"))
  const duplicateNames = new Set(normalizedNames.filter((name, index) => normalizedNames.indexOf(name) !== index)).size

  return (
    <AppLayout>
      <PageHeader
        title="Personas y operaciones"
        description="Directorio interno del equipo de Fundo Corcovado, con funciones, disponibilidad operativa y datos de contacto registrados."
        actions={<AddEmployeeDialog />}
      />

      <div className="space-y-6 p-4 sm:p-8">
        {error && (
          <Card className="border-destructive/60">
            <CardContent className="p-5">
              <p className="font-medium text-destructive">No fue posible cargar el directorio.</p>
              <p className="mt-1 text-sm text-muted-foreground">{error.message}</p>
            </CardContent>
          </Card>
        )}

        {(missingRole > 0 || duplicateNames > 0) && !error && (
          <Card className="border-amber-300">
            <CardContent className="flex gap-3 p-5">
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
              <div>
                <p className="font-medium">Datos que requieren revisión administrativa</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {missingRole > 0 ? `${missingRole} persona${missingRole === 1 ? "" : "s"} sin función registrada. ` : ""}
                  {duplicateNames > 0 ? `${duplicateNames} nombre${duplicateNames === 1 ? "" : "s"} duplicado${duplicateNames === 1 ? "" : "s"} que deben validarse antes de consolidar registros.` : ""}
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
          <Metric icon={Users} title="Personas registradas" value={employees.length} />
          <Metric icon={UserCheck} title="Activas" value={active} />
          <Metric icon={Users} title="Inactivas" value={inactive} />
          <Metric icon={Mail} title="Sin correo" value={missingEmail} warning={missingEmail > 0} />
          <Metric icon={Phone} title="Sin teléfono" value={missingPhone} warning={missingPhone > 0} />
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Directorio operativo</CardTitle>
            <p className="text-sm text-muted-foreground">Los estados indican si una persona está actualmente activa en el sistema; no representan asistencia diaria ni relación contractual.</p>
          </CardHeader>
          <CardContent>
            {employees.length > 0 ? (
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {employees.map((employee) => <EmployeeCard key={employee.id} employee={employee} />)}
              </div>
            ) : (
              <div className="py-12 text-center">
                <p className="font-medium">No hay personas registradas.</p>
                <p className="mt-1 text-sm text-muted-foreground">Utiliza “Agregar persona” para iniciar el directorio operativo.</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  )
}

function Metric({ icon: Icon, title, value, warning = false }: { icon: typeof Users; title: string; value: number; warning?: boolean }) {
  return (
    <Card className={warning ? "border-amber-300" : undefined}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent><div className="text-3xl font-semibold">{value.toLocaleString("es-CL")}</div></CardContent>
    </Card>
  )
}
