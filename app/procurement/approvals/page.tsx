"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { ArrowLeft, CheckCircle2, LogOut, ShieldCheck, XCircle } from "lucide-react"
import { toast } from "sonner"
import { AppLayout } from "@/components/app-layout"
import { PageHeader } from "@/components/page-header"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { useEffectiveAccess } from "@/lib/hooks/use-effective-access"
import { useLanguage } from "@/lib/hooks/use-language"
import { createBrowserClient } from "@/lib/supabase/client"

interface ProcurementRequest { id: string; request_number: string | null; title: string; description: string | null; business_justification: string; category: string; quantity: number; unit: string; estimated_budget_clp: number | null; priority: string; status: string; required_date: string | null; commune: string; delivery_location: string | null; requested_by: string; created_at: string }
const LOCALES = { en: "en-US", es: "es-CL", de: "de-DE" } as const
const COPY = {
  en: { title: "Procurement approvals", description: "Human decisions with monetary limits and traceability", requests: "Requests", logout: "Log out", loggedOut: "Logged out", logoutFailed: "Could not log out.", restricted: "Restricted access", restrictedDetail: "Your profile cannot manage procurement within the assigned scope.", roleRequired: "Approval role required", roleRequiredDetail: "In addition to Procurement permission, this queue requires the operational role `approver` or `admin`.", genericError: "The procurement approval operation could not be completed.", pending: "Pending", queueAmount: "Queue amount", overLimit: "Above your limit", reviewQueue: "Review queue", approverLimit: "Approver limit", noOperationalLimit: "no operational limit", number: "Number", request: "Request", category: "Category", budget: "Budget", commune: "Commune", priority: "Priority", action: "Action", loading: "Loading…", empty: "No requests are pending.", review: "Review", reviewRequest: "Review request", quantity: "Quantity", delivery: "Delivery", noDate: "no date", justification: "Justification", requestDescription: "Description", decisionNotes: "Decision notes", notesPlaceholder: "Rationale, conditions or rejection reason", limitWarning: "The amount exceeds your approval limit. You may reject it, but not approve it.", reject: "Reject", approve: "Approve", noPermission: "You do not currently have permission to decide procurement requests.", rejectionReason: "A rejection reason is required.", exceedsLimit: "The request exceeds your approval limit.", noBudget: "No budget" },
  es: { title: "Aprobaciones de Compras", description: "Decisiones humanas con límite monetario y trazabilidad", requests: "Solicitudes", logout: "Cerrar sesión", loggedOut: "Sesión cerrada", logoutFailed: "No fue posible cerrar la sesión.", restricted: "Acceso restringido", restrictedDetail: "Tu perfil no tiene permiso para administrar compras dentro del alcance asignado.", roleRequired: "Rol de aprobación requerido", roleRequiredDetail: "Además del permiso de Compras, esta cola exige el rol operativo `approver` o `admin`.", genericError: "No fue posible completar la operación de aprobación de Compras.", pending: "Pendientes", queueAmount: "Monto en cola", overLimit: "Fuera de tu límite", reviewQueue: "Cola de revisión", approverLimit: "Límite del aprobador", noOperationalLimit: "sin límite operativo", number: "Número", request: "Solicitud", category: "Categoría", budget: "Presupuesto", commune: "Comuna", priority: "Prioridad", action: "Acción", loading: "Cargando…", empty: "No hay solicitudes pendientes.", review: "Revisar", reviewRequest: "Revisar solicitud", quantity: "Cantidad", delivery: "Entrega", noDate: "sin fecha", justification: "Justificación", requestDescription: "Descripción", decisionNotes: "Notas de decisión", notesPlaceholder: "Fundamento, condiciones o motivo de rechazo", limitWarning: "El monto supera tu límite. Puedes rechazar, pero no aprobar.", reject: "Rechazar", approve: "Aprobar", noPermission: "No tienes permiso vigente para decidir solicitudes de compra.", rejectionReason: "Debes registrar el motivo del rechazo.", exceedsLimit: "La solicitud supera tu límite de aprobación.", noBudget: "Sin presupuesto" },
  de: { title: "Beschaffungsfreigaben", description: "Menschliche Entscheidungen mit Betragsgrenzen und Nachvollziehbarkeit", requests: "Anforderungen", logout: "Abmelden", loggedOut: "Abgemeldet", logoutFailed: "Abmeldung nicht möglich.", restricted: "Zugriff eingeschränkt", restrictedDetail: "Dein Profil darf die Beschaffung im zugewiesenen Bereich nicht verwalten.", roleRequired: "Freigaberolle erforderlich", roleRequiredDetail: "Zusätzlich zur Beschaffungsberechtigung benötigt diese Warteschlange die operative Rolle `approver` oder `admin`.", genericError: "Die Beschaffungsfreigabe konnte nicht abgeschlossen werden.", pending: "Ausstehend", queueAmount: "Betrag in Warteschlange", overLimit: "Über deinem Limit", reviewQueue: "Prüfwarteschlange", approverLimit: "Freigabelimit", noOperationalLimit: "kein operatives Limit", number: "Nummer", request: "Anforderung", category: "Kategorie", budget: "Budget", commune: "Kommune", priority: "Priorität", action: "Aktion", loading: "Wird geladen…", empty: "Keine Anforderungen zur Freigabe ausstehend.", review: "Prüfen", reviewRequest: "Anforderung prüfen", quantity: "Menge", delivery: "Lieferung", noDate: "kein Datum", justification: "Begründung", requestDescription: "Beschreibung", decisionNotes: "Entscheidungsnotizen", notesPlaceholder: "Begründung, Bedingungen oder Ablehnungsgrund", limitWarning: "Der Betrag überschreitet dein Limit. Du kannst ablehnen, aber nicht freigeben.", reject: "Ablehnen", approve: "Freigeben", noPermission: "Du hast derzeit keine Berechtigung, Beschaffungsanforderungen zu entscheiden.", rejectionReason: "Für eine Ablehnung ist ein Grund erforderlich.", exceedsLimit: "Die Anforderung überschreitet dein Freigabelimit.", noBudget: "Kein Budget" },
} as const
const PRIORITY = { en: { low: "Low", normal: "Normal", medium: "Medium", high: "High", critical: "Critical", urgent: "Urgent" }, es: { low: "Baja", normal: "Normal", medium: "Media", high: "Alta", critical: "Crítica", urgent: "Urgente" }, de: { low: "Niedrig", normal: "Normal", medium: "Mittel", high: "Hoch", critical: "Kritisch", urgent: "Dringend" } } as const

export default function ProcurementApprovalsPage() {
  const { language } = useLanguage()
  const lang = (language in COPY ? language : "en") as keyof typeof COPY
  const copy = COPY[lang]
  const locale = LOCALES[lang]
  const [requests, setRequests] = useState<ProcurementRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [processing, setProcessing] = useState(false)
  const [selected, setSelected] = useState<ProcurementRequest | null>(null)
  const [notes, setNotes] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [role, setRole] = useState<string | null>(null)
  const [approvalLimit, setApprovalLimit] = useState(0)
  const router = useRouter()
  const supabase = useMemo(() => createBrowserClient(), [])
  const { loading: accessLoading, error: accessError, can, canAccessDepartment } = useEffectiveAccess()
  const hasProcurementAccess = !accessLoading && !accessError && can("procurement.manage") && canAccessDepartment("procurement")
  const canApprove = hasProcurementAccess && (role === "approver" || role === "admin")
  const money = (value: number | null) => value === null ? copy.noBudget : new Intl.NumberFormat(locale, { style: "currency", currency: "CLP", maximumFractionDigits: 0 }).format(value)
  const href = (path: string) => `/${lang}${path}`

  const handleLogout = async () => {
    try { await supabase.auth.signOut(); toast.success(copy.loggedOut); router.push(href("/auth/login")) }
    catch (logoutError) { console.error("procurement logout failed", logoutError); toast.error(copy.logoutFailed) }
  }

  const loadQueue = useCallback(async () => {
    if (accessLoading) return
    setLoading(true); setError(null)
    if (!hasProcurementAccess) { setRequests([]); setLoading(false); return }
    const { data: userData } = await supabase.auth.getUser()
    const metadata = userData.user?.app_metadata ?? {}
    const currentRole = typeof metadata.procurement_role === "string" ? metadata.procurement_role : null
    const parsedLimit = currentRole === "admin" ? Number.MAX_SAFE_INTEGER : Number(metadata.procurement_approval_limit_clp ?? 0)
    setRole(currentRole); setApprovalLimit(Number.isFinite(parsedLimit) ? parsedLimit : 0)
    if (currentRole !== "approver" && currentRole !== "admin") { setRequests([]); setLoading(false); return }
    const { data, error: queueError } = await supabase.from("procurement_requests").select("id, request_number, title, description, business_justification, category, quantity, unit, estimated_budget_clp, priority, status, required_date, commune, delivery_location, requested_by, created_at").in("status", ["submitted", "under_review"]).order("created_at", { ascending: true })
    if (queueError) { console.error("procurement approvals load failed", queueError); setError(copy.genericError); setRequests([]) } else setRequests((data ?? []) as ProcurementRequest[])
    setLoading(false)
  }, [accessLoading, copy.genericError, hasProcurementAccess, supabase])

  useEffect(() => { void loadQueue() }, [loadQueue])
  useEffect(() => { if (!canApprove) { setSelected(null); setNotes("") } }, [canApprove])
  const summary = useMemo(() => ({ pending: requests.length, total: requests.reduce((sum, request) => sum + (request.estimated_budget_clp ?? 0), 0), overLimit: requests.filter((request) => (request.estimated_budget_clp ?? 0) > approvalLimit).length }), [approvalLimit, requests])

  const decide = async (decision: "approved" | "rejected") => {
    if (!selected || !canApprove) { setError(copy.noPermission); setSelected(null); return }
    if (decision === "rejected" && !notes.trim()) return setError(copy.rejectionReason)
    if (decision === "approved" && (selected.estimated_budget_clp ?? 0) > approvalLimit && role !== "admin") return setError(copy.exceedsLimit)
    setProcessing(true); setError(null)
    const { error: decisionError } = await supabase.rpc("decide_procurement_request", { p_request_id: selected.id, p_decision: decision, p_notes: notes.trim() || null })
    if (decisionError) { console.error("procurement approval decision failed", decisionError); setError(copy.genericError); setProcessing(false); return }
    setSelected(null); setNotes(""); setProcessing(false); await loadQueue()
  }

  return <AppLayout>
    <PageHeader title={copy.title} description={copy.description} actions={<div className="flex gap-2"><Button variant="outline" asChild><Link href={href("/procurement/requests")}><ArrowLeft className="mr-2 h-4 w-4" />{copy.requests}</Link></Button><Button variant="ghost" onClick={handleLogout} className="text-slate-400 hover:text-white"><LogOut className="mr-2 h-4 w-4" />{copy.logout}</Button></div>} />
    <div className="space-y-6 p-4 md:p-6 lg:p-8">
      {!accessLoading && !hasProcurementAccess && <Card className="border-amber-500/40"><CardHeader><CardTitle className="flex items-center gap-2 text-amber-500"><ShieldCheck className="h-5 w-5" />{copy.restricted}</CardTitle><CardDescription>{copy.restrictedDetail}</CardDescription></CardHeader></Card>}
      {hasProcurementAccess && !canApprove && <Card className="border-amber-500/40"><CardHeader><CardTitle className="flex items-center gap-2 text-amber-500"><ShieldCheck className="h-5 w-5" />{copy.roleRequired}</CardTitle><CardDescription>{copy.roleRequiredDetail}</CardDescription></CardHeader></Card>}
      {error && <Card className="border-red-500/40"><CardContent className="pt-6 text-sm text-red-500">{error}</CardContent></Card>}
      {canApprove && <><div className="grid gap-4 md:grid-cols-3"><Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">{copy.pending}</CardTitle></CardHeader><CardContent className="text-3xl font-bold">{new Intl.NumberFormat(locale).format(summary.pending)}</CardContent></Card><Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">{copy.queueAmount}</CardTitle></CardHeader><CardContent className="text-2xl font-bold">{money(summary.total)}</CardContent></Card><Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">{copy.overLimit}</CardTitle></CardHeader><CardContent className="text-3xl font-bold">{new Intl.NumberFormat(locale).format(summary.overLimit)}</CardContent></Card></div>
      <Card><CardHeader><CardTitle>{copy.reviewQueue}</CardTitle><CardDescription>{copy.approverLimit}: {role === "admin" ? copy.noOperationalLimit : money(approvalLimit)}.</CardDescription></CardHeader><CardContent><div className="overflow-x-auto rounded-lg border"><Table><TableHeader><TableRow><TableHead>{copy.number}</TableHead><TableHead>{copy.request}</TableHead><TableHead>{copy.category}</TableHead><TableHead>{copy.budget}</TableHead><TableHead>{copy.commune}</TableHead><TableHead>{copy.priority}</TableHead><TableHead className="text-right">{copy.action}</TableHead></TableRow></TableHeader><TableBody>{loading ? <TableRow><TableCell colSpan={7} className="py-8 text-center text-muted-foreground">{copy.loading}</TableCell></TableRow> : requests.length === 0 ? <TableRow><TableCell colSpan={7} className="py-8 text-center text-muted-foreground">{copy.empty}</TableCell></TableRow> : requests.map((request) => { const exceedsLimit = (request.estimated_budget_clp ?? 0) > approvalLimit; const priority = PRIORITY[lang][request.priority as keyof (typeof PRIORITY)[typeof lang]] ?? request.priority; return <TableRow key={request.id}><TableCell className="font-mono text-xs">{request.request_number ?? "-"}</TableCell><TableCell className="font-medium">{request.title}</TableCell><TableCell>{request.category}</TableCell><TableCell className={exceedsLimit ? "text-red-500" : ""}>{money(request.estimated_budget_clp)}</TableCell><TableCell>{request.commune}</TableCell><TableCell><Badge variant="outline">{priority}</Badge></TableCell><TableCell className="text-right"><Button size="sm" variant="outline" onClick={() => { if (!canApprove) return; setSelected(request); setNotes(""); setError(null) }}>{copy.review}</Button></TableCell></TableRow> })}</TableBody></Table></div></CardContent></Card></>}
    </div>
    <Dialog open={!!selected && canApprove} onOpenChange={(open) => !open && setSelected(null)}><DialogContent className="max-w-2xl"><DialogHeader><DialogTitle>{copy.reviewRequest} {selected?.request_number}</DialogTitle></DialogHeader>{selected && <div className="space-y-4"><div className="grid gap-3 md:grid-cols-2"><div><p className="text-xs text-muted-foreground">{copy.request}</p><p className="font-medium">{selected.title}</p></div><div><p className="text-xs text-muted-foreground">{copy.budget}</p><p className="font-medium">{money(selected.estimated_budget_clp)}</p></div><div><p className="text-xs text-muted-foreground">{copy.quantity}</p><p>{new Intl.NumberFormat(locale).format(selected.quantity)} {selected.unit}</p></div><div><p className="text-xs text-muted-foreground">{copy.delivery}</p><p>{selected.commune} · {selected.required_date ?? copy.noDate}</p></div></div><div><p className="text-xs text-muted-foreground">{copy.justification}</p><p className="text-sm">{selected.business_justification}</p></div>{selected.description && <div><p className="text-xs text-muted-foreground">{copy.requestDescription}</p><p className="text-sm">{selected.description}</p></div>}<div><label className="text-sm font-medium">{copy.decisionNotes}</label><textarea value={notes} onChange={(event) => setNotes(event.target.value)} className="mt-1 min-h-24 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" placeholder={copy.notesPlaceholder} /></div>{(selected.estimated_budget_clp ?? 0) > approvalLimit && role !== "admin" && <p className="text-sm text-red-500">{copy.limitWarning}</p>}<div className="flex justify-end gap-2"><Button variant="destructive" disabled={processing || !canApprove} onClick={() => void decide("rejected")}><XCircle className="mr-2 h-4 w-4" />{copy.reject}</Button><Button disabled={processing || !canApprove || ((selected.estimated_budget_clp ?? 0) > approvalLimit && role !== "admin")} onClick={() => void decide("approved")}><CheckCircle2 className="mr-2 h-4 w-4" />{copy.approve}</Button></div></div>}</DialogContent></Dialog>
  </AppLayout>
}
