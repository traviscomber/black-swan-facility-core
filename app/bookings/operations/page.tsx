"use client"

import type React from "react"
import { useCallback, useEffect, useMemo, useState } from "react"
import { addDays, format, parseISO, startOfDay } from "date-fns"
import { de, enUS, es } from "date-fns/locale"
import {
  AlertTriangle,
  BedDouble,
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ConciergeBell,
  DoorOpen,
  LogIn,
  LogOut,
  PackagePlus,
  PlayCircle,
  Plus,
  RefreshCw,
  Search,
  Sparkles,
  Users,
  Wrench,
  X,
} from "lucide-react"
import { toast } from "sonner"
import { AddReservationDialog } from "@/components/add-reservation-dialog"
import { AppLayout } from "@/components/app-layout"
import {
  BookingCalendarTimeline,
  type BookingCalendarBed,
  type BookingCalendarReservation,
} from "@/components/booking-calendar-timeline"
import { PageHeader } from "@/components/page-header"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { useLanguage } from "@/lib/hooks/use-language"
import { createClient } from "@/lib/supabase/client"
import { translateBookingOperationsValue } from "@/lib/translations/booking-operations"

const LABEL_WIDTH = 330
const ZOOM_OPTIONS = [7, 14, 21, 30] as const
const DATE_LOCALES = { en: enUS, es, de } as const
const INTL_LOCALES = { en: "en-US", es: "es-CL", de: "de-DE" } as const
const DAY_ABBR = { en: "d", es: "d", de: "T" } as const

type Location = { id: string; name: string }
type Room = {
  id: string
  room_number: string
  room_type: string | null
  location_id: string
  operational_status: string
  location: Location | null
}
type Bed = {
  id: string
  room_id: string
  bed_number: string
  bed_type: string | null
  is_available: boolean
  room: Room
}
type Reservation = {
  id: string
  bed_id: string | null
  room_id: string | null
  location_id: string | null
  booking_type?: string | null
  guest_name: string
  guest_email: string | null
  guest_phone: string | null
  check_in: string
  check_out: string
  status: string
  arrival_status: string | null
  payment_status: string | null
  num_guests: number | null
  total_amount: number | null
  special_requests: string | null
  source: string | null
}
type RoomBlock = {
  id: string
  room_id: string
  start_date: string
  end_date: string
  block_type: string
  reason: string
  status: string
}
type HousekeepingTask = {
  id: string
  reservation_id: string | null
  room_id: string | null
  assigned_to: string | null
  task_type: string
  status: string
  priority: string | null
  notes: string | null
  completed_at: string | null
  created_at: string | null
}
type HospitalityRequest = {
  id: string
  reservation_id: string | null
  room_id: string | null
  tablet_device_id: string | null
  assigned_to: string | null
  guest_name: string | null
  request_type: string
  category: string
  status: string
  priority: string | null
  description: string | null
  created_at: string | null
}
type ReservationExtra = {
  id: string
  name: string
  unit: string
  quantity: number
  unit_price: number
  total_amount: number | null
  notes: string | null
  created_at: string
}
type GuestRequest = {
  id: string
  request_type: string
  description: string
  status: string | null
  created_at: string | null
}
type BookingIssue = {
  id: string
  title: string | null
  description: string | null
  category: string | null
  priority: string | null
  severity: string | null
  status: string | null
  created_at: string | null
}
type BookingExtra = {
  id: string
  name: string
  description: string | null
  unit: string
  price: number
  tax_rate: number
}
type BookingOperations = {
  summary: {
    openHospitality: number
    openHousekeeping: number
    openGuestRequests: number
    openIssues: number
    extrasCount: number
    extrasAmount: number
    totalOperations: number
  }
  extras: ReservationExtra[]
  guestRequests: GuestRequest[]
  issues: BookingIssue[]
  catalog: BookingExtra[]
}
type SelectedReservation = Reservation & { bed?: Bed }
type RoomGroup = { room: Room; beds: Bed[] }
type LocationGroup = { location: Location; rooms: RoomGroup[] }

const RESERVATION_LABELS: Record<string, string> = {
  pending: "Pendiente",
  confirmed: "Confirmada",
  waiting_for_room: "Esperando habitación",
  ready_for_checkin: "Lista para check-in",
  checked_in: "Alojado",
  "checked-in": "Alojado",
  checked_out: "Salida registrada",
  "checked-out": "Salida registrada",
  cancelled: "Cancelada",
  canceled: "Cancelada",
}
const ROOM_STATUS_LABELS: Record<string, string> = {
  ready: "Lista",
  dirty: "Sucia",
  cleaning: "En limpieza",
  clean_pending_inspection: "Pendiente inspección",
  inspected: "Inspeccionada",
  occupied: "Ocupada",
  out_of_service: "Fuera de servicio",
  out_of_inventory: "Fuera de inventario",
}
const ROOM_STATUS_CLASSES: Record<string, string> = {
  ready: "border-emerald-300 bg-emerald-50 text-emerald-800",
  inspected: "border-emerald-300 bg-emerald-50 text-emerald-800",
  dirty: "border-rose-300 bg-rose-50 text-rose-800",
  cleaning: "border-sky-300 bg-sky-50 text-sky-800",
  clean_pending_inspection: "border-amber-300 bg-amber-50 text-amber-800",
  occupied: "border-violet-300 bg-violet-50 text-violet-800",
  out_of_service: "border-red-400 bg-red-50 text-red-900",
  out_of_inventory: "border-slate-400 bg-slate-100 text-slate-800",
}
const HOSPITALITY_STATUS_LABELS: Record<string, string> = {
  pending: "Pendiente",
  assigned: "Asignada",
  in_progress: "En curso",
  completed: "Completada",
  resolved: "Resuelta",
  cancelled: "Cancelada",
}
const HOUSEKEEPING_STATUS_LABELS: Record<string, string> = {
  pending: "Pendiente",
  assigned: "Asignada",
  in_progress: "En curso",
  completed: "Completada",
  cancelled: "Cancelada",
}
const HOUSEKEEPING_TYPE_LABELS: Record<string, string> = {
  turnover: "Limpieza de salida",
  room_preparation: "Preparación de habitación",
  inspection: "Inspección operativa",
  cleaning: "Limpieza",
  deep_cleaning: "Limpieza profunda",
  pre_arrival_preparation: "Preparación previa a llegada",
  pre_arrival_inspection: "Inspección previa a llegada",
  post_checkout_cleaning: "Limpieza posterior a salida",
  post_checkout_laundry: "Lavandería posterior a salida",
  post_checkout_damage_review: "Revisión de daños",
  post_checkout_restock: "Reposición posterior a salida",
  room_release: "Liberación de habitación",
}

function iso(date: Date) {
  return format(date, "yyyy-MM-dd")
}

function normalizeName(value: string | null | undefined) {
  return (value ?? "").trim().toLowerCase()
}

function roomReady(status: string | null | undefined) {
  return status === "ready" || status === "inspected"
}

export default function BookingOperationsTimelinePage() {
  const supabase = useMemo(() => createClient(), [])
  const { language } = useLanguage()
  const tr = useCallback((value: string) => translateBookingOperationsValue(value, language), [language])
  const dateLocale = DATE_LOCALES[language]
  const intlLocale = INTL_LOCALES[language]
  const numberFormatter = useMemo(() => new Intl.NumberFormat(intlLocale), [intlLocale])
  const currencyFormatter = useMemo(() => new Intl.NumberFormat(intlLocale, {
    style: "currency",
    currency: "CLP",
    maximumFractionDigits: 0,
  }), [intlLocale])
  const dateTimeFormatter = useMemo(() => new Intl.DateTimeFormat(intlLocale, {
    dateStyle: "medium",
    timeStyle: "short",
  }), [intlLocale])
  const formatCount = useCallback((value: number) => numberFormatter.format(value), [numberFormatter])
  const formatClp = useCallback((value: number) => currencyFormatter.format(value), [currencyFormatter])
  const formatStayDate = useCallback((value: string) => format(parseISO(value), "dd MMM yyyy", { locale: dateLocale }), [dateLocale])
  const formatDateTime = useCallback((value: string) => dateTimeFormatter.format(new Date(value)), [dateTimeFormatter])

  const [rangeDays, setRangeDays] = useState<(typeof ZOOM_OPTIONS)[number]>(21)
  const dayWidth = rangeDays <= 7 ? 128 : rangeDays <= 14 ? 104 : rangeDays <= 21 ? 92 : 72
  const [startDate, setStartDate] = useState(startOfDay(new Date()))
  const endDate = useMemo(() => addDays(startDate, rangeDays), [rangeDays, startDate])
  const dates = useMemo(
    () => Array.from({ length: rangeDays }, (_, index) => addDays(startDate, index)),
    [rangeDays, startDate],
  )
  const [beds, setBeds] = useState<Bed[]>([])
  const [reservations, setReservations] = useState<Reservation[]>([])
  const [blocks, setBlocks] = useState<RoomBlock[]>([])
  const [housekeeping, setHousekeeping] = useState<HousekeepingTask[]>([])
  const [hospitality, setHospitality] = useState<HospitalityRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState("")
  const [locationId, setLocationId] = useState("all")
  const [expandedRooms, setExpandedRooms] = useState<Set<string>>(new Set())
  const [selected, setSelected] = useState<SelectedReservation | null>(null)
  const [operations, setOperations] = useState<BookingOperations | null>(null)
  const [operationsLoading, setOperationsLoading] = useState(false)
  const [operationsError, setOperationsError] = useState<string | null>(null)
  const [reservationDialogOpen, setReservationDialogOpen] = useState(false)
  const [preselectedBed, setPreselectedBed] = useState<Bed | null>(null)
  const [preselectedDate, setPreselectedDate] = useState<Date | null>(null)
  const [preselectedCheckOut, setPreselectedCheckOut] = useState<Date | null>(null)
  const [savingAction, setSavingAction] = useState(false)

  const loadData = useCallback(async () => {
    setLoading(true)
    setError(null)
    const [bedsResult, reservationsResult, blocksResult, housekeepingResult, hospitalityResult] = await Promise.all([
      supabase
        .from("beds")
        .select("id, room_id, bed_number, bed_type, is_available, room:rooms!inner(id, room_number, room_type, location_id, operational_status, location:locations(id, name))")
        .order("room_id")
        .order("bed_number"),
      supabase
        .from("reservations")
        .select("id, bed_id, room_id, location_id, booking_type, guest_name, guest_email, guest_phone, check_in, check_out, status, arrival_status, payment_status, num_guests, total_amount, special_requests, source")
        .lt("check_in", iso(endDate))
        .gt("check_out", iso(startDate))
        .not("status", "in", "(cancelled,canceled,void,voided)"),
      supabase
        .from("room_blocks")
        .select("id, room_id, start_date, end_date, block_type, reason, status")
        .eq("status", "active")
        .lt("start_date", iso(endDate))
        .gt("end_date", iso(startDate)),
      supabase
        .from("housekeeping_tasks")
        .select("id, reservation_id, room_id, assigned_to, task_type, status, priority, notes, completed_at, created_at")
        .not("status", "in", "(completed,cancelled)"),
      supabase
        .from("hospitality_requests")
        .select("id, reservation_id, room_id, tablet_device_id, assigned_to, guest_name, request_type, category, status, priority, description, created_at")
        .not("status", "in", "(completed,resolved,cancelled)"),
    ])

    const firstError = bedsResult.error
      || reservationsResult.error
      || blocksResult.error
      || housekeepingResult.error
      || hospitalityResult.error

    if (firstError) {
      console.error("[booking-operations] timeline load failed", firstError)
      setError(tr("No fue posible cargar el timeline."))
    } else {
      const nextBeds = (bedsResult.data ?? []) as unknown as Bed[]
      setBeds(nextBeds)
      setReservations((reservationsResult.data ?? []) as Reservation[])
      setBlocks((blocksResult.data ?? []) as RoomBlock[])
      setHousekeeping((housekeepingResult.data ?? []) as HousekeepingTask[])
      setHospitality((hospitalityResult.data ?? []) as HospitalityRequest[])
      setExpandedRooms((current) => current.size ? current : new Set(nextBeds.map((bed) => bed.room_id)))
    }
    setLoading(false)
  }, [endDate, startDate, supabase, tr])

  const loadOperations = useCallback(async (reservationId: string) => {
    setOperationsLoading(true)
    setOperationsError(null)
    try {
      const response = await fetch(`/api/bookings/${reservationId}/operations`, { cache: "no-store" })
      const payload = await response.json()
      if (!response.ok) {
        console.error("[booking-operations] reservation operations load failed", payload.error)
        throw new Error(tr("No fue posible cargar las operaciones de la reserva"))
      }
      setOperations(payload as BookingOperations)
    } catch (loadError) {
      console.error("[booking-operations] reservation operations request failed", loadError)
      setOperations(null)
      setOperationsError(tr("No fue posible cargar las operaciones"))
    } finally {
      setOperationsLoading(false)
    }
  }, [tr])

  useEffect(() => { void loadData() }, [loadData])
  useEffect(() => {
    if (!selected) {
      setOperations(null)
      setOperationsError(null)
      return
    }
    void loadOperations(selected.id)
  }, [loadOperations, selected])
  useEffect(() => {
    const channel = supabase
      .channel("booking-operations-timeline")
      .on("postgres_changes", { event: "*", schema: "public", table: "reservations" }, () => void loadData())
      .on("postgres_changes", { event: "*", schema: "public", table: "rooms" }, () => void loadData())
      .on("postgres_changes", { event: "*", schema: "public", table: "room_blocks" }, () => void loadData())
      .on("postgres_changes", { event: "*", schema: "public", table: "housekeeping_tasks" }, () => void loadData())
      .on("postgres_changes", { event: "*", schema: "public", table: "hospitality_requests" }, () => void loadData())
      .subscribe()
    return () => { void supabase.removeChannel(channel) }
  }, [loadData, supabase])

  const locations = useMemo(
    () => Array.from(
      new Map(
        beds
          .filter((bed) => bed.room.location)
          .map((bed) => [bed.room.location!.id, bed.room.location!]),
      ).values(),
    ).sort((a, b) => a.name.localeCompare(b.name, intlLocale)),
    [beds, intlLocale],
  )

  const hierarchy = useMemo<LocationGroup[]>(() => {
    const term = search.trim().toLocaleLowerCase(intlLocale)
    const locationMap = new Map<string, LocationGroup>()
    beds.forEach((bed) => {
      const location = bed.room.location
      if (!location || (locationId !== "all" && location.id !== locationId)) return
      const roomStatus = tr(ROOM_STATUS_LABELS[bed.room.operational_status] ?? bed.room.operational_status)
      const haystack = `${location.name} ${bed.room.room_number} ${bed.room.room_type ?? ""} ${bed.bed_number} ${bed.bed_type ?? ""} ${roomStatus}`.toLocaleLowerCase(intlLocale)
      if (term && !haystack.includes(term)) return
      const locationGroup = locationMap.get(location.id) ?? { location, rooms: [] }
      let roomGroup = locationGroup.rooms.find((item) => item.room.id === bed.room_id)
      if (!roomGroup) {
        roomGroup = { room: bed.room, beds: [] }
        locationGroup.rooms.push(roomGroup)
      }
      roomGroup.beds.push(bed)
      locationMap.set(location.id, locationGroup)
    })
    return Array.from(locationMap.values())
      .map((group) => ({
        ...group,
        rooms: group.rooms.sort((a, b) => a.room.room_number.localeCompare(b.room.room_number, intlLocale)),
      }))
      .sort((a, b) => a.location.name.localeCompare(b.location.name, intlLocale))
  }, [beds, intlLocale, locationId, search, tr])

  const hospitalityForReservation = useCallback(
    (reservation: Reservation) => hospitality.filter((request) => request.reservation_id
      ? request.reservation_id === reservation.id
      : Boolean(
        request.room_id
          && reservation.room_id
          && request.room_id === reservation.room_id
          && normalizeName(request.guest_name) === normalizeName(reservation.guest_name),
      )),
    [hospitality],
  )
  const housekeepingForReservation = useCallback(
    (reservation: Reservation) => housekeeping.filter((task) => task.reservation_id
      ? task.reservation_id === reservation.id
      : Boolean(task.room_id && reservation.room_id && task.room_id === reservation.room_id)),
    [housekeeping],
  )
  const selectedHospitality = useMemo(
    () => selected ? hospitalityForReservation(selected) : [],
    [hospitalityForReservation, selected],
  )
  const selectedHousekeeping = useMemo(
    () => selected ? housekeepingForReservation(selected) : [],
    [housekeepingForReservation, selected],
  )
  const selectedRoom = useMemo(() => {
    if (!selected) return null
    const roomId = selected.bed?.room?.id ?? selected.room_id
    if (!roomId) return selected.bed?.room ?? null
    return beds.find((bed) => bed.room.id === roomId)?.room ?? selected.bed?.room ?? null
  }, [beds, selected])
  const selectedRoomStatus = selectedRoom?.operational_status ?? null
  const selectedIsCheckedIn = Boolean(selected && ["checked_in", "checked-in"].includes(selected.status))
  const selectedIsClosed = Boolean(selected && ["checked_out", "checked-out", "cancelled", "canceled"].includes(selected.status))

  const metrics = useMemo(() => {
    const today = iso(new Date())
    const uniqueRooms = Array.from(new Map(beds.map((bed) => [bed.room.id, bed.room])).values())
    return {
      arrivals: reservations.filter((item) => item.check_in === today).length,
      departures: reservations.filter((item) => item.check_out === today).length,
      occupied: reservations.filter((item) => item.check_in <= today && item.check_out > today).length,
      roomsNotReady: uniqueRooms.filter(
        (room) => !roomReady(room.operational_status) && room.operational_status !== "occupied",
      ).length,
      pendingHousekeeping: housekeeping.length,
      pendingHospitality: hospitality.length,
    }
  }, [beds, housekeeping.length, hospitality.length, reservations])

  function toggleRoom(roomId: string) {
    setExpandedRooms((current) => {
      const next = new Set(current)
      if (next.has(roomId)) next.delete(roomId)
      else next.add(roomId)
      return next
    })
  }

  function openNewReservation(bed: BookingCalendarBed, checkIn: Date, checkOut: Date) {
    setPreselectedBed(bed as Bed)
    setPreselectedDate(checkIn)
    setPreselectedCheckOut(checkOut)
    setReservationDialogOpen(true)
  }

  async function refreshSelected() {
    await loadData()
    if (selected) await loadOperations(selected.id)
  }

  function reportActionError(scope: string, actionError: unknown) {
    console.error(`[booking-operations] ${scope} failed`, actionError)
    toast.error(tr("No fue posible completar la acción."))
  }

  async function transitionReservation(action: "confirm" | "checkout") {
    if (!selected) return
    setSavingAction(true)
    const { data, error: rpcError } = await supabase.rpc("transition_reservation_status", {
      p_reservation_id: selected.id,
      p_action: action,
    })
    if (rpcError) {
      reportActionError(`reservation ${action}`, rpcError)
    } else {
      const nextReservation = data as Reservation | null
      const nextStatus = nextReservation?.status ?? (action === "confirm" ? "confirmed" : "checked_out")
      const nextArrivalStatus = nextReservation?.arrival_status
        ?? (action === "checkout" ? "checked_out" : selected.arrival_status)
      toast.success(action === "confirm" ? tr("Estado de reserva actualizado") : tr("Check-out registrado"))
      setSelected((current) => current
        ? { ...current, status: nextStatus, arrival_status: nextArrivalStatus }
        : current)
      await refreshSelected()
    }
    setSavingAction(false)
  }

  async function checkInOrQueue() {
    if (!selected) return
    setSavingAction(true)
    const { data, error: rpcError } = await supabase.rpc("check_in_or_queue", {
      p_reservation_id: selected.id,
    })
    if (rpcError) {
      reportActionError("check in", rpcError)
    } else {
      const result = (data as { result?: string } | null)?.result
      if (result === "checked_in") {
        toast.success(tr("Check-in registrado"))
        setSelected((current) => current
          ? { ...current, status: "checked_in", arrival_status: "checked_in" }
          : current)
      } else {
        toast.warning(tr("La habitación aún no está lista. La llegada quedó en cola."))
        setSelected((current) => current
          ? { ...current, status: "waiting_for_room", arrival_status: "waiting_for_room" }
          : current)
      }
      await refreshSelected()
    }
    setSavingAction(false)
  }

  async function setRoomStatus(status: string) {
    const roomId = selectedRoom?.id ?? selected?.room_id
    if (!roomId) return
    setSavingAction(true)
    const { error: rpcError } = await supabase.rpc("set_room_operational_status", {
      p_room_id: roomId,
      p_status: status,
    })
    if (rpcError) reportActionError("room status update", rpcError)
    else {
      toast.success(tr("Estado operativo actualizado"))
      await refreshSelected()
    }
    setSavingAction(false)
  }

  async function markReservationReady() {
    if (!selected) return
    if (selectedIsCheckedIn || selectedIsClosed) {
      toast.info(tr(selectedIsCheckedIn ? "El huésped ya está alojado." : "La estadía ya está cerrada."))
      return
    }
    setSavingAction(true)
    const { error: rpcError } = await supabase.rpc("supervisor_mark_reservation_ready", {
      p_reservation_id: selected.id,
      p_reason: "Verificación física desde centro de operaciones",
    })
    if (rpcError) {
      reportActionError("mark reservation ready", rpcError)
    } else {
      toast.success(tr("Habitación lista para entrada"))
      setSelected((current) => current
        ? { ...current, arrival_status: "ready_for_checkin" }
        : current)
      await refreshSelected()
    }
    setSavingAction(false)
  }

  async function createHousekeepingTask(taskType: string, notes: string) {
    if (!selected) return
    const roomId = selected.bed?.room_id ?? selected.room_id
    if (!roomId) return
    setSavingAction(true)
    const { error: insertError } = await supabase.from("housekeeping_tasks").insert({
      reservation_id: selected.id,
      room_id: roomId,
      task_type: taskType,
      status: "pending",
      priority: taskType === "turnover" ? "high" : "medium",
      notes,
    })
    if (insertError) reportActionError("create housekeeping task", insertError)
    else {
      toast.success(tr("Tarea de housekeeping creada"))
      await refreshSelected()
    }
    setSavingAction(false)
  }

  async function updateHousekeepingStatus(taskId: string, status: "in_progress" | "completed") {
    const task = selectedHousekeeping.find((item) => item.id === taskId)
    if (!task?.assigned_to) {
      toast.error(tr("Asigna un encargado antes de iniciar o completar esta acción."))
      return
    }

    setSavingAction(true)
    const { error: rpcError } = await supabase.rpc("update_housekeeping_task_operation", {
      p_task_id: taskId,
      p_action: status === "in_progress" ? "start" : "complete",
      p_assigned_to: null,
      p_notes: null,
      p_quality_score: null,
    })
    if (rpcError) reportActionError("update housekeeping task", rpcError)
    else {
      toast.success(tr(status === "completed" ? "Tarea completada" : "Tarea iniciada"))
      await refreshSelected()
    }
    setSavingAction(false)
  }

  async function createHospitalityRequest(requestType: string, description: string) {
    if (!selected) return
    setSavingAction(true)
    const { error: insertError } = await supabase.from("hospitality_requests").insert({
      reservation_id: selected.id,
      room_id: selected.bed?.room_id ?? selected.room_id,
      location_id: selected.bed?.room.location_id ?? selected.location_id,
      guest_name: selected.guest_name,
      guest_phone: selected.guest_phone,
      guest_email: selected.guest_email,
      request_type: requestType,
      category: "hospitality",
      description,
      priority: "medium",
      status: "pending",
    })
    if (insertError) reportActionError("create hospitality request", insertError)
    else {
      toast.success(tr("Solicitud de hospitalidad creada"))
      await refreshSelected()
    }
    setSavingAction(false)
  }

  async function updateHospitalityStatus(requestId: string, status: "in_progress" | "completed") {
    const request = selectedHospitality.find((item) => item.id === requestId)
    if (!request?.assigned_to) {
      toast.error(tr("Asigna un encargado antes de iniciar o completar esta acción."))
      return
    }

    setSavingAction(true)
    const { error: rpcError } = await supabase.rpc("update_hospitality_request", {
      p_request_id: requestId,
      p_status: status,
      p_assigned_to: null,
      p_priority: null,
      p_department: null,
      p_promised_at: null,
      p_sla_minutes: null,
      p_notes: null,
      p_blocked_reason: null,
      p_escalation_reason: null,
      p_evidence_url: null,
      p_completion_notes: status === "completed" ? "Completada desde operación de estadía" : null,
      p_guest_confirmed: false,
      p_satisfaction_score: null,
    })
    if (rpcError) reportActionError("update hospitality request", rpcError)
    else {
      toast.success(tr(status === "completed" ? "Solicitud completada" : "Solicitud en curso"))
      await refreshSelected()
    }
    setSavingAction(false)
  }

  return (
    <AppLayout>
      <PageHeader
        title={tr("Reservas y operación de hospitalidad")}
        description={tr("Timeline único por propiedad, habitación y cama para reservas, estado operativo, housekeeping, atención al huésped, pagos y bloqueos.")}
        actions={(
          <Button onClick={() => {
            setPreselectedBed(null)
            setPreselectedDate(null)
            setPreselectedCheckOut(null)
            setReservationDialogOpen(true)
          }}>
            <Plus className="mr-2 h-4 w-4" />{tr("Nueva reserva")}
          </Button>
        )}
      />

      <div className="space-y-4 p-4 md:p-6">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
          <Metric icon={<LogIn />} label={tr("Llegadas hoy")} value={formatCount(metrics.arrivals)} />
          <Metric icon={<LogOut />} label={tr("Salidas hoy")} value={formatCount(metrics.departures)} />
          <Metric icon={<BedDouble />} label={tr("Ocupadas hoy")} value={formatCount(metrics.occupied)} />
          <Metric icon={<DoorOpen />} label={tr("Habitaciones no listas")} value={formatCount(metrics.roomsNotReady)} />
          <Metric icon={<Sparkles />} label={tr("Limpiezas pendientes")} value={formatCount(metrics.pendingHousekeeping)} />
          <Metric icon={<ConciergeBell />} label={tr("Solicitudes abiertas")} value={formatCount(metrics.pendingHospitality)} />
        </div>

        <Card>
          <CardContent className="flex flex-col gap-3 p-4 xl:flex-row xl:items-center xl:justify-between">
            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="outline"
                size="icon"
                onClick={() => setStartDate(addDays(startDate, -7))}
                aria-label={tr("Retroceder siete días")}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button variant="outline" onClick={() => setStartDate(startOfDay(new Date()))}>{tr("Hoy")}</Button>
              <Button
                variant="outline"
                size="icon"
                onClick={() => setStartDate(addDays(startDate, 7))}
                aria-label={tr("Avanzar siete días")}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
              <span className="ml-1 text-sm font-medium">
                {format(startDate, "dd MMM", { locale: dateLocale })} – {format(addDays(endDate, -1), "dd MMM yyyy", { locale: dateLocale })}
              </span>
              <div className="ml-2 flex rounded-md border p-1">
                {ZOOM_OPTIONS.map((days) => (
                  <Button
                    key={days}
                    size="sm"
                    variant={rangeDays === days ? "secondary" : "ghost"}
                    onClick={() => setRangeDays(days)}
                  >
                    {formatCount(days)}{DAY_ABBR[language]}
                  </Button>
                ))}
              </div>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row">
              <select
                value={locationId}
                onChange={(event: React.ChangeEvent<HTMLSelectElement>) => setLocationId(event.target.value)}
                className="h-10 rounded-md border bg-background px-3 text-sm"
                aria-label={tr("Filtrar por propiedad")}
              >
                <option value="all">{tr("Todas las propiedades")}</option>
                {locations.map((location) => (
                  <option key={location.id} value={location.id}>{location.name}</option>
                ))}
              </select>
              <div className="relative min-w-72">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(event: React.ChangeEvent<HTMLInputElement>) => setSearch(event.target.value)}
                  placeholder={tr("Buscar propiedad, habitación, cama o estado")}
                  className="pl-9"
                />
              </div>
              <Button
                variant="outline"
                size="icon"
                onClick={() => void loadData()}
                aria-label={tr("Actualizar calendario")}
              >
                <RefreshCw className="h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>

        {error && (
          <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">
            {error}
          </div>
        )}

        <BookingCalendarTimeline
          hierarchy={hierarchy}
          reservations={reservations}
          blocks={blocks}
          housekeeping={housekeeping}
          hospitality={hospitality}
          dates={dates}
          startDate={startDate}
          endDate={endDate}
          dayWidth={dayWidth}
          labelWidth={LABEL_WIDTH}
          expandedRooms={expandedRooms}
          loading={loading}
          onToggleRoom={toggleRoom}
          onOpenReservation={(reservation: BookingCalendarReservation, bed: BookingCalendarBed) => {
            setSelected({ ...(reservation as Reservation), bed: bed as Bed })
          }}
          onOpenNewReservation={openNewReservation}
          onRefresh={loadData}
        />
      </div>

      <AddReservationDialog
        open={reservationDialogOpen}
        onOpenChange={setReservationDialogOpen}
        onSuccess={loadData}
        preselectedBed={preselectedBed?.id}
        preselectedDate={preselectedDate ?? undefined}
        preselectedCheckOut={preselectedCheckOut ?? undefined}
        preselectedLocation={preselectedBed?.room.location?.name}
      />

      {selected && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <button
            type="button"
            className="absolute inset-0 bg-black/40"
            onClick={() => setSelected(null)}
            aria-label={tr("Cerrar panel")}
          />
          <aside className="relative z-10 flex h-full w-full max-w-xl flex-col border-l bg-background shadow-2xl">
            <div className="flex items-start justify-between border-b p-5">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary">{tr("Operación de estadía")}</p>
                <h2 className="mt-1 text-xl font-semibold">{selected.guest_name}</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  {selectedRoom?.location?.name ?? tr("Sin ubicación")} · {selectedRoom?.room_number ?? tr("Sin habitación")} · {tr(`Cama ${selected.bed?.bed_number ?? "—"}`)}
                </p>
              </div>
              <Button variant="ghost" size="icon" onClick={() => setSelected(null)} aria-label={tr("Cerrar panel")}>
                <X className="h-4 w-4" />
              </Button>
            </div>

            <div className="flex-1 space-y-6 overflow-y-auto p-5">
              <div className="flex flex-wrap gap-2">
                <Badge>
                  {tr(RESERVATION_LABELS[selected.arrival_status ?? selected.status]
                    ?? RESERVATION_LABELS[selected.status]
                    ?? selected.status)}
                </Badge>
                <Badge variant="outline">{tr("Pago")}: {selected.payment_status ?? tr("sin registrar")}</Badge>
                <Badge variant="outline">{tr("Origen")}: {selected.source ?? tr("interno")}</Badge>
                {selectedRoom && (
                  <Badge
                    variant="outline"
                    className={ROOM_STATUS_CLASSES[selectedRoomStatus ?? ""] ?? ""}
                  >
                    {tr(ROOM_STATUS_LABELS[selectedRoomStatus ?? ""]
                      ?? selectedRoomStatus
                      ?? "Sin estado")}
                  </Badge>
                )}
                {selectedHousekeeping.length > 0 && (
                  <Badge variant="secondary" className="gap-1">
                    <Sparkles className="h-3 w-3" />{formatCount(selectedHousekeeping.length)} Housekeeping
                  </Badge>
                )}
                {selectedHospitality.length > 0 && (
                  <Badge variant="secondary" className="gap-1">
                    <ConciergeBell className="h-3 w-3" />{formatCount(selectedHospitality.length)} Hospitality
                  </Badge>
                )}
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <Info label="Check-in" value={formatStayDate(selected.check_in)} />
                <Info label="Check-out" value={formatStayDate(selected.check_out)} />
                <Info label={tr("Huéspedes")} value={formatCount(selected.num_guests ?? 1)} />
                <Info label={tr("Monto")} value={formatClp(Number(selected.total_amount ?? 0))} />
              </div>
              {selected.special_requests && (
                <Info label={tr("Solicitudes especiales")} value={selected.special_requests} />
              )}

              <ActionSection title={tr("Preparación de habitación")} icon={<DoorOpen className="h-4 w-4" />}>
                <div className="col-span-full rounded-lg border p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="font-medium">{tr("Estado operativo actual")}</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {tr(selectedIsCheckedIn
                          ? "El huésped ya está alojado. La habitación queda ocupada durante la estadía."
                          : selectedIsClosed
                            ? "La estadía está cerrada. Gestiona la habitación desde Limpieza."
                            : "Antes de la entrada, Santiago puede certificar físicamente que la habitación está lista.")}
                      </p>
                    </div>
                    <Badge
                      variant="outline"
                      className={ROOM_STATUS_CLASSES[selectedRoomStatus ?? ""] ?? ""}
                    >
                      {tr(ROOM_STATUS_LABELS[selectedRoomStatus ?? ""]
                        ?? selectedRoomStatus
                        ?? "Sin estado")}
                    </Badge>
                  </div>
                  {!selectedIsCheckedIn && !selectedIsClosed && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => void setRoomStatus("cleaning")}
                        disabled={savingAction}
                      >
                        {tr("En limpieza")}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => void setRoomStatus("clean_pending_inspection")}
                        disabled={savingAction}
                      >
                        {tr("Pendiente inspección")}
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => void markReservationReady()}
                        disabled={savingAction}
                      >
                        <CheckCircle2 className="mr-2 h-4 w-4" />{tr("Marcar lista para entrada")}
                      </Button>
                    </div>
                  )}
                </div>
              </ActionSection>

              {operationsLoading && <Empty text={tr("Cargando operaciones vinculadas…")} />}
              {operationsError && (
                <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">
                  {operationsError}
                  <Button
                    size="sm"
                    variant="outline"
                    className="ml-3"
                    onClick={() => void loadOperations(selected.id)}
                  >
                    {tr("Reintentar")}
                  </Button>
                </div>
              )}
              {operations && (
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  <Info label={tr("Operaciones")} value={formatCount(operations.summary.totalOperations)} />
                  <Info label={tr("Servicios / cargos")} value={formatCount(operations.summary.extrasCount)} />
                  <Info label={tr("Monto extras")} value={formatClp(operations.summary.extrasAmount)} />
                </div>
              )}

              <ActionSection title={tr("Servicios y cargos")} icon={<PackagePlus className="h-4 w-4" />}>
                {!operations || operations.extras.length === 0
                  ? <Empty text={tr(operations?.catalog.length === 0 ? "No hay servicios cargados y el catálogo aún está vacío." : "No hay servicios cargados a esta reserva.")} />
                  : operations.extras.map((extra) => (
                    <OperationCard
                      key={extra.id}
                      title={extra.name}
                      subtitle={`${formatCount(extra.quantity)} ${extra.unit} × ${formatClp(Number(extra.unit_price))}`}
                      status={formatClp(Number(extra.total_amount ?? extra.quantity * extra.unit_price))}
                      description={extra.notes}
                      actions={null}
                    />
                  ))}
              </ActionSection>

              <ActionSection title={tr("Solicitudes históricas del huésped")} icon={<Users className="h-4 w-4" />}>
                {!operations || operations.guestRequests.length === 0
                  ? <Empty text={tr("No hay solicitudes históricas vinculadas.")} />
                  : operations.guestRequests.map((request) => (
                    <OperationCard
                      key={request.id}
                      title={request.request_type}
                      subtitle={request.created_at ? formatDateTime(request.created_at) : tr("Sin fecha")}
                      status={request.status ?? tr("sin estado")}
                      description={request.description}
                      actions={null}
                    />
                  ))}
              </ActionSection>

              <ActionSection title={tr("Incidencias vinculadas")} icon={<AlertTriangle className="h-4 w-4" />}>
                {!operations || operations.issues.length === 0
                  ? <Empty text={tr("No hay incidencias vinculadas a esta reserva.")} />
                  : operations.issues.map((issue) => (
                    <OperationCard
                      key={issue.id}
                      title={issue.title ?? issue.category ?? tr("Incidencia")}
                      subtitle={`${issue.priority ?? issue.severity ?? tr("prioridad no registrada")}${issue.created_at ? ` · ${formatDateTime(issue.created_at)}` : ""}`}
                      status={issue.status ?? tr("sin estado")}
                      description={issue.description}
                      actions={null}
                    />
                  ))}
              </ActionSection>

              <ActionSection title={tr("Housekeeping activo")} icon={<Sparkles className="h-4 w-4" />}>
                {selectedHousekeeping.length === 0
                  ? <Empty text={tr("No hay tareas abiertas asociadas a esta reserva.")} />
                  : selectedHousekeeping.map((task) => (
                    <OperationCard
                      key={task.id}
                      title={tr(HOUSEKEEPING_TYPE_LABELS[task.task_type] ?? task.task_type)}
                      subtitle={`${tr(task.reservation_id ? "Vinculada a reserva" : "Histórica por habitación")} · ${tr(`Prioridad ${task.priority ?? "normal"}`)}`}
                      status={tr(HOUSEKEEPING_STATUS_LABELS[task.status] ?? task.status)}
                      description={task.notes}
                      actions={(
                        <>
                          {!task.assigned_to && (
                            <span className="self-center text-xs text-amber-600">{tr("Asigna un encargado antes de iniciar o completar esta acción.")}</span>
                          )}
                          {["pending", "assigned"].includes(task.status) && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => void updateHousekeepingStatus(task.id, "in_progress")}
                              disabled={savingAction || !task.assigned_to}
                            >
                              <PlayCircle className="mr-2 h-4 w-4" />{tr("Iniciar")}
                            </Button>
                          )}
                          {task.status === "in_progress" && (
                            <Button
                              size="sm"
                              onClick={() => void updateHousekeepingStatus(task.id, "completed")}
                              disabled={savingAction || !task.assigned_to}
                            >
                              <CheckCircle2 className="mr-2 h-4 w-4" />{tr("Completar")}
                            </Button>
                          )}
                        </>
                      )}
                    />
                  ))}
              </ActionSection>

              <ActionSection title={tr("Solicitudes activas de Hospitality")} icon={<ConciergeBell className="h-4 w-4" />}>
                {selectedHospitality.length === 0
                  ? <Empty text={tr("No hay solicitudes abiertas asociadas a esta reserva.")} />
                  : selectedHospitality.map((request) => (
                    <OperationCard
                      key={request.id}
                      title={request.request_type}
                      subtitle={`${request.category} · ${tr(request.tablet_device_id ? "Tablet de huésped" : "Registro interno")}`}
                      status={tr(HOSPITALITY_STATUS_LABELS[request.status] ?? request.status)}
                      description={request.description}
                      actions={(
                        <>
                          {!request.assigned_to && (
                            <span className="self-center text-xs text-amber-600">{tr("Asigna un encargado antes de iniciar o completar esta acción.")}</span>
                          )}
                          {["pending", "assigned"].includes(request.status) && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => void updateHospitalityStatus(request.id, "in_progress")}
                              disabled={savingAction || !request.assigned_to}
                            >
                              {tr("Poner en curso")}
                            </Button>
                          )}
                          {request.status === "in_progress" && (
                            <Button
                              size="sm"
                              onClick={() => void updateHospitalityStatus(request.id, "completed")}
                              disabled={savingAction || !request.assigned_to}
                            >
                              <CheckCircle2 className="mr-2 h-4 w-4" />{tr("Completar")}
                            </Button>
                          )}
                        </>
                      )}
                    />
                  ))}
              </ActionSection>

              <ActionSection title={tr("Reserva y estadía")} icon={<CalendarDays className="h-4 w-4" />}>
                {selected.status === "pending" && (
                  <ActionButton
                    icon={<CalendarDays />}
                    label={tr("Confirmar reserva")}
                    onClick={() => void transitionReservation("confirm")}
                    disabled={savingAction}
                  />
                )}
                {["confirmed", "waiting_for_room", "ready_for_checkin"].includes(selected.status) && (
                  <ActionButton
                    icon={<LogIn />}
                    label={tr(roomReady(selectedRoomStatus) ? "Registrar check-in" : "Registrar llegada y enviar a cola")}
                    onClick={() => void checkInOrQueue()}
                    disabled={savingAction}
                  />
                )}
                {["checked_in", "checked-in"].includes(selected.status) && (
                  <ActionButton
                    icon={<LogOut />}
                    label={tr("Registrar check-out")}
                    onClick={() => void transitionReservation("checkout")}
                    disabled={savingAction}
                  />
                )}
                <div className="col-span-full rounded-lg border border-dashed p-3 text-xs leading-5 text-muted-foreground">
                  {tr("El estado de pago se deriva del ledger financiero. Registra pagos, reversos y ajustes desde el flujo financiero; esta pantalla no puede fabricar un estado de pago manual.")}
                </div>
              </ActionSection>

              <ActionSection title={tr("Crear Housekeeping")} icon={<Sparkles className="h-4 w-4" />}>
                <ActionButton
                  icon={<Sparkles />}
                  label={tr("Generar limpieza de salida")}
                  onClick={() => void createHousekeepingTask(
                    "turnover",
                    `Limpieza posterior al check-out de ${selected.guest_name}, reserva ${selected.id}.`,
                  )}
                  disabled={savingAction}
                />
                <ActionButton
                  icon={<DoorOpen />}
                  label={tr("Preparar habitación")}
                  onClick={() => void createHousekeepingTask(
                    "room_preparation",
                    `Preparar habitación para ${selected.guest_name}, reserva ${selected.id}.`,
                  )}
                  disabled={savingAction}
                />
                <ActionButton
                  icon={<Wrench />}
                  label={tr("Crear inspección operativa")}
                  onClick={() => void createHousekeepingTask(
                    "inspection",
                    `Revisión operativa asociada a la reserva ${selected.id}.`,
                  )}
                  disabled={savingAction}
                />
              </ActionSection>

              <ActionSection title={tr("Crear Hospitality")} icon={<ConciergeBell className="h-4 w-4" />}>
                <ActionButton
                  icon={<ConciergeBell />}
                  label={tr("Solicitud del huésped")}
                  onClick={() => void createHospitalityRequest(
                    "guest_request",
                    `Solicitud operativa para ${selected.guest_name}, reserva ${selected.id}.`,
                  )}
                  disabled={savingAction}
                />
                <ActionButton
                  icon={<Users />}
                  label={tr("Recepción o traslado")}
                  onClick={() => void createHospitalityRequest(
                    "arrival_coordination",
                    `Coordinar recepción o traslado de ${selected.guest_name} para el ${selected.check_in}.`,
                  )}
                  disabled={savingAction}
                />
                <ActionButton
                  icon={<BedDouble />}
                  label={tr("Amenidad o preparación especial")}
                  onClick={() => void createHospitalityRequest(
                    "room_amenity",
                    `Preparación especial para ${selected.guest_name}. ${selected.special_requests ?? "Sin detalle adicional."}`,
                  )}
                  disabled={savingAction}
                />
              </ActionSection>
            </div>
          </aside>
        </div>
      )}
    </AppLayout>
  )
}

function Metric({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode
  label: string
  value: string | number
}) {
  return (
    <Card>
      <CardContent className="flex items-center gap-3 p-4">
        <div className="text-primary [&>svg]:h-5 [&>svg]:w-5">{icon}</div>
        <div>
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className="text-lg font-semibold">{value}</p>
        </div>
      </CardContent>
    </Card>
  )
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-sm font-medium">{value}</p>
    </div>
  )
}

function Empty({ text }: { text: string }) {
  return (
    <p className="col-span-full rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
      {text}
    </p>
  )
}

function ActionSection({
  title,
  icon,
  children,
}: {
  title: string
  icon: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <section>
      <div className="mb-3 flex items-center gap-2">
        <span className="text-primary">{icon}</span>
        <h3 className="text-sm font-semibold">{title}</h3>
      </div>
      <div className="grid gap-2 sm:grid-cols-2">{children}</div>
    </section>
  )
}

function ActionButton({
  icon,
  label,
  onClick,
  disabled,
}: {
  icon: React.ReactNode
  label: string
  onClick: () => void
  disabled?: boolean
}) {
  return (
    <Button
      type="button"
      variant="outline"
      className="h-auto min-h-12 justify-start whitespace-normal py-3 text-left"
      onClick={onClick}
      disabled={disabled}
    >
      <span className="mr-2 shrink-0 [&>svg]:h-4 [&>svg]:w-4">{icon}</span>{label}
    </Button>
  )
}

function OperationCard({
  title,
  subtitle,
  status,
  description,
  actions,
}: {
  title: string
  subtitle: string
  status: string
  description: string | null
  actions: React.ReactNode | null
}) {
  return (
    <div className="col-span-full rounded-lg border p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-medium">{title}</p>
          <p className="mt-1 text-xs text-muted-foreground">{subtitle}</p>
        </div>
        <Badge variant="outline">{status}</Badge>
      </div>
      {description && <p className="mt-3 text-sm leading-6">{description}</p>}
      {actions && <div className="mt-3 flex flex-wrap gap-2">{actions}</div>}
    </div>
  )
}
