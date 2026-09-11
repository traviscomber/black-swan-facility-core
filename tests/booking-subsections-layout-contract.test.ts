import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"

const layoutPath = new URL("../app/bookings/layout.tsx", import.meta.url)
const densityPath = new URL("../app/bookings/booking-subsections-v2.css", import.meta.url)

test("booking layout loads the shared subsection workspace contract", async () => {
  const source = await readFile(layoutPath, "utf8")
  assert.match(source, /booking-subsections-v2\.css/)
  assert.match(source, /booking-calendar-reference-frame/)
  assert.match(source, /booking-calendar-bedbooking-shell min-w-0/)
})

test("booking subsections remain constrained to the main content column", async () => {
  const source = await readFile(densityPath, "utf8")
  assert.match(source, /\.booking-calendar-bedbooking-shell\s*\{[\s\S]*?min-width:\s*0;/)
  assert.match(source, /flex:\s*1 1 auto;/)
  assert.match(source, /overflow:\s*hidden;/)
  assert.match(source, /section > \.overflow-auto/)
})

test("stay cockpit no longer exposes the old KPI wall as the primary surface", async () => {
  const source = await readFile(densityPath, "utf8")
  assert.match(source, /data-booking-section="operations"/)
  assert.match(source, /> \.grid:first-child\s*\{[\s\S]*?display:\s*none !important;/)
})
