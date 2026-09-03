export type DailyDigestTask = {
  id: string
  title: string
  priority: "baja" | "media" | "alta" | "urgente"
  status: "nueva" | "en_progreso" | "completada" | "cancelada"
  due_date?: string | null
  location_name?: string | null
}

const priorityWeight: Record<DailyDigestTask["priority"], number> = {
  urgente: 0,
  alta: 1,
  media: 2,
  baja: 3,
}

const priorityLabel: Record<DailyDigestTask["priority"], string> = {
  urgente: "URGENTE",
  alta: "ALTA",
  media: "MEDIA",
  baja: "BAJA",
}

export function getChileClock(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Santiago",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now)
  const value = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? ""
  return {
    date: `${value("year")}-${value("month")}-${value("day")}`,
    hour: Number(value("hour")),
    minute: Number(value("minute")),
  }
}

export function isDailyTaskDigestWindow(now = new Date()) {
  const clock = getChileClock(now)
  return clock.hour === 7 && clock.minute === 30
}

function compareTasks(a: DailyDigestTask, b: DailyDigestTask) {
  const aDue = a.due_date ?? "9999-12-31"
  const bDue = b.due_date ?? "9999-12-31"
  if (aDue !== bDue) return aDue.localeCompare(bDue)
  const priority = priorityWeight[a.priority] - priorityWeight[b.priority]
  if (priority !== 0) return priority
  return a.title.localeCompare(b.title, "es")
}

export function buildDailyTaskDigestMessage({
  employeeName,
  tasks,
  localDate,
  taskUrl,
}: {
  employeeName: string
  tasks: DailyDigestTask[]
  localDate: string
  taskUrl: string
}) {
  const open = tasks
    .filter((task) => task.status === "nueva" || task.status === "en_progreso")
    .sort(compareTasks)
  const visible = open.slice(0, 10)
  const lines = visible.map((task, index) => {
    const overdue = Boolean(task.due_date && task.due_date < localDate)
    const today = task.due_date === localDate
    const timing = overdue ? " · VENCIDA" : today ? " · HOY" : task.due_date ? ` · ${task.due_date}` : ""
    const location = task.location_name ? ` · ${task.location_name}` : ""
    return `${index + 1}. [${priorityLabel[task.priority]}${timing}] ${task.title}${location}`
  })

  return [
    `Buenos días, ${employeeName}.`,
    `Tienes ${open.length} ${open.length === 1 ? "tarea abierta" : "tareas abiertas"} en Black Swan:`,
    "",
    ...lines,
    open.length > visible.length ? `+ ${open.length - visible.length} tareas adicionales.` : null,
    "",
    `Abrir Mis tareas: ${taskUrl}`,
  ].filter((line): line is string => line !== null).join("\n")
}
