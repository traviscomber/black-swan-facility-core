"use client"

import { useEffect, useMemo, useState } from "react"
import { Check, ExternalLink, Pencil, Plus, RotateCcw, X } from "lucide-react"
import { AppLayout } from "@/components/app-layout"
import { PageHeader } from "@/components/page-header"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { createBrowserClient } from "@/lib/supabase/client"
import { useLanguage } from "@/lib/hooks/use-language"
import { AddSupplierDialog } from "@/components/add-supplier-dialog"
import { EditSupplierDialog } from "@/components/edit-supplier-dialog"
import { DeleteSupplierButton } from "@/components/delete-supplier-button"

interface Supplier { id: string; name: string; contact_name: string | null; email: string | null; phone: string | null; rut: string | null; address: string | null; commune: string | null; region: string | null; rating: number; is_active: boolean; notes: string | null; approval_status: "pending" | "approved" | "rejected"; category: string | null; website: string | null; source_url: string | null; coverage_notes: string | null; last_verified_at: string | null }
const APPROVER_EMAILS = new Set(["juan@n3uralia.com", "raimundo@blackswn.org", "santiago@blackswn.org"])
const LOCALES = { en: "en-US", es: "es-CL", de: "de-DE" } as const
const COPY = {
  en: { title: "Suppliers · Fundo Corcovado", description: "Supplier directory, review and enablement for the procurement flow.", add: "Add candidate", total: "Total registered", pending: "Pending review", approved: "Approved", rejected: "Rejected", loadError: "Suppliers could not be loaded.", updateError: "The supplier approval could not be updated.", retry: "Retry", directory: "Directory and review", directoryDetail: "Candidates remain inactive until approved. Approval automatically enables the supplier for procurement.", supplier: "Supplier", category: "Category", location: "Location", contact: "Contact", source: "Source", state: "Status", actions: "Actions", loading: "Loading suppliers…", empty: "No suppliers registered.", noCategory: "No category", notReported: "Not reported", noContact: "No assigned contact", reviewSource: "Review source", noSource: "No source recorded", verified: "Verified", approve: "Approve", reject: "Reject", returnReview: "Return to review", edit: "Edit", limited: "Your account may view and edit information, but cannot approve, reject or deactivate suppliers.", statusPending: "Pending", statusApproved: "Approved", statusRejected: "Rejected" },
  es: { title: "Proveedores · Fundo Corcovado", description: "Directorio, revisión y habilitación de proveedores para el flujo de compras.", add: "Agregar candidato", total: "Total registrados", pending: "Pendientes de revisión", approved: "Aprobados", rejected: "Rechazados", loadError: "No fue posible cargar los proveedores.", updateError: "No fue posible actualizar la aprobación del proveedor.", retry: "Reintentar", directory: "Directorio y revisión", directoryDetail: "Los candidatos permanecen inactivos hasta ser aprobados. La aprobación activa automáticamente al proveedor para compras.", supplier: "Proveedor", category: "Categoría", location: "Ubicación", contact: "Contacto", source: "Fuente", state: "Estado", actions: "Acciones", loading: "Cargando proveedores…", empty: "No hay proveedores registrados.", noCategory: "Sin categoría", notReported: "No informada", noContact: "Sin contacto asignado", reviewSource: "Revisar fuente", noSource: "Sin fuente registrada", verified: "Verificado", approve: "Aprobar", reject: "Rechazar", returnReview: "Devolver a revisión", edit: "Editar", limited: "Tu cuenta puede consultar y editar información, pero no aprobar, rechazar ni desactivar proveedores.", statusPending: "Pendiente", statusApproved: "Aprobado", statusRejected: "Rechazado" },
  de: { title: "Lieferanten · Fundo Corcovado", description: "Lieferantenverzeichnis, Prüfung und Freigabe für den Beschaffungsprozess.", add: "Kandidat hinzufügen", total: "Gesamt erfasst", pending: "Prüfung ausstehend", approved: "Freigegeben", rejected: "Abgelehnt", loadError: "Lieferanten konnten nicht geladen werden.", updateError: "Die Lieferantenfreigabe konnte nicht aktualisiert werden.", retry: "Erneut versuchen", directory: "Verzeichnis und Prüfung", directoryDetail: "Kandidaten bleiben bis zur Freigabe inaktiv. Die Freigabe aktiviert den Lieferanten automatisch für die Beschaffung.", supplier: "Lieferant", category: "Kategorie", location: "Standort", contact: "Kontakt", source: "Quelle", state: "Status", actions: "Aktionen", loading: "Lieferanten werden geladen…", empty: "Keine Lieferanten erfasst.", noCategory: "Keine Kategorie", notReported: "Nicht angegeben", noContact: "Kein Kontakt zugewiesen", reviewSource: "Quelle prüfen", noSource: "Keine Quelle erfasst", verified: "Geprüft", approve: "Freigeben", reject: "Ablehnen", returnReview: "Zur Prüfung zurückgeben", edit: "Bearbeiten", limited: "Dein Konto darf Informationen ansehen und bearbeiten, aber Lieferanten nicht freigeben, ablehnen oder deaktivieren.", statusPending: "Ausstehend", statusApproved: "Freigegeben", statusRejected: "Abgelehnt" },
} as const

export default function SuppliersPage() {
  const { language } = useLanguage()
  const lang = (language in COPY ? language : "en") as keyof typeof COPY
  const copy = COPY[lang]
  const locale = LOCALES[lang]
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showAddDialog, setShowAddDialog] = useState(false)
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null)
  const [updatingId, setUpdatingId] = useState<string | null>(null)
  const [canApprove, setCanApprove] = useState(false)

  const loadSuppliers = async () => {
    setLoading(true); setError(null)
    const supabase = createBrowserClient()
    const [{ data, error: suppliersError }, { data: authData }] = await Promise.all([
      supabase.from("suppliers").select("id, name, contact_name, email, phone, rut, address, commune, region, rating, is_active, notes, approval_status, category, website, source_url, coverage_notes, last_verified_at").order("approval_status").order("name"),
      supabase.auth.getUser(),
    ])
    if (suppliersError) { console.error("supplier directory load failed", suppliersError); setError(copy.loadError); setSuppliers([]) } else setSuppliers((data ?? []) as Supplier[])
    const user = authData.user; const email = user?.email?.toLowerCase() ?? ""; const role = user?.app_metadata?.procurement_role
    setCanApprove(APPROVER_EMAILS.has(email) && (role === "approver" || role === "admin")); setLoading(false)
  }

  useEffect(() => { void loadSuppliers() }, [copy.loadError])
  const counts = useMemo(() => ({ total: suppliers.length, pending: suppliers.filter((s) => s.approval_status === "pending").length, approved: suppliers.filter((s) => s.approval_status === "approved").length, rejected: suppliers.filter((s) => s.approval_status === "rejected").length }), [suppliers])
  const number = useMemo(() => new Intl.NumberFormat(locale), [locale])
  const statusLabel = (status: Supplier["approval_status"]) => status === "pending" ? copy.statusPending : status === "approved" ? copy.statusApproved : copy.statusRejected

  const updateApproval = async (supplier: Supplier, nextStatus: Supplier["approval_status"]) => {
    setUpdatingId(supplier.id); setError(null)
    const supabase = createBrowserClient()
    const { error: approvalError } = await supabase.rpc("set_supplier_approval", { supplier_id: supplier.id, next_status: nextStatus })
    if (approvalError) { console.error("supplier approval update failed", approvalError); setError(copy.updateError); setUpdatingId(null); return }
    await loadSuppliers(); setUpdatingId(null)
  }

  return <AppLayout><PageHeader title={copy.title} description={copy.description} actions={<Button onClick={() => setShowAddDialog(true)}><Plus className="mr-2 h-4 w-4" />{copy.add}</Button>} />
    <div className="space-y-6 p-4 sm:p-8">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><Metric title={copy.total} value={counts.total} locale={locale} /><Metric title={copy.pending} value={counts.pending} alert={counts.pending > 0} locale={locale} /><Metric title={copy.approved} value={counts.approved} locale={locale} /><Metric title={copy.rejected} value={counts.rejected} locale={locale} /></div>
      {error && <Card className="border-destructive/60"><CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between"><p className="text-sm text-destructive">{error}</p><Button variant="outline" size="sm" onClick={() => void loadSuppliers()}>{copy.retry}</Button></CardContent></Card>}
      <Card><CardHeader><CardTitle>{copy.directory}</CardTitle><CardDescription>{copy.directoryDetail}</CardDescription></CardHeader><CardContent><div className="overflow-x-auto rounded-lg border"><Table><TableHeader><TableRow><TableHead>{copy.supplier}</TableHead><TableHead>{copy.category}</TableHead><TableHead>{copy.location}</TableHead><TableHead>{copy.contact}</TableHead><TableHead>{copy.source}</TableHead><TableHead>{copy.state}</TableHead><TableHead className="text-right">{copy.actions}</TableHead></TableRow></TableHeader><TableBody>
        {loading ? <TableRow><TableCell colSpan={7} className="py-8 text-center text-muted-foreground">{copy.loading}</TableCell></TableRow> : suppliers.length === 0 ? <TableRow><TableCell colSpan={7} className="py-8 text-center text-muted-foreground">{copy.empty}</TableCell></TableRow> : suppliers.map((supplier) => <TableRow key={supplier.id}><TableCell className="min-w-64 align-top"><p className="font-medium">{supplier.name}</p>{supplier.rut && <p className="mt-1 text-xs text-muted-foreground">RUT: {supplier.rut}</p>}{supplier.coverage_notes && <p className="mt-1 max-w-sm text-xs leading-relaxed text-muted-foreground">{supplier.coverage_notes}</p>}{supplier.last_verified_at && <p className="mt-2 text-[11px] text-muted-foreground">{copy.verified}: {new Intl.DateTimeFormat(locale, { timeZone: "America/Santiago" }).format(new Date(supplier.last_verified_at))}</p>}</TableCell><TableCell className="align-top text-sm">{supplier.category || copy.noCategory}</TableCell><TableCell className="align-top text-sm">{[supplier.commune, supplier.region].filter(Boolean).join(", ") || copy.notReported}</TableCell><TableCell className="align-top text-sm"><div className="space-y-1"><p>{supplier.contact_name || copy.noContact}</p>{supplier.email && <p className="text-muted-foreground">{supplier.email}</p>}{supplier.phone && <p className="text-muted-foreground">{supplier.phone}</p>}</div></TableCell><TableCell className="align-top">{supplier.source_url || supplier.website ? <a href={supplier.source_url || supplier.website || "#"} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-sm text-primary hover:underline">{copy.reviewSource} <ExternalLink className="h-3.5 w-3.5" /></a> : <span className="text-sm text-muted-foreground">{copy.noSource}</span>}</TableCell><TableCell className="align-top"><Badge variant="outline">{statusLabel(supplier.approval_status)}</Badge></TableCell><TableCell className="align-top text-right"><div className="flex min-w-max items-center justify-end gap-1">{canApprove && supplier.approval_status !== "approved" && <Button size="sm" variant="ghost" disabled={updatingId === supplier.id} onClick={() => void updateApproval(supplier, "approved")} title={copy.approve}><Check className="h-4 w-4" /></Button>}{canApprove && supplier.approval_status !== "rejected" && <Button size="sm" variant="ghost" disabled={updatingId === supplier.id} onClick={() => void updateApproval(supplier, "rejected")} title={copy.reject}><X className="h-4 w-4" /></Button>}{canApprove && supplier.approval_status !== "pending" && <Button size="sm" variant="ghost" disabled={updatingId === supplier.id} onClick={() => void updateApproval(supplier, "pending")} title={copy.returnReview}><RotateCcw className="h-4 w-4" /></Button>}<Button variant="ghost" size="sm" onClick={() => setEditingSupplier(supplier)} title={copy.edit}><Pencil className="h-4 w-4" /></Button>{canApprove && <DeleteSupplierButton supplierId={supplier.id} supplierName={supplier.name} onDeleted={() => void loadSuppliers()} />}</div></TableCell></TableRow>)}
      </TableBody></Table></div>{!canApprove && !loading && <p className="mt-4 text-xs text-muted-foreground">{copy.limited}</p>}</CardContent></Card>
    </div>
    <AddSupplierDialog open={showAddDialog} onOpenChange={setShowAddDialog} onSupplierAdded={() => { void loadSuppliers(); setShowAddDialog(false) }} />
    {editingSupplier && <EditSupplierDialog supplier={editingSupplier} open={!!editingSupplier} onOpenChange={(open) => !open && setEditingSupplier(null)} onSupplierUpdated={() => { void loadSuppliers(); setEditingSupplier(null) }} />}
  </AppLayout>
}
function Metric({ title, value, alert=false, locale }: { title:string; value:number; alert?:boolean; locale:string }) { return <Card className={alert ? "border-amber-300" : undefined}><CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle></CardHeader><CardContent><div className="text-3xl font-semibold">{new Intl.NumberFormat(locale).format(value)}</div></CardContent></Card> }
