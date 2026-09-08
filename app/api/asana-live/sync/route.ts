import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const ASANA_API_BASE = "https://app.asana.com/api/1.0"
const DEFAULT_WORKSPACE_GID = "1205953160575908"

type AsanaProject = { gid: string; name: string }
type AsanaUser = { gid: string; name: string; email: string | null }
type AsanaTask = {
  gid: string
  name: string
  completed: boolean
  created_at: string | null
  due_on: string | null
  start_on: string | null
  modified_at: string | null
  notes: string | null
  permalink_url: string | null
  assignee: AsanaUser | null
  memberships: Array<{ project: AsanaProject | null }>
  parent: { gid: string; name: string } | null
}
type AsanaPage<T> = { data: T[]; next_page?: { offset?: string | null } | null }

function firstProject(task: AsanaTask) {
  return task.memberships.find((membership) => membership.project)?.project ?? null
}

function normalizeTitle(value: string) {
  return value.trim().replace(/\s+/g, " ").toLocaleLowerCase()
}

async function asanaJson<T>(url: URL, token: string): Promise<AsanaPage<T>> {
  const response = await fetch(url, { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" })
  if (!response.ok) {
    const detail = await response.text()
    throw new Error(`Asana API ${response.status}: ${detail.slice(0, 240)}`)
  }
  return (await response.json()) as AsanaPage<T>
}

async function fetchWorkspaceUsers(token: string, workspaceGid: string) {
  const users: AsanaUser[] = []
  let offset: string | null = null
  for (let page = 0; page < 20; page += 1) {
    const url = new URL(`${ASANA_API_BASE}/users`)
    url.searchParams.set("workspace", workspaceGid)
    url.searchParams.set("limit", "100")
    url.searchParams.set("opt_fields", "gid,name,email")
    if (offset) url.searchParams.set("offset", offset)
    const payload = await asanaJson<AsanaUser>(url, token)
    users.push(...payload.data)
    offset = payload.next_page?.offset ?? null
    if (!offset) break
  }
  return users
}

async function fetchIncompleteTasksForUser(token: string, workspaceGid: string, assignee: AsanaUser) {
  const tasks: AsanaTask[] = []
  let offset: string | null = null
  for (let page = 0; page < 20; page += 1) {
    const url = new URL(`${ASANA_API_BASE}/tasks`)
    url.searchParams.set("workspace", workspaceGid)
    url.searchParams.set("assignee", assignee.gid)
    url.searchParams.set("completed_since", "now")
    url.searchParams.set("limit", "100")
    url.searchParams.set(
      "opt_fields",
      [
        "gid",
        "name",
        "completed",
        "created_at",
        "due_on",
        "start_on",
        "modified_at",
        "notes",
        "permalink_url",
        "assignee.gid",
        "assignee.name",
        "assignee.email",
        "memberships.project.gid",
        "memberships.project.name",
        "parent.gid",
        "parent.name",
      ].join(","),
    )
    if (offset) url.searchParams.set("offset", offset)
    const payload = await asanaJson<AsanaTask>(url, token)
    tasks.push(...payload.data.map((task) => ({ ...task, assignee: task.assignee ?? assignee })))
    offset = payload.next_page?.offset ?? null
    if (!offset) break
  }
  return tasks
}

async function fetchWorkspaceTasks(token: string) {
  const workspaceGid = process.env.ASANA_WORKSPACE_GID?.trim() || DEFAULT_WORKSPACE_GID
  const users = await fetchWorkspaceUsers(token, workspaceGid)
  const taskMap = new Map<string, AsanaTask>()

  for (const user of users) {
    const tasks = await fetchIncompleteTasksForUser(token, workspaceGid, user)
    for (const task of tasks) taskMap.set(task.gid, task)
  }

  return { users, tasks: [...taskMap.values()] }
}

export async function POST() {
  const supabase = await createClient()
  const { data: authData, error: authError } = await supabase.auth.getUser()
  if (authError || !authData.user) {
    return NextResponse.json({ success: false, status: "unauthorized" }, { status: 401 })
  }

  const token = process.env.ASANA_ACCESS_TOKEN?.trim()
  if (!token) return NextResponse.json({ success: false, status: "not_configured" }, { status: 503 })

  let users: AsanaUser[] = []
  let tasks: AsanaTask[] = []
  try {
    const result = await fetchWorkspaceTasks(token)
    users = result.users
    tasks = result.tasks
  } catch (error) {
    console.error("[Asana Live] Workspace fetch failed", error)
    return NextResponse.json(
      { success: false, status: "asana_fetch_failed", error: error instanceof Error ? error.message : "Asana fetch failed" },
      { status: 502 },
    )
  }

  const observedAt = new Date().toISOString()
  const currentRows = tasks.map((task) => {
    const project = firstProject(task)
    return {
      external_task_id: task.gid,
      task_title: task.name,
      task_status: task.completed ? "completed" : "open",
      project_name: project?.name ?? null,
      project_external_id: project?.gid ?? null,
      assignee_label: task.assignee?.name ?? null,
      assignee_email: task.assignee?.email ?? null,
      assignee_external_id: task.assignee?.gid ?? null,
      parent_external_id: task.parent?.gid ?? null,
      start_on: task.start_on,
      due_on: task.due_on,
      created_at_source: task.created_at,
      modified_at_source: task.modified_at,
      task_notes: task.notes,
      source_url: task.permalink_url,
      last_seen_at: observedAt,
      updated_at: observedAt,
    }
  })

  const { error: currentWriteError } = await supabase
    .from("asana_current_tasks")
    .upsert(currentRows, { onConflict: "external_task_id" })

  if (currentWriteError) {
    console.error("[Asana Live] Current task persistence failed", currentWriteError)
    const forbidden = /row-level security|permission denied/i.test(currentWriteError.message)
    return NextResponse.json(
      { success: false, status: forbidden ? "forbidden" : "write_failed", users: users.length, observed: tasks.length, error: currentWriteError.message },
      { status: forbidden ? 403 : 500 },
    )
  }

  const titleMap = new Map<string, {
    normalized_title: string
    display_title: string
    last_seen_at: string
    last_external_task_id: string
    last_project_name: string | null
    last_assignee_label: string | null
    updated_at: string
  }>()

  for (const task of tasks) {
    const normalized = normalizeTitle(task.name)
    if (!normalized) continue
    const project = firstProject(task)
    titleMap.set(normalized, {
      normalized_title: normalized,
      display_title: task.name.trim(),
      last_seen_at: observedAt,
      last_external_task_id: task.gid,
      last_project_name: project?.name ?? null,
      last_assignee_label: task.assignee?.name ?? null,
      updated_at: observedAt,
    })
  }

  let catalogStatus: "synced" | "failed" = "synced"
  if (titleMap.size > 0) {
    const { error: catalogError } = await supabase
      .from("asana_task_title_catalog")
      .upsert([...titleMap.values()], { onConflict: "normalized_title" })
    if (catalogError) {
      catalogStatus = "failed"
      console.error("[Asana Live] Title catalog persistence failed", catalogError)
    }
  }

  return NextResponse.json({
    success: true,
    status: catalogStatus === "failed" ? "partial" : "synced",
    users: users.length,
    observed: tasks.length,
    synced: tasks.length,
    failed: 0,
    catalog: catalogStatus,
    titles: titleMap.size,
    observedAt,
  })
}
