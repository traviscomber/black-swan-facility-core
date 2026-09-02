import assert from "node:assert/strict"
import test from "node:test"
import { readFileSync } from "node:fs"

const appLayout = readFileSync(new URL("../components/app-layout.tsx", import.meta.url), "utf8")
const commandPalette = readFileSync(new URL("../components/object-command-palette.tsx", import.meta.url), "utf8")
const orchardAiDock = readFileSync(new URL("../components/orchard/orchard-ai-dock.tsx", import.meta.url), "utf8")

test("mobile shell keeps BSFC globally and uses the contextual Orchard mark on Orchard routes", () => {
  assert.match(appLayout, /orchardShell \? "ORCHARD" : "BSFC"/)
  assert.match(appLayout, /isOrchardPath/)
  assert.doesNotMatch(appLayout, />BFCS<\/span>/)
})

test("mobile shell exposes localized navigation and sign-out labels", () => {
  for (const label of [
    "Abrir navegación",
    "Volver",
    "Cerrar sesión",
    "Open navigation",
    "Back",
    "Sign out",
    "Navigation öffnen",
    "Zurück",
    "Abmelden",
  ]) {
    assert.match(appLayout, new RegExp(label))
  }

  assert.match(appLayout, /aria-label=\{mobileText\.openNavigation\}/)
  assert.match(appLayout, /aria-label=\{mobileText\.back\}/)
  assert.match(appLayout, /aria-label=\{mobileText\.logout\}/)
})

test("global command input has an explicit localized accessible name", () => {
  assert.match(commandPalette, /<Command\.Input[\s\S]*?aria-label=\{text\.title\}/)
  assert.match(commandPalette, /shrink-0 whitespace-nowrap/)
})

test("Orchard suppresses Hospitality concierge and uses its own high-contrast AI dock", () => {
  assert.match(appLayout, /const showConcierge = !orchardShell && can\("hospitality\.operate"\)/)
  assert.match(orchardAiDock, /title: "IA Orchard"/)
  assert.match(orchardAiDock, /bg-\[#171512\]/)
  assert.match(orchardAiDock, /text-\[#e7e1d8\]/)
  assert.match(orchardAiDock, /bg-\[#8bcba8\] text-\[#102018\]/)
  assert.doesNotMatch(orchardAiDock, /title: "Asistente IA de Orchard"/)
})
