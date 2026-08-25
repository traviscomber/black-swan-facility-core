import assert from "node:assert/strict"
import test from "node:test"
import { createOverlayLoadQueue } from "../lib/map/overlay-runtime.ts"

test("limits overlay work to two concurrent tasks", async () => {
  const queue = createOverlayLoadQueue({ concurrency: 2 })
  let active = 0
  let maxActive = 0
  const jobs = Array.from({ length: 5 }, (_, index) => queue.run(async () => {
    active += 1
    maxActive = Math.max(maxActive, active)
    await new Promise((resolve) => setTimeout(resolve, 5))
    active -= 1
    return index
  }))
  assert.deepEqual(await Promise.all(jobs), [0, 1, 2, 3, 4])
  assert.equal(maxActive, 2)
})

test("a failed task does not cancel queued overlay work", async () => {
  const queue = createOverlayLoadQueue({ concurrency: 2 })
  const results = await Promise.allSettled([
    queue.run(async () => "first"),
    queue.run(async () => { throw new Error("broken overlay") }),
    queue.run(async () => "third"),
  ])
  assert.equal(results[0].status, "fulfilled")
  assert.equal(results[1].status, "rejected")
  assert.equal(results[2].status, "fulfilled")
})
