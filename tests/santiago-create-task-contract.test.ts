import assert from "node:assert/strict"
import test from "node:test"
import { readFileSync } from "node:fs"

const osHome = readFileSync(new URL("../components/os-home.tsx", import.meta.url), "utf8")
const tasks = readFileSync(new URL("../app/tasks/page.tsx", import.meta.url), "utf8")

test("Santiago sees a direct create-task action in his OS home", () => {
  assert.match(osHome, /santiago: \['tasks', 'bookings', 'payments', 'guest-requests'\]/)
  assert.match(osHome, /persona === 'santiago'/)
  assert.match(osHome, /\/tasks\?new=1/)
  assert.match(osHome, /newTask: 'Nueva tarea'/)
})

test("task workspace accepts direct blank creation links", () => {
  assert.match(tasks, /params\.get\("new"\) === "1"/)
  assert.match(tasks, /setTaskPrefill\(prefill\)/)
  assert.match(tasks, /setIsAddDialogOpen\(true\)/)
})
