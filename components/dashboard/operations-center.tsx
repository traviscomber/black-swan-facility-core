"use client"

import Link from "next/link"
import { useCallback, useEffect, useMemo, useState } from "react"
import { AlertTriangle, ArrowRight, BedDouble, ClipboardCheck, ConciergeBell, Fuel, PackageCheck, RefreshCw, ShoppingCart, UserRound, UsersRound, Wrench } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"

interface PriorityItem {
  id: string
  area: string
  department: string
  title: string
  status: string
  priority: string
  dueAt: string | null
  assignedTo: string | null
  isMine: boolean
  href: string
}

interface OperationsSummary {
  date: string
  currentUserId: string | null
  isAdmin: boolean
  currentDepartments: string[]
  arrivals: number
  departures: number
  housekeepingOpen: number
  hospitalityOpen: number
  maintenanceOpen: number
  issuesCritical: number
  procurementPending: number
  inventoryPending: number
  fuelPending: number
  unpaidInvoices: number
  priorityItems: PriorityItem[]
}

type QueueView = "mine" | "area" | "all"

const EMPTY_SUMMARY: OperationsSummary = {
  date: "",
  currentUserId: null,
  isAdmin: false,
  currentDepartments: [],
  arrivals: 0,
  departures: 0,
  housekeepingOpen: 0,
  hospitalityOpen: 0,
  maintenanceOpen: 0,
  issuesCritical: 0,
  procurementPending: 0,
  inventoryPending: 0,
  fuelPending: 0,
  unpaidInvoices: 0,
  priorityItems: [],
}

const metrics = [
  { key: "arrivals", label: "Llegadas hoy", href: "/bookings", icon: BedDouble },
  { key: "departures", label: "Salidas hoy", href: "/bookings", icon: BedDouble },
  { key: "housekeepingOpen", label: "Housekeeping pendiente", href: "/bookings/housekeeping", icon: ClipboardCheck },
  { key: "hospitalityOpen", label: "Solicitudes de huéspedes", href: "/concierge", icon: ConciergeBell },
  { key: "maintenanceOpen", label: "Mantenimiento pendiente", href: "/maintenance", icon: Wrench },
  { key: "procurementPending", label: "Compras por revisar", href: "/procurement/approvals", icon: ShoppingCart },
  { key: "inventoryPending", label: "Ingresos a inventario", href: "/inventory", icon: PackageCheck },
  { key: "fuelPending", label: "Combustible por validar", href: "/combustibles", icon: Fuel },
] as const

const queueViews: Array<{ key: QueueView; label: string; icon: typeof UserRound }> = [
  { key: "mine", label: "Mis tareas", icon: UserRound },
  { key: "area", label: "Mi área", icon: UsersRound },
  { key: "all", label: "Todas visibles", icon: ClipboardCheck },
]

export function OperationsCenter() {
  const supabase = useMemo(() => createClient(), [])
  const [summary, setSummary] = useState<OperationsSummary>(EMPTY_SUMMARY)
  const [queueView, setQueueView] = useState<QueueView>("mine")
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const { data, error: rpcError } = await supabase.rpc("get_operations_center_today")
    if (rpcError) {
      setError(rpcError.message)
      setSummary(EMPTY_SUMMARY)
    } else {
      const payload = (data ?? {}) as Partial<OperationsSummary>
      setSummary({
        ...EMPTY_SUMMARY,
        ...payload,
        currentDepartments: Array.isArray(payload.currentDepartments) ? payload.currentDepartments : [],
        priorityItems: Array.isArray(payload.priorityItems) ? payload.priorityItems : [],
      })
      setError(null)
    }
    setLoading(false)
  }, [supabase])

  useEffect(() => { void load() }, [load])

  const visibleItems = useMemo(() => {
    const items = summary.priorityItems
    if (queueView === "mine") return items.filter((item) => item.isMine)
    if (queueView === "area" && !summary.isAdmin && summary.currentDepartments.length > 0) {
      return items.filter((item) => summary.currentDepartments.includes(item.department))
    }
    return items
  }, [queueView, summary])

  const queueDescription = queueView === "mine"
    ? "Elementos asignados directamente a tu usuario."
    : queueView === "area"
      ? "Trabajo abierto de los departamentos asignados a tu perfil."
      : "Todo el trabajo que tus permisos y ubicaciones permiten consultar."

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">Centro operacional</p>
          <h2 className="mt-1 text-xl font-semibold">Trabajo que requiere atención</h2>
          <p className="mt-1 text-sm text-muted-foreground">Resumen diario filtrado según permisos, departamentos y ubicaciones.</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
          <RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />Actualizar
        </Button>
      </div>

      {error && <div className="flex items-center gap-2 rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive"><AlertTriangle className="h-4 w-4" />No se pudo cargar el centro operacional: {error}</div>}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {metrics.map(({ key, label, href, icon: Icon }) => (
          <Link key={key} href={href} className="group rounded-lg border bg-card p-4 transition-colors hover:bg-muted/40">
            <div className="flex items-start justify-between gap-3"><Icon className="h-4 w-4 text-primary" /><ArrowRight className="h-4 w-4 text-muted-foreground opacity-40 transition-all group-hover:translate-x-0.5 group-hover:opacity-100" /></div>
            <p className="mt-5 text-2xl font-semibold">{loading ? "—" : summary[key].toLocaleString("es-CL")}</p>
            <p className="mt-1 text-xs text-muted-foreground">{label}</p>
          </Link>
        ))}
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <CardTitle className="text-base">Bandeja operacional</CardTitle>
              <CardDescription>{queueDescription} Se muestran hasta 30 prioridades.</CardDescription>
            </div>
            <div className="flex flex-wrap gap-2">
              {queueViews.map(({ key, label, icon: Icon }) => (
                <Button key={key} type="button" size="sm" variant={queueView === key ? "default" : "outline"} onClick={() => setQueueView(key)}>
                  <Icon className="mr-2 h-4 w-4" />{label}
                </Button>
              ))}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? <p className="py-6 text-center text-sm text-muted-foreground">Cargando prioridades…</p> : visibleItems.length === 0 ? (
            <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
              {queueView === "mine" ? "No tienes tareas asignadas directamente." : "No hay prioridades abiertas dentro de este alcance."}
            </p>
          ) : (
            <div className="divide-y rounded-lg border">
              {visibleItems.map((item) => {
                const overdue = item.dueAt ? new Date(item.dueAt).getTime() < Date.now() : false
                return (
                  <Link key={`${item.area}-${item.id}`} href={item.href} className="grid gap-2 p-3 transition-colors hover:bg-muted/40 sm:grid-cols-[120px_1fr_auto] sm:items-center">
                    <div className="flex flex-wrap gap-1.5">
                      <Badge variant="outline">{item.area}</Badge>
                      {item.isMine && <Badge>Asignada a mí</Badge>}
                      {overdue && <Badge variant="destructive">Vencida</Badge>}
                    </div>
                    <div>
                      <p className="text-sm font-medium">{item.title}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {item.status}
                        {item.dueAt ? ` · ${new Intl.DateTimeFormat("es-CL", { dateStyle: "short", timeStyle: "short" }).format(new Date(item.dueAt))}` : ""}
                        {!item.assignedTo ? " · Sin responsable" : ""}
                      </p>
                    </div>
                    <ArrowRight className="h-4 w-4 text-muted-foreground" />
                  </Link>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </section>
  )
}
