import assert from "node:assert/strict"
import test from "node:test"
import { normalizeActivitiesForTimeline } from "../lib/activities/activities-timeline.ts"

const activities = [
  { id: "a", title: "Yoga", activity_type_id: "wellness", start_date: "2026-08-24", end_date: null, status: "active" },
  { id: "b", title: "Ride", activity_type_id: "sport", start_date: "2026-08-25", end_date: "2026-08-27", status: "active" },
]
const types = [
  { id: "wellness", name: "Wellness", color: "#111", icon: "Y" },
  { id: "sport", name: "Sport", color: "#222", icon: "S" },
]
const dates = [
  new Date("2026-08-24T00:00:00Z"),
  new Date("2026-08-25T00:00:00Z"),
  new Date("2026-08-26T00:00:00Z"),
  new Date("2026-08-27T00:00:00Z"),
]

test("normalizes activities without mutating source", () => {
  const snapshot = JSON.stringify(activities)
  const rows = normalizeActivitiesForTimeline(activities, types, dates)
  assert.equal(rows.length, 2)
  assert.equal(rows[0].events[0].width, 96)
  assert.equal(rows[1].events[0].width, 192)
  assert.equal(JSON.stringify(activities), snapshot)
})
