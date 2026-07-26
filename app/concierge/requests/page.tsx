"use client"

import Link from "next/link"
import { useCallback, useEffect, useMemo, useState } from "react"
import { ClipboardPlus, Loader2, RefreshCw } from "lucide-react"
import { AppLayout } from "@/components/app-layout"
import { PageHeader } from "@/components/page-header"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { createBrowserClient } from "@/lib/supabase/client"
import { buildOperationalTaskHref } from "@/lib/operational-task-links"

type HospitalityRequest = {
  id: string
  guest_name: string
  request_type: string
  category: string
  description: string | null
  priority: string | null
  status: string | null
  room_id: string
  location_id: string
  created_at: string | null
  rooms?: { room_number?: string | null } | null
  locations?: { name?: string | null } | null
}

const priorityMap: Record<string, "baja" | "media" | "alta" | "urgente"> = { low: "baja", medium: "media", high: "alta", urgent: "urgente", critical: "urgente", baja: "baja", media: "media", alta: "alta", urgente: "urgente" }
const statusLabels: Record<string, string> = { pending: "Pendiente", assigned: "Asignada", in_progress: "En curso", completed: "Completada", cancelled: "Cancelada" }

export default function HospitalityRequestsOperationsPage() {
  const supabase = useMemo(() => createBrowserClient(), [])
  const [requests, setRequests] = useState<HospitalityRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadRequests = useCallback(async () => {
    setLoading(true)
    setError(null)
    const { data, error: loadError } = await supabase
      .from("hospitality_requests")
      .select("id, guest_name, request_type, category, description, priority, status, room_id, location_id, created_at, rooms(room_number), locations(name)")
      .order("created_at", { ascending: false })
      .limit(250)
    if (loadError) setError(loadError.message)
    else setRequests((data ?? []) as unknown as HospitalityRequest[])
    setLoading(false)
  }, [supabase])

  useEffect(() => { void loadRequests() }, [loadRequests])

  return (
    <AppLayout>
      <PageHeader title="Solicitudes de hospitalidad" description="Seguimiento interno de solicitudes de huéspedes y creación trazable de tareas para trabajadores o voluntarios." actions={<div className="flex gap-2"><Button asChild variant="outline"><Link href="/guest-requests">Formulario de huésped</Link></Button><Button variant="outline" onClick={() => void loadRequests()} disabled={loading}><RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />Actualizar</Button></div>} />
      <div className="space-y-5 p-4 md:p-6">
        {error && <Card className="border-destructive/40"><CardContent className="p-4 text-sm text-destructive">No fue posible cargar solicitudes: {error}</CardContent></Card>}
        {loading ? <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin" /></div> : requests.length === 0 ? <Card><CardContent className="py-12 text-center"><p className="font-medium">No hay solicitudes de hospitalidad registradas.</p><p className="mt-1 text-sm text-muted-foreground">Las solicitudes enviadas desde el formulario aparecerán aquí para asignación y seguimiento.</p></CardContent></Card> : <div className="grid gap-4 lg:grid-cols-2">{requests.map((request) => {
          const room = request.rooms?.room_number ? `Habitación ${request.rooms.room_number}` : "Habitación no identificada"
          const location = request.locations?.name || room
          const taskHref = buildOperationalTaskHref({
            template: "hosp-request",
            area: "hospitalidad",
            title: `${request.request_type} · ${request.guest_name}`,
            description: request.description || `Atender solicitud de ${request.guest_name} y registrar resultado.`,
            category: request.category,
            priority: priorityMap[(request.priority || "medium").toLowerCase()] || "media",
            locationId: request.location_id,
            sourceType: "hospitality_request",
            sourceId: request.id,
            sourceLabel: `${request.guest_name} · ${request.request_type}`,
            sourcePath: "/concierge/requests",
          })
          return <Card key={request.id}><CardHeader className="pb-3"><div className="flex items-start justify-between gap-3"><div><CardTitle className="text-base">{request.request_type}</CardTitle><p className="mt-1 text-sm text-muted-foreground">{request.guest_name} · {location}</p></div><Badge variant="outline">{statusLabels[request.status || "pending"] || request.status || "Pendiente"}</Badge></div></CardHeader><CardContent className="space-y-4">{request.description && <p className="text-sm leading-6">{request.description}</p>}<div className="flex flex-wrap gap-2"><Badge variant="secondary">{request.category}</Badge><Badge variant="outline">Prioridad {priorityMap[(request.priority || "medium").toLowerCase()] || "media"}</Badge></div><Button asChild className="w-full"><Link href={taskHref}><ClipboardPlus className="mr-2 h-4 w-4" />Crear tarea operativa</Link></Button></CardContent></Card>
        })}</div>}
      </div>
    </AppLayout>
  )
}
