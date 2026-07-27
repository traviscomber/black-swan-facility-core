export type TaskNotificationStatus = "nueva" | "en_progreso" | "completada" | "cancelada"
export type TaskNotificationPriority = "baja" | "media" | "alta" | "urgente"
export type TaskNotificationProvider = "whatsapp_web" | "greenapi"

export type TaskNotificationPayload = {
  recipientName: string
  recipientPhone: string
  taskId: string
  title: string
  description?: string | null
  status: TaskNotificationStatus
  priority: TaskNotificationPriority
  dueDate?: string | null
  locationName?: string | null
  taskUrl: string
}

export type PreparedTaskNotification = {
  provider: TaskNotificationProvider
  mode: "manual" | "automatic"
  href: string
  message: string
  recipient: string
}

const statusLabels: Record<TaskNotificationStatus, string> = {
  nueva: "Pendiente",
  en_progreso: "En curso",
  completada: "Completada",
  cancelada: "Cancelada",
}

const priorityLabels: Record<TaskNotificationPriority, string> = {
  baja: "Baja",
  media: "Media",
  alta: "Alta",
  urgente: "Urgente",
}

export function normalizeChileWhatsappNumber(value: string) {
  const digits = value.replace(/\D/g, "").replace(/^0+/, "")
  if (digits.startsWith("56")) return digits
  return digits.length >= 8 ? `56${digits}` : digits
}

function formatTaskDate(value?: string | null) {
  if (!value) return "sin fecha definida"
  return new Intl.DateTimeFormat("es-CL", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${value}T00:00:00Z`))
}

export function buildTaskNotificationMessage(payload: TaskNotificationPayload) {
  return [
    "Black Swan · Tarea operativa",
    `Hola ${payload.recipientName},`,
    `*${payload.title}*`,
    `Estado: ${statusLabels[payload.status]}`,
    `Prioridad: ${priorityLabels[payload.priority]}`,
    `Fecha objetivo: ${formatTaskDate(payload.dueDate)}`,
    payload.locationName ? `Lugar: ${payload.locationName}` : null,
    payload.description ? `Indicaciones: ${payload.description}` : null,
    `Seguimiento: ${payload.taskUrl}`,
  ].filter(Boolean).join("\n")
}

export function prepareTaskNotification(
  payload: TaskNotificationPayload,
  provider: TaskNotificationProvider = "whatsapp_web",
): PreparedTaskNotification {
  const recipient = normalizeChileWhatsappNumber(payload.recipientPhone)
  const message = buildTaskNotificationMessage(payload)

  if (provider === "greenapi") {
    throw new Error("GreenAPI aún no está configurado para envío automático")
  }

  return {
    provider,
    mode: "manual",
    recipient,
    message,
    href: `https://wa.me/${recipient}?text=${encodeURIComponent(message)}`,
  }
}

export function getTaskNotificationCapabilities() {
  return {
    activeProvider: "whatsapp_web" as const,
    automaticDelivery: false,
    requiresUserConfirmation: true,
    futureProvider: "greenapi" as const,
  }
}
