"use client"

import Link from "next/link"
import { useCallback, useEffect, useMemo, useState } from "react"
import { AlertTriangle, ArrowLeft, Banknote, BedDouble, ClipboardCheck, FileText, History, Loader2, MessageSquareText, ReceiptText, ShoppingCart, UserRound, Wrench } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { InvoiceEditorModal } from "@/components/invoice-editor-modal"
import { useLanguage } from "@/lib/hooks/use-language"

type Reservation = {
  id: string; room_id: string | null; guest_id: string | null; guest_name: string | null; guest_email: string | null; guest_phone: string | null;
  check_in: string; check_out: string; status: string | null; arrival_status: string | null; payment_status: string | null; num_guests: number | null;
  source: string | null; booking_type: string | null; total_amount: number | string | null; special_requests: string | null;
  estimated_arrival_time: string | null; estimated_departure_time: string | null; early_check_in_requested: boolean | null; late_check_out_requested: boolean | null;
}

type Related = {
  room: any | null; guest: any | null; payments: any[]; invoices: any[]; housekeeping: any[]; maintenance: any[]; hospitality: any[];
  extras: any[]; guestRequests: any[]; shopping: any[]; issues: any[]; exceptions: any[]; documents: any[]; events: any[];
  logistics: any[]; handoverItems: any[]; activityBookings: any[];
}

const COPY = {
  en: { back:"Calendar", object:"Reservation · Stay cockpit", createInvoice:"Invoice", guest:"Guest", room:"Room & stay", finance:"Payments & invoices", operations:"Stay operations", stayDetails:"Stay details", active:"active", historical:"Historical record", historicalNote:"Imported history for reference only. It does not create operational tasks, alerts, invoices or balances.", historicalAmount:"Source amount", reservationBalance:"Reservation balance", invoicedBalance:"Invoiced balance", notInvoiced:"Not invoiced", housekeeping:"Housekeeping", maintenance:"Maintenance", requests:"Requests & hospitality", shopping:"Shopping list", extras:"Extras", issues:"Issues", documents:"Documents", activity:"Activity", attention:"Requires attention", loading:"Loading operational context…", partial:"Some related context could not be loaded. Only RLS-authorized data is shown.", empty:"No linked records", total:"Reservation total", paid:"Recorded payments", guests:"guest(s)", source:"Source", noRoom:"No room linked", noGuest:"No guest linked", special:"Special requests", blocksIn:"Blocks check-in", blocksOut:"Blocks check-out", allergies:"Allergies", mobility:"Mobility", housekeepingPref:"Housekeeping preference", arrival:"Arrival", departure:"Departure", invoice:"Invoice", openList:"Open list", logistics:"Arrival, departure & handover", noLogistics:"No logistics or handover items linked", due:"Due", balance:"Outstanding balance", payment:"Payment", issue:"Issue", document:"Document", event:"Event", activities:"Activities", attendees:"attendee(s)", transport:"Transport", pickup:"Pickup" },
  es: { back:"Calendario", object:"Reserva · Stay cockpit", createInvoice:"Facturar", guest:"Huésped", room:"Habitación y estadía", finance:"Pagos y facturas", operations:"Operación de la estadía", stayDetails:"Detalles de la estadía", active:"activas", historical:"Registro histórico", historicalNote:"Histórico importado sólo como referencia. No genera tareas, alertas, facturas ni saldos operacionales.", historicalAmount:"Monto de origen", reservationBalance:"Saldo de reserva", invoicedBalance:"Saldo facturado", notInvoiced:"No facturada", housekeeping:"Housekeeping", maintenance:"Mantenimiento", requests:"Solicitudes y hospitalidad", shopping:"Lista de compras", extras:"Extras", issues:"Incidencias", documents:"Documentos", activity:"Actividad", attention:"Requiere atención", loading:"Cargando contexto operacional…", partial:"Parte del contexto relacionado no pudo cargarse. Sólo se muestran datos autorizados por RLS.", empty:"Sin registros vinculados", total:"Total reserva", paid:"Pagos registrados", guests:"huésped(es)", source:"Fuente", noRoom:"Sin habitación vinculada", noGuest:"Sin huésped vinculado", special:"Solicitudes especiales", blocksIn:"Bloquea check-in", blocksOut:"Bloquea check-out", allergies:"Alergias", mobility:"Movilidad", housekeepingPref:"Preferencia de housekeeping", arrival:"Llegada", departure:"Salida", invoice:"Factura", openList:"Abrir lista", logistics:"Llegada, salida y entrega de turno", noLogistics:"Sin logística ni pendientes de turno vinculados", due:"Vence", balance:"Saldo pendiente", payment:"Pago", issue:"Incidencia", document:"Documento", event:"Evento", activities:"Actividades", attendees:"asistente(s)", transport:"Transporte", pickup:"Recogida" },
  de: { back:"Kalender", object:"Reservierung · Stay cockpit", createInvoice:"Rechnung", guest:"Gast", room:"Zimmer & Aufenthalt", finance:"Zahlungen & Rechnungen", operations:"Aufenthaltsbetrieb", stayDetails:"Aufenthaltsdetails", active:"aktiv", historical:"Historischer Eintrag", historicalNote:"Importierter Verlauf nur als Referenz. Er erzeugt keine operativen Aufgaben, Warnungen, Rechnungen oder Salden.", historicalAmount:"Quellbetrag", reservationBalance:"Reservierungssaldo", invoicedBalance:"Rechnungssaldo", notInvoiced:"Nicht fakturiert", housekeeping:"Housekeeping", maintenance:"Instandhaltung", requests:"Anfragen & Hospitality", shopping:"Einkaufsliste", extras:"Extras", issues:"Vorfälle", documents:"Dokumente", activity:"Aktivität", attention:"Aufmerksamkeit erforderlich", loading:"Betriebskontext wird geladen…", partial:"Ein Teil des verknüpften Kontexts konnte nicht geladen werden. Es werden nur durch RLS erlaubte Daten gezeigt.", empty:"Keine verknüpften Einträge", total:"Reservierung gesamt", paid:"Erfasste Zahlungen", guests:"Gast/Gäste", source:"Quelle", noRoom:"Kein Zimmer verknüpft", noGuest:"Kein Gast verknüpft", special:"Besondere Wünsche", blocksIn:"Blockiert Check-in", blocksOut:"Blockiert Check-out", allergies:"Allergien", mobility:"Mobilität", housekeepingPref:"Housekeeping-Präferenz", arrival:"Anreise", departure:"Abreise", invoice:"Rechnung", openList:"Liste öffnen", logistics:"Anreise, Abreise und Schichtübergabe", noLogistics:"Keine Logistik- oder Übergabepunkte verknüpft", due:"Fällig", balance:"Offener Betrag", payment:"Zahlung", issue:"Vorfall", document:"Dokument", event:"Ereignis", activities:"Aktivitäten", attendees:"Teilnehmer", transport:"Transport", pickup:"Abholung" },
} as const

function operationalLabel(value: string | null | undefined, language: "en" | "es" | "de") {
  if (!value) return "—"
  const labels: Record<string, Record<"en" | "es" | "de", string>> = {
    post_checkout_laundry: { en: "Post check-out laundry", es: "Lavandería post check-out", de: "Wäsche nach Check-out" },
    post_checkout_restock: { en: "Post check-out restock", es: "Reposición post check-out", de: "Nachbestückung nach Check-out" },
    room_release: { en: "Release room", es: "Liberar habitación", de: "Zimmer freigeben" },
    post_checkout_cleaning: { en: "Post check-out cleaning", es: "Limpieza post check-out", de: "Reinigung nach Check-out" },
    post_checkout_damage_review: { en: "Damage review", es: "Revisión de daños", de: "Schadensprüfung" },
    pre_arrival_inspection: { en: "Pre-arrival inspection", es: "Inspección previa a llegada", de: "Inspektion vor Anreise" },
    pre_arrival_preparation: { en: "Pre-arrival preparation", es: "Preparación previa a llegada", de: "Vorbereitung vor Anreise" },
    canonical_event_xls: { en: "Imported history", es: "Histórico importado", de: "Importierter Verlauf" },
    manual: { en: "Direct booking", es: "Reserva directa", de: "Direktbuchung" },
    direct: { en: "Direct booking", es: "Reserva directa", de: "Direktbuchung" },
  }
  const key = String(value).trim().toLowerCase()
  if (labels[key]) return labels[key][language]
  if (!key.includes("_")) return value
  const human = key.replaceAll("_", " ")
  return human.charAt(0).toUpperCase() + human.slice(1)
}

function statusClass(value: string | null | undefined) {
  const status = String(value ?? "").toLowerCase()
  if (["critical","blocked","overdue","failed","unpaid","open"].includes(status)) return "text-[#ef9a8d]"
  if (["completed","resolved","paid","ready","checked_in","checked-out","checked_out"].includes(status)) return "text-[#9db69f]"
  if (["pending","assigned","in_progress","partial"].includes(status)) return "text-[#d3ad61]"
  return "text-[#b9b0a4]"
}

function Row({ title, detail, status }: { title: string; detail?: string | null; status?: string | null }) {
  return <div data-stay-row className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-4 border-b border-white/[.045] py-2.5 last:border-b-0"><div className="min-w-0"><p className="truncate text-xs font-medium text-[#e7e1d8]">{title}</p>{detail && <p className="mt-1 line-clamp-2 text-[11px] leading-4 text-[#8f867b]">{detail}</p>}</div>{status && <span className={`pt-0.5 text-[9px] font-medium uppercase tracking-[.07em] ${statusClass(status)}`}>{status.replaceAll("_"," ")}</span>}</div>
}

function Panel({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return <section data-stay-panel className="min-w-0 bg-[#211e1a] px-4 py-3.5"><div data-stay-panel-title className="mb-2.5 flex items-center gap-2 text-[10px] font-medium uppercase tracking-[.08em] text-[#9f968b]">{icon}{title}</div>{children}</section>
}

function NestedSection({ title, icon, count, activeCount = 0, defaultOpen = false, children }: { title: string; icon: React.ReactNode; count: number; activeCount?: number; defaultOpen?: boolean; children: React.ReactNode }) {
  if (count <= 0) return null
  return <details data-stay-nested open={defaultOpen} className="group border-b border-white/[.055] last:border-b-0">
    <summary className="flex cursor-pointer list-none items-center gap-2 py-2.5 text-xs text-[#e7e1d8] marker:hidden">
      <span className="text-[#8f867b]">{icon}</span>
      <span className="min-w-0 flex-1 font-medium">{title}</span>
      {activeCount > 0 && <span className="text-[9px] uppercase tracking-[.07em] text-[#d3ad61]">{activeCount}</span>}
      <span className="min-w-5 text-right text-[10px] tabular-nums text-[#6f675f]">{count}</span>
      <span className="text-[#6f675f] transition-transform group-open:rotate-90">›</span>
    </summary>
    <div className="pb-2 pl-5">{children}</div>
  </details>
}

export function BookingReservationStayCockpit({ reservation }: { reservation: Reservation }) {
  const { language } = useLanguage(); const c = COPY[language]; const supabase = useMemo(() => createClient(), [])
  const locale = language === "es" ? "es-CL" : language === "de" ? "de-DE" : "en-US"
  const money = useCallback((value: number | string | null | undefined) => new Intl.NumberFormat(locale,{style:"currency",currency:"CLP",maximumFractionDigits:0}).format(Number(value ?? 0)), [locale])
  const knownMoney = useCallback((value: number | string | null | undefined) => value == null || value === "" ? "—" : money(value), [money])
  const [related, setRelated] = useState<Related | null>(null); const [loading, setLoading] = useState(true); const [partial, setPartial] = useState(false); const [invoiceOpen, setInvoiceOpen] = useState(false)

  useEffect(() => {
    let alive = true
    async function load() {
      setLoading(true); setPartial(false)
      const safe = async (promise: any, fallback: any) => { try { const result = await promise; if (result?.error) { setPartial(true); return fallback }; return result?.data ?? fallback } catch { setPartial(true); return fallback } }
      const [room, guest, payments, invoices, housekeeping, maintenance, hospitality, extras, guestRequests, shopping, issues, exceptions, documents, events, logistics, handoverItems, activityBookings] = await Promise.all([
        reservation.room_id ? safe(supabase.from("rooms").select("id,room_number,status,operational_status,location,location_ref:locations(name)").eq("id", reservation.room_id).maybeSingle(), null) : null,
        reservation.guest_id ? safe(supabase.from("guests").select("id,name,email,phone,vip_status,preferred_language,preferred_contact_channel,allergies,mobility_requirements,housekeeping_preferences").eq("id", reservation.guest_id).maybeSingle(), null) : null,
        safe(supabase.from("payments").select("id,amount,payment_method,payment_status,paid_at,created_at").eq("reservation_id",reservation.id).order("created_at",{ascending:false}).limit(10), []),
        safe(supabase.from("invoices").select("id,invoice_number,status,payment_status,total_amount,amount_paid,invoice_date,due_date").eq("reservation_id",reservation.id).order("created_at",{ascending:false}).limit(10), []),
        safe(supabase.from("housekeeping_tasks").select("id,task_type,status,priority,service_date,requires_inspection,inspection_status").eq("reservation_id",reservation.id).order("service_date",{ascending:false,nullsFirst:false}).limit(10), []),
        safe(supabase.from("maintenance_tasks").select("id,title,status,prioridad,fecha_objetivo,bloqueado,blocks_room").eq("reservation_id",reservation.id).order("created_at",{ascending:false}).limit(10), []),
        safe(supabase.from("hospitality_requests").select("id,request_type,category,description,priority,status,due_at").eq("reservation_id",reservation.id).order("created_at",{ascending:false}).limit(10), []),
        safe(supabase.from("reservation_extras").select("id,name,unit,quantity,unit_price,total_amount,notes,created_at").eq("reservation_id",reservation.id).order("created_at",{ascending:false}).limit(10), []),
        safe(supabase.from("guest_requests").select("id,request_type,description,status,created_at").eq("reservation_id",reservation.id).order("created_at",{ascending:false}).limit(10), []),
        safe(supabase.from("hospitality_shopping_items").select("id,item_name,quantity,unit,status,source_strategy,required_date,assigned_to").eq("reservation_id",reservation.id).order("created_at",{ascending:false}).limit(20), []),
        safe(supabase.from("issues").select("id,title,description,category,priority,severity,status,created_at").eq("related_item_type","reservation").eq("related_item_id",reservation.id).order("created_at",{ascending:false}).limit(10), []),
        safe(supabase.from("reservation_operational_exceptions").select("source_id,domain,title,status,priority,exception_state,blocks_check_in,blocks_check_out,detail").eq("reservation_id",reservation.id).in("exception_state",["open","overdue"]).limit(10), []),
        safe(supabase.from("operational_documents").select("id,document_number,document_type,status,title,issued_at").eq("reservation_id",reservation.id).order("created_at",{ascending:false}).limit(10), []),
        safe(supabase.from("booking_events").select("id,event_type,category,title,description,previous_state,new_state,occurred_at").eq("reservation_id",reservation.id).order("occurred_at",{ascending:false}).limit(20), []),
        safe(supabase.from("reservation_logistics").select("id,direction,hub,anchor_at,status,notes").eq("reservation_id",reservation.id).order("anchor_at",{ascending:true,nullsFirst:false}).limit(10), []),
        safe(supabase.from("booking_handover_items").select("id,title,detail,priority,status,due_at").eq("reservation_id",reservation.id).order("due_at",{ascending:true,nullsFirst:false}).limit(10), []),
        safe(supabase.from("reservation_activity_bookings").select("id,activity_id,attendee_count,status,total_amount,transport_required,pickup_location,notes").eq("reservation_id",reservation.id).order("created_at",{ascending:false}).limit(10), []),
      ])
      const activityIds = (activityBookings ?? []).map((item:any)=>item.activity_id).filter(Boolean)
      const activities = activityIds.length
        ? await safe(supabase.from("activities").select("id,title,start_date,start_time,end_date,end_time,location,status").in("id", activityIds), [])
        : []
      const activityById = new Map((activities ?? []).map((item:any)=>[item.id,item]))
      const linkedActivityBookings = (activityBookings ?? []).map((item:any)=>({ ...item, activity: activityById.get(item.activity_id) ?? null }))
      if (alive) { setRelated({room,guest,payments,invoices,housekeeping,maintenance,hospitality,extras,guestRequests,shopping,issues,exceptions,documents,events,logistics,handoverItems,activityBookings:linkedActivityBookings}); setLoading(false) }
    }
    void load(); return () => { alive = false }
  }, [reservation.guest_id, reservation.id, reservation.room_id, supabase])

  const paid = useMemo(() => (related?.payments ?? []).filter((p:any)=>["paid","completed","succeeded"].includes(String(p.payment_status??"").toLowerCase())).reduce((sum:number,p:any)=>sum+Number(p.amount??0),0), [related])
  const invoicedBalance = useMemo(() => (related?.invoices ?? []).reduce((sum:number,x:any)=>sum+Math.max(0,Number(x.balance_due ?? Number(x.total_amount??0)-Number(x.amount_paid??0))),0), [related])
  const reservationTotal = Number(reservation.total_amount ?? 0)
  const reservationBalance = Math.max(0, reservationTotal - paid)
  const hasInvoice = (related?.invoices?.length ?? 0) > 0
  const todayChile = useMemo(() => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Santiago", year:"numeric", month:"2-digit", day:"2-digit" }).format(new Date()), [])
  const historicalImported = reservation.source === "canonical_event_xls" && reservation.check_out < todayChile
  const isActive = (status: unknown) => !["completed","resolved","cancelled","canceled","void","voided","checked_out","checked-out","paid"].includes(String(status ?? "").toLowerCase())
  const activeHousekeeping = (related?.housekeeping ?? []).filter((x:any)=>isActive(x.status)).length
  const activeMaintenance = (related?.maintenance ?? []).filter((x:any)=>isActive(x.status)).length
  const activeRequests = [...(related?.hospitality ?? []), ...(related?.guestRequests ?? [])].filter((x:any)=>isActive(x.status)).length
  const activeIssues = (related?.issues ?? []).filter((x:any)=>isActive(x.status)).length
  const activeShopping = (related?.shopping ?? []).filter((x:any)=>isActive(x.status)).length
  const activeOperations = activeHousekeeping + activeMaintenance + activeRequests + activeIssues + activeShopping
  const guest = related?.guest; const room = related?.room

  return <div data-stay-cockpit className="min-h-screen bg-[#171512] text-[#e7e1d8]">
    <header className="sticky top-0 z-20 flex min-h-[64px] flex-wrap items-center justify-between gap-4 border-b border-white/[.055] bg-[#211e1a]/95 px-5 py-3 backdrop-blur-sm"><div className="min-w-0"><div className="mb-1.5 flex items-center gap-3"><Link href={`/${language}/bookings/calendar`} className="inline-flex items-center gap-1.5 text-[10px] uppercase tracking-[.07em] text-[#8f867b] hover:text-[#e7e1d8]"><ArrowLeft className="h-3.5 w-3.5"/>{c.back}</Link><span className="text-[9px] uppercase tracking-[.1em] text-[#6f675f]">{c.object}</span></div><h1 className="truncate text-[18px] font-medium leading-6 tracking-[-.015em]">{reservation.guest_name || guest?.name || c.noGuest}</h1><p className="mt-0.5 text-[11px] text-[#8f867b]">{reservation.check_in} → {reservation.check_out} · {reservation.num_guests ?? 1} {c.guests}{reservation.source ? ` · ${c.source}: ${operationalLabel(reservation.source, language)}` : ""}</p></div><div className="flex shrink-0 items-center gap-3">{!historicalImported && <button type="button" onClick={() => setInvoiceOpen(true)} className="inline-flex h-8 items-center gap-2 border border-white/10 bg-[#2b2722] px-3 text-[10px] font-medium uppercase tracking-[.07em] text-[#e7e1d8] hover:bg-[#332e28]"><ReceiptText className="h-3.5 w-3.5"/>{c.createInvoice}</button>}<div className="text-right"><div className={`text-[9px] font-medium uppercase tracking-[.09em] ${historicalImported ? "text-[#8f867b]" : statusClass(reservation.arrival_status || reservation.status)}`}>{historicalImported ? c.historical : reservation.arrival_status || reservation.status || "—"}</div>{!historicalImported && <div className="mt-1 text-lg font-medium tracking-[-.02em] text-[#e7e1d8]">{knownMoney(reservation.total_amount)}</div>}</div></div></header>

    {loading && <div className="flex items-center gap-2 px-5 py-3 text-[11px] text-[#8f867b]"><Loader2 className="h-3.5 w-3.5 animate-spin"/>{c.loading}</div>}
    {partial && <div className="mx-3 mt-3 flex gap-2 border-l-2 border-[#d3ad61]/70 bg-[#2b2722] px-3 py-2 text-[11px] leading-4 text-[#d3ad61]"><AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0"/>{c.partial}</div>}

    <div className="grid gap-2 p-3 xl:grid-cols-2 2xl:grid-cols-3">
      {historicalImported && <section className="border-l-2 border-white/10 bg-[#211e1a] px-4 py-3.5 xl:col-span-2 2xl:col-span-3"><div className="mb-1 text-[10px] font-medium uppercase tracking-[.08em] text-[#9f968b]">{c.historical}</div><p className="text-[11px] leading-4 text-[#8f867b]">{c.historicalNote}</p></section>}
      {!historicalImported && (related?.exceptions?.length ?? 0) > 0 && <section className="border-l-2 border-[#d3ad61]/70 bg-[#2b2722] px-4 py-3.5 xl:col-span-2 2xl:col-span-3"><div className="mb-2.5 flex items-center gap-2 text-[10px] font-medium uppercase tracking-[.08em] text-[#d3ad61]"><AlertTriangle className="h-3.5 w-3.5"/>{c.attention}</div>{related!.exceptions.map((x:any)=><Row key={`${x.domain}-${x.source_id}`} title={x.title} detail={`${operationalLabel(x.domain, language)}${x.detail ? ` · ${x.detail}` : ""}${x.blocks_check_in ? ` · ${c.blocksIn}` : ""}${x.blocks_check_out ? ` · ${c.blocksOut}` : ""}`} status={x.exception_state}/>)}</section>}

      <Panel title={c.guest} icon={<UserRound className="h-3.5 w-3.5"/>}>{guest ? <><Row title={`${guest.name || reservation.guest_name || c.noGuest}${guest.vip_status ? " · VIP" : ""}`} detail={`${guest.email || reservation.guest_email || "—"} · ${guest.phone || reservation.guest_phone || "—"}`}/>{guest.allergies && <Row title={c.allergies} detail={guest.allergies}/>} {guest.mobility_requirements && <Row title={c.mobility} detail={guest.mobility_requirements}/>} {guest.housekeeping_preferences && <Row title={c.housekeepingPref} detail={guest.housekeeping_preferences}/>}</> : <Row title={reservation.guest_name || c.noGuest} detail={`${reservation.guest_email || "—"} · ${reservation.guest_phone || "—"}`}/>}</Panel>
      <Panel title={c.room} icon={<BedDouble className="h-3.5 w-3.5"/>}>{room ? <><Row title={`${room.room_number}`} detail={room.location_ref?.name || room.location || "—"} status={room.operational_status || room.status}/>{reservation.estimated_arrival_time && <Row title={c.arrival} detail={reservation.estimated_arrival_time}/>} {reservation.estimated_departure_time && <Row title={c.departure} detail={reservation.estimated_departure_time}/>}</> : <Row title={c.noRoom}/>}</Panel>
      <Panel title={c.finance} icon={<Banknote className="h-3.5 w-3.5"/>}>{historicalImported ? <Row title={c.historicalAmount} detail={`${knownMoney(reservation.total_amount)} · ${c.historicalNote}`}/> : <><Row title={c.total} detail={`${knownMoney(reservation.total_amount)} · ${c.paid}: ${money(paid)} · ${c.reservationBalance}: ${money(reservationBalance)}${hasInvoice ? ` · ${c.invoicedBalance}: ${money(invoicedBalance)}` : ` · ${c.notInvoiced}`}`} status={hasInvoice ? reservation.payment_status : "not_invoiced"}/>{(related?.payments ?? []).map((x:any)=><Row key={`p-${x.id}`} title={`${money(x.amount)} · ${x.payment_method || c.payment}`} detail={x.paid_at || x.created_at} status={x.payment_status}/>)}{(related?.invoices ?? []).map((x:any)=><Row key={`i-${x.id}`} title={x.invoice_number || c.invoice} detail={`${money(x.total_amount)}${x.due_date ? ` · ${c.due}: ${x.due_date}` : ""}`} status={x.payment_status || x.status}/>)}{!loading && !(related?.payments.length || related?.invoices.length) && <Row title={c.empty}/>}</>}</Panel>
      {!historicalImported && <>
        <section data-stay-operations className="min-w-0 bg-[#211e1a] px-4 py-3.5 xl:col-span-2 2xl:col-span-2">
          <div className="mb-1 flex items-center gap-2 text-[10px] font-medium uppercase tracking-[.08em] text-[#9f968b]"><ClipboardCheck className="h-3.5 w-3.5"/>{c.operations}{activeOperations > 0 && <span className="ml-auto text-[9px] text-[#d3ad61]">{activeOperations} {c.active}</span>}</div>
          <NestedSection title={c.housekeeping} icon={<ClipboardCheck className="h-3.5 w-3.5"/>} count={related?.housekeeping.length ?? 0} activeCount={activeHousekeeping} defaultOpen={activeHousekeeping > 0}>
            {(related?.housekeeping ?? []).map((x:any)=><Row key={x.id} title={operationalLabel(x.task_type || "Housekeeping", language)} detail={x.service_date} status={x.status}/>)}
          </NestedSection>
          <NestedSection title={c.requests} icon={<MessageSquareText className="h-3.5 w-3.5"/>} count={(related?.hospitality.length ?? 0)+(related?.guestRequests.length ?? 0)} activeCount={activeRequests} defaultOpen={activeRequests > 0}>
            {[...(related?.hospitality ?? []), ...(related?.guestRequests ?? [])].map((x:any)=><Row key={`${x.request_type}-${x.id}`} title={operationalLabel(x.request_type || x.category || "Request", language)} detail={x.description} status={x.status}/>)}
          </NestedSection>
          <NestedSection title={c.maintenance} icon={<Wrench className="h-3.5 w-3.5"/>} count={related?.maintenance.length ?? 0} activeCount={activeMaintenance} defaultOpen={activeMaintenance > 0}>
            {(related?.maintenance ?? []).map((x:any)=><Row key={x.id} title={x.title || c.maintenance} detail={x.fecha_objetivo} status={x.bloqueado ? "blocked" : x.status}/>)}
          </NestedSection>
          <NestedSection title={c.issues} icon={<AlertTriangle className="h-3.5 w-3.5"/>} count={related?.issues.length ?? 0} activeCount={activeIssues} defaultOpen={activeIssues > 0}>
            {(related?.issues ?? []).map((x:any)=><Row key={x.id} title={x.title || x.category || c.issue} detail={x.description} status={x.status}/>)}
          </NestedSection>
          <NestedSection title={c.shopping} icon={<ShoppingCart className="h-3.5 w-3.5"/>} count={related?.shopping.length ?? 0} activeCount={activeShopping}>
            <div className="mb-1 flex justify-end"><Link href={`/${language}/bookings/shopping-list?reservation_id=${reservation.id}`} className="text-[10px] uppercase tracking-[.07em] text-[#9db69f] hover:text-[#e7e1d8]">{c.openList}</Link></div>
            {(related?.shopping ?? []).map((x:any)=><Row key={x.id} title={`${x.item_name} × ${x.quantity} ${x.unit}`} detail={`${operationalLabel(x.source_strategy, language)}${x.required_date ? ` · ${x.required_date}` : ""}`} status={x.status}/>)}
          </NestedSection>
          {!loading && activeOperations === 0 && !((related?.housekeeping.length??0)+(related?.maintenance.length??0)+(related?.hospitality.length??0)+(related?.guestRequests.length??0)+(related?.issues.length??0)+(related?.shopping.length??0)) && <Row title={c.empty}/>}
        </section>

        <section data-stay-details className="min-w-0 bg-[#211e1a] px-4 py-3.5 2xl:col-span-1">
          <div className="mb-1 flex items-center gap-2 text-[10px] font-medium uppercase tracking-[.08em] text-[#9f968b]"><History className="h-3.5 w-3.5"/>{c.stayDetails}</div>
          <NestedSection title={c.logistics} icon={<History className="h-3.5 w-3.5"/>} count={(related?.logistics.length??0)+(related?.handoverItems.length??0)}>
            {[...(related?.logistics ?? []).map((x:any)=>({id:`l-${x.id}`,title:x.direction==="arrival"?c.arrival:c.departure,detail:[x.hub,x.anchor_at,x.notes].filter(Boolean).join(" · "),status:x.status})),...(related?.handoverItems ?? []).map((x:any)=>({id:`h-${x.id}`,title:x.title,detail:[x.detail,x.due_at].filter(Boolean).join(" · "),status:x.status}))].map((x:any)=><Row key={x.id} title={x.title} detail={x.detail} status={x.status}/>)}
          </NestedSection>
          <NestedSection title={c.activities} icon={<History className="h-3.5 w-3.5"/>} count={related?.activityBookings.length ?? 0}>
            {(related?.activityBookings ?? []).map((x:any)=>{const activity=x.activity;const detail=[activity?.start_date ? `${activity.start_date}${activity.start_time ? ` · ${String(activity.start_time).slice(0,5)}` : ""}` : null,activity?.location,x.attendee_count ? `${x.attendee_count} ${c.attendees}` : null,x.transport_required ? c.transport : null,x.pickup_location ? `${c.pickup}: ${x.pickup_location}` : null,x.total_amount != null ? money(x.total_amount) : null].filter(Boolean).join(" · ");return <Row key={x.id} title={activity?.title || c.activities} detail={detail || x.notes} status={x.status || activity?.status}/>})}
          </NestedSection>
          <NestedSection title={c.extras} icon={<Banknote className="h-3.5 w-3.5"/>} count={related?.extras.length ?? 0}>
            {(related?.extras ?? []).map((x:any)=><Row key={x.id} title={`${x.name} × ${x.quantity}`} detail={money(x.total_amount ?? Number(x.unit_price||0)*Number(x.quantity||0))}/>)}
          </NestedSection>
          <NestedSection title={c.documents} icon={<FileText className="h-3.5 w-3.5"/>} count={related?.documents.length ?? 0}>
            {(related?.documents ?? []).map((x:any)=><Row key={x.id} title={x.title || x.document_number || x.document_type || c.document} detail={x.issued_at} status={x.status}/>)}
          </NestedSection>
          {reservation.special_requests && <NestedSection title={c.special} icon={<MessageSquareText className="h-3.5 w-3.5"/>} count={1}><Row title={reservation.special_requests}/></NestedSection>}
          <NestedSection title={c.activity} icon={<History className="h-3.5 w-3.5"/>} count={related?.events.length ?? 0}>
            {(related?.events ?? []).map((x:any)=><Row key={x.id} title={x.title || x.event_type || c.event} detail={`${x.occurred_at}${x.description ? ` · ${x.description}` : ""}`} status={x.new_state}/>)}
          </NestedSection>
          {!loading && !((related?.logistics.length??0)+(related?.handoverItems.length??0)+(related?.activityBookings.length??0)+(related?.extras.length??0)+(related?.documents.length??0)+(related?.events.length??0)+(reservation.special_requests?1:0)) && <Row title={c.empty}/>}
        </section>
      </>}
    </div>
    {!historicalImported && <InvoiceEditorModal open={invoiceOpen} onOpenChange={setInvoiceOpen} reservationId={reservation.id} guestName={reservation.guest_name || ""} guestEmail={reservation.guest_email || ""} guestPhone={reservation.guest_phone || ""} />}
  </div>
}
