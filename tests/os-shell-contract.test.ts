import assert from "node:assert/strict"
import test from "node:test"
import { readFileSync } from "node:fs"

const layout = readFileSync(new URL("../app/os/layout.tsx", import.meta.url), "utf8")

test("all OS routes inherit the common AppLayout shell", () => {
  assert.match(layout, /AppLayout/)
  assert.match(layout, /<AppLayout>\{children\}<\/AppLayout>/)
})
