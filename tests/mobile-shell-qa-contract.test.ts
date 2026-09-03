import assert from "node:assert/strict"
import test from "node:test"
import { readFileSync } from "node:fs"

const appLayout = readFileSync(new URL("../components/app-layout.tsx", import.meta.url), "utf8")
const sidebar = readFileSync(new URL("../components/sidebar.tsx", import.meta.url), "utf8")
const commandPalette = readFileSync(new URL("../components/object-command-palette.tsx", import.meta.url), "utf8")
const orchardAiDock = readFileSync(new URL("../components/orchard/orchard-ai-dock.tsx", import.meta.url), "utf8")
const personaSource = readFileSync(new URL("../lib/os/personas.ts", import.meta.url), "utf8")
const personaHook = readFileSync(new URL("../lib/hooks/use-os-persona.ts", import.meta.url), "utf8")
const inventoryPage = readFileSync(new URL("../app/inventory/page.tsx", import.meta.url), "utf8")
const procurementLayout = readFileSync(new URL("../app/procurement/layout.tsx", import.meta.url), "utf8")
const bookingsPage = readFileSync(new URL("../app/bookings/page.tsx", import.meta.url), "utf8")
const bookingsLayout = readFileSync(new URL("../app/bookings/layout.tsx", import.meta.url), "utf8")
const bookingsNav = readFileSync(new URL("../components/bookings-section-nav.tsx", import.meta.url), "utf8")
const hospitalityCommandStrip = readFileSync(new URL("../components/hospitality-command-strip.tsx", import.meta.url), "utf8")
const shellTranslations = readFileSync(new URL("../lib/translations/shell.ts", import.meta.url), "utf8")
const maintenancePage = readFileSync(new URL("../app/maintenance/page.tsx", import.meta.url), "utf8")
const tasksPage = readFileSync(new URL("../app/tasks/page.tsx", import.meta.url), "utf8")
const issuesView = readFileSync(new URL("../components/issues-view.tsx", import.meta.url), "utf8")
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

test("common shell constrains wide workspaces to the content column", () => {
  assert.match(appLayout, /flex min-w-0 flex-1 flex-col overflow-hidden/)
  assert.match(appLayout, /relative min-h-0 min-w-0 flex-1 overflow-y-auto bg-background/)
  assert.doesNotMatch(appLayout, /flex w-full flex-1 flex-col overflow-hidden/)
})

test("desktop sidebar uses the same BSFC identity and native dark shell", () => {
  assert.match(sidebar, />BSFC<\/h1>/)
  assert.doesNotMatch(sidebar, />BFCS<\/h1>/)
  assert.match(sidebar, /border-r border-sidebar-border bg-sidebar/)
  assert.match(sidebar, /border-t border-sidebar-border p-3/)
  assert.doesNotMatch(sidebar, /bg-white/)
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

test("global shell renders only one floating assistant without removing either canonical route", () => {
  assert.match(appLayout, /showConcierge \? \(/)
  assert.match(appLayout, /: showGlobalAiOps \? \(/)
  assert.match(appLayout, /href=\{conciergeHref\}/)
  assert.match(appLayout, /href=\{aiHref\}/)
  assert.match(appLayout, /t\("shell\.concierge"\)/)
  assert.match(appLayout, /t\("shell\.ai_ops"\)/)
  assert.doesNotMatch(appLayout, /\{showConcierge && <Link/)
  assert.doesNotMatch(appLayout, /\{showGlobalAiOps && <Link/)
})

test("legacy operational hubs cannot escape or pre-render outside the common shell", () => {
  assert.match(inventoryPage, /<AppLayout>[\s\S]*?<InventoryCommandCenter \/>/)
  assert.doesNotMatch(procurementLayout, /ProcurementReadinessPanel/)
  assert.match(procurementLayout, /<AccessGate[\s\S]*?>[\s\S]*?\{children\}[\s\S]*?<\/AccessGate>/)
})

test("booking section navigation stays inside the common shell without losing capability filters", () => {
  assert.match(bookingsLayout, /booking-workspace contents/)
  assert.doesNotMatch(bookingsLayout, /TabsList|TabsTrigger/)
  assert.match(appLayout, /const bookingsShell = isBookingsPath\(pathname\)/)
  assert.match(appLayout, /\{bookingsShell && <BookingsSectionNav \/>\}/)
  assert.match(bookingsNav, /if \(tab\.adminOnly\) return access\.is_admin/)
  assert.match(bookingsNav, /if \(tab\.action && !can\(tab\.action\)\) return false/)
  assert.match(bookingsNav, /if \(tab\.department && !canAccessDepartment\(tab\.department\)\) return false/)
  assert.match(bookingsNav, /overflow-x-auto/)
  assert.match(bookingsNav, /localizeRoute\(route, language\)/)
})

test("Hospitality pulse belongs to the bookings root shell and preserves locale without changing operational sources", () => {
  assert.match(appLayout, /const bookingsRoot = isBookingsRoot\(pathname\)/)
  assert.match(appLayout, /\{bookingsRoot && <HospitalityCommandStrip \/>\}/)
  assert.doesNotMatch(bookingsPage, /HospitalityCommandStrip/)
  assert.match(hospitalityCommandStrip, /useLanguage/)
  for (const label of ["Hospitality today", "Hospitalidad hoy", "Hospitalität heute"]) assert.match(hospitalityCommandStrip, new RegExp(label))
  assert.match(hospitalityCommandStrip, /const href = \(path: string\) => `\/\$\{language\}\$\{path\}`/)
  assert.match(hospitalityCommandStrip, /href=\{href\("\/bookings\/requests"\)\}/)
  assert.match(hospitalityCommandStrip, /href=\{href\("\/budgets\/approvals"\)\}/)
  for (const source of ["reservations", "hospitality_requests", "reservation_operational_exceptions", "reservation_room_readiness"]) {
    assert.match(hospitalityCommandStrip, new RegExp(`from\\(\\"${source}\\"\\)`))
  }
  assert.match(hospitalityCommandStrip, /rpc\("can_finance_approve"\)/)
  assert.match(hospitalityCommandStrip, /channel\("hospitality-command-strip"\)/)
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

test("tasks and issues use compact object-first hierarchy and keep locale in direct routes", () => {
  assert.match(tasksPage, /grid grid-cols-2 gap-x-6 gap-y-4 border-y py-4 sm:grid-cols-4/)
  assert.match(tasksPage, /const taskPath = `\/\$\{lang\}\/tasks`/)
  assert.match(tasksPage, /`\$\{taskPath\}\?selected=\$\{task\.id\}`/)
  assert.doesNotMatch(tasksPage, /<Card><CardHeader><CardTitle className="text-base">\{copy\.workList\}/)
  assert.doesNotMatch(tasksPage, /bg-amber-50(?:\s|\")|bg-orange-50(?:\s|\")/)
  assert.match(issuesView, /border-l-2 border-primary\/40 pl-4/)
  assert.match(issuesView, /grid grid-cols-2 gap-x-6 gap-y-4 border-y py-4 sm:grid-cols-4/)
  assert.match(issuesView, /const href = \(path:string\) => `\/\$\{lang\}\$\{path\}`/)
  assert.match(issuesView, /href=\{href\("\/issues\/report"\)\}/)
  assert.match(issuesView, /href=\{href\("\/maintenance"\)\}/)
  assert.match(issuesView, /<Card key=\{issue\.id\}>/)
  assert.doesNotMatch(issuesView, /rounded-lg border bg-muted\/20 p-4/)
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
