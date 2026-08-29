import assert from "node:assert/strict"
import test from "node:test"
import { readFileSync } from "node:fs"

const source = readFileSync(new URL("../components/orchard/orchard-navigation.tsx", import.meta.url), "utf8")

test("mobile Orchard navigation keeps accessible names when visible labels are hidden", () => {
  assert.match(source, /aria-label=\{item\.label\[locale\]\}/)
  assert.match(source, /aria-label=\{group\.label\[locale\]\}/)
})
