"use client"

import { FormEvent, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { ArrowLeft, Save } from "lucide-react"
import { AppLayout } from "@/components/app-layout"
import { PageHeader } from "@/components/page-header"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { useLanguage } from "@/lib/hooks/use-language"
import { createClient } from "@/lib/supabase/client"

const DOMAINS = [
  ["Hospitalidad y reservas", "hospitality"], ["Traslados y logística", "logistics"], ["Actividades", "activities"], ["Housekeeping", "housekeeping"], ["Mantenimiento e incidencias", "maintenance"], ["Inventario y activos", "inventory"], ["Compras y proveedores", "procurement"], ["Propiedades e infraestructura", "properties"], ["Personas y tareas", "people"], ["Facturación interna y pagos", "billing"],
] as const
const COPY = {
  en: { title: "New procedure", description: "Register only a real procedure from current operations. The procedure is created as a draft.", back: "Back", required: "Code, name and area are required.", createError: "The procedure could not be created.", versionError: "The initial procedure version could not be created.", code: "Code", codeHint: "Use a stable code by area and sequence.", name: "Procedure name", namePlaceholder: "Room preparation before arrival", area: "Area", selectArea: "Select an area", owner: "Process owner", brief: "Short description", briefPlaceholder: "When it is used and which operational outcome it must ensure.", objective: "Objective", scope: "Scope", acceptance: "Acceptance criteria", acceptancePlaceholder: "Verifiable condition for considering the procedure correctly executed.", minutes: "Estimated time in minutes", cancel: "Cancel", saving: "Saving…", save: "Save draft", hospitality: "Hospitality and reservations", logistics: "Transfers and logistics", activities: "Activities", housekeeping: "Housekeeping", maintenance: "Maintenance and incidents", inventory: "Inventory and assets", procurement: "Procurement and suppliers", properties: "Properties and infrastructure", people: "People and tasks", billing: "Internal billing and payments" },
  es: { title: "Nuevo procedimiento", description: "Registre únicamente un procedimiento real de la operación actual. El procedimiento se crea como borrador.", back: "Volver", required: "Código, nombre y área son obligatorios.", createError: "No fue posible crear el procedimiento.", versionError: "No fue posible crear la versión inicial del procedimiento.", code: "Código", codeHint: "Use un código estable por área y secuencia.", name: "Nombre del procedimiento", namePlaceholder: "Preparación de habitación antes de llegada", area: "Área", selectArea: "Seleccione un área", owner: "Responsable del proceso", brief: "Descripción breve", briefPlaceholder: "Cuándo se utiliza y qué resultado operacional debe asegurar.", objective: "Objetivo", scope: "Alcance", acceptance: "Criterio de aceptación", acceptancePlaceholder: "Condición verificable para considerar el procedimiento correctamente ejecutado.", minutes: "Tiempo estimado en minutos", cancel: "Cancelar", saving: "Guardando…", save: "Guardar borrador", hospitality: "Hospitalidad y reservas", logistics: "Traslados y logística", activities: "Actividades", housekeeping: "Housekeeping", maintenance: "Mantenimiento e incidencias", inventory: "Inventario y activos", procurement: "Compras y proveedores", properties: "Propiedades e infraestructura", people: "Personas y tareas", billing: "Facturación interna y pagos" },
  de: { title: "Neues Verfahren", description: "Erfasse nur ein reales Verfahren des aktuellen Betriebs. Das Verfahren wird als Entwurf angelegt.", back: "Zurück", required: "Code, Name und Bereich sind erforderlich.", createError: "Das Verfahren konnte nicht erstellt werden.", versionError: "Die erste Verfahrensversion konnte nicht erstellt werden.", code: "Code", codeHint: "Verwende einen stabilen Code nach Bereich und Sequenz.", name: "Verfahrensname", namePlaceholder: "Zimmer vor Ankunft vorbereiten", area: "Bereich", selectArea: "Bereich auswählen", owner: "Prozessverantwortung", brief: "Kurzbeschreibung", briefPlaceholder: "Wann es verwendet wird und welches operative Ergebnis es sicherstellen muss.", objective: "Ziel", scope: "Geltungsbereich", acceptance: "Abnahmekriterium", acceptancePlaceholder: "Prüfbare Bedingung, damit das Verfahren als korrekt ausgeführt gilt.", minutes: "Geschätzte Zeit in Minuten", cancel: "Abbrechen", saving: "Wird gespeichert…", save: "Entwurf speichern", hospitality: "Hospitality und Reservierungen", logistics: "Transfers und Logistik", activities: "Aktivitäten", housekeeping: "Housekeeping", maintenance: "Instandhaltung und Vorfälle", inventory: "Inventar und Anlagen", procurement: "Beschaffung und Lieferanten", properties: "Immobilien und Infrastruktur", people: "Personen und Aufgaben", billing: "Interne Abrechnung und Zahlungen" },
} as const

export default function NewSopPage() {
  const { language } = useLanguage()
  const lang = (language in COPY ? language : "en") as keyof typeof COPY
  const copy = COPY[lang]
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setSaving(true); setError(null)
    const formData = new FormData(event.currentTarget)
    const code = String(formData.get("code") ?? "").trim().toUpperCase()
    const title = String(formData.get("title") ?? "").trim()
    const domain = String(formData.get("domain") ?? "").trim()
    const description = String(formData.get("description") ?? "").trim()
    const ownerRole = String(formData.get("owner_role") ?? "").trim()
    const objective = String(formData.get("objective") ?? "").trim()
    const scope = String(formData.get("scope") ?? "").trim()
    const acceptanceCriteria = String(formData.get("acceptance_criteria") ?? "").trim()
    const estimatedMinutesValue = String(formData.get("estimated_minutes") ?? "").trim()
    const estimatedMinutes = estimatedMinutesValue ? Number(estimatedMinutesValue) : null
    if (!code || !title || !domain) { setError(copy.required); setSaving(false); return }
    const { data: procedure, error: procedureError } = await supabase.from("sop_procedures").insert({ code, title, domain, description: description || null, owner_role: ownerRole || null, status: "draft", risk_level: "low" }).select("id").single()
    if (procedureError || !procedure) { console.error("SOP procedure creation failed", procedureError); setError(copy.createError); setSaving(false); return }
    const { error: versionError } = await supabase.from("sop_versions").insert({ sop_procedure_id: procedure.id, version_number: 1, status: "draft", objective: objective || null, scope: scope || null, acceptance_criteria: acceptanceCriteria || null, estimated_minutes: estimatedMinutes })
    if (versionError) { console.error("SOP version creation failed", versionError); await supabase.from("sop_procedures").delete().eq("id", procedure.id); setError(copy.versionError); setSaving(false); return }
    router.push(`/sop/${procedure.id}`); router.refresh()
  }

  return <AppLayout><PageHeader title={copy.title} description={copy.description} actions={<Button variant="secondary" onClick={() => router.back()}><ArrowLeft className="h-4 w-4" />{copy.back}</Button>} />
    <form onSubmit={handleSubmit} className="mx-auto w-full max-w-5xl space-y-8 px-4 py-6 md:px-8 md:py-8">
      <section className="grid gap-5 bg-card p-5 md:grid-cols-2 md:p-6">
        <div className="space-y-2"><Label htmlFor="code">{copy.code}</Label><Input id="code" name="code" placeholder="SOP-HSK-001" required /><p className="text-xs text-muted-foreground">{copy.codeHint}</p></div>
        <div className="space-y-2"><Label htmlFor="title">{copy.name}</Label><Input id="title" name="title" placeholder={copy.namePlaceholder} required /></div>
        <div className="space-y-2"><Label htmlFor="domain">{copy.area}</Label><select id="domain" name="domain" required className="min-h-10 w-full bg-secondary px-3 text-sm text-foreground outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring"><option value="">{copy.selectArea}</option>{DOMAINS.map(([value, key]) => <option key={value} value={value}>{copy[key]}</option>)}</select></div>
        <div className="space-y-2"><Label htmlFor="owner_role">{copy.owner}</Label><Input id="owner_role" name="owner_role" placeholder="Housekeeping" /></div>
        <div className="space-y-2 md:col-span-2"><Label htmlFor="description">{copy.brief}</Label><Textarea id="description" name="description" rows={3} placeholder={copy.briefPlaceholder} /></div>
      </section>
      <section className="grid gap-5 bg-card p-5 md:p-6"><div className="space-y-2"><Label htmlFor="objective">{copy.objective}</Label><Textarea id="objective" name="objective" rows={3} /></div><div className="space-y-2"><Label htmlFor="scope">{copy.scope}</Label><Textarea id="scope" name="scope" rows={3} /></div><div className="space-y-2"><Label htmlFor="acceptance_criteria">{copy.acceptance}</Label><Textarea id="acceptance_criteria" name="acceptance_criteria" rows={3} placeholder={copy.acceptancePlaceholder} /></div><div className="max-w-xs space-y-2"><Label htmlFor="estimated_minutes">{copy.minutes}</Label><Input id="estimated_minutes" name="estimated_minutes" type="number" min="1" step="1" /></div></section>
      {error && <div role="alert" className="bg-card px-5 py-4 text-sm text-destructive">{error}</div>}
      <div className="flex justify-end gap-3"><Button type="button" variant="secondary" onClick={() => router.back()} disabled={saving}>{copy.cancel}</Button><Button type="submit" disabled={saving}><Save className="h-4 w-4" />{saving ? copy.saving : copy.save}</Button></div>
    </form></AppLayout>
}
