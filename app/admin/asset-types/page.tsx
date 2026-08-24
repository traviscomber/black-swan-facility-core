"use client"

import type React from "react"
import { useEffect, useState } from "react"
import { Droplet, Loader2, Pencil, Plus, Trash2, Wifi, Zap } from "lucide-react"
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

interface AssetType {
  id: string
  name: string
  category: "internet" | "water" | "electricity"
  description: string | null
  is_active: boolean
  created_at: string
}

const copy = {
  es: {
    title: "Tipos de activo de infraestructura",
    description: "Catálogo maestro para internet, agua y electricidad.",
    configured: "tipos configurados",
    add: "Agregar tipo",
    loading: "Cargando catálogo…",
    empty: "No hay tipos de activo registrados.",
    name: "Nombre",
    category: "Categoría",
    descriptionLabel: "Descripción",
    status: "Estado",
    actions: "Acciones",
    active: "Activo",
    inactive: "Inactivo",
    editTitle: "Editar tipo de activo",
    addTitle: "Agregar tipo de activo",
    dialogDescription: "Los tipos activos aparecen en los formularios de selección de infraestructura.",
    namePlaceholder: "Ej.: Punto de acceso WiFi",
    descriptionPlaceholder: "Descripción operativa breve",
    activeHelp: "Visible en la selección de activos",
    cancel: "Cancelar",
    save: "Guardar",
    saving: "Guardando…",
    deleteTitle: "Eliminar tipo de activo",
    deleteDescription: "Esta acción puede afectar referencias existentes. Solo continúe si el tipo no está en uso.",
    delete: "Eliminar",
    internet: "Internet",
    water: "Agua",
    electricity: "Electricidad",
    loadError: "No fue posible cargar los tipos de activo.",
    saveSuccess: "Tipo de activo guardado",
    saveError: "No fue posible guardar el tipo de activo.",
    deleteSuccess: "Tipo de activo eliminado",
    deleteError: "No fue posible eliminar el tipo. Puede estar siendo utilizado.",
  },
  en: {
    title: "Infrastructure asset types",
    description: "Master catalog for internet, water and electricity.",
    configured: "types configured",
    add: "Add type",
    loading: "Loading catalog…",
    empty: "No asset types are registered.",
    name: "Name",
    category: "Category",
    descriptionLabel: "Description",
    status: "Status",
    actions: "Actions",
    active: "Active",
    inactive: "Inactive",
    editTitle: "Edit asset type",
    addTitle: "Add asset type",
    dialogDescription: "Active types appear in infrastructure selection forms.",
    namePlaceholder: "Example: WiFi access point",
    descriptionPlaceholder: "Brief operational description",
    activeHelp: "Visible in asset selection",
    cancel: "Cancel",
    save: "Save",
    saving: "Saving…",
    deleteTitle: "Delete asset type",
    deleteDescription: "This action may affect existing references. Continue only when the type is not in use.",
    delete: "Delete",
    internet: "Internet",
    water: "Water",
    electricity: "Electricity",
    loadError: "Unable to load asset types.",
    saveSuccess: "Asset type saved",
    saveError: "Unable to save the asset type.",
    deleteSuccess: "Asset type deleted",
    deleteError: "Unable to delete the type. It may still be in use.",
  },
} as const

export default function AssetTypesPage() {
  const { language } = useLanguage()
  const text = copy[language === "es" ? "es" : "en"]
  const { toast } = useToast()
  const [assetTypes, setAssetTypes] = useState<AssetType[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingType, setEditingType] = useState<AssetType | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<AssetType | null>(null)
  const [formData, setFormData] = useState({ name: "", category: "internet" as AssetType["category"], description: "", is_active: true })

  const fetchAssetTypes = async () => {
    setLoading(true)
    const supabase = createClient()
    const { data, error } = await supabase.from("infrastructure_asset_types").select("id,name,category,description,is_active,created_at").order("category").order("name")
    if (error) toast({ title: text.loadError, description: error.message, variant: "destructive" })
    setAssetTypes((data || []) as AssetType[])
    setLoading(false)
  }

  useEffect(() => { void fetchAssetTypes() }, [])

  const openForm = (type?: AssetType) => {
    setEditingType(type || null)
    setFormData(type ? { name: type.name, category: type.category, description: type.description || "", is_active: type.is_active } : { name: "", category: "internet", description: "", is_active: true })
    setDialogOpen(true)
  }

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    setSaving(true)
    const supabase = createClient()
    const payload = { name: formData.name.trim(), category: formData.category, description: formData.description.trim() || null, is_active: formData.is_active }
    const result = editingType
      ? await supabase.from("infrastructure_asset_types").update(payload).eq("id", editingType.id)
      : await supabase.from("infrastructure_asset_types").insert(payload)
    setSaving(false)
    if (result.error) {
      toast({ title: text.saveError, description: result.error.message, variant: "destructive" })
      return
    }
    toast({ title: text.saveSuccess })
    setDialogOpen(false)
    await fetchAssetTypes()
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    const supabase = createClient()
    const { error } = await supabase.from("infrastructure_asset_types").delete().eq("id", deleteTarget.id)
    if (error) toast({ title: text.deleteError, description: error.message, variant: "destructive" })
    else toast({ title: text.deleteSuccess })
    setDeleteTarget(null)
    await fetchAssetTypes()
  }

  const categoryLabel = (category: AssetType["category"]) => text[category]
  const categoryIcon = (category: AssetType["category"]) => category === "internet" ? <Wifi className="h-4 w-4" /> : category === "water" ? <Droplet className="h-4 w-4" /> : <Zap className="h-4 w-4" />

  return (
    <AppLayout>
      <PageHeader
        title={text.title}
        description={text.description}
        actions={<Button onClick={() => openForm()}><Plus className="mr-2 h-4 w-4" />{text.add}</Button>}
      />

      <div className="space-y-4 p-4 md:p-8">
        <p className="text-sm text-muted-foreground">{assetTypes.length} {text.configured}</p>
        <Card>
          <CardContent className="p-0">
            {loading ? (
              <div className="flex min-h-48 items-center justify-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />{text.loading}</div>
            ) : assetTypes.length === 0 ? (
              <div className="p-8 text-center text-sm text-muted-foreground">{text.empty}</div>
            ) : (
              <Table>
                <TableHeader><TableRow><TableHead>{text.name}</TableHead><TableHead>{text.category}</TableHead><TableHead>{text.descriptionLabel}</TableHead><TableHead>{text.status}</TableHead><TableHead className="text-right">{text.actions}</TableHead></TableRow></TableHeader>
                <TableBody>{assetTypes.map((type) => (
                  <TableRow key={type.id}>
                    <TableCell className="font-medium">{type.name}</TableCell>
                    <TableCell><div className="flex items-center gap-2">{categoryIcon(type.category)}<span>{categoryLabel(type.category)}</span></div></TableCell>
                    <TableCell className="max-w-md text-sm text-muted-foreground">{type.description || "—"}</TableCell>
                    <TableCell><Badge variant={type.is_active ? "default" : "outline"}>{type.is_active ? text.active : text.inactive}</Badge></TableCell>
                    <TableCell className="text-right"><div className="flex justify-end gap-1"><Button variant="ghost" size="icon" onClick={() => openForm(type)} aria-label={text.editTitle}><Pencil className="h-4 w-4" /></Button><Button variant="ghost" size="icon" onClick={() => setDeleteTarget(type)} aria-label={text.deleteTitle}><Trash2 className="h-4 w-4" /></Button></div></TableCell>
                  </TableRow>
                ))}</TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={dialogOpen} onOpenChange={(open) => !saving && setDialogOpen(open)}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{editingType ? text.editTitle : text.addTitle}</DialogTitle><DialogDescription>{text.dialogDescription}</DialogDescription></DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2"><Label htmlFor="asset-type-name">{text.name}</Label><Input id="asset-type-name" value={formData.name} onChange={(event) => setFormData({ ...formData, name: event.target.value })} placeholder={text.namePlaceholder} required maxLength={120} /></div>
            <div className="space-y-2"><Label>{text.category}</Label><Select value={formData.category} onValueChange={(value: AssetType["category"]) => setFormData({ ...formData, category: value })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="internet">{text.internet}</SelectItem><SelectItem value="water">{text.water}</SelectItem><SelectItem value="electricity">{text.electricity}</SelectItem></SelectContent></Select></div>
            <div className="space-y-2"><Label htmlFor="asset-type-description">{text.descriptionLabel}</Label><Textarea id="asset-type-description" value={formData.description} onChange={(event) => setFormData({ ...formData, description: event.target.value })} placeholder={text.descriptionPlaceholder} rows={3} maxLength={500} /></div>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={formData.is_active} onChange={(event) => setFormData({ ...formData, is_active: event.target.checked })} className="h-4 w-4 rounded border" />{text.activeHelp}</label>
            <div className="flex justify-end gap-2"><Button type="button" variant="outline" onClick={() => setDialogOpen(false)} disabled={saving}>{text.cancel}</Button><Button type="submit" disabled={saving || !formData.name.trim()}>{saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{saving ? text.saving : text.save}</Button></div>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={Boolean(deleteTarget)} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent><AlertDialogHeader><AlertDialogTitle>{text.deleteTitle}</AlertDialogTitle><AlertDialogDescription>{text.deleteDescription}</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>{text.cancel}</AlertDialogCancel><AlertDialogAction onClick={() => void handleDelete()}>{text.delete}</AlertDialogAction></AlertDialogFooter></AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  )
}
