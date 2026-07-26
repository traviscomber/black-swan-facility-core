"use client"

import Link from "next/link"
import { useEffect, useMemo, useState } from "react"
import { AlertTriangle, CalendarCheck, ClipboardList, Loader2, MessageSquare, RefreshCw, Users } from "lucide-react"
import { AppLayout } from "@/components/app-layout"
import { PageHeader } from "@/components/page-header"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { createBrowserClient } from "@/lib/supabase/client"

type ConciergeStats = {
  leads: number
  messages24h: number
  openIncidents: number
  openRequests: number
  tasksToday: number
}

const emptyStats: ConciergeStats = { leads: 0, messages24h: 0, openIncidents: 0, openRequests: 0, tasksToday: 0 }

export default function ConciergeDashboard() {
  const supabase = useMemo(() => createBrowserClient(), [])
  const [stats, setStats] = useState<ConciergeStats>(emptyStats)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  async function loadDashboard() {
    setLoading(true)
    setError(null)
    const today = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Santiago", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date())
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
    const [leads, messages, incidents, requests, tasks] = await Promise.all([
      supabase.from("leads").select("id", { count: "exact", head: true }).eq("stage", "new"),
      supabase.from("messages").select("id", { count: "exact", head: true }).gte("ts", since),
      supabase.from("incidents").select("id", { count: "exact", head: true }).eq("status", "open"),
      supabase.from("hospitality_requests").select("id", { count: "exact", head: true }).not("status", "in", "(completed,cancelled)"),
      supabase.from("tasks").select("id", { count: "exact", head: true }).eq("due_date", today).in("status", ["nueva", "en_progreso"]),
    ])
    const firstError = leads.error ?? messages.error ?? incidents.error ?? requests.error ?? tasks.error
    if (firstError) setError(firstError.message)
    setStats({ leads: leads.count ?? 0, messages24h: messages.count ?? 0, openIncidents: incidents.count ?? 0, openRequests: requests.count ?? 0, tasksToday: tasks.count ?? 0 })
    setLoading(false)
  }

  useEffect(() => { void loadDashboard() }, [])

  return (
    <AppLayout>
      <PageHeader title="Concierge y hospitalidad" description="Control operativo de huéspedes, mensajes, solicitudes, incidencias y tareas de atención en Fundo Corcovado." actions={<Button variant="outline" onClick={() => void loadDashboard()} disabled={loading}><RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />Actualizar</Button>} />
      <div className="space-y-6 p-4 md:p-6">
        {error && <Card className="border-destructive/40"><CardContent className="p-4 text-sm text-destructive">No fue posible actualizar el panel: {error}</CardContent></Card>}
        {loading ? <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin" /></div> : <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5"><Metric title="Nuevos contactos" value={stats.leads} icon={Users} /><Metric title="Mensajes últimas 24 h" value={stats.messages24h} icon={MessageSquare} /><Metric title="Solicitudes abiertas" value={stats.openRequests} icon={CalendarCheck} /><Metric title="Incidencias abiertas" value={stats.openIncidents} icon={AlertTriangle} /><Metric title="Tareas para hoy" value={stats.tasksToday} icon={ClipboardList} /></div>}

        <Card><CardHeader><CardTitle className="text-base">Operación de hospitalidad</CardTitle></CardHeader><CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <Button asChild><Link href="/concierge/requests">Gestionar solicitudes de huéspedes</Link></Button>
          <Button asChild variant="outline"><Link href="/guest-requests">Abrir formulario para huéspedes</Link></Button>
          <Button asChild variant="outline"><Link href="/tasks">Ver tareas operativas</Link></Button>
          <Button asChild variant="outline"><Link href="/bookings">Reservas y disponibilidad</Link></Button>
          <Button asChild variant="outline"><Link href="/concierge/leads">Contactos y oportunidades</Link></Button>
          <Button asChild variant="outline"><Link href="/concierge/messages">Mensajes</Link></Button>
        </CardContent></Card>

        <Card><CardHeader><CardTitle className="text-base">Regla de seguimiento</CardTitle></CardHeader><CardContent className="text-sm leading-6 text-muted-foreground">Las solicitudes de huéspedes permanecen como registro de hospitalidad. Cuando requieren ejecución, se genera una tarea vinculada para asignar trabajadores o voluntarios, registrar seguridad, estado y resultado sin duplicar el origen.</CardContent></Card>
      </div>
    </AppLayout>
  )
}

function Metric({ title, value, icon: Icon }: { title: string; value: number; icon: typeof Users }) {
  return <Card><CardContent className="flex items-start justify-between p-4"><div><p className="text-sm text-muted-foreground">{title}</p><p className="mt-1 text-3xl font-semibold tabular-nums">{value.toLocaleString("es-CL")}</p></div><Icon className="h-5 w-5 text-muted-foreground" /></CardContent></Card>
}
