import assert from "node:assert/strict"
import test from "node:test"

import { buildDailyTaskDigestMessage, getChileClock, isDailyTaskDigestWindow } from "../lib/notifications/daily-task-digest.ts"
import { normalizeGreenApiChatId } from "../lib/notifications/greenapi.ts"

test("resolves 07:30 Chile across summer and winter UTC offsets", () => {
  const summer = new Date("2026-01-15T10:30:00.000Z")
  const winter = new Date("2026-06-15T11:30:00.000Z")

  assert.deepEqual(getChileClock(summer), { date: "2026-01-15", hour: 7, minute: 30 })
  assert.deepEqual(getChileClock(winter), { date: "2026-06-15", hour: 7, minute: 30 })
  assert.equal(isDailyTaskDigestWindow(summer), true)
  assert.equal(isDailyTaskDigestWindow(winter), true)
  assert.equal(isDailyTaskDigestWindow(new Date("2026-06-15T10:30:00.000Z")), false)
})

test("accepts canonical Chile mobile numbers and rejects incomplete records", () => {
  assert.equal(normalizeGreenApiChatId("+56 9 9382 6127"), "56993826127@c.us")
  assert.equal(normalizeGreenApiChatId("9 7333 2011"), "56973332011@c.us")
  assert.throws(() => normalizeGreenApiChatId("+56 9 218 6628"), /Invalid Chile mobile number/)
})

test("builds one prioritized morning digest from assigned open tasks", () => {
  const message = buildDailyTaskDigestMessage({
    employeeName: "Juan Vial",
    localDate: "2026-09-03",
    taskUrl: "https://blackswn.app/es/my-tasks",
    tasks: [
      { id: "1", title: "Revisar tablero", priority: "media", status: "en_progreso", due_date: "2026-09-04", location_name: "Casa" },
      { id: "2", title: "Cerrar fuga", priority: "urgente", status: "nueva", due_date: "2026-09-02", location_name: "Bodega" },
      { id: "3", title: "Tarea cerrada", priority: "alta", status: "completada", due_date: "2026-09-03", location_name: null },
    ],
  })

  assert.match(message, /^Buenos días, Juan Vial\./)
  assert.match(message, /Tienes 2 tareas abiertas/)
  assert.match(message, /1\. \[URGENTE · VENCIDA\] Cerrar fuga · Bodega/)
  assert.match(message, /2\. \[MEDIA · 2026-09-04\] Revisar tablero · Casa/)
  assert.doesNotMatch(message, /Tarea cerrada/)
  assert.match(message, /https:\/\/blackswn\.app\/es\/my-tasks/)
})
