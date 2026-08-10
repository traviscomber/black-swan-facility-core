"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { BriefcaseBusiness, CheckCircle2, ChevronDown, ConciergeBell, Flame, Lightbulb, PackageCheck, Plus, Snowflake, Sparkles } from "lucide-react"
import { toast } from "sonner"
import { BOOKING_COMMAND_SELECTION_EVENT } from "@/components/booking-calendar-timeline"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { createClient } from "@/lib/supabase/client"

type ReservationContext = {
  id: string
  guest_name: string
  guest_phone: string | null
  guest_email: string | null
  room_id: string | null
  location_id: string | null
  check_in: string
  check_out: string
  status: string
  room: { room_number: string; location: { name: string } | null } | null
}

type QuickTask = {
  key: string
  label: string
  category: "arrival_detail" | "stay_detail" | "return_detail" | "departure_detail"
  description: string
  icon?: typeof ConciergeBell
}

type TaskSet = {
  key: string
  label: string
  description: string
  taskKeys: string[]
}

const TASKS: QuickTask[] = [
  { key: "luggage_labeling", label: "Etiquetado de maletas", category: "arrival_detail", description: "Etiquetar e identificar el equipaje antes de moverlo o distribuirlo.", icon: BriefcaseBusiness },
  { key: "luggage_distribution", label: "Distribuir maletas", category: "arrival_detail", description: "Mover el equipaje etiquetado a la habitación o casa correspondiente.", icon: PackageCheck },
  { key: "firewood_delivery", label: "Llevar leña", category: "arrival_detail", description: "Dejar leña suficiente y ordenada en el punto asignado.", icon: Flame },
  { key: "light_fireplace", label: "Prender chimenea", category: "arrival_detail", description: "Prender la chimenea antes de la llegada y verificar funcionamiento.", icon: Flame },
  { key: "turn_on_heating", label: "Prender calefacción", category: "arrival_detail", description: "Encender calefacción con anticipación y revisar temperatura interior.", icon: Flame },
  { key: "arrival_lighting", label: "Encender luces", category: "arrival_detail", description: "Encender iluminación interior, acceso y exterior necesaria para la llegada.", icon: Lightbulb },
  { key: "hot_water_check", label: "Revisar agua caliente", category: "arrival_detail", description: "Confirmar disponibilidad y temperatura de agua caliente." },
  { key: "drinking_water", label: "Dejar agua", category: "arrival_detail", description: "Dejar agua potable preparada para el huésped." },
  { key: "ice", label: "Dejar hielo", category: "arrival_detail", description: "Preparar y dejar hielo disponible." , icon: Snowflake},
  { key: "coffee_tea", label: "Revisar café y té", category: "arrival_detail", description: "Revisar y reponer café, té y elementos básicos asociados." },
  { key: "amenities", label: "Revisar amenities", category: "arrival_detail", description: "Confirmar amenities completos y correctamente presentados.", icon: Sparkles },
  { key: "extra_blankets", label: "Dejar mantas", category: "arrival_detail", description: "Dejar mantas adicionales disponibles cuando corresponda." },
  { key: "terrace_ready", label: "Preparar terraza", category: "arrival_detail", description: "Ordenar mobiliario exterior y dejar terraza lista para uso." },
  { key: "bonfire_ready", label: "Preparar fogata", category: "arrival_detail", description: "Dejar fogata preparada y segura para encendido.", icon: Flame },
  { key: "access_check", label: "Revisar acceso", category: "arrival_detail", description: "Verificar puertas, accesos, llaves y recorrido de entrada." },
  { key: "final_walkthrough", label: "Recorrido final", category: "arrival_detail", description: "Hacer último recorrido operativo y confirmar presentación de la casa.", icon: CheckCircle2 },

  { key: "restock_firewood", label: "Reponer leña", category: "stay_detail", description: "Reponer leña durante la estadía." , icon: Flame},
  { key: "relight_fireplace", label: "Prender chimenea", category: "stay_detail", description: "Prender chimenea a solicitud del huésped o por instrucción operativa.", icon: Flame },
  { key: "restock_water", label: "Reponer agua", category: "stay_detail", description: "Reponer agua potable durante la estadía." },
  { key: "restock_ice", label: "Reponer hielo", category: "stay_detail", description: "Reponer hielo durante la estadía.", icon: Snowflake },
  { key: "restock_coffee_tea", label: "Reponer café y té", category: "stay_detail", description: "Reponer café, té y consumibles básicos." },
  { key: "restock_amenities", label: "Reponer amenities", category: "stay_detail", description: "Reponer amenities solicitados o faltantes.", icon: Sparkles },
  { key: "extra_blankets_stay", label: "Llevar mantas", category: "stay_detail", description: "Llevar mantas adicionales al huésped." },
  { key: "trash_pickup", label: "Retirar basura", category: "stay_detail", description: "Retirar basura sin interferir con la estadía." },
  { key: "terrace_reset", label: "Ordenar terraza", category: "stay_detail", description: "Reordenar terraza o espacio exterior durante la estadía." },
  { key: "package_delivery", label: "Entregar compra / paquete", category: "stay_detail", description: "Recibir y entregar una compra, paquete u objeto solicitado." },

  { key: "return_fireplace", label: "Chimenea antes del regreso", category: "return_detail", description: "Prender chimenea antes de que el huésped regrese.", icon: Flame },
  { key: "return_heating", label: "Calefacción antes del regreso", category: "return_detail", description: "Calefaccionar la habitación o casa antes del regreso.", icon: Flame },
  { key: "return_lighting", label: "Luces antes del regreso", category: "return_detail", description: "Encender luces de acceso, exteriores e interiores antes del regreso.", icon: Lightbulb },
  { key: "return_water", label: "Agua para el regreso", category: "return_detail", description: "Dejar agua preparada antes del regreso." },
  { key: "return_ice", label: "Hielo para el regreso", category: "return_detail", description: "Dejar hielo preparado antes del regreso.", icon: Snowflake },
  { key: "return_terrace", label: "Preparar terraza", category: "return_detail", description: "Dejar terraza o espacio exterior nuevamente presentado." },

  { key: "departure_luggage", label: "Coordinar maletas de salida", category: "departure_detail", description: "Confirmar, recoger y organizar equipaje para la salida.", icon: BriefcaseBusiness },
  { key: "departure_access", label: "Preparar acceso de salida", category: "departure_detail", description: "Dejar recorrido y acceso despejados para salida y retiro de equipaje." },
  { key: "forgotten_items", label: "Revisar objetos olvidados", category: "departure_detail", description: "Revisar espacios principales por objetos olvidados antes del cierre." },
  { key: "pending_requests_check", label: "Revisar pendientes del huésped", category: "departure_detail", description: "Confirmar que no queden solicitudes abiertas antes de la salida.", icon: CheckCircle2 },
]

const SETS: TaskSet[] = [
  {
    key: "arrival_luggage",
    label: "Equipaje de llegada",
    description: "Etiqueta primero y luego distribuye el equipaje.",
    taskKeys: ["luggage_labeling", "luggage_distribution"],
  },
  {
    key: "prepare_arrival",
    label: "Preparar llegada",
    description: "Detalles de confort y presentación antes de recibir al huésped.",
    taskKeys: ["firewood_delivery", "light_fireplace", "turn_on_heating", "arrival_lighting", "hot_water_check", "drinking_water", "ice", "coffee_tea", "amenities", "terrace_ready", "access_check", "final_walkthrough"],
  },
  {
    key: "prepare_return",
    label: "Preparar regreso",
    description: "Dejar la casa lista antes de que el huésped vuelva de una actividad.",
    taskKeys: ["return_fireplace", "return_heating", "return_lighting", "return_water", "return_ice", "return_terrace"],
  },
  {
    key: "prepare_departure",
    label: "Preparar salida",
    description: "Equipaje, acceso y cierre de pendientes antes del check-out.",
    taskKeys: ["departure_luggage", "departure_access", "forgotten_items", "pending_requests_check"],
  },
]

const CATEGORY_LABELS: Record<QuickTask["category"], string> = {
  arrival_detail: "Antes de la llegada",
  stay_detail: "Durante la estadía",
  return_detail: "Antes del regreso",
  departure_detail: "Antes de la salida",
}

export function SantiagoHospitalityQuickTasks() {
  const supabase = useMemo(() => createClient(), [])
  const [reservationId, setReservationId] = useState<string | null>(null)
  const [reservation, setReservation] = useState<ReservationContext | null>(null)
  const [loading, setLoading] = useState(false)
  const [savingKey, setSavingKey] = useState<string | null>(null)
  const [expanded, setExpanded] = useState(true)

  const loadReservation = useCallback(async (id: string) => {
    setLoading(true)
    const { data, error } = await supabase
      .from("reservations")
      .select("id, guest_name, guest_phone, guest_email, room_id, location_id, check_in, check_out, status, room:rooms(room_number, location:locations(name))")
      .eq("id", id)
      .single()
    if (error) {
      toast.error("No fue posible cargar la reserva para tareas rápidas")
      setReservation(null)
    } else {
      setReservation(data as unknown as ReservationContext)
    }
    setLoading(false)
  }, [supabase])

  useEffect(() => {
    const listener = (event: Event) => {
      const detail = (event as CustomEvent<{ reservationId?: string | null }>).detail
      if (!detail?.reservationId) return
      setReservationId(detail.reservationId)
      setExpanded(true)
    }
    window.addEventListener(BOOKING_COMMAND_SELECTION_EVENT, listener)
    return () => window.removeEventListener(BOOKING_COMMAND_SELECTION_EVENT, listener)
  }, [])

  useEffect(() => {
    if (reservationId) void loadReservation(reservationId)
  }, [loadReservation, reservationId])

  const createTasks = useCallback(async (taskKeys: string[], sourceLabel: string) => {
    if (!reservation) {
      toast.error("Selecciona primero una reserva en el calendario")
      return
    }
    const selectedTasks = taskKeys
      .map((key) => TASKS.find((task) => task.key === key))
      .filter((task): task is QuickTask => Boolean(task))
    if (selectedTasks.length === 0) return

    setSavingKey(sourceLabel)
    const payload = selectedTasks.map((task, index) => ({
      reservation_id: reservation.id,
      room_id: reservation.room_id,
      location_id: reservation.location_id,
      guest_name: reservation.guest_name,
      guest_phone: reservation.guest_phone,
      guest_email: reservation.guest_email,
      request_type: task.key,
      category: task.category,
      description: `${task.label}. ${task.description}${selectedTasks.length > 1 ? ` · Set: ${sourceLabel} · Paso ${index + 1}/${selectedTasks.length}` : ""}`,
      priority: task.key === "luggage_labeling" ? "high" : "normal",
      status: "pending",
    }))

    const { error } = await supabase.from("hospitality_requests").insert(payload)
    if (error) {
      toast.error(error.message)
    } else {
      toast.success(selectedTasks.length === 1 ? `${selectedTasks[0].label} creada` : `${selectedTasks.length} tareas creadas · ${sourceLabel}`)
    }
    setSavingKey(null)
  }, [reservation, supabase])

  const grouped = useMemo(() => {
    return (Object.keys(CATEGORY_LABELS) as QuickTask["category"][]).map((category) => ({
      category,
      label: CATEGORY_LABELS[category],
      tasks: TASKS.filter((task) => task.category === category),
    }))
  }, [])

  return (
    <Card className="mx-2 mb-4 sm:mx-4">
      <CardHeader className="pb-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-base"><ConciergeBell className="h-4 w-4" /> Tareas rápidas Hospitality</CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">Detalles operativos repetibles para Santiago. Etiquetado de maletas es siempre la primera tarea de llegada.</p>
          </div>
          <div className="flex items-center gap-2">
            {reservation ? (
              <Badge variant="secondary">{reservation.guest_name} · {reservation.room?.location?.name ?? "Sin casa"} · {reservation.room?.room_number ?? "Sin habitación"}</Badge>
            ) : (
              <Badge variant="outline">Selecciona una reserva</Badge>
            )}
            <Button type="button" size="icon" variant="ghost" onClick={() => setExpanded((value) => !value)} aria-label={expanded ? "Ocultar tareas rápidas" : "Mostrar tareas rápidas"}>
              <ChevronDown className={`h-4 w-4 transition-transform ${expanded ? "rotate-180" : ""}`} />
            </Button>
          </div>
        </div>
      </CardHeader>

      {expanded && (
        <CardContent className="space-y-5">
          <div className="rounded-md border p-3">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">Acción #1 de llegada</p>
                <p className="mt-1 font-medium">Etiquetado de maletas</p>
              </div>
              <Badge>Prioridad alta</Badge>
            </div>
            <Button
              type="button"
              className="w-full justify-start"
              disabled={!reservation || loading || savingKey !== null}
              onClick={() => void createTasks(["luggage_labeling"], "Etiquetado de maletas")}
            >
              <BriefcaseBusiness className="mr-2 h-4 w-4" /> Crear etiquetado de maletas
            </Button>
          </div>

          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">Sets de un toque</p>
            <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-4">
              {SETS.map((set) => (
                <Button
                  key={set.key}
                  type="button"
                  variant="outline"
                  className="h-auto min-h-16 justify-start whitespace-normal p-3 text-left"
                  disabled={!reservation || loading || savingKey !== null}
                  onClick={() => void createTasks(set.taskKeys, set.label)}
                >
                  <Plus className="mr-2 h-4 w-4 shrink-0" />
                  <span><span className="block font-medium">{set.label}</span><span className="mt-1 block text-xs opacity-70">{set.description}</span></span>
                </Button>
              ))}
            </div>
          </div>

          {grouped.map((group) => (
            <div key={group.category}>
              <p className="mb-2 text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">{group.label}</p>
              <div className="flex flex-wrap gap-2">
                {group.tasks.map((task) => {
                  const Icon = task.icon ?? ConciergeBell
                  return (
                    <Button
                      key={task.key}
                      type="button"
                      size="sm"
                      variant={task.key === "luggage_labeling" ? "default" : "outline"}
                      disabled={!reservation || loading || savingKey !== null}
                      onClick={() => void createTasks([task.key], task.label)}
                    >
                      <Icon className="mr-2 h-3.5 w-3.5" />{task.label}
                    </Button>
                  )
                })}
              </div>
            </div>
          ))}
        </CardContent>
      )}
    </Card>
  )
}
