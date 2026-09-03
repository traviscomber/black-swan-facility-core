import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { buildDailyTaskDigestMessage, getChileClock, isDailyTaskDigestWindow, type DailyDigestTask } from "@/lib/notifications/daily-task-digest"
import { getGreenApiState, normalizeGreenApiChatId, sendGreenApiText } from "@/lib/notifications/greenapi"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

type EmployeeProfile = {
  employee_id: string | null
  employees: { id: string; name: string; phone: string | null } | Array<{ id: string; name: string; phone: string | null }> | null
}

type AssignmentRow = { employee_id: string | null; task_id: string }

type DeliveryStatus = "processing" | "sent" | "failed" | "skipped"

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
  if (!url || !serviceRoleKey) throw new Error("Supabase service credentials are not configured")
  return createClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

function isCronAuthorized(request: Request) {
  const secret = process.env.CRON_SECRET?.trim()
  if (!secret) return false
  return request.headers.get("authorization") === `Bearer ${secret}`
}

function employeeFromProfile(profile: EmployeeProfile) {
  return Array.isArray(profile.employees) ? profile.employees[0] ?? null : profile.employees
}

async function markDelivery(
  supabase: ReturnType<typeof getServiceClient>,
  employeeId: string,
  localDate: string,
  patch: Record<string, unknown>,
) {
  const { error } = await supabase
    .from("task_whatsapp_digest_deliveries")
    .update(patch)
    .eq("employee_id", employeeId)
    .eq("local_date", localDate)
  if (error) console.error("[Task WhatsApp Digest] Could not update delivery audit", { employeeId, localDate, error: error.message })
}

export async function GET(request: Request) {
  if (!isCronAuthorized(request)) {
    return NextResponse.json({ success: false, status: "unauthorized" }, { status: 401 })
  }

  const now = new Date()
  const clock = getChileClock(now)
  if (!isDailyTaskDigestWindow(now)) {
    return NextResponse.json({ success: true, status: "outside_window", localTime: `${clock.date} ${String(clock.hour).padStart(2, "0")}:${String(clock.minute).padStart(2, "0")}` })
  }

  let supabase: ReturnType<typeof getServiceClient>
  try {
    supabase = getServiceClient()
  } catch (error) {
    return NextResponse.json({ success: false, status: "not_configured", error: error instanceof Error ? error.message : "Supabase not configured" }, { status: 503 })
  }

  try {
    const greenApiState = await getGreenApiState()
    if (greenApiState !== "authorized") {
      return NextResponse.json({ success: false, status: "greenapi_unavailable", greenApiState }, { status: 503 })
    }
  } catch (error) {
    return NextResponse.json({ success: false, status: "greenapi_not_configured", error: error instanceof Error ? error.message : "GreenAPI not configured" }, { status: 503 })
  }

  const { data: profileRows, error: profileError } = await supabase
    .from("user_access_profiles")
    .select("employee_id, employees(id, name, phone)")
    .eq("is_active", true)
    .not("employee_id", "is", null)

  if (profileError) {
    console.error("[Task WhatsApp Digest] Profiles load failed", profileError)
    return NextResponse.json({ success: false, status: "profiles_failed" }, { status: 500 })
  }

  const profiles = (profileRows ?? []) as EmployeeProfile[]
  const employeeIds = Array.from(new Set(profiles.map((profile) => profile.employee_id).filter(Boolean))) as string[]
  if (employeeIds.length === 0) {
    return NextResponse.json({ success: true, status: "no_profiles", sent: 0, skipped: 0, failed: 0 })
  }

  const { data: assignmentRows, error: assignmentError } = await supabase
    .from("task_assignments")
    .select("employee_id, task_id")
    .in("employee_id", employeeIds)

  if (assignmentError) {
    console.error("[Task WhatsApp Digest] Assignments load failed", assignmentError)
    return NextResponse.json({ success: false, status: "assignments_failed" }, { status: 500 })
  }

  const assignments = (assignmentRows ?? []) as AssignmentRow[]
  const taskIds = Array.from(new Set(assignments.map((row) => row.task_id).filter(Boolean)))
  let tasks: DailyDigestTask[] = []
  if (taskIds.length > 0) {
    const { data: taskRows, error: taskError } = await supabase
      .from("tasks")
      .select("id, title, priority, status, due_date, location_name")
      .in("id", taskIds)
      .in("status", ["nueva", "en_progreso"])
    if (taskError) {
      console.error("[Task WhatsApp Digest] Tasks load failed", taskError)
      return NextResponse.json({ success: false, status: "tasks_failed" }, { status: 500 })
    }
    tasks = (taskRows ?? []) as DailyDigestTask[]
  }

  const tasksById = new Map(tasks.map((task) => [task.id, task]))
  const employeeTaskIds = new Map<string, string[]>()
  for (const assignment of assignments) {
    if (!assignment.employee_id || !tasksById.has(assignment.task_id)) continue
    const current = employeeTaskIds.get(assignment.employee_id) ?? []
    current.push(assignment.task_id)
    employeeTaskIds.set(assignment.employee_id, current)
  }

  const appUrl = (process.env.NEXT_PUBLIC_APP_URL?.trim() || "https://blackswn.app").replace(/\/$/, "")
  const summary = { sent: 0, skipped: 0, failed: 0, invalidPhones: [] as string[] }

  for (const profile of profiles) {
    const employeeId = profile.employee_id
    const employee = employeeFromProfile(profile)
    if (!employeeId || !employee) continue

    const assignedTasks = Array.from(new Set(employeeTaskIds.get(employeeId) ?? []))
      .map((taskId) => tasksById.get(taskId))
      .filter((task): task is DailyDigestTask => Boolean(task))

    if (assignedTasks.length === 0) {
      summary.skipped += 1
      continue
    }

    try {
      normalizeGreenApiChatId(employee.phone ?? "")
    } catch {
      summary.skipped += 1
      summary.invalidPhones.push(employee.name)
      continue
    }

    const { data: existing } = await supabase
      .from("task_whatsapp_digest_deliveries")
      .select("status")
      .eq("employee_id", employeeId)
      .eq("local_date", clock.date)
      .maybeSingle()

    const existingStatus = existing?.status as DeliveryStatus | undefined
    if (existingStatus === "sent" || existingStatus === "processing") {
      summary.skipped += 1
      continue
    }

    const taskIdsForAudit = assignedTasks.map((task) => task.id)
    if (existingStatus === "failed") {
      await markDelivery(supabase, employeeId, clock.date, {
        status: "processing",
        phone: employee.phone,
        task_ids: taskIdsForAudit,
        task_count: assignedTasks.length,
        error_message: null,
      })
    } else {
      const { error: insertError } = await supabase.from("task_whatsapp_digest_deliveries").insert({
        local_date: clock.date,
        employee_id: employeeId,
        phone: employee.phone,
        task_ids: taskIdsForAudit,
        task_count: assignedTasks.length,
        status: "processing",
      })
      if (insertError) {
        if (insertError.code === "23505") {
          summary.skipped += 1
          continue
        }
        console.error("[Task WhatsApp Digest] Audit reservation failed", { employeeId, error: insertError.message })
        summary.failed += 1
        continue
      }
    }

    const message = buildDailyTaskDigestMessage({
      employeeName: employee.name,
      tasks: assignedTasks,
      localDate: clock.date,
      taskUrl: `${appUrl}/es/my-tasks`,
    })

    try {
      const delivery = await sendGreenApiText(employee.phone ?? "", message)
      await markDelivery(supabase, employeeId, clock.date, {
        status: "sent",
        greenapi_message_id: delivery.idMessage,
        sent_at: new Date().toISOString(),
        error_message: null,
      })
      summary.sent += 1
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown GreenAPI error"
      console.error("[Task WhatsApp Digest] Send failed", { employeeId, error: message })
      await markDelivery(supabase, employeeId, clock.date, { status: "failed", error_message: message })
      summary.failed += 1
    }
  }

  return NextResponse.json({ success: summary.failed === 0, status: summary.failed === 0 ? "completed" : "partial_failure", localDate: clock.date, ...summary }, { status: summary.failed === 0 ? 200 : 207 })
}
