"use client"

import Link from "next/link"
import { useCallback, useEffect, useMemo, useState } from "react"
import { AlertTriangle, BedDouble, CheckCircle2, ChevronDown, Loader2, Search, ShieldCheck, Smartphone, Sparkles, UserRound, XCircle } from "lucide-react"
import { toast } from "sonner"
import { createClient } from "@/lib/supabase/client"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { useLanguage } from "@/lib/hooks/use-language"

const supabase = createClient()

type Language = "es" | "en" | "de"
type RoomStatus = "dirty" | "cleaning" | "clean_pending_inspection" | "ready" | "occupied" | "out_of_service"

type Room = {
  id: string
  room_number: string
  room_type: string | null
  location: string | null
  location_id: string | null
  operational_status: string | null
}

type Reservation = {
  id: string
  guest_name: string
  room_id: string | null
  check_in: string
  check_out: string
  status: string
  arrival_status: string | null
}

type Employee = {
  id: string
  name: string
  role: string | null
}

type Task = {
  id: string
  room_id: string | null
  task_type: string
  status: string | null
  assigned_to: string | null
  priority: string | null
  requires_inspection: boolean | null
  inspection_status: string | null
}

const COPY: Record<Language, {
  title: string
  subtitle: string
  search: string
  noRooms: string
  room: string
  guest: string
  nextGuest: string
  noGuest: string
  openTasks: string
  ready: string
  saving: string
  permission: string
  state: string
  summaryReady: string
  summaryAttention: string
  myTasks: string
  workflow: string
  workflowHelp: string
  unassigned: string
  inspection: string
  assign: string
  choosePerson: string
  approve: string
  reject: string
  rejectReason: string
  noWorkflowTasks: string
}> = {
  es: {
    title: "Estado de habitaciones",
    subtitle: "Una tarjeta por habitación. Selecciona directamente en qué etapa está y déjala lista para check-in cuando corresponda.",
    search: "Buscar casa, habitación o huésped",
    noRooms: "No hay habitaciones para mostrar.",
    room: "Habitación",
    guest: "Huésped actual",
    nextGuest: "Próxima llegada",
    noGuest: "Sin huésped asociado",
    openTasks: "tareas abiertas",
    ready: "Lista para check-in",
    saving: "Actualizando…",
    permission: "Necesitas permiso de supervisión de Housekeeping para cambiar estados.",
    state: "Estado actual",
    summaryReady: "listas para check-in",
    summaryAttention: "requieren atención",
    myTasks: "Mis tareas",
    workflow: "Flujo de tareas",
    workflowHelp: "Asigna responsables aquí. La ejecución se hace desde Mis tareas con checklist, evidencia y comentario. Las tareas que requieren inspección vuelven aquí para aprobación.",
    unassigned: "sin asignar",
    inspection: "en inspección",
    assign: "Asignar",
    choosePerson: "Seleccionar responsable",
    approve: "Aprobar",
    reject: "Rechazar",
    rejectReason: "Motivo del rechazo de la inspección",
    noWorkflowTasks: "No hay tareas abiertas de Housekeeping.",
  },
  en: {
    title: "Room status",
    subtitle: "One card per room. Choose the current stage directly and leave it ready for check-in when appropriate.",
    search: "Search house, room or guest",
    noRooms: "No rooms to show.",
    room: "Room",
    guest: "Current guest",
    nextGuest: "Next arrival",
    noGuest: "No guest assigned",
    openTasks: "open tasks",
    ready: "Ready for check-in",
    saving: "Updating…",
    permission: "Housekeeping supervisor permission is required to change room status.",
    state: "Current status",
    summaryReady: "ready for check-in",
    summaryAttention: "need attention",
    myTasks: "My tasks",
    workflow: "Task workflow",
    workflowHelp: "Assign owners here. Execution happens in My tasks with checklist, evidence and completion notes. Tasks requiring inspection return here for approval.",
    unassigned: "unassigned",
    inspection: "in inspection",
    assign: "Assign",
    choosePerson: "Select assignee",
    approve: "Approve",
    reject: "Reject",
    rejectReason: "Reason for rejecting the inspection",
    noWorkflowTasks: "There are no open Housekeeping tasks.",
  },
  de: {
    title: "Zimmerstatus",
    subtitle: "Eine Karte pro Zimmer. Wählen Sie direkt die aktuelle Phase und markieren Sie das Zimmer bei Bedarf als check-in-bereit.",
    search: "Haus, Zimmer oder Gast suchen",
    noRooms: "Keine Zimmer verfügbar.",
    room: "Zimmer",
    guest: "Aktueller Gast",
    nextGuest: "Nächste Anreise",
    noGuest: "Kein Gast zugeordnet",
    openTasks: "offene Aufgaben",
    ready: "Bereit für Check-in",
    saving: "Wird aktualisiert…",
    permission: "Zum Ändern des Zimmerstatus ist eine Housekeeping-Supervisor-Berechtigung erforderlich.",
    state: "Aktueller Status",
    summaryReady: "bereit für Check-in",
    summaryAttention: "benötigen Aufmerksamkeit",
    myTasks: "Meine Aufgaben",
    workflow: "Aufgabenablauf",
    workflowHelp: "Verantwortliche werden hier zugewiesen. Die Ausführung erfolgt unter Meine Aufgaben mit Checkliste, Nachweis und Abschlusskommentar. Prüfpflichtige Aufgaben kommen zur Freigabe hierher zurück.",
    unassigned: "nicht zugewiesen",
    inspection: "in Prüfung",
    assign: "Zuweisen",
    choosePerson: "Verantwortliche Person wählen",
    approve: "Freigeben",
    reject: "Ablehnen",
    rejectReason: "Grund für die Ablehnung der Prüfung",
    noWorkflowTasks: "Keine offenen Housekeeping-Aufgaben.",
  },
}

const STATE_COPY: Record<Language, Record<RoomStatus, string>> = {
  es: {
    dirty: "Sucia",
    cleaning: "En limpieza",
    clean_pending_inspection: "Revisar",
    ready: "Lista check-in",
    occupied: "Ocupada",
    out_of_service: "Fuera de servicio",
  },
  en: {
    dirty: "Dirty",
    cleaning: "Cleaning",
    clean_pending_inspection: "Review",
    ready: "Ready check-in",
    occupied: "Occupied",
    out_of_service: "Out of service",
  },
  de: {
    dirty: "Schmutzig",
    cleaning: "In Reinigung",
    clean_pending_inspection: "Prüfen",
    ready: "Check-in bereit",
    occupied: "Belegt",
    out_of_service: "Außer Betrieb",
  },
}

const MAIN_STAGES: RoomStatus[] = ["dirty", "cleaning", "clean_pending_inspection", "ready"]
const OTHER_STAGES: RoomStatus[] = ["occupied", "out_of_service"]
const OPEN_TASK_STATUSES = new Set(["pending", "assigned", "in_progress", "inspection"])

function chileDate() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Santiago" }).format(new Date())
}

function normalizedStatus(value: string | null): RoomStatus {
  if (value === "inspected") return "ready"
  if (value === "dirty" || value === "cleaning" || value === "clean_pending_inspection" || value === "ready" || value === "occupied" || value === "out_of_service") return value
  return "dirty"
}

function isOpenTask(status: string | null) {
  return OPEN_TASK_STATUSES.has(status ?? "pending")
}

export default function HousekeepingPage() {
  const { language } = useLanguage()
  const locale: Language = language === "en" || language === "de" ? language : "es"
  const copy = COPY[locale]
  const states = STATE_COPY[locale]
  const [rooms, setRooms] = useState<Room[]>([])
  const [reservations, setReservations] = useState<Reservation[]>([])
  const [tasks, setTasks] = useState<Task[]>([])
  const [employees, setEmployees] = useState<Employee[]>([])
  const [canManage, setCanManage] = useState(false)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [savingRoomId, setSavingRoomId] = useState<string | null>(null)
  const [savingTaskId, setSavingTaskId] = useState<string | null>(null)
  const [workflowOpen, setWorkflowOpen] = useState(false)
  const [search, setSearch] = useState("")

  const loadData = useCallback(async () => {
    setLoading(true)
    setLoadError(null)
    const today = chileDate()

    const [roomsResult, reservationsResult, tasksResult, employeesResult, manageResult] = await Promise.all([
      supabase
        .from("rooms")
        .select("id,room_number,room_type,location,location_id,operational_status")
        .order("location")
        .order("room_number"),
      supabase
        .from("reservations")
        .select("id,guest_name,room_id,check_in,check_out,status,arrival_status")
        .lte("check_in", today)
        .gte("check_out", today)
        .not("status", "in", "(cancelled,canceled,void,voided)"),
      supabase
        .from("housekeeping_tasks")
        .select("id,room_id,task_type,status,assigned_to,priority,requires_inspection,inspection_status")
        .not("status", "in", "(completed,cancelled,resolved)"),
      supabase
        .from("employees")
        .select("id,name,role")
        .eq("is_active", true)
        .order("name"),
      supabase.rpc("can_app_action", { p_action_key: "housekeeping.manage" }),
    ])

    const firstError = roomsResult.error || reservationsResult.error || tasksResult.error
    if (firstError) {
      setLoadError(firstError.message)
      toast.error(firstError.message)
      setLoading(false)
      return
    }

    setRooms((roomsResult.data ?? []) as Room[])
    setReservations((reservationsResult.data ?? []) as Reservation[])
    setTasks((tasksResult.data ?? []) as Task[])
    setEmployees((employeesResult.data ?? []) as Employee[])
    setCanManage(Boolean(manageResult.data))
    setLoading(false)
  }, [])

  useEffect(() => {
    void loadData()
    const channel = supabase
      .channel("simple-housekeeping-room-status")
      .on("postgres_changes", { event: "*", schema: "public", table: "rooms" }, () => void loadData())
      .on("postgres_changes", { event: "*", schema: "public", table: "reservations" }, () => void loadData())
      .on("postgres_changes", { event: "*", schema: "public", table: "housekeeping_tasks" }, () => void loadData())
      .subscribe()
    return () => { void supabase.removeChannel(channel) }
  }, [loadData])

  const reservationsByRoom = useMemo(() => {
    const map = new Map<string, Reservation[]>()
    reservations.forEach((reservation) => {
      if (!reservation.room_id) return
      const current = map.get(reservation.room_id) ?? []
      current.push(reservation)
      map.set(reservation.room_id, current)
    })
    return map
  }, [reservations])

  const roomsById = useMemo(() => new Map(rooms.map((room) => [room.id, room])), [rooms])

  const openTasks = useMemo(() => tasks.filter((task) => isOpenTask(task.status)), [tasks])
  const unassignedTasks = useMemo(() => openTasks.filter((task) => !task.assigned_to), [openTasks])
  const inspectionTasks = useMemo(() => openTasks.filter((task) => task.status === "inspection"), [openTasks])

  const openTasksByRoom = useMemo(() => {
    const map = new Map<string, number>()
    openTasks.forEach((task) => {
      if (!task.room_id) return
      map.set(task.room_id, (map.get(task.room_id) ?? 0) + 1)
    })
    return map
  }, [openTasks])

  const filteredRooms = useMemo(() => {
    const term = search.trim().toLowerCase()
    if (!term) return rooms
    return rooms.filter((room) => {
      const guests = (reservationsByRoom.get(room.id) ?? []).map((item) => item.guest_name).join(" ")
      return `${room.location ?? ""} ${room.room_number} ${room.room_type ?? ""} ${guests}`.toLowerCase().includes(term)
    })
  }, [reservationsByRoom, rooms, search])

  const readyCount = rooms.filter((room) => normalizedStatus(room.operational_status) === "ready").length
  const attentionCount = rooms.filter((room) => ["dirty", "cleaning", "clean_pending_inspection"].includes(normalizedStatus(room.operational_status))).length

  async function assignTask(task: Task, assignedTo: string) {
    if (!canManage || !assignedTo) return
    setSavingTaskId(task.id)
    const { error } = await supabase.rpc("update_housekeeping_task_operation", {
      p_task_id: task.id,
      p_action: "assign",
      p_assigned_to: assignedTo,
      p_notes: null,
      p_quality_score: null,
    })
    if (error) toast.error(error.message)
    else toast.success(copy.assign)
    setSavingTaskId(null)
    await loadData()
  }

  async function reviewTask(task: Task, action: "approve" | "reject") {
    if (!canManage) {
      toast.error(copy.permission)
      return
    }
    let notes: string | null = null
    if (action === "reject") {
      notes = window.prompt(copy.rejectReason)?.trim() || null
      if (!notes) return
    }

    setSavingTaskId(task.id)
    const { error } = await supabase.rpc("update_housekeeping_task_operation", {
      p_task_id: task.id,
      p_action: action,
      p_assigned_to: null,
      p_notes: notes,
      p_quality_score: null,
    })
    if (error) toast.error(error.message)
    else toast.success(action === "approve" ? copy.approve : copy.reject)
    setSavingTaskId(null)
    await loadData()
  }

  async function setRoomState(room: Room, status: RoomStatus) {
    if (!canManage) {
      toast.error(copy.permission)
      return
    }

    setSavingRoomId(room.id)
    const { error: statusError } = await supabase.rpc("set_room_operational_status", {
      p_room_id: room.id,
      p_status: status,
    })

    if (statusError) {
      toast.error(statusError.message)
      setSavingRoomId(null)
      return
    }

    if (status === "ready") {
      const arrival = (reservationsByRoom.get(room.id) ?? []).find((reservation) =>
        reservation.check_in === chileDate()
        && ["confirmed", "waiting_for_room", "ready_for_checkin"].includes(reservation.status),
      )
      if (arrival) {
        const { error: readyError } = await supabase.rpc("supervisor_mark_reservation_ready", {
          p_reservation_id: arrival.id,
          p_reason: "Habitación marcada lista desde Housekeeping",
        })
        if (readyError) {
          toast.warning(`Habitación lista, pero la reserva no pudo sincronizarse: ${readyError.message}`)
        }
      }
    }

    toast.success(status === "ready" ? copy.ready : states[status])
    setSavingRoomId(null)
    await loadData()
  }

  if (loading) return <div className="flex min-h-[420px] items-center justify-center"><Loader2 className="h-7 w-7 animate-spin" /></div>

  return (
    <div className="space-y-5 p-4 md:p-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-primary">HOUSEKEEPING</p>
          <h1 className="mt-1 text-2xl font-semibold text-foreground">{copy.title}</h1>
          <p className="mt-1 max-w-3xl text-sm text-muted-foreground">{copy.subtitle}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button asChild variant="outline" size="sm">
            <Link href={`/${language}/bookings/housekeeping/mobile`}><Smartphone className="mr-2 h-4 w-4" />{copy.myTasks}</Link>
          </Button>
          <Badge variant="outline" className="px-3 py-2"><CheckCircle2 className="mr-2 h-4 w-4 text-primary" />{readyCount} {copy.summaryReady}</Badge>
          <Badge variant="outline" className="px-3 py-2"><Sparkles className="mr-2 h-4 w-4" />{attentionCount} {copy.summaryAttention}</Badge>
        </div>
      </div>

      {loadError && (
        <div className="flex items-start gap-3 border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{loadError}</span>
        </div>
      )}

      {!canManage && (
        <div className="border border-amber-400/35 bg-amber-400/8 p-3 text-sm text-amber-500">{copy.permission}</div>
      )}

      <section className="overflow-hidden border border-border bg-card">
        <button
          type="button"
          className="flex min-h-14 w-full items-center justify-between gap-3 px-4 py-3 text-left hover:bg-muted/30"
          onClick={() => setWorkflowOpen((current) => !current)}
          aria-expanded={workflowOpen}
        >
          <div className="flex min-w-0 items-center gap-3">
            <ShieldCheck className="h-4 w-4 shrink-0 text-primary" />
            <div className="min-w-0">
              <p className="text-sm font-medium">{copy.workflow}</p>
              <div className="mt-1 flex flex-wrap gap-x-3 text-xs text-muted-foreground">
                <span>{openTasks.length} {copy.openTasks}</span>
                <span>{unassignedTasks.length} {copy.unassigned}</span>
                <span>{inspectionTasks.length} {copy.inspection}</span>
              </div>
            </div>
          </div>
          <ChevronDown className={`h-4 w-4 shrink-0 transition-transform ${workflowOpen ? "rotate-180" : ""}`} />
        </button>

        {workflowOpen && (
          <div className="space-y-3 border-t border-border p-4">
            <p className="text-xs text-muted-foreground">{copy.workflowHelp}</p>
            {openTasks.length === 0 ? (
              <p className="py-3 text-sm text-muted-foreground">{copy.noWorkflowTasks}</p>
            ) : (
              <div className="grid gap-2 lg:grid-cols-2">
                {openTasks.map((task) => {
                  const room = task.room_id ? roomsById.get(task.room_id) : null
                  const status = task.status ?? "pending"
                  const saving = savingTaskId === task.id
                  return (
                    <div key={task.id} className="border border-border bg-secondary/10 p-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium">{room ? `${room.location ?? "Black Swan"} · ${room.room_number}` : task.task_type.replaceAll("_", " ")}</p>
                          <p className="mt-1 text-xs text-muted-foreground">{task.task_type.replaceAll("_", " ")}</p>
                        </div>
                        <Badge variant={status === "inspection" ? "default" : "outline"}>{status.replaceAll("_", " ")}</Badge>
                      </div>

                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        {canManage && status !== "inspection" && (
                          <select
                            value={task.assigned_to ?? ""}
                            onChange={(event) => void assignTask(task, event.target.value)}
                            disabled={saving}
                            className="h-9 min-w-[210px] flex-1 border border-input bg-background px-2 text-xs text-foreground"
                          >
                            <option value="">{copy.choosePerson}</option>
                            {employees.map((employee) => <option key={employee.id} value={employee.id}>{employee.name}{employee.role ? ` · ${employee.role}` : ""}</option>)}
                          </select>
                        )}

                        {!task.assigned_to && status !== "inspection" && (
                          <span className="flex items-center gap-1 text-xs text-amber-500"><UserRound className="h-3.5 w-3.5" />{copy.unassigned}</span>
                        )}

                        {status === "inspection" && canManage && (
                          <>
                            <Button size="sm" disabled={saving} onClick={() => void reviewTask(task, "approve")}><CheckCircle2 className="mr-2 h-4 w-4" />{copy.approve}</Button>
                            <Button size="sm" variant="outline" disabled={saving} onClick={() => void reviewTask(task, "reject")}><XCircle className="mr-2 h-4 w-4" />{copy.reject}</Button>
                          </>
                        )}

                        {saving && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}
      </section>

      <div className="relative max-w-xl">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={copy.search} className="pl-9" />
      </div>

      {filteredRooms.length === 0 ? (
        <div className="border border-border bg-card p-8 text-sm text-muted-foreground">{copy.noRooms}</div>
      ) : (
        <div className="grid gap-4 xl:grid-cols-2">
          {filteredRooms.map((room) => {
            const current = normalizedStatus(room.operational_status)
            const roomReservations = reservationsByRoom.get(room.id) ?? []
            const currentGuest = roomReservations.find((reservation) => ["checked_in", "checked-in"].includes(reservation.status))
            const arrival = roomReservations.find((reservation) => reservation.check_in === chileDate() && !["checked_in", "checked-in", "checked_out", "checked-out"].includes(reservation.status))
            const taskCount = openTasksByRoom.get(room.id) ?? 0
            const saving = savingRoomId === room.id

            return (
              <Card key={room.id} className="border-border bg-card py-0">
                <CardHeader className="border-b border-border py-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-primary">{room.location ?? "Black Swan"}</p>
                      <CardTitle className="mt-1 flex items-center gap-2 text-lg">
                        <BedDouble className="h-4 w-4 text-muted-foreground" />
                        {room.room_number}
                      </CardTitle>
                      {room.room_type && <p className="mt-1 text-xs text-muted-foreground">{room.room_type}</p>}
                    </div>
                    <Badge variant={current === "ready" ? "default" : "outline"}>{states[current]}</Badge>
                  </div>
                </CardHeader>

                <CardContent className="space-y-4 py-4">
                  <div className="grid gap-2 sm:grid-cols-3">
                    <Info label={copy.state} value={states[current]} />
                    <Info label={currentGuest ? copy.guest : copy.nextGuest} value={currentGuest?.guest_name ?? arrival?.guest_name ?? copy.noGuest} />
                    <Info label="Housekeeping" value={`${taskCount} ${copy.openTasks}`} />
                  </div>

                  <div>
                    <p className="mb-2 text-xs font-medium text-muted-foreground">Flujo de limpieza</p>
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                      {MAIN_STAGES.map((status) => (
                        <Button
                          key={status}
                          type="button"
                          size="sm"
                          variant={current === status ? "default" : "outline"}
                          disabled={!canManage || saving}
                          onClick={() => void setRoomState(room, status)}
                          className="min-h-11 whitespace-normal text-xs"
                        >
                          {status === "ready" && <CheckCircle2 className="mr-2 h-4 w-4" />}
                          {states[status]}
                        </Button>
                      ))}
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2 border-t border-border pt-3">
                    {OTHER_STAGES.map((status) => (
                      <Button
                        key={status}
                        type="button"
                        size="sm"
                        variant={current === status ? "secondary" : "ghost"}
                        disabled={!canManage || saving}
                        onClick={() => void setRoomState(room, status)}
                        className="text-xs"
                      >
                        {states[status]}
                      </Button>
                    ))}
                    {saving && <span className="ml-auto flex items-center text-xs text-muted-foreground"><Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />{copy.saving}</span>}
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="border border-border bg-secondary/20 p-3">
      <p className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground">{label}</p>
      <p className="mt-1 truncate text-sm font-medium text-foreground" title={value}>{value}</p>
    </div>
  )
}
