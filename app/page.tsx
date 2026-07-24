"use client"

import Link from "next/link"
import { useCallback, useEffect, useMemo, useState } from "react"
import {
  AlertCircle,
  Beef,
  Building2,
  Calendar,
  ChevronRight,
  Grape,
  LogOut,
  Package,
  RefreshCw,
  ShoppingCart,
  Users,
  Wrench,
  Zap,
} from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

interface DashboardMetrics {
  locations: number
  reservations: number
  maintenance: number
  issues: number
  procurement: number
  suppliers: number
  employees: number
  assets: number
}

type MetricKey = keyof DashboardMetrics

type CountResult = {
  count: number | null
  error: { message: string } | null
}

const EMPTY_METRICS: DashboardMetrics = {
  locations: 0,
  reservations: 0,
  maintenance: 0,
  issues: 0,
  procurement: 0,
  suppliers: 0,
  employees: 0,
  assets: 0,
}

const moduleGroups = [
  {
    label: "Operación",
    description: "Coordinación diaria de hospitalidad, mantenimiento, compras y personas.",
    modules: [
      { label: "Hospitalidad", description: "Reservas, habitaciones, huéspedes y solicitudes del Fundo Corcovado.", icon: Building2, href: "/bookings" },
      { label: "Mantenimiento", description: "Trabajos preventivos, correctivos e incidencias de infraestructura.", icon: Wrench, href: "/maintenance" },
      { label: "Compras", description: "Solicitudes, aprobaciones, órdenes y proveedores pendientes.", icon: ShoppingCart, href: "/procurement" },
      { label: "Personas", description: "Equipo activo, funciones y operación interna del fundo.", icon: Users, href: "/employees" },
      { label: "Actividades", description: "Calendario de actividades, responsables y planificación diaria.", icon: Calendar, href: "/activities-calendar" },
    ],
  },
  {
    label: "Recursos y territorio",
    description: "Activos, producción, energía y registros vinculados al territorio.",
    modules: [
      { label: "Inventario y activos", description: "Activos, existencias, categorías, centros de costo y auditoría.", icon: Package, href: "/inventory" },
      { label: "Ganadería", description: "Potreros, crianza, engorda, salud animal y planificación ganadera.", icon: Beef, href: "/cattle" },
      { label: "Viñedo y huerto", description: "Cuarteles, cultivos, manejo, sanidad, cosechas y registros productivos.", icon: Grape, href: "/vineyard" },
      { label: "Energía y combustibles", description: "Consumos, generación, servicios, combustible y seguimiento energético.", icon: Zap, href: "/energy" },
    ],
  },
]

export default function OperationsDashboard() {
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])
  const [userEmail, setUserEmail] = useState<string | null>(null)
  const [metrics, setMetrics] = useState<DashboardMetrics>(EMPTY_METRICS)
  const [loading, setLoading] = useState(true)
  const [warnings, setWarnings] = useState<string[]>([])

  const loadDashboard = useCallback(async () => {
    setLoading(true)
    setWarnings([])

    const userResult = await supabase.auth.getUser()
    setUserEmail(userResult.data.user?.email ?? null)

    const metricQueries: Array<[MetricKey, PromiseLike<CountResult>]> = [
      ["locations", supabase.from("locations").select("id", { count: "exact", head: true }).eq("is_active", true)],
      ["reservations", supabase.from("reservations").select("id", { count: "exact", head: true }).in("status", ["pending", "confirmed", "checked_in", "checked-in"])],
      ["maintenance", supabase.from("maintenance_tasks").select("id", { count: "exact", head: true }).not("status", "in", "(completed,cancelled)")],
      ["issues", supabase.from("issues").select("id", { count: "exact", head: true }).not("status", "in", "(resolved,closed,cancelled)")],
      ["procurement", supabase.from("procurement_requests").select("id", { count: "exact", head: true }).in("status", ["pending", "submitted", "under_review"])],
      ["suppliers", supabase.from("suppliers").select("id", { count: "exact", head: true }).eq("approval_status", "pending")],
      ["employees", supabase.from("employees").select("id", { count: "exact", head: true }).eq("is_active", true)],
      ["assets", supabase.from("assets").select("id", { count: "exact", head: true })],
    ]

    const results = await Promise.all(metricQueries.map(async ([key, query]) => [key, await query] as const))
    const nextMetrics = { ...EMPTY_METRICS }
    const nextWarnings: string[] = []

    for (const [key, result] of results) {
      if (result.error) {
        nextWarnings.push(`${key}: ${result.error.message}`)
        continue
      }
      nextMetrics[key] = result.count ?? 0
    }

    setMetrics(nextMetrics)
    setWarnings(nextWarnings)
    setLoading(false)
  }, [supabase])

  useEffect(() => {
    void loadDashboard()
  }, [loadDashboard])

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push("/auth/login")
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border bg-background">
        <div className="mx-auto flex max-w-[1600px] items-center justify-between px-4 py-4 sm:px-8">
          <div className="flex items-center gap-3">
            <img src="/blackswan-logo.png" alt="Blackswan Facility Core" className="h-10 w-10 object-contain" />
            <div><p className="text-sm font-semibold tracking-wide">BSFC</p><p className="text-xs text-muted-foreground">Fundo Corcovado · Valdivia</p></div>
          </div>
          <div className="flex items-center gap-3">
            {userEmail && <span className="hidden text-sm text-muted-foreground sm:block">{userEmail}</span>}
            {userEmail ? <Button variant="outline" size="sm" onClick={handleLogout}><LogOut className="mr-2 h-4 w-4" />Cerrar sesión</Button> : <Button asChild size="sm"><Link href="/auth/login">Ingresar</Link></Button>}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1600px] space-y-10 px-4 py-8 sm:px-8">
        <section className="max-w-3xl">
          <p className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-primary">Centro interno de operaciones</p>
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Fundo Corcovado</h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground sm:text-base">Vista central para coordinar hospitalidad, campo, infraestructura, compras y equipo en la operación de Valdivia. Los indicadores provienen de registros existentes y no modifican la información de producción.</p>
        </section>

        {warnings.length > 0 && (
          <div className="flex flex-col justify-between gap-3 rounded-lg border border-amber-300 bg-amber-50/60 p-4 text-sm text-amber-950 sm:flex-row sm:items-center">
            <div className="flex gap-2"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /><span>Se cargó un resumen parcial. {warnings.length} fuente{warnings.length === 1 ? "" : "s"} no respondió correctamente.</span></div>
            <Button variant="outline" size="sm" onClick={() => void loadDashboard()}><RefreshCw className="mr-2 h-4 w-4" />Reintentar</Button>
          </div>
        )}

        <section>
          <div className="mb-4"><h2 className="text-lg font-semibold">Situación operativa</h2><p className="mt-1 text-sm text-muted-foreground">Registros abiertos o activos que requieren seguimiento.</p></div>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <MetricCard title="Reservas abiertas" value={metrics.reservations} detail="Pendientes, confirmadas o con check-in" loading={loading} href="/bookings" />
            <MetricCard title="Incidencias abiertas" value={metrics.issues} detail="Pendientes de resolución o cierre" loading={loading} href="/issues" alert={metrics.issues > 0} />
            <MetricCard title="Mantenimientos abiertos" value={metrics.maintenance} detail="Trabajos no completados ni cancelados" loading={loading} href="/maintenance" />
            <MetricCard title="Proveedores por aprobar" value={metrics.suppliers} detail="Candidatos pendientes de revisión" loading={loading} href="/suppliers" alert={metrics.suppliers > 0} />
          </div>
        </section>

        <section>
          <div className="mb-4"><h2 className="text-lg font-semibold">Base operativa registrada</h2><p className="mt-1 text-sm text-muted-foreground">Cobertura actual de ubicaciones, personas, activos y compras.</p></div>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <MetricCard title="Ubicaciones activas" value={metrics.locations} detail="Propiedades y áreas habilitadas" loading={loading} href="/property-management" />
            <MetricCard title="Personas activas" value={metrics.employees} detail="Colaboradores registrados como activos" loading={loading} href="/employees" />
            <MetricCard title="Activos registrados" value={metrics.assets} detail="Total disponible en el registro principal de activos" loading={loading} href="/assets" />
            <MetricCard title="Compras en revisión" value={metrics.procurement} detail="Solicitudes pendientes, enviadas o en revisión" loading={loading} href="/procurement" />
          </div>
        </section>

        <section>
          <div className="mb-6"><h2 className="text-lg font-semibold">Secciones operativas</h2><p className="mt-1 text-sm text-muted-foreground">Las áreas se mantienen separadas y se organizan por contexto de trabajo, sin fusionar datos ni tablas.</p></div>
          <div className="space-y-8">
            {moduleGroups.map((group) => (
              <div key={group.label}>
                <div className="mb-3"><h3 className="text-sm font-semibold">{group.label}</h3><p className="mt-1 text-xs text-muted-foreground">{group.description}</p></div>
                <div className="grid gap-px overflow-hidden rounded-lg border border-border bg-border sm:grid-cols-2 lg:grid-cols-3">
                  {group.modules.map((module) => {
                    const Icon = module.icon
                    return <Link key={module.href} href={module.href} className="group flex min-h-40 flex-col justify-between bg-background p-5 transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-inset"><div className="flex items-start justify-between"><div className="flex h-9 w-9 items-center justify-center rounded-md border border-border bg-card"><Icon className="h-4 w-4 text-primary" /></div><ChevronRight className="h-4 w-4 text-muted-foreground opacity-50 transition-all group-hover:translate-x-0.5 group-hover:opacity-100" /></div><div className="mt-6"><p className="text-sm font-semibold">{module.label}</p><p className="mt-1 text-xs leading-5 text-muted-foreground">{module.description}</p></div></Link>
                  })}
                </div>
              </div>
            ))}
          </div>
        </section>
      </main>

      <footer className="border-t border-border px-4 py-5 text-center text-xs text-muted-foreground sm:px-8">Blackswan Facility Core · Fundo Corcovado, Valdivia · Uso interno</footer>
    </div>
  )
}

function MetricCard({ title, value, detail, loading, href, alert = false }: { title: string; value: number; detail: string; loading: boolean; href: string; alert?: boolean }) {
  return <Card className={alert ? "border-amber-300" : undefined}><CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle></CardHeader><CardContent><div className="text-3xl font-semibold">{loading ? "—" : value.toLocaleString("es-CL")}</div><CardDescription className="mt-1 min-h-10">{detail}</CardDescription><Link href={href} className="mt-3 inline-flex items-center text-xs font-medium text-primary hover:underline">Revisar sección<ChevronRight className="ml-1 h-3 w-3" /></Link></CardContent></Card>
}
