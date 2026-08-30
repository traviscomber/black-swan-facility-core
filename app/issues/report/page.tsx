"use client"

import type React from "react"
import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { AlertCircle, CheckCircle2 } from "lucide-react"
import { AppLayout } from "@/components/app-layout"
import { PageHeader } from "@/components/page-header"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { useLanguage } from "@/lib/hooks/use-language"
import { createClient } from "@/lib/supabase/client"

interface Asset { id: string; name: string; type: string }
interface Infrastructure { id: string; name: string; category: string; status: string; description: string | null; locations?: { name: string } | null }
interface Employee { id: string; name: string; role: string | null }
interface IssueCategory { id: string; name: string; description: string | null }

const COPY = {
  en: { title: "Report issue", description: "Submit a new facility or infrastructure issue", details: "Issue details", detailsHint: "Provide information about the issue you are reporting", issueTitle: "Issue title", issueTitlePlaceholder: "Brief summary of the issue", category: "Issue category", selectCategory: "Select category", related: "Related to", selectType: "Select item type", infrastructure: "Infrastructure", asset: "Asset", infrastructureItem: "Infrastructure item", selectInfrastructure: "Select infrastructure", associatedAsset: "Associated asset (optional)", selectAsset: "Select asset", selectAssetOptional: "Select asset if applicable", priority: "Priority", low: "Low", medium: "Medium", high: "High", critical: "Critical", issueDescription: "Description", descriptionPlaceholder: "Describe the issue in detail…", reporter: "Reported by", selectReporter: "Select reporter", enterTitle: "Enter an issue title.", selectIssueCategory: "Select an issue category.", enterDescription: "Provide a description.", selectRelated: "Select either an infrastructure item or asset.", genericError: "The issue could not be submitted.", success: "Issue submitted successfully. Redirecting…", submitting: "Submitting…", submitted: "Submitted", submit: "Submit issue", cancel: "Cancel" },
  es: { title: "Registrar incidencia", description: "Registra una nueva incidencia de instalaciones o infraestructura", details: "Detalle de la incidencia", detailsHint: "Entrega la información necesaria para registrar y gestionar el problema", issueTitle: "Título de la incidencia", issueTitlePlaceholder: "Resumen breve del problema", category: "Categoría de incidencia", selectCategory: "Selecciona una categoría", related: "Relacionado con", selectType: "Selecciona el tipo de elemento", infrastructure: "Infraestructura", asset: "Activo", infrastructureItem: "Elemento de infraestructura", selectInfrastructure: "Selecciona infraestructura", associatedAsset: "Activo asociado (opcional)", selectAsset: "Selecciona un activo", selectAssetOptional: "Selecciona un activo si corresponde", priority: "Prioridad", low: "Baja", medium: "Media", high: "Alta", critical: "Crítica", issueDescription: "Descripción", descriptionPlaceholder: "Describe la incidencia en detalle…", reporter: "Reportada por", selectReporter: "Selecciona a quien reporta", enterTitle: "Ingresa un título para la incidencia.", selectIssueCategory: "Selecciona una categoría de incidencia.", enterDescription: "Ingresa una descripción.", selectRelated: "Selecciona un elemento de infraestructura o un activo.", genericError: "No fue posible registrar la incidencia.", success: "Incidencia registrada correctamente. Redirigiendo…", submitting: "Registrando…", submitted: "Registrada", submit: "Registrar incidencia", cancel: "Cancelar" },
  de: { title: "Vorfall melden", description: "Neuen Vorfall zu Anlage oder Infrastruktur erfassen", details: "Vorfallsdetails", detailsHint: "Gib die Informationen zum gemeldeten Problem an", issueTitle: "Vorfallstitel", issueTitlePlaceholder: "Kurze Zusammenfassung des Problems", category: "Vorfallskategorie", selectCategory: "Kategorie auswählen", related: "Bezug zu", selectType: "Elementtyp auswählen", infrastructure: "Infrastruktur", asset: "Anlage", infrastructureItem: "Infrastrukturelement", selectInfrastructure: "Infrastruktur auswählen", associatedAsset: "Zugehörige Anlage (optional)", selectAsset: "Anlage auswählen", selectAssetOptional: "Anlage auswählen, falls zutreffend", priority: "Priorität", low: "Niedrig", medium: "Mittel", high: "Hoch", critical: "Kritisch", issueDescription: "Beschreibung", descriptionPlaceholder: "Beschreibe den Vorfall im Detail…", reporter: "Gemeldet von", selectReporter: "Meldende Person auswählen", enterTitle: "Gib einen Vorfallstitel ein.", selectIssueCategory: "Wähle eine Vorfallskategorie.", enterDescription: "Gib eine Beschreibung an.", selectRelated: "Wähle ein Infrastrukturelement oder eine Anlage.", genericError: "Der Vorfall konnte nicht erfasst werden.", success: "Vorfall erfolgreich erfasst. Weiterleitung…", submitting: "Wird erfasst…", submitted: "Erfasst", submit: "Vorfall erfassen", cancel: "Abbrechen" },
} as const

export default function ReportIssuePage() {
  const { language } = useLanguage()
  const lang = (language in COPY ? language : "en") as keyof typeof COPY
  const copy = COPY[lang]
  const router = useRouter()
  const [issueCategories, setIssueCategories] = useState<IssueCategory[]>([])
  const [assets, setAssets] = useState<Asset[]>([])
  const [infrastructure, setInfrastructure] = useState<Infrastructure[]>([])
  const [employees, setEmployees] = useState<Employee[]>([])
  const [title, setTitle] = useState("")
  const [category, setCategory] = useState("")
  const [description, setDescription] = useState("")
  const [priority, setPriority] = useState("medium")
  const [relatedItemType, setRelatedItemType] = useState("")
  const [relatedItemId, setRelatedItemId] = useState("")
  const [assetId, setAssetId] = useState("")
  const [reportedBy, setReportedBy] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  useEffect(() => {
    async function loadData() {
      const supabase = createClient()
      const [categoriesRes, assetsRes, infraRes, employeesRes] = await Promise.all([
        supabase.from("issue_categories").select("*").eq("is_active", true).order("name"),
        supabase.from("assets").select("*").order("name"),
        supabase.from("infrastructure_plans").select("*, locations(name)").order("name"),
        supabase.from("employees").select("*").eq("is_active", true).order("name"),
      ])
      const loadError = categoriesRes.error || assetsRes.error || infraRes.error || employeesRes.error
      if (loadError) console.error("issue report reference data load failed", loadError)
      if (categoriesRes.data) setIssueCategories(categoriesRes.data)
      if (assetsRes.data) setAssets(assetsRes.data)
      if (infraRes.data) setInfrastructure(infraRes.data)
      if (employeesRes.data) setEmployees(employeesRes.data)
    }
    void loadData()
  }, [])

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault(); setError(null); setSuccess(false)
    if (!title.trim()) return setError(copy.enterTitle)
    if (!category) return setError(copy.selectIssueCategory)
    if (!description.trim()) return setError(copy.enterDescription)
    if (!relatedItemType || !relatedItemId) return setError(copy.selectRelated)
    setIsSubmitting(true)
    try {
      const supabase = createClient()
      const issueData = { title: title.trim(), category, description: description.trim(), priority, status: "open", related_item_type: relatedItemType, related_item_id: relatedItemId, asset_id: relatedItemType === "asset" ? relatedItemId : assetId || null, reported_by: reportedBy || null, photo_url: null }
      const { error: insertError } = await supabase.from("issues").insert(issueData).select().single()
      if (insertError) throw insertError
      setSuccess(true); setTitle(""); setCategory(""); setDescription(""); setPriority("medium"); setRelatedItemType(""); setRelatedItemId(""); setAssetId(""); setReportedBy("")
      setTimeout(() => { router.push("/issues"); router.refresh() }, 1500)
    } catch (submitError) {
      console.error("issue submit failed", submitError); setError(copy.genericError)
    } finally { setIsSubmitting(false) }
  }

  return <AppLayout><PageHeader title={copy.title} description={copy.description} /><div className="p-4 md:p-8"><div className="mx-auto max-w-2xl"><Card><CardHeader><CardTitle>{copy.details}</CardTitle><CardDescription>{copy.detailsHint}</CardDescription></CardHeader><CardContent><form onSubmit={handleSubmit} className="space-y-6">
    <Field label={`${copy.issueTitle} *`} htmlFor="title"><Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder={copy.issueTitlePlaceholder} required /></Field>
    <Field label={`${copy.category} *`} htmlFor="category"><Select value={category} onValueChange={setCategory} required><SelectTrigger id="category"><SelectValue placeholder={copy.selectCategory} /></SelectTrigger><SelectContent>{issueCategories.map((cat) => <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>)}</SelectContent></Select>{category && <p className="text-xs text-muted-foreground">{issueCategories.find((c) => c.id === category)?.description}</p>}</Field>
    <Field label={`${copy.related} *`} htmlFor="item-type"><Select value={relatedItemType} onValueChange={(value) => { setRelatedItemType(value); setRelatedItemId("") }} required><SelectTrigger id="item-type"><SelectValue placeholder={copy.selectType} /></SelectTrigger><SelectContent><SelectItem value="infrastructure">{copy.infrastructure}</SelectItem><SelectItem value="asset">{copy.asset}</SelectItem></SelectContent></Select></Field>
    {relatedItemType === "infrastructure" && <><Field label={`${copy.infrastructureItem} *`} htmlFor="infrastructure"><Select value={relatedItemId} onValueChange={setRelatedItemId} required><SelectTrigger id="infrastructure"><SelectValue placeholder={copy.selectInfrastructure} /></SelectTrigger><SelectContent className="max-h-[300px]">{infrastructure.map((infra) => <SelectItem key={infra.id} value={infra.id}><div className="flex flex-col"><span className="font-medium">{infra.name}</span><span className="text-xs text-muted-foreground">{infra.category} • {infra.status}{infra.locations && ` • ${infra.locations.name}`}</span></div></SelectItem>)}</SelectContent></Select></Field><Field label={copy.associatedAsset} htmlFor="asset"><Select value={assetId} onValueChange={setAssetId}><SelectTrigger id="asset"><SelectValue placeholder={copy.selectAssetOptional} /></SelectTrigger><SelectContent className="max-h-[300px]">{assets.map((asset) => <SelectItem key={asset.id} value={asset.id}>{asset.name} ({asset.type})</SelectItem>)}</SelectContent></Select></Field></>}
    {relatedItemType === "asset" && <Field label={`${copy.asset} *`} htmlFor="asset-select"><Select value={relatedItemId} onValueChange={(value) => { setRelatedItemId(value); setAssetId(value) }} required><SelectTrigger id="asset-select"><SelectValue placeholder={copy.selectAsset} /></SelectTrigger><SelectContent className="max-h-[300px]">{assets.map((asset) => <SelectItem key={asset.id} value={asset.id}>{asset.name} ({asset.type})</SelectItem>)}</SelectContent></Select></Field>}
    <Field label={`${copy.priority} *`} htmlFor="priority"><Select value={priority} onValueChange={setPriority} required><SelectTrigger id="priority"><SelectValue /></SelectTrigger><SelectContent>{(["low","medium","high","critical"] as const).map((value) => <SelectItem key={value} value={value}>{copy[value]}</SelectItem>)}</SelectContent></Select></Field>
    <Field label={`${copy.issueDescription} *`} htmlFor="description"><Textarea id="description" value={description} onChange={(e) => setDescription(e.target.value)} placeholder={copy.descriptionPlaceholder} rows={5} required /></Field>
    <Field label={copy.reporter} htmlFor="reporter"><Select value={reportedBy} onValueChange={setReportedBy}><SelectTrigger id="reporter"><SelectValue placeholder={copy.selectReporter} /></SelectTrigger><SelectContent className="max-h-[300px]">{employees.map((emp) => <SelectItem key={emp.id} value={emp.id}>{emp.name} {emp.role && `(${emp.role})`}</SelectItem>)}</SelectContent></Select></Field>
    {error && <div className="flex items-start gap-2 rounded-lg bg-destructive/10 p-4 text-sm text-destructive"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /><span>{error}</span></div>}
    {success && <div className="flex items-start gap-2 rounded-lg bg-green-50 p-4 text-sm text-green-700"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" /><span>{copy.success}</span></div>}
    <div className="flex gap-3"><Button type="submit" disabled={isSubmitting || success}>{isSubmitting ? copy.submitting : success ? copy.submitted : copy.submit}</Button><Button type="button" variant="outline" onClick={() => router.back()} disabled={isSubmitting}>{copy.cancel}</Button></div>
  </form></CardContent></Card></div></div></AppLayout>
}

function Field({ label, htmlFor, children }: { label: string; htmlFor: string; children: React.ReactNode }) { return <div className="space-y-2"><Label htmlFor={htmlFor}>{label}</Label>{children}</div> }
