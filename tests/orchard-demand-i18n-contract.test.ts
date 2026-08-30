import assert from "node:assert/strict"
import fs from "node:fs"
import test from "node:test"

const source = fs.readFileSync("app/orchard/demand/page.tsx", "utf8")

test("orchard demand does not persist an English scenario name by default", () => {
  assert.match(source, /useState\(\{name:"",start_date:/)
  assert.doesNotMatch(source, /useState\(\{name:"Food independence"/)
})

test("orchard demand exposes localized scenario placeholders", () => {
  assert.match(source, /scenarioPlaceholder:"Food independence"/)
  assert.match(source, /scenarioPlaceholder:"Independencia alimentaria"/)
  assert.match(source, /scenarioPlaceholder:"Lebensmittelunabhängigkeit"/)
  assert.match(source, /placeholder=\{text\.scenarioPlaceholder\}/)
})

test("orchard demand formats dates and numbers by locale", () => {
  assert.match(source, /new Intl\.DateTimeFormat\(numberLocale/)
  assert.match(source, /new Intl\.NumberFormat\(numberLocale/)
  assert.match(source, /formatDate\(s\.start_date\)/)
  assert.doesNotMatch(source, /metrics\.weeks\.toFixed\(1\)/)
})

test("orchard demand Spanish copy avoids audited English leakage", () => {
  assert.match(source, /forecast:"Proyectado kg"/)
  assert.match(source, /días-huésped/)
  assert.doesNotMatch(source, /es:\{[^\n]*forecast:"Forecast kg"/)
  assert.doesNotMatch(source, /es:\{[^\n]*guest-days/)
})
