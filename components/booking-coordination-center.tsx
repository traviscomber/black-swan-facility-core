"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { ClipboardCheck, MessageSquareText, RefreshCw, ShieldCheck } from "lucide-react"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { createClient } from "@/lib/supabase/client"

type Reservation = { id: string; guest_name: string; guest_email: string | null; guest_phone: string | null; check_in: string; check_out: string }
type Template = { id: string; template_key: string; name: string; event_type: string; channel: string; subject_template: string | null; body_template: string; is_active: boolean; requires_manual_approval: boolean }
type Message = { id: string; reservation_id: string | null; channel: string; status: string; recipient: string | null; subject: string | null; text: string; template_key: string | null; created_at: string }
type Employee = { id: string; name: string; role: string | null }
type Handover = { id: string; area: string; shift_date: string; shift_name: string; summary: string | null; status: string; outgoing_employee_id: string | null; incoming_employee_id: string | null; created_at: string }
type Permission = { id: string; role_key: string; action_key: string; allowed: boolean; requires_reason: boolean; requires_approval: boolean; is_critical: boolean }

function renderTemplate(text: string, reservation?: Reservation) {
  if (!reservation) return text
  return text
    .replaceAll("{{guest_name}}", reservation.guest_name)
    .replaceAll("{{check_in}}", reservation.check_in)
    .replaceAll("{{check_out}}", reservation.check_out)
    .replaceAll("{{departure_time}}", "11:00")
    .replaceAll("{{balance}}", "Por confirmar")
    .replaceAll("{{request_summary}}", "Solicitud registrada")
}

export function BookingCoordinationCenter() {
  const supabase = useMemo(() => createClient(), [])
  const [tab, setTab] = useState<"messages" | "handover" | "permissions">("messages")
  const [reservations, setReservations] = useState<Reservation[]>([])
  const [templates, setTemplates] = useState<Template[]>([])
  const [messages, setMessages] = useState<Message[]>([])
  const [employees, setEmployees] = useState<Employee[]>([])
  const [handovers, setHandovers] = useState<Handover[]>([])
  const [permissions, setPermissions] = useState<Permission[]>([])
  const [reservationId, setReservationId] = useState("")
  const [templateKey, setTemplateKey] = useState("")
  const [channel, setChannel] = useState("whatsapp")
  const [recipient, setRecipient] = useState("")
  const [subject, setSubject] = useState("")
  const [body, setBody] = useState("")
  const [area, setArea] = useState("reception")
  const [shiftName, setShiftName] = useState("morning")
  const [outgoingId, setOutgoingId] = useState("")
  const [incomingId, setIncomingId] = useState("")
  const [summary, setSummary] = useState("")
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    const [r, t, m, e, h, p] = await Promise.all([
      supabase.from("reservations").select("id,guest_name,guest_email,guest_phone,check_in,check_out").order("check_in"),
      supabase.from("booking_message_templates").select("id,template_key,name,event_type,channel,subject_template,body_template,is_active,requires_manual_approval").eq("is_active", true).order("name"),
      supabase.from("messages").select("id,reservation_id,channel,status,recipient,subject,text,template_key,created_at").order("created_at", { ascending: false }).limit(30),
      supabase.from("employees").select("id,name,role").eq("is_active", true).order("name"),
      supabase.from("booking_shift_handovers").select("id,area,shift_date,shift_name,summary,status,outgoing_employee_id,incoming_employee_id,created_at").order("created_at", { ascending: false }).limit(20),
      supabase.from("booking_action_permissions").select("id,role_key,action_key,allowed,requires_reason,requires_approval,is_critical").order("role_key").order("action_key"),
    ])
    const error = r.error || t.error || m.error || e.error || h.error || p.error
    if (error) return toast.error(error.message)
    setReservations((r.data ?? []) as Reservation[])
    setTemplates((t.data ?? []) as Template[])
    setMessages((m.data ?? []) as Message[])
    setEmployees((e.data ?? []) as Employee[])
    setHandovers((h.data ?? []) as Handover[])
    setPermissions((p.data ?? []) as Permission[])
  }, [supabase])

  useEffect(() => { void load() }, [load])

  function applyTemplate(key: string) {
    setTemplateKey(key)
    const template = templates.find((item) => item.template_key === key)
    const reservation = reservations.find((item) => item.id === reservationId)
    if (!template) return
    setChannel(template.channel)
    setSubject(renderTemplate(template.subject_template ?? "", reservation))
    setBody(renderTemplate(template.body_template, reservation))
    if (reservation) setRecipient(template.channel === "email" ? reservation.guest_email ?? "" : reservation.guest_phone ?? "")
  }

  async function createMessage() {
    if (!reservationId || !body.trim()) return toast.error("Selecciona una reserva y escribe el mensaje")
    setSaving(true)
    const { error } = await supabase.rpc("record_booking_message", {
      p_reservation_id: reservationId,
      p_channel: channel,
      p_direction: "outbound",
      p_recipient: recipient.trim() || null,
      p_subject: subject.trim() || null,
      p_text: body.trim(),
      p_template_key: templateKey || null,
      p_status: "draft",
    })
    setSaving(false)
    if (error) return toast.error(error.message)
    toast.success("Mensaje guardado como borrador")
    setBody(""); setSubject(""); setTemplateKey("")
    await load()
  }

  async function updateMessageStatus(id: string, status: string) {
    const { error } = await supabase.rpc("update_booking_message_status", { p_message_id: id, p_status: status, p_error: null })
    if (error) return toast.error(error.message)
    toast.success(`Mensaje marcado como ${status}`)
    await load()
  }

  async function createHandover() {
    if (!summary.trim()) return toast.error("Agrega un resumen de entrega")
    setSaving(true)
    const { data, error } = await supabase.from("booking_shift_handovers").insert({
      area, shift_name: shiftName, shift_date: new Date().toISOString().slice(0, 10),
      outgoing_employee_id: outgoingId || null, incoming_employee_id: incomingId || null,
      summary: summary.trim(), status: "draft",
    }).select("id").single()
    if (!error && data) await supabase.rpc("submit_booking_handover", { p_handover_id: data.id })
    setSaving(false)
    if (error) return toast.error(error.message)
    toast.success("Entrega de turno enviada")
    setSummary("")
    await load()
  }

  async function acceptHandover(id: string) {
    const { error } = await supabase.rpc("accept_booking_handover", { p_handover_id: id })
    if (error) return toast.error(error.message)
    toast.success("Entrega de turno aceptada")
    await load()
  }

  return (
    <Card className="mx-4 mb-4">
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <CardTitle className="flex items-center gap-2 text-base"><MessageSquareText className="h-4 w-4" /> Coordinación operacional</CardTitle>
          <Button variant="outline" size="sm" onClick={() => void load()}><RefreshCw className="mr-2 h-4 w-4" />Actualizar</Button>
        </div>
        <div className="flex flex-wrap gap-2 pt-2">
          <Button size="sm" variant={tab === "messages" ? "default" : "outline"} onClick={() => setTab("messages")}>Mensajería</Button>
          <Button size="sm" variant={tab === "handover" ? "default" : "outline"} onClick={() => setTab("handover")}>Entrega de turno</Button>
          <Button size="sm" variant={tab === "permissions" ? "default" : "outline"} onClick={() => setTab("permissions")}>Permisos críticos</Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {tab === "messages" && <>
          <div className="grid gap-3 lg:grid-cols-2">
            <div className="space-y-3 rounded-lg border p-4">
              <div className="space-y-1.5"><Label>Reserva</Label><select className="h-10 w-full rounded-md border bg-background px-3 text-sm" value={reservationId} onChange={(event) => { setReservationId(event.target.value); const r = reservations.find((item) => item.id === event.target.value); if (r) setRecipient(channel === "email" ? r.guest_email ?? "" : r.guest_phone ?? "") }}><option value="">Seleccionar reserva</option>{reservations.map((r) => <option key={r.id} value={r.id}>{r.guest_name} · {r.check_in}</option>)}</select></div>
              <div className="space-y-1.5"><Label>Plantilla</Label><select className="h-10 w-full rounded-md border bg-background px-3 text-sm" value={templateKey} onChange={(event) => applyTemplate(event.target.value)}><option value="">Mensaje libre</option>{templates.map((t) => <option key={t.id} value={t.template_key}>{t.name}</option>)}</select></div>
              <div className="grid gap-3 sm:grid-cols-2"><div className="space-y-1.5"><Label>Canal</Label><select className="h-10 w-full rounded-md border bg-background px-3 text-sm" value={channel} onChange={(e) => setChannel(e.target.value)}><option value="whatsapp">WhatsApp</option><option value="email">Correo</option><option value="sms">SMS</option><option value="internal">Interno</option></select></div><div className="space-y-1.5"><Label>Destinatario</Label><Input value={recipient} onChange={(e) => setRecipient(e.target.value)} /></div></div>
              <div className="space-y-1.5"><Label>Asunto</Label><Input value={subject} onChange={(e) => setSubject(e.target.value)} /></div>
              <div className="space-y-1.5"><Label>Mensaje</Label><textarea className="min-h-28 w-full rounded-md border bg-background p-3 text-sm" value={body} onChange={(e) => setBody(e.target.value)} /></div>
              <div className="flex justify-end"><Button onClick={() => void createMessage()} disabled={saving}>Guardar borrador</Button></div>
            </div>
            <div className="space-y-2 rounded-lg border p-4"><h3 className="font-medium">Historial reciente</h3>{messages.length === 0 ? <p className="text-sm text-muted-foreground">Sin mensajes registrados.</p> : messages.map((message) => <div key={message.id} className="rounded-md border p-3"><div className="flex flex-wrap items-center gap-2"><Badge variant="outline">{message.channel}</Badge><Badge variant={message.status === "failed" ? "destructive" : "secondary"}>{message.status}</Badge><span className="text-xs text-muted-foreground">{new Date(message.created_at).toLocaleString("es-CL")}</span></div><p className="mt-2 text-sm">{message.text}</p>{message.status === "draft" && <div className="mt-2 flex gap-2"><Button size="sm" variant="outline" onClick={() => void updateMessageStatus(message.id, "queued")}>Encolar</Button><Button size="sm" onClick={() => void updateMessageStatus(message.id, "sent")}>Marcar enviado</Button></div>}</div>)}</div>
          </div>
        </>}

        {tab === "handover" && <div className="grid gap-3 lg:grid-cols-2">
          <div className="space-y-3 rounded-lg border p-4"><div className="flex items-center gap-2"><ClipboardCheck className="h-4 w-4" /><h3 className="font-medium">Nueva entrega</h3></div><div className="grid gap-3 sm:grid-cols-2"><div className="space-y-1.5"><Label>Área</Label><select className="h-10 w-full rounded-md border bg-background px-3 text-sm" value={area} onChange={(e) => setArea(e.target.value)}><option value="reception">Recepción</option><option value="housekeeping">Housekeeping</option><option value="hospitality">Hospitality</option><option value="maintenance">Mantenimiento</option><option value="management">Administración</option></select></div><div className="space-y-1.5"><Label>Turno</Label><select className="h-10 w-full rounded-md border bg-background px-3 text-sm" value={shiftName} onChange={(e) => setShiftName(e.target.value)}><option value="morning">Mañana</option><option value="afternoon">Tarde</option><option value="night">Noche</option><option value="custom">Especial</option></select></div></div><div className="grid gap-3 sm:grid-cols-2"><div className="space-y-1.5"><Label>Entrega</Label><select className="h-10 w-full rounded-md border bg-background px-3 text-sm" value={outgoingId} onChange={(e) => setOutgoingId(e.target.value)}><option value="">Sin asignar</option>{employees.map((employee) => <option key={employee.id} value={employee.id}>{employee.name}</option>)}</select></div><div className="space-y-1.5"><Label>Recibe</Label><select className="h-10 w-full rounded-md border bg-background px-3 text-sm" value={incomingId} onChange={(e) => setIncomingId(e.target.value)}><option value="">Sin asignar</option>{employees.map((employee) => <option key={employee.id} value={employee.id}>{employee.name}</option>)}</select></div></div><div className="space-y-1.5"><Label>Resumen y pendientes</Label><textarea className="min-h-32 w-full rounded-md border bg-background p-3 text-sm" value={summary} onChange={(e) => setSummary(e.target.value)} placeholder="Llegadas, salidas, habitaciones no listas, pagos, incidencias y solicitudes pendientes" /></div><div className="flex justify-end"><Button onClick={() => void createHandover()} disabled={saving}>Enviar entrega</Button></div></div>
          <div className="space-y-2 rounded-lg border p-4"><h3 className="font-medium">Entregas recientes</h3>{handovers.length === 0 ? <p className="text-sm text-muted-foreground">Sin entregas registradas.</p> : handovers.map((handover) => <div key={handover.id} className="rounded-md border p-3"><div className="flex flex-wrap items-center gap-2"><Badge variant="outline">{handover.area}</Badge><Badge>{handover.shift_name}</Badge><Badge variant="secondary">{handover.status}</Badge></div><p className="mt-2 text-sm">{handover.summary}</p>{handover.status === "submitted" && <Button className="mt-2" size="sm" onClick={() => void acceptHandover(handover.id)}>Aceptar entrega</Button>}</div>)}</div>
        </div>}

        {tab === "permissions" && <div className="rounded-lg border p-4"><div className="mb-3 flex items-center gap-2"><ShieldCheck className="h-4 w-4" /><div><h3 className="font-medium">Matriz de acciones críticas</h3><p className="text-sm text-muted-foreground">Toda acción crítica debe registrar actor, motivo y cambios.</p></div></div><div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="border-b text-left"><th className="py-2">Rol</th><th>Acción</th><th>Permitida</th><th>Motivo</th><th>Aprobación</th><th>Crítica</th></tr></thead><tbody>{permissions.map((permission) => <tr key={permission.id} className="border-b"><td className="py-2 font-medium">{permission.role_key}</td><td>{permission.action_key}</td><td>{permission.allowed ? "Sí" : "No"}</td><td>{permission.requires_reason ? "Sí" : "No"}</td><td>{permission.requires_approval ? "Sí" : "No"}</td><td>{permission.is_critical ? "Sí" : "No"}</td></tr>)}</tbody></table></div></div>}
      </CardContent>
    </Card>
  )
}
