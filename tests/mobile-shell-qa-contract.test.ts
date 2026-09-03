import assert from "node:assert/strict"
import test from "node:test"
import { readFileSync } from "node:fs"

const appLayout = readFileSync(new URL("../components/app-layout.tsx", import.meta.url), "utf8")
const commandPalette = readFileSync(new URL("../components/object-command-palette.tsx", import.meta.url), "utf8")
const orchardAiDock = readFileSync(new URL("../components/orchard/orchard-ai-dock.tsx", import.meta.url), "utf8")
const personaSource = readFileSync(new URL("../lib/os/personas.ts", import.meta.url), "utf8")
const personaHook = readFileSync(new URL("../lib/hooks/use-os-persona.ts", import.meta.url), "utf8")
const inventoryPage = readFileSync(new URL("../app/inventory/page.tsx", import.meta.url), "utf8")
const procurementLayout = readFileSync(new URL("../app/procurement/layout.tsx", import.meta.url), "utf8")
const shellTranslations = readFileSync(new URL("../lib/translations/shell.ts", import.meta.url), "utf8")
const maintenancePage = readFileSync(new URL("../app/maintenance/page.tsx", import.meta.url), "utf8")
const peopleDirectory = readFileSync(new URL("../components/employees-directory-view.tsx", import.meta.url), "utf8")
const employeeCard = readFileSync(new URL("../components/employee-card.tsx", import.meta.url), "utf8")
const addEmployeeDialog = readFileSync(new URL("../components/add-employee-dialog.tsx", import.meta.url), "utf8")
const editEmployeeDialog = readFileSync(new URL("../components/edit-employee-dialog.tsx", import.meta.url), "utf8")
const deleteEmployeeButton = readFileSync(new URL("../components/delete-employee-button.tsx", import.meta.url), "utf8")
const employeePhotoUpload = readFileSync(new URL("../components/employee-photo-upload.tsx", import.meta.url), "utf8")

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

test("OS persona labels follow the active locale without changing persona identity", () => {
  for (const label of ["Operations", "Field operations", "Executive", "Operación", "Operación en terreno", "Dirección", "Betrieb", "Betrieb vor Ort", "Leitung"]) {
    assert.match(personaSource, new RegExp(label))
  }
  assert.match(personaSource, /getOsPersonaLabel\(persona: OsPersonaKey, primaryDomain\?: string \| null, language: OsPersonaLanguage = "es"\)/)
  assert.match(personaHook, /useLanguage/)
  assert.match(personaHook, /getOsPersonaLabel\(persona, primaryDomain, language\)/)
  assert.match(personaSource, /CEO · Hospitality/)
})

test("global command input has an explicit localized accessible name", () => {
  assert.match(commandPalette, /<Command\.Input[\s\S]*?aria-label=\{text\.title\}/)
  assert.match(commandPalette, /shrink-0 whitespace-nowrap/)
})

test("Orchard suppresses global assistants and uses its own high-contrast AI dock", () => {
  assert.match(appLayout, /const showConcierge = !orchardShell && can\("hospitality\.operate"\)/)
  assert.match(appLayout, /const showGlobalAiOps = !orchardShell && access\.is_admin/)
  assert.match(appLayout, /\(showConcierge \|\| showGlobalAiOps\)/)
  assert.match(orchardAiDock, /title: "IA Orchard"/)
  assert.match(orchardAiDock, /bg-\[#171512\]/)
  assert.match(orchardAiDock, /text-\[#e7e1d8\]/)
  assert.match(orchardAiDock, /bg-\[#8bcba8\] text-\[#102018\]/)
  assert.doesNotMatch(orchardAiDock, /title: "Asistente IA de Orchard"/)
})

test("legacy operational hubs cannot escape or pre-render outside the common shell", () => {
  assert.match(inventoryPage, /<AppLayout>[\s\S]*?<InventoryCommandCenter \/>/)
  assert.doesNotMatch(procurementLayout, /ProcurementReadinessPanel/)
  assert.match(procurementLayout, /<AccessGate[\s\S]*?>[\s\S]*?\{children\}[\s\S]*?<\/AccessGate>/)
})

test("places and assets map navigation never leaks a raw translation key", () => {
  assert.match(shellTranslations, /en:\s*\{[\s\S]*?"nav\.map": "Map"/)
  assert.match(shellTranslations, /es:\s*\{[\s\S]*?"nav\.map": "Mapa"/)
  assert.match(shellTranslations, /de:\s*\{[\s\S]*?"nav\.map": "Karte"/)
})

test("secondary operating surfaces use compact responsive hierarchy and preserve locale", () => {
  assert.match(maintenancePage, /grid grid-cols-2 gap-x-6 gap-y-4 border-y py-4 sm:grid-cols-3 xl:grid-cols-5/)
  assert.match(maintenancePage, /const href=\(path:string\)=>`\/\$\{lang\}\$\{path\}`/)
  assert.match(maintenancePage, /href=\{href\("\/issues"\)\}/)
  assert.match(maintenancePage, /href=\{href\("\/tasks"\)\}/)
  assert.match(peopleDirectory, /grid grid-cols-2 gap-x-6 gap-y-4 border-y py-4 sm:grid-cols-3 xl:grid-cols-5/)
  assert.doesNotMatch(peopleDirectory, /<Card><CardHeader><CardTitle className="text-base">\{copy\.directory\}/)
  for (const label of ["Role not recorded", "Función pendiente de registrar", "Rolle nicht erfasst", "Historical record", "Registro histórico", "Historischer Datensatz"]) {
    assert.match(employeeCard, new RegExp(label))
  }
})

test("people record actions stay localized and dark across all supported locales", () => {
  for (const source of [addEmployeeDialog, editEmployeeDialog, deleteEmployeeButton, employeePhotoUpload]) {
    assert.match(source, /useLanguage/)
  }
  for (const label of ["Add person", "Agregar persona", "Person hinzufügen"]) assert.match(addEmployeeDialog, new RegExp(label))
  for (const label of ["Edit person", "Editar persona", "Person bearbeiten"]) assert.match(editEmployeeDialog, new RegExp(label))
  for (const label of ["Deactivate", "Desactivar", "Deaktivieren"]) assert.match(deleteEmployeeButton, new RegExp(label))
  for (const label of ["Employee photo", "Foto de la persona", "Foto der Person"]) assert.match(employeePhotoUpload, new RegExp(label))
  assert.doesNotMatch(employeePhotoUpload, /bg-blue-50|bg-slate-200|text-gray-|border-gray-/)
  assert.match(employeePhotoUpload, /border-primary bg-primary\/5/)
  assert.match(employeePhotoUpload, /bg-destructive/)
})
