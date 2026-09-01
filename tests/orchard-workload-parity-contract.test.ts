import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"

test("Heirloom-style Orchard workload exposes list, week board and workload graph on canonical tasks", async () => {
  const component = await readFile("components/orchard/orchard-workload-parity.tsx", "utf8")
  const list = await readFile("app/orchard/work/list/page.tsx", "utf8")
  const week = await readFile("app/orchard/work/week-board/page.tsx", "utf8")
  const graph = await readFile("app/orchard/work/workload-graph/page.tsx", "utf8")

  assert.match(component, /from\("tasks"\)/)
  assert.match(component, /from\("task_assignments"\)/)
  assert.match(component, /from\("employees"\)/)
  assert.match(component, /operational_area","huerto_vinedo"/)
  assert.match(component, /Recurring tasks are not yet a canonical Core field/)
  assert.match(component, /mode===\"list\"/)
  assert.match(component, /mode===\"week-board\"/)
  assert.match(component, /mode===\"workload-graph\"/)
  assert.match(list, /mode="list"/)
  assert.match(week, /mode="week-board"/)
  assert.match(graph, /mode="workload-graph"/)
})
