import Link from "next/link"
import { notFound } from "next/navigation"
import { AlertTriangle, ArrowLeft, Banknote, BedDouble, ClipboardCheck, FileText, History, MessageSquareText, UserRound, Wrench } from "lucide-react"
import { AppLayout } from "@/components/app-layout"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { createClient } from "@/lib/supabase/server"

type Reservation = {
  id: string
  room_id: string | null
  guest_id: string | null
  guest_name: string | null
  guest_email: string | null
  guest_phone: string | null
  check_in: string
  check_out: string
  status: string | null
  arrival_status: string | null
  payment_status: string | null
  num_guests: number | null
  source: string | null
  booking_type: string | null
  total_amount: number | string | null
  special_requests: string | null
  estimated_arrival_time: string | null
  estimated_departure_time: string | null
  early_check_in_requested: boolean | null
  late_check_out_requested: boolean | null
}

type Room = { id: string; room_number: string; status: string | null; operational_status: string | null; location: string | null }
type Guest = { id: string; name: string | null; email: string | null; phone: string | null; vip_status: boolean | null; preferred_language: string | null; preferred_contact_channel: string | null; allergies: string | null; mobility_requirements: string | null; housekeeping_preferences: string | null }
type Payment = { id: string; amount: number | string; payment_method: string | null; payment_status: string | null; paid_at: string | null; created_at: string }
type Invoice = { id: string; invoice_number: string | null; status: string | null; payment_status: string | null; total_amount: number | string | null; balance_due: number | string | null; invoice_date: string | null }
type Housekeeping = { id: string; task_type: string | null; status: string | null; priority: string | null; service_date: string | null; requires_inspection: boolean | null; inspection_status: string | null }
type Maintenance = { id: string; title: string | null; status: string | null; prioridad: string | null; fecha_objetivo: string | null; bloqueado: boolean | null; blocks_room: boolean | null }
type RequestRow = { id: string; request_type: string | null; category: string | null; description: string | null; priority: string | null; status: string | null; due_at: string | null }
type ExceptionRow = { source_id: string; domain: string; title: string; status: string; priority: string | null; exception_state: string; blocks_check_in: boolean; blocks_check_out: boolean; detail: string | null }
type DocumentRow = { id: string; document_number: string | null; document_type: string | null; status: string | null; title: string | null; issued_at: string | null }
type EventRow = { id: string; event_type: string | null; category: string | null; title: string; description: string | null; previous_state: string | null; new_state: string | null; occurred_at: string }

function formatDate(value: string | null) {
  if (!value) return "Sin fecha"
  return new Intl.DateTimeFormat("es-CL", { dateStyle: "medium", timeZone: "America/Santiago" }).format(new Date(`${value}T12:00:00-04:00`))
}

function formatDateTime(value: string | null) {
  if (!value) return "Sin fecha"
  return new Intl.DateTimeFormat("es-CL", { dateStyle: "medium", timeStyle: "short", timeZone: "America/Santiago" }).format(new Date(value))
}

function formatMoney(value: number | string | null) {
  const amount = Number(value ?? 0)
  return Number.isFinite(amount) ? new Intl.NumberFormat("es-CL", { style: "currency", currency: "CLP", maximumFractionDigits: 0 }).format(amount) : "—"
}

function statusVariant(value: string | null): "default" | "secondary" | "destructive" | "outline" {
  const status = value?.toLowerCase() || ""
  if (["critical", "blocked", "overdue", "failed", "unpaid"].includes(status)) return "destructive"
  if (["completed", "resolved", "paid", "ready", "checked_in", "checked-out", "checked_out"].includes(status)) return "secondary"
  return "outline"
}

export default async function ReservationObjectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()

  const reservationResult = await supabase
    .from("reservations")
    .select("id,room_id,guest_id,guest_name,guest_email,guest_phone,check_in,check_out,status,arrival_status,payment_status,num_guests,source,booking_type,total_amount,special_requests,estimated_arrival_time,estimated_departure_time,early_check_in_requested,late_check_out_requested")
    .eq("id", id)
    .maybeSingle()

  if (reservationResult.error || !reservationResult.data) notFound()
  const reservation = reservationResult.data as Reservation

  const [roomResult, guestResult, paymentsResult, invoicesResult, housekeepingResult, maintenanceResult, requestsResult, exceptionsResult, documentsResult, eventsResult] = await Promise.all([
    reservation.room_id ? supabase.from("rooms").select("id,room_number,status,operational_status,location").eq("id", reservation.room_id).maybeSingle() : Promise.resolve({ data: null, error: null }),
    reservation.guest_id ? supabase.from("guests").select("id,name,email,phone,vip_status,preferred_language,preferred_contact_channel,allergies,mobility_requirements,housekeeping_preferences").eq("id", reservation.guest_id).maybeSingle() : Promise.resolve({ data: null, error: null }),
    supabase.from("payments").select("id,amount,payment_method,payment_status,paid_at,created_at").eq("reservation_id", id).order("created_at", { ascending: false }).limit(10),
    supabase.from("invoices").select("id,invoice_number,status,payment_status,total_amount,balance_due,invoice_date").eq("reservation_id", id).order("created_at", { ascending: false }).limit(10),
    supabase.from("housekeeping_tasks").select("id,task_type,status,priority,service_date,requires_inspection,inspection_status").eq("reservation_id", id).order("service_date", { ascending: false, nullsFirst: false }).limit(10),
    supabase.from("maintenance_tasks").select("id,title,status,prioridad,fecha_objetivo,bloqueado,blocks_room").eq("reservation_id", id).order("created_at", { ascending: false }).limit(10),
    supabase.from("hospitality_requests").select("id,request_type,category,description,priority,status,due_at").eq("reservation_id", id).order("created_at", { ascending: false }).limit(10),
    supabase.from("reservation_operational_exceptions").select("source_id,domain,title,status,priority,exception_state,blocks_check_in,blocks_check_out,detail").eq("reservation_id", id).in("exception_state", ["open", "overdue"]).limit(10),
    supabase.from("operational_documents").select("id,document_number,document_type,status,title,issued_at").eq("reservation_id", id).order("created_at", { ascending: false }).limit(10),
    supabase.from("booking_events").select("id,event_type,category,title,description,previous_state,new_state,occurred_at").eq("reservation_id", id).order("occurred_at", { ascending: false }).limit(20),
  ])

  const room = roomResult.data as Room | null
  const guest = guestResult.data as Guest | null
  const payments = (paymentsResult.data ?? []) as Payment[]
  const invoices = (invoicesResult.data ?? []) as Invoice[]
  const housekeeping = (housekeepingResult.data ?? []) as Housekeeping[]
  const maintenance = (maintenanceResult.data ?? []) as Maintenance[]
  const requests = (requestsResult.data ?? []) as RequestRow[]
  const exceptions = (exceptionsResult.data ?? []) as ExceptionRow[]
  const documents = (documentsResult.data ?? []) as DocumentRow[]
  const events = (eventsResult.data ?? []) as EventRow[]
  const queryError = roomResult.error || guestResult.error || paymentsResult.error || invoicesResult.error || housekeepingResult.error || maintenanceResult.error || requestsResult.error || exceptionsResult.error || documentsResult.error || eventsResult.error
  const paidAmount = payments.filter((item) => ["paid", "completed", "succeeded"].includes(item.payment_status?.toLowerCase() || "")).reduce((sum, item) => sum + Number(item.amount || 0), 0)

  return (
    <AppLayout>
      <div className="space-y-6 p-4 md:p-6">
        <div className="flex flex-col gap-4 border-b pb-5 md:flex-row md:items-end md:justify-between">
          <div>
            <Link href="/bookings" className="mb-3 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="h-4 w-4" />Calendario</Link>
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center border border-primary/25 bg-primary/10 text-primary"><CalendarIcon /></div>
              <div>
                <p className="text-xs font-medium uppercase tracking-[0.18em] text-primary">Objeto · Reserva</p>
                <h1 className="text-2xl font-semibold">{reservation.guest_name || guest?.name || "Reserva sin huésped"}</h1>
              </div>
              <Badge variant={statusVariant(reservation.arrival_status || reservation.status)}>{reservation.arrival_status || reservation.status || "sin estado"}</Badge>
            </div>
            <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-sm text-muted-foreground">
              <span>{formatDate(reservation.check_in)} → {formatDate(reservation.check_out)}</span>
              <span>{reservation.num_guests ?? "—"} huésped{reservation.num_guests === 1 ? "" : "es"}</span>
              {reservation.source && <span>Fuente {reservation.source}</span>}
            </div>
          </div>
          {room && <Link href={`/bookings/rooms/${room.id}`} className="inline-flex h-9 items-center gap-2 rounded-md border px-3 text-sm font-medium hover:bg-muted"><BedDouble className="h-4 w-4" />Habitación {room.room_number}</Link>}
        </div>

        {queryError && <div className="rounded-md border border-amber-500/30 bg-amber-500/5 p-3 text-sm text-amber-700 dark:text-amber-300">Parte del contexto relacionado no pudo cargarse. La reserva sigue mostrando únicamente la información permitida por RLS.</div>}

        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <StateCard label="Estadía" value={reservation.status} />
          <StateCard label="Llegada" value={reservation.arrival_status} />
          <StateCard label="Pago" value={reservation.payment_status} />
          <div className="rounded-lg border p-4"><p className="text-xs uppercase tracking-[0.12em] text-muted-foreground">Total reserva</p><p className="mt-2 text-lg font-semibold">{formatMoney(reservation.total_amount)}</p><p className="mt-1 text-xs text-muted-foreground">Pagos registrados: {formatMoney(paidAmount)}</p></div>
        </section>

        {exceptions.length > 0 && <Card className="border-amber-500/30 bg-amber-500/5"><CardHeader><CardTitle className="flex items-center gap-2 text-base"><AlertTriangle className="h-4 w-4" />Requiere atención</CardTitle></CardHeader><CardContent className="space-y-2">{exceptions.map((item) => <div key={`${item.domain}-${item.source_id}`} className="rounded-md border border-amber-500/20 bg-background/40 p-3"><div className="flex flex-wrap items-center justify-between gap-2"><p className="font-medium">{item.title}</p><Badge variant="destructive">{item.exception_state}</Badge></div><p className="mt-1 text-xs text-muted-foreground">{item.domain}{item.detail ? ` · ${item.detail}` : ""}</p>{(item.blocks_check_in || item.blocks_check_out) && <p className="mt-2 text-xs font-medium text-amber-700 dark:text-amber-300">{item.blocks_check_in ? "Bloquea check-in" : ""}{item.blocks_check_in && item.blocks_check_out ? " · " : ""}{item.blocks_check_out ? "Bloquea check-out" : ""}</p>}</div>)}</CardContent></Card>}

        <div className="grid gap-6 xl:grid-cols-2">
          <Card><CardHeader><CardTitle className="flex items-center gap-2 text-base"><UserRound className="h-4 w-4" />Huésped</CardTitle></CardHeader><CardContent className="space-y-3 text-sm"><div><p className="font-medium">{guest?.name || reservation.guest_name || "No identificado"}{guest?.vip_status ? " · VIP" : ""}</p><p className="text-muted-foreground">{guest?.email || reservation.guest_email || "Sin email"} · {guest?.phone || reservation.guest_phone || "Sin teléfono"}</p></div>{guest?.preferred_language && <p><span className="text-muted-foreground">Idioma:</span> {guest.preferred_language}</p>}{guest?.preferred_contact_channel && <p><span className="text-muted-foreground">Contacto:</span> {guest.preferred_contact_channel}</p>}{guest?.allergies && <p><span className="text-muted-foreground">Alergias:</span> {guest.allergies}</p>}{guest?.mobility_requirements && <p><span className="text-muted-foreground">Movilidad:</span> {guest.mobility_requirements}</p>}{guest?.housekeeping_preferences && <p><span className="text-muted-foreground">Housekeeping:</span> {guest.housekeeping_preferences}</p>}</CardContent></Card>

          <Card><CardHeader><CardTitle className="flex items-center gap-2 text-base"><BedDouble className="h-4 w-4" />Habitación y estadía</CardTitle></CardHeader><CardContent className="space-y-3 text-sm">{room ? <><div className="flex items-center justify-between gap-3"><div><p className="font-medium">Habitación {room.room_number}</p><p className="text-muted-foreground">{room.location || "Ubicación no registrada"}</p></div><Badge variant={statusVariant(room.operational_status || room.status)}>{room.operational_status || room.status || "sin estado"}</Badge></div><Link href={`/bookings/rooms/${room.id}`} className="text-sm font-medium text-primary hover:underline">Abrir objeto habitación</Link></> : <p className="text-muted-foreground">No hay habitación vinculada.</p>}{reservation.estimated_arrival_time && <p><span className="text-muted-foreground">Llegada estimada:</span> {reservation.estimated_arrival_time}</p>}{reservation.estimated_departure_time && <p><span className="text-muted-foreground">Salida estimada:</span> {reservation.estimated_departure_time}</p>}{(reservation.early_check_in_requested || reservation.late_check_out_requested) && <div className="flex flex-wrap gap-2">{reservation.early_check_in_requested && <Badge variant="outline">Early check-in</Badge>}{reservation.late_check_out_requested && <Badge variant="outline">Late check-out</Badge>}</div>}</CardContent></Card>

          <ObjectList title="Pagos e invoices" icon={<Banknote className="h-4 w-4" />} empty="Sin movimientos financieros visibles." href="/bookings/charges">
            {[...payments.map((item) => ({ id: `payment-${item.id}`, title: `${formatMoney(item.amount)} · ${item.payment_method || "Pago"}`, detail: formatDateTime(item.paid_at || item.created_at), status: item.payment_status })), ...invoices.map((item) => ({ id: `invoice-${item.id}`, title: item.invoice_number ? `Invoice ${item.invoice_number}` : "Invoice", detail: `${formatMoney(item.total_amount)}${item.balance_due != null ? ` · saldo ${formatMoney(item.balance_due)}` : ""}`, status: item.payment_status || item.status }))].map((item) => <CompactRow key={item.id} title={item.title} detail={item.detail} status={item.status} />)}
          </ObjectList>

          <ObjectList title="Housekeeping" icon={<ClipboardCheck className="h-4 w-4" />} empty="Sin housekeeping vinculado." href="/bookings/housekeeping">
            {housekeeping.map((item) => <CompactRow key={item.id} title={item.task_type || "Housekeeping"} detail={`${item.service_date ? formatDate(item.service_date) : "Sin fecha"}${item.requires_inspection ? ` · inspección ${item.inspection_status || "pendiente"}` : ""}`} status={item.priority || item.status} />)}
          </ObjectList>

          <ObjectList title="Mantenimiento" icon={<Wrench className="h-4 w-4" />} empty="Sin mantenimiento vinculado." href="/maintenance">
            {maintenance.map((item) => <CompactRow key={item.id} title={item.title || "Mantenimiento"} detail={`${item.bloqueado ? "Bloqueado · " : ""}${item.blocks_room ? "bloquea habitación · " : ""}${item.fecha_objetivo ? formatDate(item.fecha_objetivo) : "sin fecha objetivo"}`} status={item.prioridad || item.status} />)}
          </ObjectList>

          <ObjectList title="Solicitudes" icon={<MessageSquareText className="h-4 w-4" />} empty="Sin solicitudes vinculadas." href="/bookings/requests">
            {requests.map((item) => <CompactRow key={item.id} title={item.request_type || item.category || "Solicitud"} detail={`${item.description || "Sin descripción"}${item.due_at ? ` · vence ${formatDateTime(item.due_at)}` : ""}`} status={item.priority || item.status} />)}
          </ObjectList>

          <ObjectList title="Documentos" icon={<FileText className="h-4 w-4" />} empty="Sin documentos vinculados." href="/bookings/documents">
            {documents.map((item) => <CompactRow key={item.id} title={item.title || item.document_number || item.document_type || "Documento"} detail={`${item.document_type || "Documento"}${item.issued_at ? ` · ${formatDateTime(item.issued_at)}` : ""}`} status={item.status} />)}
          </ObjectList>
        </div>

        {reservation.special_requests && <Card><CardHeader><CardTitle className="text-base">Solicitudes especiales de la reserva</CardTitle></CardHeader><CardContent><p className="text-sm text-muted-foreground">{reservation.special_requests}</p></CardContent></Card>}

        <Card><CardHeader><CardTitle className="flex items-center gap-2 text-base"><History className="h-4 w-4" />Actividad de la reserva</CardTitle></CardHeader><CardContent>{events.length === 0 ? <p className="text-sm text-muted-foreground">Todavía no hay eventos operacionales registrados para esta reserva.</p> : <div className="space-y-3">{events.map((item) => <div key={item.id} className="border-l-2 border-border pl-4"><div className="flex flex-wrap items-center gap-2"><p className="text-sm font-medium">{item.title}</p>{item.category && <Badge variant="outline">{item.category}</Badge>}</div><p className="mt-1 text-xs text-muted-foreground">{formatDateTime(item.occurred_at)}{item.previous_state || item.new_state ? ` · ${item.previous_state || "—"} → ${item.new_state || "—"}` : ""}</p>{item.description && <p className="mt-1 text-sm text-muted-foreground">{item.description}</p>}</div>)}</div>}</CardContent></Card>
      </div>
    </AppLayout>
  )
}

function CalendarIcon() {
  return <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2"><path d="M8 2v4M16 2v4M3 10h18M5 4h14a2 2 0 0 1 2 2v14H3V6a2 2 0 0 1 2-2Z" /></svg>
}

function StateCard({ label, value }: { label: string; value: string | null | undefined }) {
  return <div className="rounded-lg border p-4"><p className="text-xs uppercase tracking-[0.12em] text-muted-foreground">{label}</p><div className="mt-2"><Badge variant={statusVariant(value || null)}>{value || "sin señal"}</Badge></div></div>
}

function ObjectList({ title, icon, empty, href, children }: { title: string; icon: React.ReactNode; empty: string; href: string; children: React.ReactNode }) {
  const hasChildren = Array.isArray(children) ? children.length > 0 : Boolean(children)
  return <Card><CardHeader className="pb-3"><div className="flex items-center justify-between gap-3"><CardTitle className="flex items-center gap-2 text-base">{icon}{title}</CardTitle><Link href={href} className="text-xs font-medium text-primary hover:underline">Ver todo</Link></div></CardHeader><CardContent>{hasChildren ? <div className="space-y-2">{children}</div> : <p className="text-sm text-muted-foreground">{empty}</p>}</CardContent></Card>
}

function CompactRow({ title, detail, status }: { title: string; detail: string; status: string | null }) {
  return <div className="flex items-start justify-between gap-3 rounded-md border p-3"><div className="min-w-0"><p className="font-medium">{title}</p><p className="mt-1 text-xs text-muted-foreground">{detail}</p></div><Badge variant={statusVariant(status)}>{status || "sin estado"}</Badge></div>
}
