import assert from "node:assert/strict"
import test from "node:test"
import { readFileSync } from "node:fs"

const page = readFileSync(new URL("../app/activities-calendar/page.tsx", import.meta.url), "utf8")
const timeline = readFileSync(new URL("../components/activities/activities-timeline.tsx", import.meta.url), "utf8")
const checklists = readFileSync(new URL("../components/localized-checklists-page.tsx", import.meta.url), "utf8")
const checklistDetail = readFileSync(new URL("../app/checklists/[id]/page.tsx", import.meta.url), "utf8")
const checklistLoading = readFileSync(new URL("../app/checklists/[id]/loading.tsx", import.meta.url), "utf8")
const guestRequests = readFileSync(new URL("../components/guest-requests-inbox.tsx", import.meta.url), "utf8")
const volunteers = readFileSync(new URL("../components/localized-volunteers-page.tsx", import.meta.url), "utf8")
const addVolunteer = readFileSync(new URL("../components/add-volunteer-dialog.tsx", import.meta.url), "utf8")
const editVolunteer = readFileSync(new URL("../components/edit-volunteer-dialog.tsx", import.meta.url), "utf8")
const deleteVolunteer = readFileSync(new URL("../components/delete-volunteer-button.tsx", import.meta.url), "utf8")
const volunteerPhoto = readFileSync(new URL("../components/volunteer-photo-upload.tsx", import.meta.url), "utf8")

test("activities calendar keeps existing Supabase CRUD paths", () => {
  assert.match(page, /from\('activities'\)\.delete\(\)/)
  assert.match(page, /from\('activities'\)/)
  assert.match(page, /ActivityFormDialog/)
})

test("activities timeline preserves date-specific creation", () => {
  assert.match(timeline, /onCreate\(date\)/)
  assert.match(page, /onCreate=\{\(date\) => handleCreateActivity\(date\)\}/)
  assert.match(page, /setSelectedDate\(date\)/)
})

test("activities calendar uses compact dark hierarchy without changing workflow", () => {
  assert.match(page, /const LOCALE_TAGS = \{ en: 'en-US', es: 'es-CL', de: 'de-DE' \}/)
  assert.match(page, /border-y px-1 py-2/)
  assert.match(page, /<section className="pt-2">/)
  assert.match(page, /className="flex flex-col gap-3 border-b px-1 py-4/)
  assert.doesNotMatch(page, /components\/ui\/card/)
  assert.doesNotMatch(page, /rounded border bg-card/)
})

test("checklist index is localized, route-safe and free of legacy light-card styling", () => {
  assert.match(checklists, /Listas de verificación/)
  assert.match(checklists, /Checklisten/)
  assert.match(checklists, /href=\{`\/\$\{language\}\/checklists\/\$\{checklist\.id\}`\}/)
  assert.match(checklists, /className="group grid gap-3 border-b/)
  assert.doesNotMatch(checklists, /hover:border-blue|text-gray-|components\/ui\/card|components\/ui\/button/)
})

test("checklist detail keeps canonical completion mutation and dark object hierarchy", () => {
  assert.match(checklistDetail, /from\("checklist_items"\)\.update\(\{ is_completed: !currentState, completed_at: completedAt \}\)\.eq\("id", itemId\)/)
  assert.match(checklistDetail, /flex flex-col gap-3 border-y py-4/)
  assert.match(checklistDetail, /border-t px-1 py-4 transition-colors hover:bg-muted\/30/)
  assert.doesNotMatch(checklistDetail, /components\/ui\/card|text-gray-|border-gray-|bg-gray-/)
  assert.match(checklistLoading, /animate-pulse/)
  assert.match(checklistLoading, /bg-muted\/60/)
})

test("guest request inbox is trilingual while preserving canonical mutations", () => {
  assert.match(guestRequests, /useLanguage/)
  for (const label of ["Guest requests", "Solicitudes de huéspedes", "Gästeanfragen"]) assert.match(guestRequests, new RegExp(label))
  assert.match(guestRequests, /const LOCALES = \{ en: "en-US", es: "es-CL", de: "de-DE" \}/)
  assert.match(guestRequests, /from\("hospitality_requests"\)\.update\(\{ assigned_to: employeeId \|\| null, status:/)
  assert.match(guestRequests, /if \(status === "completed"\) updates\.completed_at = new Date\(\)\.toISOString\(\)/)
  assert.match(guestRequests, /grid grid-cols-2 gap-x-6 gap-y-4 border-y py-4 sm:grid-cols-3/)
  assert.doesNotMatch(guestRequests, /const STATUS_LABELS|const PRIORITY_LABELS|const CATEGORY_LABELS|Intl\.DateTimeFormat\("es-CL"/)
})

test("volunteer directory and record actions are trilingual dark surfaces with unchanged mutations", () => {
  for (const source of [addVolunteer, editVolunteer, deleteVolunteer, volunteerPhoto]) assert.match(source, /useLanguage/)
  for (const label of ["Agregar voluntario", "Freiwilligen hinzufügen"]) assert.match(addVolunteer, new RegExp(label))
  for (const label of ["Editar voluntario", "Freiwilligen bearbeiten"]) assert.match(editVolunteer, new RegExp(label))
  for (const label of ["Eliminar voluntario", "Freiwillige Person löschen"]) assert.match(deleteVolunteer, new RegExp(label))
  for (const label of ["Subir foto", "Foto hochladen"]) assert.match(volunteerPhoto, new RegExp(label))

  assert.match(addVolunteer, /from\("volunteers"\)\.insert\(/)
  assert.match(editVolunteer, /from\("volunteers"\)\.update\(/)
  assert.match(deleteVolunteer, /from\("volunteers"\)\.delete\(\)\.eq\("id", volunteerId\)/)
  assert.match(volunteerPhoto, /storage\.from\("facility-photos"\)\.upload\(filePath, file\)/)
  assert.match(volunteerPhoto, /from\("volunteers"\)\.update\(\{ photo_url: null \}\)\.eq\("id", volunteerId\)/)

  for (const source of [volunteers, addVolunteer, editVolunteer, deleteVolunteer, volunteerPhoto]) {
    assert.doesNotMatch(source, /bg-slate-200|text-gray-|bg-green-50|border-green-200|text-red-400|bg-red-600/)
  }
})
