"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { ArrowLeft, CheckCircle2, Loader2, ShieldCheck, Store } from "lucide-react"
import { AppLayout } from "@/components/app-layout"
import { PageHeader } from "@/components/page-header"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { useLanguage } from "@/lib/hooks/use-language"
import { createBrowserClient } from "@/lib/supabase/client"

type RequestSummary = { status: string; requested_by: string }
type Supplier = { id: string; name: string; approval_status: string; is_active: boolean; email: string | null; source_url: string | null }

type Locale = "en" | "es" | "de"
const COPY = {
  en: {
    title: "Orchard sourcing approval",
    description: "Move the 2026/27 seed plan from submitted requests to quotation without bypassing segregation of duties.",
    back: "Procurement approvals",
    requests: "Orchard requests",
    suppliers: "Seed supplier candidates",
    pending: "Pending approval",
    approved: "Approved for sourcing",
    supplierReady: "Approved suppliers",
    approveSuppliers: "Approve both supplier candidates",
    approvingSuppliers: "Approving suppliers…",
    approveBatch: "Approve Orchard requests for quotation",
    approvingBatch: "Approving requests…",
    selfBlocked: "This session created the Orchard requests. Self-approval is blocked by policy; a different Procurement approver must use this page.",
    sourceRule: "Supplier approval only makes the vendor eligible to quote. It does not confirm cultivar availability, stock, price, terms or purchase.",
    requestRule: "Request approval only unlocks sourcing. Purchase orders still require quotations, comparison and final approval.",
    supplierDone: "Supplier candidates are approved and active for quotation.",
    requestDone: "Orchard requests were approved for sourcing.",
    error: "The sourcing approval action could not be completed.",
  },
  es: {
    title: "Aprobación de sourcing Orchard",
    description: "Mover el plan de semillas 2026/27 desde solicitudes enviadas a cotización sin saltar la segregación de funciones.",
    back: "Aprobaciones de Compras",
    requests: "Solicitudes Orchard",
    suppliers: "Candidatos de proveedores de semillas",
    pending: "Pendientes de aprobación",
    approved: "Aprobadas para sourcing",
    supplierReady: "Proveedores aprobados",
    approveSuppliers: "Aprobar ambos proveedores candidatos",
    approvingSuppliers: "Aprobando proveedores…",
    approveBatch: "Aprobar solicitudes Orchard para cotización",
    approvingBatch: "Aprobando solicitudes…",
    selfBlocked: "Esta sesión creó las solicitudes Orchard. La autoaprobación está bloqueada por política; un aprobador de Compras distinto debe usar esta página.",
    sourceRule: "Aprobar proveedor sólo lo habilita para cotizar. No confirma cultivar, stock, precio, condiciones ni compra.",
    requestRule: "Aprobar la solicitud sólo habilita sourcing. La orden de compra aún requiere cotizaciones, comparación y aprobación final.",
    supplierDone: "Los proveedores candidatos quedaron aprobados y activos para cotizar.",
    requestDone: "Las solicitudes Orchard quedaron aprobadas para sourcing.",
    error: "No fue posible completar la acción de aprobación de sourcing.",
  },
  de: {
    title: "Orchard-Sourcing-Freigabe",
    description: "Den Saatgutplan 2026/27 von eingereichten Anforderungen zur Angebotsphase bewegen, ohne Funktionstrennung zu umgehen.",
    back: "Beschaffungsfreigaben",
    requests: "Orchard-Anforderungen",
    suppliers: "Saatgut-Lieferantenkandidaten",
    pending: "Freigabe ausstehend",
    approved: "Für Sourcing freigegeben",
    supplierReady: "Freigegebene Lieferanten",
    approveSuppliers: "Beide Lieferantenkandidaten freigeben",
    approvingSuppliers: "Lieferanten werden freigegeben…",
    approveBatch: "Orchard-Anforderungen für Angebote freigeben",
    approvingBatch: "Anforderungen werden freigegeben…",
    selfBlocked: "Diese Sitzung hat die Orchard-Anforderungen erstellt. Selbstfreigabe ist gesperrt; ein anderer Beschaffungsfreigeber muss diese Seite verwenden.",
    sourceRule: "Lieferantenfreigabe macht den Anbieter nur angebotsberechtigt. Sorte, Bestand, Preis, Bedingungen und Kauf bleiben unbestätigt.",
    requestRule: "Anforderungsfreigabe öffnet nur das Sourcing. Bestellungen benötigen weiterhin Angebote, Vergleich und Endfreigabe.",
    supplierDone: "Die Lieferantenkandidaten sind für Angebote freigegeben und aktiv.",
    requestDone: "Die Orchard-Anforderungen wurden für Sourcing freigegeben.",
    error: "Die Sourcing-Freigabe konnte nicht abgeschlossen werden.",
  },
} as const

const CANDIDATE_NAMES = ["Anasac Agropecuario", "Cooprinsem Valdivia"] as const

export default function OrchardSourcingApprovalPage() {
  const supabase = useMemo(() => createBrowserClient(), [])
  const { language } = useLanguage()
  const lang = (language in COPY ? language : "en") as Locale
  const copy = COPY[lang]
  const href = (path: string) => `/${lang}${path}`
  const [requests, setRequests] = useState<RequestSummary[]>([])
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [userId, setUserId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [working, setWorking] = useState<"suppliers" | "requests" | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    const [{ data: auth }, { data: req, error: reqError }, { data: supplierRows, error: supplierError }] = await Promise.all([
      supabase.auth.getUser(),
      supabase.from("procurement_requests").select("status,requested_by").eq("source_type", "orchard_seed_plan"),
      supabase.from("suppliers").select("id,name,approval_status,is_active,email,source_url").in("name", [...CANDIDATE_NAMES]),
    ])
    if (reqError || supplierError) {
      console.error("orchard sourcing approval load failed", reqError ?? supplierError)
      setError(copy.error)
      setLoading(false)
      return
    }
    setUserId(auth.user?.id ?? null)
    setRequests((req ?? []) as RequestSummary[])
    setSuppliers((supplierRows ?? []) as Supplier[])
    setLoading(false)
  }, [copy.error, supabase])

  useEffect(() => { void load() }, [load])

  const pendingRequests = requests.filter((row) => ["submitted", "under_review"].includes(row.status))
  const approvedRequests = requests.filter((row) => ["approved", "approved_for_quotation", "converted"].includes(row.status))
  const selfBlocked = Boolean(userId && pendingRequests.some((row) => row.requested_by === userId))
  const approvedSuppliers = suppliers.filter((row) => row.approval_status === "approved" && row.is_active)
  const pendingSuppliers = suppliers.filter((row) => row.approval_status !== "approved" || !row.is_active)

  const approveSuppliers = async () => {
    if (working || pendingSuppliers.length === 0) return
    setWorking("suppliers"); setError(null); setMessage(null)
    for (const supplier of pendingSuppliers) {
      const { error: rpcError } = await supabase.rpc("set_supplier_approval", { supplier_id: supplier.id, next_status: "approved" })
      if (rpcError) {
        console.error("orchard supplier approval failed", rpcError)
        setError(copy.error); setWorking(null); return
      }
    }
    setMessage(copy.supplierDone); setWorking(null); await load()
  }

  const approveRequests = async () => {
    if (working || pendingRequests.length === 0 || selfBlocked) return
    setWorking("requests"); setError(null); setMessage(null)
    const { error: rpcError } = await supabase.rpc("approve_orchard_seed_requests_bulk", {
      p_notes: "Bulk approval for sourcing: Orchard 2026/27 seed procurement. Supplier, price and purchase order remain subject to sourcing and final approval.",
    })
    if (rpcError) {
      console.error("orchard bulk request approval failed", rpcError)
      setError(rpcError.message || copy.error); setWorking(null); return
    }
    setMessage(copy.requestDone); setWorking(null); await load()
  }

  return <AppLayout>
    <PageHeader title={copy.title} description={copy.description} actions={<Button variant="outline" asChild><Link href={href("/procurement/approvals")}><ArrowLeft className="mr-2 h-4 w-4"/>{copy.back}</Link></Button>} />
    <main className="space-y-6 p-4 md:p-6 lg:p-8">
      {error ? <Card className="border-red-500/40"><CardContent className="pt-6 text-sm text-red-400">{error}</CardContent></Card> : null}
      {message ? <Card className="border-emerald-500/40"><CardContent className="flex items-center gap-2 pt-6 text-sm text-emerald-300"><CheckCircle2 className="h-4 w-4"/>{message}</CardContent></Card> : null}
      {selfBlocked && pendingRequests.length > 0 ? <Card className="border-amber-500/40"><CardHeader><CardTitle className="flex items-center gap-2 text-amber-300"><ShieldCheck className="h-5 w-5"/>{copy.pending}</CardTitle><CardDescription>{copy.selfBlocked}</CardDescription></CardHeader></Card> : null}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>{copy.suppliers}</CardTitle><CardDescription>{copy.sourceRule}</CardDescription></CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between"><span className="text-sm text-muted-foreground">{copy.supplierReady}</span><span className="text-2xl font-semibold">{loading ? "…" : `${approvedSuppliers.length}/2`}</span></div>
            <div className="space-y-2">{suppliers.map((supplier) => <div key={supplier.id} className="flex items-center justify-between border-t border-border/60 pt-2 text-sm"><span>{supplier.name}</span><span className={supplier.approval_status === "approved" && supplier.is_active ? "text-emerald-300" : "text-amber-300"}>{supplier.approval_status}</span></div>)}</div>
            <Button className="w-full" onClick={() => void approveSuppliers()} disabled={loading || working !== null || pendingSuppliers.length === 0}>{working === "suppliers" ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Store className="mr-2 h-4 w-4"/>}{working === "suppliers" ? copy.approvingSuppliers : copy.approveSuppliers}</Button>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>{copy.requests}</CardTitle><CardDescription>{copy.requestRule}</CardDescription></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-3"><div><p className="text-xs text-muted-foreground">{copy.pending}</p><p className="mt-1 text-2xl font-semibold">{loading ? "…" : pendingRequests.length}</p></div><div><p className="text-xs text-muted-foreground">{copy.approved}</p><p className="mt-1 text-2xl font-semibold">{loading ? "…" : approvedRequests.length}</p></div></div>
            <Button className="w-full" onClick={() => void approveRequests()} disabled={loading || working !== null || pendingRequests.length === 0 || selfBlocked}>{working === "requests" ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <CheckCircle2 className="mr-2 h-4 w-4"/>}{working === "requests" ? copy.approvingBatch : `${copy.approveBatch} · ${pendingRequests.length}`}</Button>
          </CardContent>
        </Card>
      </div>
    </main>
  </AppLayout>
}
