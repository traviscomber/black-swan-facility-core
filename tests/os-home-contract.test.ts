import assert from "node:assert/strict"
import test from "node:test"
import { readFileSync } from "node:fs"

const source = readFileSync(new URL("../components/os-home.tsx", import.meta.url), "utf8")

test("OS home keeps server-authorized navigation as the source of truth", () => {
  assert.match(source, /\/v1\/os\/navigation/)
  assert.match(source, /authorization: `Bearer \$\{token\}`/)
})

test("area selection is additive and keeps canonical item hrefs", () => {
  assert.match(source, /searchParams\.get\('area'\)/)
  assert.match(source, /href=\{item\.href\}/)
})
