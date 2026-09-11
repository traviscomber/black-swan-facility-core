"use client"

import Link from "next/link"
import { useCallback, useEffect, useMemo, useState } from "react"
import { AlertTriangle, ArrowLeft, Banknote, BedDouble, ClipboardCheck, FileText, History, Loader2, MessageSquareText, UserRound, Wrench } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { createClient } from "@/lib/supabase/client"
import { useLanguage } from "@/lib/hooks/use-language"

type Reservation = {
  id: string; room_id: string | null; guest_id: string | null; guest_name: string | null; guest_email: string | null; guest_phone: string | null;
  check_in: string; check_out: string; status: string | null; arrival_status: string | null; payment_status: string | null; num_guests: number | null;
  source: string | null; booking_type: string | null; total_amount: number | string | null; special_requests: string | null;
  estimated_arrival_time: string | null; estimated_departure_time: string | null; early_check_in_requested: boolean | null; late_check_out_requested: boolean | null;
}

type Related = {
  room: any | null; guest: any | null; payments: any[]; invoices: any[]; housekeeping: any[]; maintenance: any[]; hospitality: any[];
  extras: any[]; guestRequests: any[]; issues: any[]; exceptions: any[]; documents: any[]; events: any[];
}

const COPY = {
  en: { back:"Reservation list", object:"Reservation · Stay cockpit", guest:"Guest", room:"Room & stay", finance:"Payments & invoices", housekeeping:"Housekeeping", maintenance:"Maintenance", requests:"Requests & hospitality", extras:"Extras", issues:"Issues", documents:"Documents", activity:"Activity", attention:"Requires attention", loading:"Loading operational context…", partial:"Some related context could not be loaded. Only RLS-authorized data is shown.", empty:"No linked records", total:"Reservation total", paid:"Recorded payments", guests:"guest(s)", source:"Source", noRoom:"No room linked", noGuest:"No guest linked", special:"Special requests", blocksIn:"Blocks check-in", blocksOut:"Blocks check-out" },
  es: { back:"Lista de reservas", object:"Reserva · Stay cockpit", guest:"Huésped", room:"Habitación y estadía", finance:"Pagos y facturas", housekeeping:"Housekeeping", maintenance:"Mantenimiento", requests:"Solicitudes y hospitalidad", extras:"Extras", issues:"Incidencias", documents:"Documentos", activity:"Actividad", attention:"Requiere atención", loading:"Cargando contexto operacional…", partial:"Parte del contexto relacionado no pudo cargarse. Sólo se muestran datos autorizados por RLS.", empty:"Sin registros vinculados", total:"Total reserva", paid:"Pagos registrados", guests:"huésped(es)", source:"Fuente", noRoom:"Sin habitación vinculada", noGuest:"Sin huésped vinculado", special:"Solicitudes especiales", blocksIn:"Bloquea check-in", blocksOut:"Bloquea check-out" },
  de: { back:"Reservierungsliste", object:"Reservierung · Stay cockpit", guest:"Gast", room:"Zimmer & Aufenthalt", finance:"Zahlungen & Rechnungen", housekeeping:"Housekeeping", maintenance:"Instandhaltung", requests:"Anfragen & Hospitality", extras:"Extras", issues:"Vorfälle", documents:"Dokumente", activity:"Aktivität", attention:"Aufmerksamkeit erforderlich", loading:"Betriebskontext wird geladen…", partial:"Ein Teil des verknüpften Kontexts konnte nicht geladen werden. Es werden nur durch RLS erlaubte Daten gezeigt.", empty:"Keine verknüpften Einträge", total:"Reservierung gesamt", paid:"Erfasste Zahlungen", guests:"Gast/Gäste", source:"Quelle", noRoom:"Kein Zimmer verknüpft", noGuest:"Kein Gast verknüpft", special:"Besondere Wünsche", blocksIn:"Blockiert Check-in", blocksOut:"Blockiert Check-out" },
} as const

function statusClass(value: string | null | undefined) {
  const status = String(value ?? "").toLowerCase()
  if (["critical","blocked","overdue","failed","unpaid","open"].includes(status)) return "text-[#ef9a8d]"
  if (["completed","resolved","paid","ready","checked_in","checked-out","checked_out"].includes(status)) return "text-[#9db69f]"
  if (["pending","assigned","in_progress","partial"].includes(status)) return "text-[#d3ad61]"
  return "text-[#b9b0a4]"
}

function Row({ title, detail, status }: { title: string; detail?: string | null; status?: string | null }) {
  return <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-3 py-2.5"><div className="min-w-0"><p className="truncate text-xs font-medium text-[#e7e1d8]">{title}</p>{detail && <p className="mt-0.5 line-clamp-2 text-[11px] text-[#8f867b]">{detail}</p>}</div>{status && <span className={`text-[10px] uppercase tracking-[.08em] ${statusClass(status)}`}>{status.replaceAll("_"," ")}</span>}</div>
}

function Panel({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return <section className="bg-[#211e1a] p-3"><div className="mb-2 flex items-center gap-2 text-xs font-medium text-[#e7e1d8]">{icon}{title}</div>{children}</section>
}

export function BookingReservationStayCockpit({ reservation }: { reservation: Reservation }) {
  const { language } = useLanguage(); const c = COPY[language]; const supabase = useMemo(() => createClient(), [])
  const locale = language === "es" ? "es-CL" : language === "de" ? "de-DE" : "en-US"
  const money = useCallback((value: number | string | null | undefined) => new Intl.NumberFormat(locale,{style:"currency",currency:"CLP",maximumFractionDigits:0}).format(Number(value ?? 0)), [locale])
  const [related, setRelated] = useState<Related | null>(null); const [loading, setLoading] = useState(true); const [partial, setPartial] = useState(false)

  useEffect(() => {
    let alive = true
    async function load() {
      setLoading(true); setPartial(false)
      const safe = async (promise: any, fallback: any) => { try { const result = await promise; if (result?.error) { setPartial(true); return fallback }; return result?.data ?? fallback } catch { setPartial(true); return fallback } }
      const [room, guest, payments, invoices, housekeeping, maintenance, hospitality, extras, guestRequests, issues, exceptions, documents, events] = await Promise.all([
        reservation.room_id ? safe(supabase.from("rooms").select("id,room_number,status,operational_status,location,location_ref:locations(name)").eq("id", reservation.room_id).maybeSingle(), null) : null,
        reservation.guest_id ? safe(supabase.from("guests").select("id,name,email,phone,vip_status,preferred_language,preferred_contact_channel,allergies,mobility_requirements,housekeeping_preferences").eq("id", reservation.guest_id).maybeSingle(), null) : null,
        safe(supabase.from("payments").select("id,amount,payment_method,payment_status,paid_at,created_at").eq("reservation_id",reservation.id).order("created_at",{ascending:false}).limit(10), []),
        safe(supabase.from("invoices").select("id,invoice_number,status,payment_status,total_amount,amount_paid,invoice_date").eq("reservation_id",reservation.id).order("created_at",{ascending:false}).limit(10), []),
        safe(supabase.from("housekeeping_tasks").select("id,task_type,status,priority,service_date,requires_inspection,inspection_status").eq("reservation_id",reservation.id).order("service_date",{ascending:false,nullsFirst:false}).limit(10), []),
        safe(supabase.from("maintenance_tasks").select("id,title,status,prioridad,fecha_objetivo,bloqueado,blocks_room").eq("reservation_id",reservation.id).order("created_at",{ascending:false}).limit(10), []),
        safe(supabase.from("hospitality_requests").select("id,request_type,category,description,priority,status,due_at").eq("reservation_id",reservation.id).order("created_at",{ascending:false}).limit(10), []),
        safe(supabase.from("reservation_extras").select("id,name,unit,quantity,unit_price,total_amount,notes,created_at").eq("reservation_id",reservation.id).order("created_at",{ascending:false}).limit(10), []),
        safe(supabase.from("guest_requests").select("id,request_type,description,status,created_at").eq("reservation_id",reservation.id).order("created_at",{ascending:false}).limit(10), []),
        safe(supabase.from("issues").select("id,title,description,category,priority,severity,status,created_at").eq("related_item_type","reservation").eq("related_item_id",reservation.id).order("created_at",{ascending:false}).limit(10), []),
        safe(supabase.from("reservation_operational_exceptions").select("source_id,domain,title,status,priority,exception_state,blocks_check_in,blocks_check_out,detail").eq("reservation_id",reservation.id).in("exception_state",["open","overdue"]).limit(10), []),
        safe(supabase.from("operational_documents").select("id,document_number,document_type,status,title,issued_at").eq("reservation_id",reservation.id).order("created_at",{ascending:false}).limit(10), []),
        safe(supabase.from("booking_events").select("id,event_type,category,title,description,previous_state,new_state,occurred_at").eq("reservation_id",reservation.id).order("occurred_at",{ascending:false}).limit(20), []),
      ])
      if (alive) { setRelated({room,guest,payments,invoices,housekeeping,maintenance,hospitality,extras,guestRequests,issues,exceptions,documents,events}); setLoading(false) }
    }
    void load(); return () => { alive = false }
  }, [reservation.guest_id, reservation.id, reservation.room_id, supabase])

  const paid = useMemo(() => (related?.payments ?? []).filter((p:any)=>["paid","completed","succeeded"].includes(String(p.payment_status??"").toLowerCase())).reduce((sum:number,p:any)=>sum+Number(p.amount??0),0), [related])
  const guest = related?.guest; const room = related?.room

  return <div className="min-h-screen bg-[#171512] text-[#e7e1d8]">
    <header className="flex min-h-[58px] flex-wrap items-center justify-between gap-3 bg-[#211e1a] px-4 py-3"><div><Link href={`/${language}/bookings`} className="mb-1 inline-flex items-center gap-1.5 text-[11px] text-[#8f867b] hover:text-[#e7e1d8]"><ArrowLeft className="h-3.5 w-3.5"/>{c.back}</Link><h1 className="text-base font-medium">{reservation.guest_name || guest?.name || c.noGuest}</h1><p className="text-[11px] text-[#8f867b]">{reservation.check_in} → {reservation.check_out} · {reservation.num_guests ?? 1} {c.guests}{reservation.source ? ` · ${c.source}: ${reservation.source}` : ""}</p></div><div className="text-right"><div className={`text-[11px] uppercase tracking-[.08em] ${statusClass(reservation.arrival_status || reservation.status)}`}>{reservation.arrival_status || reservation.status || "—"}</div><div className="mt-1 text-sm font-medium">{money(reservation.total_amount)}</div></div></header>

    {loading && <div className="flex items-center gap-2 px-4 py-3 text-xs text-[#8f867b]"><Loader2 className="h-3.5 w-3.5 animate-spin"/>{c.loading}</div>}
    {partial && <div className="mx-4 mt-3 flex gap-2 bg-[#2b2722] px-3 py-2 text-xs text-[#d3ad61]"><AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0"/>{c.partial}</div>}

    <div className="grid gap-2 p-3 xl:grid-cols-2">
      {(related?.exceptions?.length ?? 0) > 0 && <section className="bg-[#2b2722] p-3 xl:col-span-2"><div className="mb-2 flex items-center gap-2 text-xs font-medium text-[#d3ad61]"><AlertTriangle className="h-3.5 w-3.5"/>{c.attention}</div>{related!.exceptions.map((x:any)=><Row key={`${x.domain}-${x.source_id}`} title={x.title} detail={`${x.domain}${x.detail ? ` · ${x.detail}` : ""}${x.blocks_check_in ? ` · ${c.blocksIn}` : ""}${x.blocks_check_out ? ` · ${c.blocksOut}` : ""}`} status={x.exception_state}/>)}</section>}

      <Panel title={c.guest} icon={<UserRound className="h-3.5 w-3.5"/>}>{guest ? <><Row title={`${guest.name || reservation.guest_name || c.noGuest}${guest.vip_status ? " · VIP" : ""}`} detail={`${guest.email || reservation.guest_email || "—"} · ${guest.phone || reservation.guest_phone || "—"}`}/>{guest.allergies && <Row title="Allergies" detail={guest.allergies}/>} {guest.mobility_requirements && <Row title="Mobility" detail={guest.mobility_requirements}/>} {guest.housekeeping_preferences && <Row title="Housekeeping" detail={guest.housekeeping_preferences}/>}</> : <Row title={c.noGuest} detail={`${reservation.guest_email || "—"} · ${reservation.guest_phone || "—"}`}/>}</Panel>
      <Panel title={c.room} icon={<BedDouble className="h-3.5 w-3.5"/>}>{room ? <><Row title={`${room.room_number}`} detail={room.location_ref?.name || room.location || "—"} status={room.operational_status || room.status}/>{reservation.estimated_arrival_time && <Row title="Arrival" detail={reservation.estimated_arrival_time}/>} {reservation.estimated_departure_time && <Row title="Departure" detail={reservation.estimated_departure_time}/>}</> : <Row title={c.noRoom}/>}</Panel>
      <Panel title={c.finance} icon={<Banknote className="h-3.5 w-3.5"/>}><Row title={c.total} detail={`${money(reservation.total_amount)} · ${c.paid}: ${money(paid)}`} status={reservation.payment_status}/>{(related?.payments ?? []).map((x:any)=><Row key={`p-${x.id}`} title={`${money(x.amount)} · ${x.payment_method || "payment"}`} detail={x.paid_at || x.created_at} status={x.payment_status}/>)}{(related?.invoices ?? []).map((x:any)=><Row key={`i-${x.id}`} title={x.invoice_number || "Invoice"} detail={money(x.total_amount)} status={x.payment_status || x.status}/>)}{!loading && !(related?.payments.length || related?.invoices.length) && <Row title={c.empty}/>}</Panel>
      <Panel title={c.housekeeping} icon={<ClipboardCheck className="h-3.5 w-3.5"/>}>{(related?.housekeeping ?? []).map((x:any)=><Row key={x.id} title={x.task_type || "Housekeeping"} detail={x.service_date} status={x.status}/>)}{!loading && !related?.housekeeping.length && <Row title={c.empty}/>}</Panel>
      <Panel title={c.maintenance} icon={<Wrench className="h-3.5 w-3.5"/>}>{(related?.maintenance ?? []).map((x:any)=><Row key={x.id} title={x.title || "Maintenance"} detail={x.fecha_objetivo} status={x.bloqueado ? "blocked" : x.status}/>)}{!loading && !related?.maintenance.length && <Row title={c.empty}/>}</Panel>
      <Panel title={c.requests} icon={<MessageSquareText className="h-3.5 w-3.5"/>}>{[...(related?.hospitality ?? []), ...(related?.guestRequests ?? [])].map((x:any)=><Row key={`${x.request_type}-${x.id}`} title={x.request_type || x.category || "Request"} detail={x.description} status={x.status}/>)}{!loading && !(related?.hospitality.length || related?.guestRequests.length) && <Row title={c.empty}/>}</Panel>
      <Panel title={c.extras} icon={<Banknote className="h-3.5 w-3.5"/>}>{(related?.extras ?? []).map((x:any)=><Row key={x.id} title={`${x.name} × ${x.quantity}`} detail={money(x.total_amount ?? Number(x.unit_price||0)*Number(x.quantity||0))}/>)}{!loading && !related?.extras.length && <Row title={c.empty}/>}</Panel>
      <Panel title={c.issues} icon={<AlertTriangle className="h-3.5 w-3.5"/>}>{(related?.issues ?? []).map((x:any)=><Row key={x.id} title={x.title || x.category || "Issue"} detail={x.description} status={x.status}/>)}{!loading && !related?.issues.length && <Row title={c.empty}/>}</Panel>
      <Panel title={c.documents} icon={<FileText className="h-3.5 w-3.5"/>}>{(related?.documents ?? []).map((x:any)=><Row key={x.id} title={x.title || x.document_number || x.document_type || "Document"} detail={x.issued_at} status={x.status}/>)}{!loading && !related?.documents.length && <Row title={c.empty}/>}</Panel>
      {reservation.special_requests && <Panel title={c.special} icon={<MessageSquareText className="h-3.5 w-3.5"/>}><Row title={reservation.special_requests}/></Panel>}
      <Panel title={c.activity} icon={<History className="h-3.5 w-3.5"/>}>{(related?.events ?? []).map((x:any)=><Row key={x.id} title={x.title || x.event_type || "Event"} detail={`${x.occurred_at}${x.description ? ` · ${x.description}` : ""}`} status={x.new_state}/>)}{!loading && !related?.events.length && <Row title={c.empty}/>}</Panel>
    </div>
  </div>
}
