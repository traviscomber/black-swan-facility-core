import Link from "next/link"
import { notFound } from "next/navigation"
import { AlertTriangle, ArrowLeft, BedDouble, CalendarDays, ClipboardCheck, ConciergeBell, History, MapPin, PackageSearch, Wrench } from "lucide-react"
import { AppLayout } from "@/components/app-layout"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { createClient } from "@/lib/supabase/server"

type Room = {
  id: string
  room_number: string
  room_type: string | null
  capacity: number | null
  status: string | null
  operational_status: string | null
  location: string | null
  floor: string | null
  bed_type: string | null
  amenities: string[] | null
  notes: string | null
}

type RoomState = {
  reservation_status: string | null
  housekeeping_status: string | null
  maintenance_status: string | null
  availability_status: string | null
  current_reservation_id: string | null
  guest_name: string | null
  check_in: string | null
  check_out: string | null
}

type Reservation = {
  id: string
  guest_name: string | null
  check_in: string
  check_out: string
  status: string | null
  payment_status: string | null
  arrival_status: string | null
}

type Housekeeping = { id: string; task_type: string | null; status: string | null; priority: string | null; service_date: string | null }
type Maintenance = { id: string; title: string | null; status: string | null; prioridad: string | null; fecha_objetivo: string | null; bloqueado: boolean | null; asset_id: string | null }
type RequestRow = { id: string; request_type: string | null; category: string | null; description: string | null; status: string | null; priority: string | null; due_at: string | null }
type Issue = { id: string; title: string | null; status: string | null; severity: string | null; priority: string | null; created_at: string | null; asset_id: string | null }
type Asset = { id: string; name: string; asset_code: string | null; status: string | null; is_critical: boolean | null }
type HistoryRow = { id: string; previous_status: string | null; new_status: string | null; reason: string | null; source: string | null; created_at: string }

function formatDate(value: string | null) {
  if (!value) return "Sin fecha"
  return new Intl.DateTimeFormat("es-CL", { dateStyle: "medium", timeZone: "America/Santiago" }).format(new Date(`${value}T12:00:00-04:00`))
}

function formatDateTime(value: string | null) {
  if (!value) return "Sin fecha"
  return new Intl.DateTimeFormat("es-CL", { dateStyle: "medium", timeStyle: "short", timeZone: "America/Santiago" }).format(new Date(value))
}

function statusVariant(value: string | null): "default" | "secondary" | "destructive" | "outline" {
  const status = value?.toLowerCase() || ""
  if (["blocked", "bloqueado", "critical", "out_of_service", "maintenance"].includes(status)) return "destructive"
  if (["ready", "available", "completed", "resolved", "clean"].includes(status)) return "secondary"
  return "outline"
}

export default async function RoomObjectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()

  const roomResult = await supabase
    .from("rooms")
    .select("id,room_number,room_type,capacity,status,operational_status,location,floor,bed_type,amenities,notes")
    .eq("id", id)
    .maybeSingle()

  if (roomResult.error || !roomResult.data) notFound()
  const room = roomResult.data as Room
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Santiago", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date())

  const [stateResult, reservationsResult, housekeepingResult, maintenanceResult, historyResult] = await Promise.all([
    supabase.from("room_state_matrix").select("reservation_status,housekeeping_status,maintenance_status,availability_status,current_reservation_id,guest_name,check_in,check_out").eq("room_id", id).limit(1).maybeSingle(),
    supabase.from("reservations").select("id,guest_name,check_in,check_out,status,payment_status,arrival_status").eq("room_id", id).gte("check_out", today).not("status", "in", "(cancelled,canceled,void,voided)").order("check_in", { ascending: true }).limit(8),
    supabase.from("housekeeping_tasks").select("id,task_type,status,priority,service_date").eq("room_id", id).not("status", "in", "(completed,cancelled,canceled)").order("service_date", { ascending: true, nullsFirst: false }).limit(8),
    supabase.from("maintenance_tasks").select("id,title,status,prioridad,fecha_objetivo,bloqueado,asset_id").eq("room_id", id).not("status", "in", "(completada,completed,cancelada,cancelled,canceled)").order("fecha_objetivo", { ascending: true, nullsFirst: false }).limit(8),
    supabase.from("room_operational_history").select("id,previous_status,new_status,reason,source,created_at").eq("room_id", id).order("created_at", { ascending: false }).limit(10),
  ])

  const state = (stateResult.data ?? null) as RoomState | null
  const reservations = (reservationsResult.data ?? []) as Reservation[]
  const housekeeping = (housekeepingResult.data ?? []) as Housekeeping[]
  const maintenance = (maintenanceResult.data ?? []) as Maintenance[]
  const history = (historyResult.data ?? []) as HistoryRow[]
  const reservationIds = reservations.map((item) => item.id)

  const roomRequestsResult = await supabase
    .from("hospitality_requests")
    .select("id,request_type,category,description,status,priority,due_at")
    .eq("room_id", id)
    .not("status", "in", "(completed,resolved,closed,cancelled,canceled)")
    .order("due_at", { ascending: true, nullsFirst: false })
    .limit(8)

  const reservationRequestsResult = reservationIds.length > 0
    ? await supabase
      .from("hospitality_requests")
      .select("id,request_type,category,description,status,priority,due_at")
      .in("reservation_id", reservationIds)
      .not("status", "in", "(completed,resolved,closed,cancelled,canceled)")
      .order("due_at", { ascending: true, nullsFirst: false })
      .limit(8)
    : { data: [], error: null }

  const roomIssuesResult = await supabase
    .from("issues")
    .select("id,title,status,severity,priority,created_at,asset_id")
    .eq("related_item_type", "room")
    .eq("related_item_id", id)
    .not("status", "in", "(resolved,closed,cancelled,canceled)")
    .order("created_at", { ascending: false })
    .limit(8)

  const reservationIssuesResult = reservationIds.length > 0
    ? await supabase
      .from("issues")
      .select("id,title,status,severity,priority,created_at,asset_id")
      .eq("related_item_type", "reservation")
      .in("related_item_id", reservationIds)
      .not("status", "in", "(resolved,closed,cancelled,canceled)")
      .order("created_at", { ascending: false })
      .limit(8)
    : { data: [], error: null }

  const requests = Array.from(new Map([...(roomRequestsResult.data ?? []), ...(reservationRequestsResult.data ?? [])].map((item) => [item.id, item as RequestRow])).values())
  const issues = Array.from(new Map([...(roomIssuesResult.data ?? []), ...(reservationIssuesResult.data ?? [])].map((item) => [item.id, item as Issue])).values())
  const assetIds = Array.from(new Set([...maintenance.map((item) => item.asset_id), ...issues.map((item) => item.asset_id)].filter((value): value is string => Boolean(value))))
  const assetsResult = assetIds.length > 0
    ? await supabase.from("assets").select("id,name,asset_code,status,is_critical").in("id", assetIds).order("name")
    : { data: [], error: null }
  const assets = (assetsResult.data ?? []) as Asset[]

  const queryError = stateResult.error
    || reservationsResult.error
    || housekeepingResult.error
    || maintenanceResult.error
    || historyResult.error
    || roomRequestsResult.error
    || reservationRequestsResult.error
    || roomIssuesResult.error
    || reservationIssuesResult.error
    || assetsResult.error

  return (
    <AppLayout>
      <div className="space-y-6 p-4 md:p-6">
        <div className="flex flex-col gap-4 border-b pb-5 md:flex-row md:items-end md:justify-between">
          <div>
            <Link href="/bookings/rooms" className="mb-3 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="h-4 w-4" />Habitaciones</Link>
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center border border-primary/25 bg-primary/10 text-primary"><BedDouble className="h-5 w-5" /></div>
              <div>
                <p className="text-xs font-medium uppercase tracking-[0.18em] text-primary">Objeto · Habitación</p>
                <h1 className="text-2xl font-semibold">Habitación {room.room_number}</h1>
              </div>
              <Badge variant={statusVariant(room.operational_status || room.status)}>{room.operational_status || room.status || "sin estado"}</Badge>
            </div>
            <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-sm text-muted-foreground">
              {room.location && <span className="inline-flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5" />{room.location}</span>}
              {room.floor && <span>Piso {room.floor}</span>}
              <span>{room.room_type || "Tipo no registrado"}</span>
              <span>Capacidad {room.capacity ?? "—"}</span>
            </div>
          </div>
          <Link href="/bookings" className="inline-flex h-9 items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90">Abrir calendario</Link>
        </div>

        {queryError && <div className="rounded-md border border-amber-500/30 bg-amber-500/5 p-3 text-sm text-amber-700 dark:text-amber-300">Parte del contexto relacionado no pudo cargarse. La habitación sigue disponible con los datos que sí pasaron RLS.</div>}

        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <StateCard label="Disponibilidad" value={state?.availability_status || room.status} />
          <StateCard label="Reserva" value={state?.reservation_status} />
          <StateCard label="Housekeeping" value={state?.housekeeping_status} />
          <StateCard label="Mantenimiento" value={state?.maintenance_status} />
        </section>

        {state?.current_reservation_id && (
          <Card className="border-primary/25 bg-primary/5">
            <CardHeader className="pb-3"><CardTitle className="text-base">Reserva actual</CardTitle></CardHeader>
            <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div><p className="font-medium">{state.guest_name || "Huésped no identificado"}</p><p className="text-sm text-muted-foreground">{formatDate(state.check_in)} → {formatDate(state.check_out)}</p></div>
              <Link href={`/bookings/reservations/${state.current_reservation_id}`} className="text-sm font-medium text-primary hover:underline">Abrir reserva</Link>
            </CardContent>
          </Card>
        )}

        <div className="grid gap-6 xl:grid-cols-2">
          <ObjectList title="Reservas próximas" icon={<CalendarDays className="h-4 w-4" />} empty="No hay reservas próximas visibles." href="/bookings">
            {reservations.map((item) => (
              <Link key={item.id} href={`/bookings/reservations/${item.id}`} className="flex items-start justify-between gap-3 rounded-md border p-3 hover:bg-muted/40">
                <div><p className="font-medium">{item.guest_name || "Reserva sin huésped"}</p><p className="mt-1 text-xs text-muted-foreground">{formatDate(item.check_in)} → {formatDate(item.check_out)} · {item.payment_status || "pago sin estado"}</p></div>
                <Badge variant="outline">{item.arrival_status || item.status || "sin estado"}</Badge>
              </Link>
            ))}
          </ObjectList>

          <ObjectList title="Housekeeping abierto" icon={<ClipboardCheck className="h-4 w-4" />} empty="Sin housekeeping abierto." href="/bookings/housekeeping">
            {housekeeping.map((item) => <CompactRow key={item.id} title={item.task_type || "Housekeeping"} detail={`${item.service_date ? formatDate(item.service_date) : "Sin fecha"}${item.priority ? ` · ${item.priority}` : ""}`} status={item.status} />)}
          </ObjectList>

          <ObjectList title="Solicitudes abiertas" icon={<ConciergeBell className="h-4 w-4" />} empty="Sin solicitudes abiertas." href="/bookings/requests">
            {requests.map((item) => <CompactRow key={item.id} title={item.request_type || item.category || "Solicitud"} detail={`${item.due_at ? formatDateTime(item.due_at) : "Sin vencimiento"}${item.description ? ` · ${item.description}` : ""}`} status={item.priority || item.status} />)}
          </ObjectList>

          <ObjectList title="Mantenimiento abierto" icon={<Wrench className="h-4 w-4" />} empty="Sin mantenimiento abierto." href="/maintenance">
            {maintenance.map((item) => <CompactRow key={item.id} title={item.title || "Mantenimiento"} detail={`${item.bloqueado ? "Bloqueado · " : ""}${item.fecha_objetivo ? formatDate(item.fecha_objetivo) : "Sin fecha objetivo"}${item.asset_id ? " · activo vinculado" : ""}`} status={item.prioridad || item.status} />)}
          </ObjectList>

          <ObjectList title="Incidencias abiertas" icon={<AlertTriangle className="h-4 w-4" />} empty="Sin incidencias abiertas." href="/issues">
            {issues.map((item) => <CompactRow key={item.id} title={item.title || "Incidencia"} detail={item.created_at ? formatDateTime(item.created_at) : "Sin fecha"} status={item.severity || item.priority || item.status} />)}
          </ObjectList>

          <ObjectList title="Activos implicados" icon={<PackageSearch className="h-4 w-4" />} empty="No hay activos implicados en trabajo abierto." href="/assets">
            {assets.map((item) => (
              <Link key={item.id} href={`/assets/${item.id}`} className="flex items-start justify-between gap-3 rounded-md border p-3 hover:bg-muted/40">
                <div><p className="font-medium">{item.name}</p><p className="mt-1 text-xs text-muted-foreground">{item.asset_code || "Sin código"} · vínculo por incidencia o mantenimiento</p></div>
                <Badge variant={item.is_critical ? "destructive" : "outline"}>{item.status || "sin estado"}</Badge>
              </Link>
            ))}
          </ObjectList>
        </div>

        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2 text-base"><History className="h-4 w-4" />Actividad de la habitación</CardTitle></CardHeader>
          <CardContent>
            {history.length === 0 ? <p className="text-sm text-muted-foreground">Todavía no hay historial operacional registrado para esta habitación.</p> : (
              <div className="space-y-3">{history.map((item) => <div key={item.id} className="border-l-2 border-border pl-4"><div className="flex flex-wrap items-center gap-2"><p className="text-sm font-medium">{item.previous_status || "—"} → {item.new_status || "—"}</p><Badge variant="outline">{item.source || "system"}</Badge></div><p className="mt-1 text-xs text-muted-foreground">{formatDateTime(item.created_at)}{item.reason ? ` · ${item.reason}` : ""}</p></div>)}</div>
            )}
          </CardContent>
        </Card>

        {(room.amenities?.length || room.notes) && <Card><CardHeader><CardTitle className="text-base">Ficha</CardTitle></CardHeader><CardContent className="space-y-3">{room.amenities?.length ? <div className="flex flex-wrap gap-2">{room.amenities.map((item) => <Badge key={item} variant="secondary">{item}</Badge>)}</div> : null}{room.notes && <p className="text-sm text-muted-foreground">{room.notes}</p>}</CardContent></Card>}
      </div>
    </AppLayout>
  )
}

function StateCard({ label, value }: { label: string; value: string | null | undefined }) {
  return <div className="rounded-lg border p-4"><p className="text-xs uppercase tracking-[0.12em] text-muted-foreground">{label}</p><div className="mt-2"><Badge variant={statusVariant(value || null)}>{value || "sin señal"}</Badge></div></div>
}

function ObjectList({ title, icon, empty, href, children }: { title: string; icon: React.ReactNode; empty: string; href: string; children: React.ReactNode }) {
  const hasChildren = Array.isArray(children) ? children.length > 0 : Boolean(children)
  return <Card><CardHeader className="pb-3"><div className="flex items-center justify-between gap-3"><CardTitle className="flex items-center gap-2 text-base">{icon}{title}</CardTitle><Link href={href} className="text-xs font-medium text-primary hover:underline">Ver todo</Link></div></CardHeader><CardContent>{hasChildren ? <div className="space-y-2">{children}</div> : <p className="text-sm text-muted-foreground">{empty}</p>}</CardContent></Card>
}

function CompactRow({ title, detail, status }: { title: string; detail: string; status: string | null }) {
  return <div className="flex items-start justify-between gap-3 rounded-md border p-3"><div className="min-w-0"><p className="font-medium">{title}</p><p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{detail}</p></div><Badge variant={statusVariant(status)}>{status || "sin estado"}</Badge></div>
}
