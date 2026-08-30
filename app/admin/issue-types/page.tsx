"use client"

import type React from "react"
import { useEffect, useState } from "react"
import { AlertTriangle, Building2, Loader2, Pencil, Plus, Shield, Trash2, Wrench } from "lucide-react"
import { AppLayout } from "@/components/app-layout"
import { PageHeader } from "@/components/page-header"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { createClient } from "@/lib/supabase/client"
import { useLanguage } from "@/lib/hooks/use-language"
import { useToast } from "@/hooks/use-toast"

type IssueCategory = "infrastructure" | "asset" | "facility" | "safety" | "other"
type IssueSeverity = "low" | "medium" | "high" | "critical"

interface IssueType {
  id: string
  name: string
  category: IssueCategory
  description: string | null
  severity: IssueSeverity
  is_active: boolean
  is_custom: boolean
  created_at: string
}

const copy = {
  es: {
    title: "Tipos de incidencia",
    description: "Catálogo utilizado para clasificar incidencias operativas y de seguridad.",
    configured: "tipos configurados",
    predefined: "predefinidos",
    custom: "personalizados",
    add: "Agregar tipo",
    loading: "Cargando catálogo…",
    empty: "No hay tipos de incidencia registrados.",
    name: "Nombre",
    category: "Categoría",
    severity: "Severidad",
    descriptionLabel: "Descripción",
    origin: "Origen",
    status: "Estado",
    actions: "Acciones",
    active: "Activo",
    inactive: "Inactivo",
    predefinedLabel: "Predefinido",
    customLabel: "Personalizado",
    editTitle: "Editar tipo de incidencia",
    addTitle: "Agregar tipo de incidencia",
    dialogDescription: "Los tipos activos aparecen en los formularios de creación y clasificación de incidencias.",
    namePlaceholder: "Ej.: Falla de bomba de agua",
    descriptionPlaceholder: "Descripción operativa breve",
    visibleHelp: "Visible en la selección de incidencias",
    cancel: "Cancelar",
    save: "Guardar",
    saving: "Guardando…",
    deleteTitle: "Eliminar tipo personalizado",
    deleteDescription: "Solo pueden eliminarse tipos personalizados. La operación puede fallar si existen incidencias asociadas.",
    delete: "Eliminar",
    loadError: "No fue posible cargar los tipos de incidencia.",
    saveSuccess: "Tipo de incidencia guardado",
    saveError: "No fue posible guardar el tipo de incidencia.",
    deleteSuccess: "Tipo de incidencia eliminado",
    deleteError: "No fue posible eliminar el tipo. Puede estar siendo utilizado.",
    infrastructure: "Infraestructura",
    asset: "Activo",
    facility: "Instalación",
    safety: "Seguridad",
    other: "Otro",
    low: "Baja",
    medium: "Media",
    high: "Alta",
    critical: "Crítica",
  },
  en: {
    title: "Issue types",
    description: "Catalog used to classify operational and safety issues.",
    configured: "types configured",
    predefined: "predefined",
    custom: "custom",
    add: "Add type",
    loading: "Loading catalog…",
    empty: "No issue types are registered.",
    name: "Name",
    category: "Category",
    severity: "Severity",
    descriptionLabel: "Description",
    origin: "Origin",
    status: "Status",
    actions: "Actions",
    active: "Active",
    inactive: "Inactive",
    predefinedLabel: "Predefined",
    customLabel: "Custom",
    editTitle: "Edit issue type",
    addTitle: "Add issue type",
    dialogDescription: "Active types appear in issue creation and classification forms.",
    namePlaceholder: "Example: Water pump failure",
    descriptionPlaceholder: "Brief operational description",
    visibleHelp: "Visible in issue selection",
    cancel: "Cancel",
    save: "Save",
    saving: "Saving…",
    deleteTitle: "Delete custom type",
    deleteDescription: "Only custom types can be deleted. The operation may fail when associated issues exist.",
    delete: "Delete",
    loadError: "Unable to load issue types.",
    saveSuccess: "Issue type saved",
    saveError: "Unable to save the issue type.",
    deleteSuccess: "Issue type deleted",
    deleteError: "Unable to delete the type. It may still be in use.",
    infrastructure: "Infrastructure",
    asset: "Asset",
    facility: "Facility",
    safety: "Safety",
    other: "Other",
    low: "Low",
    medium: "Medium",
    high: "High",
    critical: "Critical",
  },
  de: {
    title: "Störungstypen",
    description: "Katalog zur Klassifizierung betrieblicher und sicherheitsrelevanter Störungen.",
    configured: "Typen konfiguriert",
    predefined: "vordefiniert",
    custom: "benutzerdefiniert",
    add: "Typ hinzufügen",
    loading: "Katalog wird geladen…",
    empty: "Es sind keine Störungstypen registriert.",
    name: "Name",
    category: "Kategorie",
    severity: "Schweregrad",
    descriptionLabel: "Beschreibung",
    origin: "Herkunft",
    status: "Status",
    actions: "Aktionen",
    active: "Aktiv",
    inactive: "Inaktiv",
    predefinedLabel: "Vordefiniert",
    customLabel: "Benutzerdefiniert",
    editTitle: "Störungstyp bearbeiten",
    addTitle: "Störungstyp hinzufügen",
    dialogDescription: "Aktive Typen erscheinen in den Formularen zum Erfassen und Klassifizieren von Störungen.",
    namePlaceholder: "Beispiel: Ausfall der Wasserpumpe",
    descriptionPlaceholder: "Kurze betriebliche Beschreibung",
    visibleHelp: "In der Störungsauswahl sichtbar",
    cancel: "Abbrechen",
    save: "Speichern",
    saving: "Wird gespeichert…",
    deleteTitle: "Benutzerdefinierten Typ löschen",
    deleteDescription: "Nur benutzerdefinierte Typen können gelöscht werden. Der Vorgang kann fehlschlagen, wenn verknüpfte Störungen vorhanden sind.",
    delete: "Löschen",
    loadError: "Störungstypen konnten nicht geladen werden.",
    saveSuccess: "Störungstyp gespeichert",
    saveError: "Störungstyp konnte nicht gespeichert werden.",
    deleteSuccess: "Störungstyp gelöscht",
    deleteError: "Der Typ konnte nicht gelöscht werden. Er wird möglicherweise noch verwendet.",
    infrastructure: "Infrastruktur",
    asset: "Anlage",
    facility: "Einrichtung",
    safety: "Sicherheit",
    other: "Sonstiges",
    low: "Niedrig",
    medium: "Mittel",
    high: "Hoch",
    critical: "Kritisch",
  },
} as const

export default function IssueTypesPage() {
  const { language } = useLanguage()
  const text = copy[language]
  const { toast } = useToast()
  const [issueTypes, setIssueTypes] = useState<IssueType[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingType, setEditingType] = useState<IssueType | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<IssueType | null>(null)
  const [formData, setFormData] = useState({ name: "", category: "infrastructure" as IssueCategory, description: "", severity: "medium" as IssueSeverity, is_active: true })

  const fetchIssueTypes = async () => {
    setLoading(true)
    const supabase = createClient()
    const { data, error } = await supabase.from("issue_types").select("id,name,category,description,severity,is_active,is_custom,created_at").order("category").order("name")
    if (error) toast({ title: text.loadError, description: error.message, variant: "destructive" })
    setIssueTypes((data || []) as IssueType[])
    setLoading(false)
  }

  useEffect(() => { void fetchIssueTypes() }, [])

  const openForm = (type?: IssueType) => {
    setEditingType(type || null)
    setFormData(type ? { name: type.name, category: type.category, description: type.description || "", severity: type.severity, is_active: type.is_active } : { name: "", category: "infrastructure", description: "", severity: "medium", is_active: true })
    setDialogOpen(true)
  }

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    setSaving(true)
    const supabase = createClient()
    const payload = { name: formData.name.trim(), category: formData.category, description: formData.description.trim() || null, severity: formData.severity, is_active: formData.is_active }
    const result = editingType
      ? await supabase.from("issue_types").update(payload).eq("id", editingType.id)
      : await supabase.from("issue_types").insert({ ...payload, is_custom: true })
    setSaving(false)
    if (result.error) {
      toast({ title: text.saveError, description: result.error.message, variant: "destructive" })
      return
    }
    toast({ title: text.saveSuccess })
    setDialogOpen(false)
    await fetchIssueTypes()
  }

  const handleDelete = async () => {
    if (!deleteTarget?.is_custom) return
    const supabase = createClient()
    const { error } = await supabase.from("issue_types").delete().eq("id", deleteTarget.id).eq("is_custom", true)
    if (error) toast({ title: text.deleteError, description: error.message, variant: "destructive" })
    else toast({ title: text.deleteSuccess })
    setDeleteTarget(null)
    await fetchIssueTypes()
  }

  const categoryIcon = (category: IssueCategory) => category === "infrastructure" ? <Wrench className="h-4 w-4" /> : category === "safety" ? <Shield className="h-4 w-4" /> : category === "other" ? <AlertTriangle className="h-4 w-4" /> : <Building2 className="h-4 w-4" />
  const customCount = issueTypes.filter((type) => type.is_custom).length

  return (
    <AppLayout>
      <PageHeader title={text.title} description={text.description}>
        <Button onClick={() => openForm()}><Plus className="mr-2 h-4 w-4" />{text.add}</Button>
      </PageHeader>

      <div className="space-y-4 p-4 md:p-8">
        <p className="text-sm text-muted-foreground">{issueTypes.length} {text.configured} · {issueTypes.length - customCount} {text.predefined} · {customCount} {text.custom}</p>
        <Card><CardContent className="p-0">
          {loading ? <div className="flex min-h-48 items-center justify-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />{text.loading}</div> : issueTypes.length === 0 ? <div className="p-8 text-center text-sm text-muted-foreground">{text.empty}</div> : (
            <Table>
              <TableHeader><TableRow><TableHead>{text.name}</TableHead><TableHead>{text.category}</TableHead><TableHead>{text.severity}</TableHead><TableHead>{text.descriptionLabel}</TableHead><TableHead>{text.origin}</TableHead><TableHead>{text.status}</TableHead><TableHead className="text-right">{text.actions}</TableHead></TableRow></TableHeader>
              <TableBody>{issueTypes.map((type) => <TableRow key={type.id}>
                <TableCell className="font-medium">{type.name}</TableCell>
                <TableCell><div className="flex items-center gap-2">{categoryIcon(type.category)}<span>{text[type.category]}</span></div></TableCell>
                <TableCell><Badge variant={type.severity === "critical" ? "destructive" : "outline"}>{text[type.severity]}</Badge></TableCell>
                <TableCell className="max-w-md text-sm text-muted-foreground">{type.description || "—"}</TableCell>
                <TableCell><Badge variant="outline">{type.is_custom ? text.customLabel : text.predefinedLabel}</Badge></TableCell>
                <TableCell><Badge variant={type.is_active ? "default" : "outline"}>{type.is_active ? text.active : text.inactive}</Badge></TableCell>
                <TableCell className="text-right"><div className="flex justify-end gap-1"><Button variant="ghost" size="icon" onClick={() => openForm(type)} aria-label={text.editTitle}><Pencil className="h-4 w-4" /></Button>{type.is_custom && <Button variant="ghost" size="icon" onClick={() => setDeleteTarget(type)} aria-label={text.deleteTitle}><Trash2 className="h-4 w-4" /></Button>}</div></TableCell>
              </TableRow>)}</TableBody>
            </Table>
          )}
        </CardContent></Card>
      </div>

      <Dialog open={dialogOpen} onOpenChange={(open) => !saving && setDialogOpen(open)}>
        <DialogContent className="max-w-md"><DialogHeader><DialogTitle>{editingType ? text.editTitle : text.addTitle}</DialogTitle><DialogDescription>{text.dialogDescription}</DialogDescription></DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2"><Label htmlFor="issue-type-name">{text.name}</Label><Input id="issue-type-name" value={formData.name} onChange={(event) => setFormData({ ...formData, name: event.target.value })} placeholder={text.namePlaceholder} required maxLength={120} /></div>
            <div className="space-y-2"><Label>{text.category}</Label><Select value={formData.category} onValueChange={(value: IssueCategory) => setFormData({ ...formData, category: value })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{(["infrastructure", "asset", "facility", "safety", "other"] as IssueCategory[]).map((category) => <SelectItem key={category} value={category}>{text[category]}</SelectItem>)}</SelectContent></Select></div>
            <div className="space-y-2"><Label>{text.severity}</Label><Select value={formData.severity} onValueChange={(value: IssueSeverity) => setFormData({ ...formData, severity: value })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{(["low", "medium", "high", "critical"] as IssueSeverity[]).map((severity) => <SelectItem key={severity} value={severity}>{text[severity]}</SelectItem>)}</SelectContent></Select></div>
            <div className="space-y-2"><Label htmlFor="issue-type-description">{text.descriptionLabel}</Label><Textarea id="issue-type-description" value={formData.description} onChange={(event) => setFormData({ ...formData, description: event.target.value })} placeholder={text.descriptionPlaceholder} rows={3} maxLength={500} /></div>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={formData.is_active} onChange={(event) => setFormData({ ...formData, is_active: event.target.checked })} className="h-4 w-4 rounded border" />{text.visibleHelp}</label>
            <div className="flex justify-end gap-2"><Button type="button" variant="outline" onClick={() => setDialogOpen(false)} disabled={saving}>{text.cancel}</Button><Button type="submit" disabled={saving || !formData.name.trim()}>{saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{saving ? text.saving : text.save}</Button></div>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={Boolean(deleteTarget)} onOpenChange={(open) => !open && setDeleteTarget(null)}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>{text.deleteTitle}</AlertDialogTitle><AlertDialogDescription>{text.deleteDescription}</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>{text.cancel}</AlertDialogCancel><AlertDialogAction onClick={() => void handleDelete()}>{text.delete}</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
    </AppLayout>
  )
}
