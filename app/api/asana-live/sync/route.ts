import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const ASANA_API_BASE = "https://app.asana.com/api/1.0"
const DEFAULT_WORKSPACE_GID = "1205953160575908"
const DEFAULT_RAIMUNDO_GID = "1205952889360086"

type AsanaProject = {
  gid: string
  name: string
}

type AsanaTask = {
  gid: string
  name: string
  completed: boolean
  due_on: string | null
  start_on: string | null
  modified_at: string | null
  notes: string | null
  permalink_url: string | null
  assignee: { gid: string; name: string } | null
  memberships: Array<{ project: AsanaProject | null }>
  parent: { gid: string; name: string } | null
}

type AsanaTaskPage = {
  data: AsanaTask[]
  next_page?: { offset?: string | null } | null
}

function classifyRecency(task: AsanaTask) {
  const explicitDates = [task.due_on, task.start_on].filter((value): value is string => Boolean(value))
  if (explicitDates.some((value) => value.startsWith("2026-"))) return "current_2026"
  if (explicitDates.length > 0 && explicitDates.every((value) => value < "2026-01-01")) return "legacy_open"
  if (task.modified_at?.startsWith("2026-")) return "current_2026"
  return null
}

function firstProject(task: AsanaTask) {
  return task.memberships.find((membership) => membership.project)?.project ?? null
}

async function fetchRaimundoTasks(token: string) {
  const workspaceGid = process.env.ASANA_WORKSPACE_GID?.trim() || DEFAULT_WORKSPACE_GID
  const assigneeGid = process.env.ASANA_RAIMUNDO_GID?.trim() || DEFAULT_RAIMUNDO_GID
  const tasks: AsanaTask[] = []
  let offset: string | null = null

  for (let page = 0; page < 20; page += 1) {
    const url = new URL(`${ASANA_API_BASE}/tasks`)
    url.searchParams.set("workspace", workspaceGid)
    url.searchParams.set("assignee", assigneeGid)
    url.searchParams.set("completed_since", "now")
    url.searchParams.set("limit", "100")
    url.searchParams.set(
      "opt_fields",
      [
        "gid",
        "name",
        "completed",
        "due_on",
        "start_on",
        "modified_at",
        "notes",
        "permalink_url",
        "assignee.gid",
        "assignee.name",
        "memberships.project.gid",
        "memberships.project.name",
        "parent.gid",
        "parent.name",
      ].join(","),
    )
    if (offset) url.searchParams.set("offset", offset)

    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    })

    if (!response.ok) {
      const detail = await response.text()
      throw new Error(`Asana API ${response.status}: ${detail.slice(0, 240)}`)
    }

    const payload = (await response.json()) as AsanaTaskPage
    tasks.push(...payload.data)
    offset = payload.next_page?.offset ?? null
    if (!offset) break
  }

  return tasks
}

export async function POST() {
  const supabase = await createClient()
  const { data: authData, error: authError } = await supabase.auth.getUser()
  if (authError || !authData.user) {
    return NextResponse.json({ success: false, status: "unauthorized" }, { status: 401 })
  }

  const token = process.env.ASANA_ACCESS_TOKEN?.trim()
  if (!token) {
    return NextResponse.json({ success: false, status: "not_configured" }, { status: 503 })
  }

  let tasks: AsanaTask[]
  try {
    tasks = await fetchRaimundoTasks(token)
  } catch (error) {
    console.error("[Asana Live] Asana fetch failed", error)
    return NextResponse.json(
      {
        success: false,
        status: "asana_fetch_failed",
        error: error instanceof Error ? error.message : "Asana fetch failed",
      },
      { status: 502 },
    )
  }

  const observedAt = new Date().toISOString()
  let synced = 0
  let collisions = 0
  const failures: Array<{ gid: string; error: string }> = []

  for (const task of tasks) {
    const project = firstProject(task)
    const row = {
      observer_account: task.assignee?.name || "Raimundo Colvin",
      task_title: task.name,
      task_status: task.completed ? "completed" : "open",
      project_name: project?.name ?? null,
      project_url: project ? `https://app.asana.com/0/${project.gid}/list` : null,
      due_label: task.due_on,
      external_task_id: task.gid,
      assignee_label: task.assignee?.name ?? null,
      assignee_external_id: task.assignee?.gid ?? null,
      project_external_id: project?.gid ?? null,
      parent_external_id: task.parent?.gid ?? null,
      start_on: task.start_on,
      due_on: task.due_on,
      modified_at_source: task.modified_at,
      task_notes: task.notes,
      source_surface: "asana_api_sync",
      source_surface_url: task.permalink_url,
      recency_class: classifyRecency(task),
      last_seen_at: observedAt,
    }

    const { error } = await supabase
      .from("asana_live_observations")
      .upsert(row, { onConflict: "external_task_id" })

    if (!error) {
      synced += 1
      continue
    }

    if (error.code === "23505") {
      collisions += 1
      continue
    }

    failures.push({ gid: task.gid, error: error.message })
  }

  if (failures.length > 0 && synced === 0) {
    const forbidden = failures.some((failure) => /row-level security|permission denied/i.test(failure.error))
    return NextResponse.json(
      {
        success: false,
        status: forbidden ? "forbidden" : "write_failed",
        observed: tasks.length,
        synced,
        collisions,
        failures: failures.slice(0, 5),
      },
      { status: forbidden ? 403 : 500 },
    )
  }

  return NextResponse.json({
    success: true,
    status: failures.length > 0 ? "partial" : "synced",
    observed: tasks.length,
    synced,
    collisions,
    failed: failures.length,
    observedAt,
  })
}
