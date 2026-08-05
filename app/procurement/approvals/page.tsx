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
import { createBrowserClient } from "@/lib/supabase/client"

interface ProcurementRequest {
  id: string
  request_number: string | null
  title: string
  description: string | null
  business_justification: string
  category: string
  quantity: number
  unit: string
  estimated_budget_clp: number | null
  priority: string
  status: string
  required_date: string | null
  commune: string
  delivery_location: string | null
  requested_by: string
  created_at: string
}

function formatClp(value: number | null) {
  if (value === null) return "Sin presupuesto"
  return new Intl.NumberFormat("es-CL", { style: "currency", currency: "CLP", maximumFractionDigits: 0 }).format(value)
}

export default function ProcurementApprovalsPage() {
  const [requests, setRequests] = useState<ProcurementRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [processing, setProcessing] = useState(false)
  const [selected, setSelected] = useState<ProcurementRequest | null>(null)
  const [notes, setNotes] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [role, setRole] = useState<string | null>(null)
  const [approvalLimit, setApprovalLimit] = useState<number>(0)
  const router = useRouter()
  const supabase = useMemo(() => createBrowserClient(), [])
  const { loading: accessLoading, error: accessError, can, canAccessDepartment } = useEffectiveAccess()

  const hasProcurementAccess = !accessLoading && !accessError && can("procurement.manage") && canAccessDepartment("procurement")
  const canApprove = hasProcurementAccess && (role === "approver" || role === "admin")

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut()
      toast.success("Logged out successfully")
      router.push("/auth/login")
    } catch (logoutError) {
      toast.error(logoutError instanceof Error ? logoutError.message : "Failed to logout")
    }
  }

  const loadQueue = useCallback(async () => {
    if (accessLoading) return
    setLoading(true)
    setError(null)

    if (!hasProcurementAccess) {
      setRequests([])
      setLoading(false)
      return
    }

    const { data: userData } = await supabase.auth.getUser()
    const metadata = userData.user?.app_metadata ?? {}
    const currentRole = typeof metadata.procurement_role === "string" ? metadata.procurement_role : null
    const rawLimit = metadata.procurement_approval_limit_clp
    const parsedLimit = currentRole === "admin" ? Number.MAX_SAFE_INTEGER : Number(rawLimit ?? 0)

    setRole(currentRole)
    setApprovalLimit(Number.isFinite(parsedLimit) ? parsedLimit : 0)

    if (currentRole !== "approver" && currentRole !== "admin") {
      setRequests([])
      setLoading(false)
      return
    }

    const { data, error: queueError } = await supabase
      .from("procurement_requests")
      .select("id, request_number, title, description, business_justification, category, quantity, unit, estimated_budget_clp, priority, status, required_date, commune, delivery_location, requested_by, created_at")
      .in("status", ["submitted", "under_review"])
      .order("created_at", { ascending: true })

    if (queueError) {
      setError(queueError.message)
      setRequests([])
    } else {
      setRequests((data ?? []) as ProcurementRequest[])
    }
    setLoading(false)
  }, [accessLoading, hasProcurementAccess, supabase])

  useEffect(() => { void loadQueue() }, [loadQueue])
  useEffect(() => {
    if (!canApprove) {
      setSelected(null)
      setNotes("")
    }
  }, [canApprove])

  const summary = useMemo(() => ({
    pending: requests.length,
    total: requests.reduce((sum, request) => sum + (request.estimated_budget_clp ?? 0), 0),
    overLimit: requests.filter((request) => (request.estimated_budget_clp ?? 0) > approvalLimit).length,
  }), [approvalLimit, requests])

  const decide = async (decision: "approved" | "rejected") => {
    if (!selected || !canApprove) {
      setError("No tienes permiso vigente para decidir solicitudes de compra.")
      setSelected(null)
      return
    }
    if (decision === "rejected" && !notes.trim()) {
      setError("Debes registrar el motivo del rechazo.")
      return
    }
    if (decision === "approved" && (selected.estimated_budget_clp ?? 0) > approvalLimit && role !== "admin") {
      setError("La solicitud supera tu límite de aprobación.")
      return
    }

    setProcessing(true)
    setError(null)
    const { error: decisionError } = await supabase.rpc("decide_procurement_request", {
      p_request_id: selected.id,
      p_decision: decision,
      p_notes: notes.trim() || null,
    })

    if (decisionError) {
      setError(decisionError.message)
      setProcessing(false)
      return
    }

    setSelected(null)
    setNotes("")
    setProcessing(false)
    await loadQueue()
  }

  return (
    <AppLayout>
      <PageHeader
        title="Aprobaciones de Compras"
        description="Decisiones humanas con límite monetario y trazabilidad"
        actions={<div className="flex gap-2"><Button variant="outline" asChild><Link href="/procurement/requests"><ArrowLeft className="mr-2 h-4 w-4" />Solicitudes</Link></Button><Button variant="ghost" onClick={handleLogout} className="text-slate-400 hover:text-white"><LogOut className="mr-2 h-4 w-4" />Logout</Button></div>}
      />

      <div className="space-y-6 p-4 md:p-6 lg:p-8">
        {!accessLoading && !hasProcurementAccess && <Card className="border-amber-500/40"><CardHeader><CardTitle className="flex items-center gap-2 text-amber-500"><ShieldCheck className="h-5 w-5" />Acceso restringido</CardTitle><CardDescription>Tu perfil no tiene permiso para administrar compras dentro del alcance asignado.</CardDescription></CardHeader></Card>}
        {hasProcurementAccess && !canApprove && <Card className="border-amber-500/40"><CardHeader><CardTitle className="flex items-center gap-2 text-amber-500"><ShieldCheck className="h-5 w-5" />Rol de aprobación requerido</CardTitle><CardDescription>Además del permiso de Compras, esta cola exige el rol operativo `approver` o `admin`.</CardDescription></CardHeader></Card>}
        {error && <Card className="border-red-500/40"><CardContent className="pt-6 text-sm text-red-500">{error}</CardContent></Card>}

        {canApprove && <>
          <div className="grid gap-4 md:grid-cols-3"><Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Pendientes</CardTitle></CardHeader><CardContent className="text-3xl font-bold">{summary.pending}</CardContent></Card><Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Monto en cola</CardTitle></CardHeader><CardContent className="text-2xl font-bold">{formatClp(summary.total)}</CardContent></Card><Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Fuera de tu límite</CardTitle></CardHeader><CardContent className="text-3xl font-bold">{summary.overLimit}</CardContent></Card></div>
          <Card><CardHeader><CardTitle>Cola de revisión</CardTitle><CardDescription>Límite del aprobador: {role === "admin" ? "sin límite operativo" : formatClp(approvalLimit)}.</CardDescription></CardHeader><CardContent><div className="overflow-x-auto rounded-lg border"><Table><TableHeader><TableRow><TableHead>Número</TableHead><TableHead>Solicitud</TableHead><TableHead>Categoría</TableHead><TableHead>Presupuesto</TableHead><TableHead>Comuna</TableHead><TableHead>Prioridad</TableHead><TableHead className="text-right">Acción</TableHead></TableRow></TableHeader><TableBody>{loading ? <TableRow><TableCell colSpan={7} className="py-8 text-center text-muted-foreground">Cargando...</TableCell></TableRow> : requests.length === 0 ? <TableRow><TableCell colSpan={7} className="py-8 text-center text-muted-foreground">No hay solicitudes pendientes.</TableCell></TableRow> : requests.map((request) => { const exceedsLimit = (request.estimated_budget_clp ?? 0) > approvalLimit; return <TableRow key={request.id}><TableCell className="font-mono text-xs">{request.request_number ?? "-"}</TableCell><TableCell className="font-medium">{request.title}</TableCell><TableCell>{request.category}</TableCell><TableCell className={exceedsLimit ? "text-red-500" : ""}>{formatClp(request.estimated_budget_clp)}</TableCell><TableCell>{request.commune}</TableCell><TableCell><Badge variant="outline">{request.priority}</Badge></TableCell><TableCell className="text-right"><Button size="sm" variant="outline" onClick={() => { if (!canApprove) return; setSelected(request); setNotes(""); setError(null) }}>Revisar</Button></TableCell></TableRow> })}</TableBody></Table></div></CardContent></Card>
        </>}
      </div>

      <Dialog open={!!selected && canApprove} onOpenChange={(open) => !open && setSelected(null)}><DialogContent className="max-w-2xl"><DialogHeader><DialogTitle>Revisar solicitud {selected?.request_number}</DialogTitle></DialogHeader>{selected && <div className="space-y-4"><div className="grid gap-3 md:grid-cols-2"><div><p className="text-xs text-muted-foreground">Solicitud</p><p className="font-medium">{selected.title}</p></div><div><p className="text-xs text-muted-foreground">Presupuesto</p><p className="font-medium">{formatClp(selected.estimated_budget_clp)}</p></div><div><p className="text-xs text-muted-foreground">Cantidad</p><p>{selected.quantity} {selected.unit}</p></div><div><p className="text-xs text-muted-foreground">Entrega</p><p>{selected.commune} · {selected.required_date ?? "sin fecha"}</p></div></div><div><p className="text-xs text-muted-foreground">Justificación</p><p className="text-sm">{selected.business_justification}</p></div>{selected.description && <div><p className="text-xs text-muted-foreground">Descripción</p><p className="text-sm">{selected.description}</p></div>}<div><label className="text-sm font-medium">Notas de decisión</label><textarea value={notes} onChange={(event) => setNotes(event.target.value)} className="mt-1 min-h-24 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" placeholder="Fundamento, condiciones o motivo de rechazo" /></div>{(selected.estimated_budget_clp ?? 0) > approvalLimit && role !== "admin" && <p className="text-sm text-red-500">El monto supera tu límite. Puedes rechazar, pero no aprobar.</p>}<div className="flex justify-end gap-2"><Button variant="destructive" disabled={processing || !canApprove} onClick={() => void decide("rejected")}><XCircle className="mr-2 h-4 w-4" />Rechazar</Button><Button disabled={processing || !canApprove || ((selected.estimated_budget_clp ?? 0) > approvalLimit && role !== "admin")} onClick={() => void decide("approved")}><CheckCircle2 className="mr-2 h-4 w-4" />Aprobar</Button></div></div>}</DialogContent></Dialog>
    </AppLayout>
  )
}
