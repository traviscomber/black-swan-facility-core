import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"

const sidebarPath = new URL("../components/calendar/booking-reference-sidebar.tsx", import.meta.url)
const rootLayoutPath = new URL("../app/layout.tsx", import.meta.url)
const vercelPath = new URL("../vercel.json", import.meta.url)

test("booking workspace exposes a stable path back to Black Swan OS", async () => {
  const source = await readFile(sidebarPath, "utf8")
  assert.match(source, /href\(\"\/os\"\)/)
  assert.match(source, /backToOs/)
})

test("root layout does not force zero revalidation globally", async () => {
  const source = await readFile(rootLayoutPath, "utf8")
  assert.doesNotMatch(source, /export const revalidate\s*=\s*0/)
})

test("Vercel uses a focused build while GitHub remains the full quality gate", async () => {
  const config = JSON.parse(await readFile(vercelPath, "utf8")) as { buildCommand?: string }
  assert.ok(config.buildCommand?.includes("pnpm typecheck"))
  assert.ok(config.buildCommand?.includes("pnpm test:booking"))
  assert.ok(config.buildCommand?.includes("next build"))
  assert.doesNotMatch(config.buildCommand ?? "", /test:os|test:inventory|test:notifications/)
})
