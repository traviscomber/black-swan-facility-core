"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { CheckCircle2, ClipboardList, Plus, RefreshCw, Send, Truck, UserCheck } from "lucide-react"
import { toast } from "sonner"
import { PageHeader } from "@/components/page-header"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { createClient } from "@/lib/supabase/client"
import { useLanguage } from "@/lib/hooks/use-language"

type Staff = { id: string; name: string }
type Handover = {
  id: string
  area: string
  shift_date: string
  shift_name: string
  incoming_employee_id: string | null
  outgoing_employee_id: string | null
  summary: string | null
  status: string
  submitted_at: string | null
  accepted_at: string | null
  accepted_by: string | null
  created_at: string
}
type HandoverItem = {
  id: string
  handover_id: string
  reservation_id: string | null
  source_type: string
  source_id: string | null
  priority: string
  title: string
  detail: string | null
  due_at: string | null
  status: string
}
type Logistics = {
  id: string
  reservation_id: string
  direction: string
  hub: string
  anchor_at: string | null
  status: string
  notes: string | null
  reservation?: { guest_name?: string | null } | null
}

const copy = {
  en: {
    title: "Shift handovers",
    description: "Create, submit, accept and close operational handovers with auditable pending items.",
    newHandover: "New handover",
    summary: "Summary",
    create: "Create draft",
    addItem: "Add item",
    itemTitle: "Pending item",
    detail: "Detail",
    submit: "Submit",
    accept: "Accept",
    close: "Close",
    acknowledge: "Acknowledge",
    resolve: "Resolve",
    carry: "Carry forward",
    logistics: "Open logistics",
    addToHandover: "Add to draft",
    plan: "Plan",
    confirm: "Confirm",
    complete: "Complete",
    cancel: "Cancel",
    noDraft: "Select a draft handover first.",
    noHandovers: "No handovers yet.",
    noItems: "No items in this handover.",
    refresh: "Refresh",
  },
  es: {
    title: "Entregas de turno",
    description: "Crear, enviar, aceptar y cerrar entregas operativas con pendientes auditables.",
    newHandover: "Nueva entrega",
    summary: "Resumen",
    create: "Crear borrador",
    addItem: "Agregar pendiente",
    itemTitle: "Pendiente",
    detail: "Detalle",
    submit: "Enviar",
    accept: "Aceptar",
    close: "Cerrar",
    acknowledge: "Reconocer",
    resolve: "Resolver",
    carry: "Traspasar",
    logistics: "Logística abierta",
    addToHandover: "Agregar al borrador",
    plan: "Planificar",
    confirm: "Confirmar",
    complete: "Completar",
    cancel: "Cancelar",
    noDraft: "Selecciona primero una entrega en borrador.",
    noHandovers: "Aún no hay entregas de turno.",
    noItems: "Esta entrega no tiene pendientes.",
    refresh: "Actualizar",
  },
  de: {
    title: "Schichtübergaben",
    description: "Operative Übergaben mit nachvollziehbaren offenen Punkten erstellen, übergeben, annehmen und schließen.",
    newHandover: "Neue Übergabe",
    summary: "Zusammenfassung",
    create: "Entwurf erstellen",
    addItem: "Punkt hinzufügen",
    itemTitle: "Offener Punkt",
    detail: "Details",
    submit: "Übergeben",
    accept: "Annehmen",
    close: "Schließen",
    acknowledge: "Bestätigen",
    resolve: "Erledigen",
    carry: "Weitergeben",
    logistics: "Offene Logistik",
    addToHandover: "Zum Entwurf hinzufügen",
    plan: "Planen",
    confirm: "Bestätigen",
    complete: "Abschließen",
    cancel: "Stornieren",
    noDraft: "Zuerst einen Entwurf auswählen.",
    noHandovers: "Noch keine Übergaben vorhanden.",
    noItems: "Diese Übergabe enthält keine offenen Punkte.",
    refresh: "Aktualisieren",
  },
} as const

function todayIso() {
  return new Date().toISOString().slice(0, 10)
}

function statusVariant(status: string): "default" | "secondary" | "outline" {
  if (status === "accepted" || status === "resolved" || status === "closed" || status === "completed") return "default"
  if (status === "submitted" || status === "acknowledged" || status === "confirmed") return "secondary"
  return "outline"
}

export default function BookingHandoversPage() {
  const supabase = useMemo(() => createClient(), [])
  const { language } = useLanguage()
  const t = copy[language]

  const [handovers, setHandovers] = useState<Handover[]>([])
  const [items, setItems] = useState<HandoverItem[]>([])
  const [staff, setStaff] = useState<Staff[]>([])
  const [logistics, setLogistics] = useState<Logistics[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const [area, setArea] = useState("reception")
  const [shiftName, setShiftName] = useState("morning")
  const [shiftDate, setShiftDate] = useState(todayIso())
  const [incomingEmployeeId, setIncomingEmployeeId] = useState("")
  const [summary, setSummary] = useState("")
  const [itemTitle, setItemTitle] = useState("")
  const [itemDetail, setItemDetail] = useState("")
  const [itemPriority, setItemPriority] = useState("normal")

  const selected = handovers.find((item) => item.id === selectedId) ?? null
  const selectedItems = items.filter((item) => item.handover_id === selectedId)

  const loadData = useCallback(async () => {
    setLoading(true)
    const [handoverResult, itemResult, staffResult, logisticsResult] = await Promise.all([
      supabase.from("booking_shift_handovers").select("id, area, shift_date, shift_name, incoming_employee_id, outgoing_employee_id, summary, status, submitted_at, accepted_at, accepted_by, created_at").order("created_at", { ascending: false }).limit(50),
      supabase.from("booking_handover_items").select("id, handover_id, reservation_id, source_type, source_id, priority, title, detail, due_at, status").order("created_at", { ascending: true }),
      supabase.rpc("get_booking_handover_staff"),
      supabase.from("reservation_logistics").select("id, reservation_id, direction, hub, anchor_at, status, notes, reservation:reservations(guest_name)").not("status", "in", "(completed,cancelled)").order("anchor_at", { ascending: true, nullsFirst: false }),
    ])

    const firstError = handoverResult.error || itemResult.error || staffResult.error || logisticsResult.error
    if (firstError) {
      toast.error(firstError.message)
    } else {
      setHandovers((handoverResult.data ?? []) as Handover[])
      setItems((itemResult.data ?? []) as HandoverItem[])
      setStaff((staffResult.data ?? []) as Staff[])
      setLogistics((logisticsResult.data ?? []) as unknown as Logistics[])
      setSelectedId((current) => current ?? handoverResult.data?.[0]?.id ?? null)
    }
    setLoading(false)
  }, [supabase])

  useEffect(() => { void loadData() }, [loadData])

  async function createHandover() {
    if (!summary.trim()) {
      toast.error("Summary is required")
      return
    }
    setSaving(true)
    const { data, error } = await supabase.from("booking_shift_handovers").insert({
      area,
      shift_date: shiftDate,
      shift_name: shiftName,
      incoming_employee_id: incomingEmployeeId || null,
      summary: summary.trim(),
      status: "draft",
    }).select("id").single()
    if (error) toast.error(error.message)
    else {
      setSummary("")
      setIncomingEmployeeId("")
      setSelectedId(data.id)
      toast.success("Draft created")
      await loadData()
    }
    setSaving(false)
  }

  async function addManualItem() {
    if (!selected || selected.status !== "draft") {
      toast.error(t.noDraft)
      return
    }
    if (!itemTitle.trim()) {
      toast.error("Title is required")
      return
    }
    setSaving(true)
    const { error } = await supabase.from("booking_handover_items").insert({
      handover_id: selected.id,
      source_type: "manual",
      priority: itemPriority,
      title: itemTitle.trim(),
      detail: itemDetail.trim() || null,
      status: "pending",
    })
    if (error) toast.error(error.message)
    else {
      setItemTitle("")
      setItemDetail("")
      toast.success("Item added")
      await loadData()
    }
    setSaving(false)
  }

  async function addLogisticsItem(logisticsItem: Logistics) {
    if (!selected || selected.status !== "draft") {
      toast.error(t.noDraft)
      return
    }
    if (items.some((item) => item.handover_id === selected.id && item.source_type === "reservation_logistics" && item.source_id === logisticsItem.id)) {
      toast.error("This logistics item is already in the draft")
      return
    }
    const guestName = logisticsItem.reservation?.guest_name || "Guest"
    setSaving(true)
    const { error } = await supabase.from("booking_handover_items").insert({
      handover_id: selected.id,
      reservation_id: logisticsItem.reservation_id,
      source_type: "reservation_logistics",
      source_id: logisticsItem.id,
      priority: logisticsItem.status === "confirmed" ? "normal" : "high",
      title: `${logisticsItem.direction === "arrival" ? "Arrival" : "Departure"} · ${guestName}`,
      detail: [logisticsItem.hub, logisticsItem.anchor_at ? new Date(logisticsItem.anchor_at).toLocaleString() : null, logisticsItem.notes].filter(Boolean).join(" · "),
      due_at: logisticsItem.anchor_at,
      status: "pending",
    })
    if (error) toast.error(error.message)
    else {
      toast.success("Logistics item added")
      await loadData()
    }
    setSaving(false)
  }

  async function handoverAction(action: "submit" | "accept" | "close") {
    if (!selected) return
    setSaving(true)
    const rpc = action === "submit" ? "submit_booking_handover" : action === "accept" ? "accept_booking_handover" : "close_booking_handover"
    const { error } = await supabase.rpc(rpc, { p_handover_id: selected.id })
    if (error) toast.error(error.message)
    else {
      toast.success(action === "submit" ? "Handover submitted" : action === "accept" ? "Handover accepted" : "Handover closed")
      await loadData()
    }
    setSaving(false)
  }

  async function updateItemStatus(itemId: string, status: "acknowledged" | "resolved" | "carried_forward") {
    setSaving(true)
    const { error } = await supabase.rpc("update_booking_handover_item_status", { p_item_id: itemId, p_status: status })
    if (error) toast.error(error.message)
    else {
      toast.success("Item updated")
      await loadData()
    }
    setSaving(false)
  }

  async function updateLogisticsStatus(logisticsId: string, status: "planned" | "confirmed" | "completed" | "cancelled") {
    setSaving(true)
    const { error } = await supabase.rpc("update_reservation_logistics_status", { p_logistics_id: logisticsId, p_status: status })
    if (error) toast.error(error.message)
    else {
      toast.success("Logistics updated")
      await loadData()
    }
    setSaving(false)
  }

  return (
    <div className="min-h-full overflow-y-auto">
      <PageHeader
        title={t.title}
        description={t.description}
        actions={<Button variant="outline" onClick={() => void loadData()} disabled={loading}><RefreshCw className="mr-2 h-4 w-4" />{t.refresh}</Button>}
      />

      <div className="grid gap-4 p-4 md:p-6 xl:grid-cols-[360px_minmax(0,1fr)]">
        <div className="space-y-4">
          <Card>
            <CardHeader><CardTitle className="text-base">{t.newHandover}</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <select value={area} onChange={(e) => setArea(e.target.value)} className="h-10 rounded-md border bg-background px-3 text-sm">
                  <option value="reception">Reception</option><option value="housekeeping">Housekeeping</option><option value="hospitality">Hospitality</option><option value="maintenance">Maintenance</option><option value="management">Management</option>
                </select>
                <select value={shiftName} onChange={(e) => setShiftName(e.target.value)} className="h-10 rounded-md border bg-background px-3 text-sm">
                  <option value="morning">Morning</option><option value="afternoon">Afternoon</option><option value="night">Night</option><option value="custom">Custom</option>
                </select>
              </div>
              <Input type="date" value={shiftDate} onChange={(e) => setShiftDate(e.target.value)} />
              <select value={incomingEmployeeId} onChange={(e) => setIncomingEmployeeId(e.target.value)} className="h-10 w-full rounded-md border bg-background px-3 text-sm">
                <option value="">Incoming employee (optional)</option>
                {staff.map((person) => <option key={person.id} value={person.id}>{person.name}</option>)}
              </select>
              <textarea value={summary} onChange={(e) => setSummary(e.target.value)} placeholder={t.summary} className="min-h-24 w-full rounded-md border bg-background p-3 text-sm" />
              <Button className="w-full" onClick={() => void createHandover()} disabled={saving}><Plus className="mr-2 h-4 w-4" />{t.create}</Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base">{t.title}</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {handovers.length === 0 && <p className="text-sm text-muted-foreground">{t.noHandovers}</p>}
              {handovers.map((handover) => (
                <button key={handover.id} type="button" onClick={() => setSelectedId(handover.id)} className={`w-full rounded-lg border p-3 text-left ${selectedId === handover.id ? "border-primary bg-primary/5" : ""}`}>
                  <div className="flex items-center justify-between gap-2"><span className="font-medium capitalize">{handover.area} · {handover.shift_name}</span><Badge variant={statusVariant(handover.status)}>{handover.status}</Badge></div>
                  <p className="mt-1 text-xs text-muted-foreground">{handover.shift_date}</p>
                  {handover.summary && <p className="mt-2 line-clamp-2 text-sm">{handover.summary}</p>}
                </button>
              ))}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <CardTitle className="flex items-center gap-2 text-base"><ClipboardList className="h-4 w-4" />{selected ? `${selected.area} · ${selected.shift_name} · ${selected.shift_date}` : t.title}</CardTitle>
                {selected && <Badge variant={statusVariant(selected.status)}>{selected.status}</Badge>}
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {!selected ? <p className="text-sm text-muted-foreground">{t.noHandovers}</p> : <>
                {selected.summary && <div className="rounded-lg border p-3 text-sm">{selected.summary}</div>}
                <div className="flex flex-wrap gap-2">
                  {selected.status === "draft" && <Button onClick={() => void handoverAction("submit")} disabled={saving}><Send className="mr-2 h-4 w-4" />{t.submit}</Button>}
                  {selected.status === "submitted" && <Button onClick={() => void handoverAction("accept")} disabled={saving}><UserCheck className="mr-2 h-4 w-4" />{t.accept}</Button>}
                  {selected.status === "accepted" && <Button onClick={() => void handoverAction("close")} disabled={saving}><CheckCircle2 className="mr-2 h-4 w-4" />{t.close}</Button>}
                </div>

                {selected.status === "draft" && <div className="rounded-lg border p-4">
                  <div className="mb-3 font-medium">{t.addItem}</div>
                  <div className="grid gap-2 md:grid-cols-[160px_minmax(0,1fr)]">
                    <select value={itemPriority} onChange={(e) => setItemPriority(e.target.value)} className="h-10 rounded-md border bg-background px-3 text-sm"><option value="low">Low</option><option value="normal">Normal</option><option value="high">High</option><option value="critical">Critical</option></select>
                    <Input value={itemTitle} onChange={(e) => setItemTitle(e.target.value)} placeholder={t.itemTitle} />
                  </div>
                  <textarea value={itemDetail} onChange={(e) => setItemDetail(e.target.value)} placeholder={t.detail} className="mt-2 min-h-20 w-full rounded-md border bg-background p-3 text-sm" />
                  <Button variant="outline" className="mt-2" onClick={() => void addManualItem()} disabled={saving}><Plus className="mr-2 h-4 w-4" />{t.addItem}</Button>
                </div>}

                <div className="space-y-2">
                  {selectedItems.length === 0 && <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">{t.noItems}</p>}
                  {selectedItems.map((item) => <div key={item.id} className="rounded-lg border p-4">
                    <div className="flex flex-wrap items-start justify-between gap-2"><div><p className="font-medium">{item.title}</p><p className="mt-1 text-xs text-muted-foreground">{item.source_type} · {item.priority}</p></div><Badge variant={statusVariant(item.status)}>{item.status}</Badge></div>
                    {item.detail && <p className="mt-3 text-sm">{item.detail}</p>}
                    {selected.status !== "draft" && selected.status !== "closed" && <div className="mt-3 flex flex-wrap gap-2">
                      {item.status !== "acknowledged" && item.status !== "resolved" && <Button size="sm" variant="outline" onClick={() => void updateItemStatus(item.id, "acknowledged")} disabled={saving}>{t.acknowledge}</Button>}
                      {item.status !== "resolved" && <Button size="sm" onClick={() => void updateItemStatus(item.id, "resolved")} disabled={saving}>{t.resolve}</Button>}
                      {item.status !== "carried_forward" && item.status !== "resolved" && <Button size="sm" variant="outline" onClick={() => void updateItemStatus(item.id, "carried_forward")} disabled={saving}>{t.carry}</Button>}
                    </div>}
                  </div>)}
                </div>
              </>}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2 text-base"><Truck className="h-4 w-4" />{t.logistics}</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {logistics.length === 0 && <p className="text-sm text-muted-foreground">No open logistics.</p>}
              {logistics.map((entry) => <div key={entry.id} className="flex flex-col gap-3 rounded-lg border p-4 md:flex-row md:items-center md:justify-between">
                <div><p className="font-medium capitalize">{entry.direction} · {entry.reservation?.guest_name ?? "Guest"}</p><p className="mt-1 text-xs text-muted-foreground">{entry.hub} · {entry.status}{entry.anchor_at ? ` · ${new Date(entry.anchor_at).toLocaleString()}` : ""}</p>{entry.notes && <p className="mt-2 text-sm">{entry.notes}</p>}</div>
                <div className="flex flex-wrap gap-2">
                  {entry.status === "draft" && <Button size="sm" onClick={() => void updateLogisticsStatus(entry.id, "planned")} disabled={saving}>{t.plan}</Button>}
                  {entry.status === "planned" && <Button size="sm" onClick={() => void updateLogisticsStatus(entry.id, "confirmed")} disabled={saving}>{t.confirm}</Button>}
                  {entry.status === "confirmed" && <Button size="sm" onClick={() => void updateLogisticsStatus(entry.id, "completed")} disabled={saving}>{t.complete}</Button>}
                  {["draft", "planned", "confirmed"].includes(entry.status) && <Button size="sm" variant="outline" onClick={() => void updateLogisticsStatus(entry.id, "cancelled")} disabled={saving}>{t.cancel}</Button>}
                  <Button size="sm" variant="outline" onClick={() => void addLogisticsItem(entry)} disabled={saving || selected?.status !== "draft"}>{t.addToHandover}</Button>
                </div>
              </div>)}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
