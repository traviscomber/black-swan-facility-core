"use client"

import { useEffect, useMemo, useState } from "react"
import { Edit, Eye, FileText, Search, Trash2 } from "lucide-react"
import { toast } from "sonner"
import { InvoiceEditorModal } from "@/components/invoice-editor-modal"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { createClient } from "@/lib/supabase/client"
import { formatClp } from "@/lib/money"
import { useLanguage, type Language } from "@/lib/hooks/use-language"
import { fillInvoiceCopy, invoiceCopy } from "@/lib/translations/invoices"

type AppRole = "admin" | "approver" | "operator" | "viewer" | null
interface Invoice { id: string; reservation_id: string | null; invoice_number: string; invoice_date: string; due_date: string; customer_name: string; customer_email: string | null; total_amount: number; amount_paid: number | null; payment_status: string; status: string }
const LOCALES: Record<Language, string> = { en: "en-US", es: "es-CL", de: "de-DE" }

function getStatusClass(status: string) {
  switch (status) {
    case "paid": return "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
    case "pending": return "border-amber-500/30 bg-amber-500/10 text-amber-300"
    case "partial": return "border-sky-500/30 bg-sky-500/10 text-sky-300"
    case "overdue": return "border-red-500/30 bg-red-500/10 text-red-300"
    default: return "border-white/10 bg-white/[.03] text-muted-foreground"
  }
}

export default function InvoicesPage() {
  const { language } = useLanguage()
  const copy = invoiceCopy[language]
  const locale = LOCALES[language]
  const paymentStatusLabels: Record<string, string> = { pending: copy.pending, partial: copy.partial, paid: copy.paid, overdue: copy.overdue }
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState("")
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null)
  const [editorOpen, setEditorOpen] = useState(false)
  const [role, setRole] = useState<AppRole>(null)

  function formatDate(value: string) { return new Intl.DateTimeFormat(locale, { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "UTC" }).format(new Date(`${value}T00:00:00Z`)) }

  useEffect(() => {
    const supabase = createClient()
    void supabase.auth.getUser().then(({ data: { user } }) => setRole((user?.app_metadata?.procurement_role as AppRole) ?? null))
    void loadInvoices()
  }, [])

  async function loadInvoices() {
    setLoading(true); setError(null)
    try {
      const response = await fetch("/api/bookings/invoices")
      const data = (await response.json()) as Invoice[] | { error?: string }
      if (!response.ok) throw new Error(copy.loadFailed)
      setInvoices(Array.isArray(data) ? data : [])
    } catch { setError(copy.loadFailed); setInvoices([]) }
    finally { setLoading(false) }
  }

  async function handleDeleteInvoice(invoice: Invoice) {
    if (!confirm(fillInvoiceCopy(copy.deleteConfirm, { number: invoice.invoice_number }))) return
    try {
      const response = await fetch(`/api/bookings/invoices/${invoice.id}`, { method: "DELETE" })
      if (!response.ok) throw new Error(copy.deleteFailed)
      setInvoices((current) => current.filter((item) => item.id !== invoice.id)); toast.success(copy.deleted)
    } catch { toast.error(copy.deleteFailed) }
  }

  const filteredInvoices = useMemo(() => {
    const query = searchTerm.trim().toLocaleLowerCase(locale)
    if (!query) return invoices
    return invoices.filter((invoice) => invoice.invoice_number.toLocaleLowerCase(locale).includes(query) || invoice.customer_name.toLocaleLowerCase(locale).includes(query) || invoice.customer_email?.toLocaleLowerCase(locale).includes(query))
  }, [invoices, locale, searchTerm])

  const canEdit = role === "admin" || role === "approver"
  const canDelete = role === "admin"
  const openBalance = filteredInvoices.reduce((sum, invoice) => sum + Math.max(0, Number(invoice.total_amount) - Number(invoice.amount_paid ?? 0)), 0)

  return <div className="min-h-screen bg-[#111213] text-foreground">
    <header className="flex min-h-[58px] flex-wrap items-center justify-between gap-3 border-b border-white/10 bg-[#17191a] px-4 py-2">
      <div><h1 className="text-base font-medium">{copy.title}</h1><p className="text-xs text-muted-foreground">{copy.subtitle}</p></div>
      <div className="text-right"><div className="text-[10px] uppercase tracking-wide text-muted-foreground">{copy.registered}</div><div className="text-sm font-medium">{filteredInvoices.length} · {formatClp(openBalance, locale)}</div></div>
    </header>

    <div className="border-b border-white/10 bg-[#151718] p-2"><div className="relative max-w-xl"><Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" /><Input placeholder={copy.search} value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} className="h-8 pl-9" /></div></div>
    {error && <div className="flex items-center justify-between border-b border-red-500/30 bg-red-500/10 px-4 py-2 text-xs text-red-300"><span>{error}</span><Button size="sm" variant="outline" onClick={() => void loadInvoices()}>{copy.retry}</Button></div>}

    <div className="overflow-x-auto">
      <table className="w-full min-w-[980px] text-xs">
        <thead className="border-b border-white/10 bg-[#151718] text-left text-muted-foreground"><tr><th className="px-3 py-2 font-medium">#</th><th className="px-3 py-2 font-medium">{copy.customer ?? "Customer"}</th><th className="px-3 py-2 font-medium">{copy.issued}</th><th className="px-3 py-2 font-medium">{copy.due}</th><th className="px-3 py-2 font-medium">Status</th><th className="px-3 py-2 text-right font-medium">Total</th><th className="px-3 py-2 text-right font-medium">{copy.balance}</th><th className="px-3 py-2 text-right font-medium">{copy.actions ?? "Actions"}</th></tr></thead>
        <tbody>{loading ? <tr><td colSpan={8} className="px-4 py-12 text-center text-muted-foreground">{copy.loading}</td></tr> : filteredInvoices.length === 0 ? <tr><td colSpan={8} className="px-4 py-12 text-center"><FileText className="mx-auto mb-2 h-5 w-5 text-muted-foreground" /><div className="text-sm">{copy.empty}</div><div className="mt-1 text-xs text-muted-foreground">{copy.emptyHint}</div></td></tr> : filteredInvoices.map((invoice) => {
          const balance = Math.max(0, Number(invoice.total_amount) - Number(invoice.amount_paid ?? 0))
          return <tr key={invoice.id} className="border-b border-white/5 hover:bg-white/[.025]"><td className="px-3 py-2 font-medium">{invoice.invoice_number}</td><td className="px-3 py-2"><div>{invoice.customer_name}</div><div className="text-[10px] text-muted-foreground">{invoice.customer_email || "—"}</div></td><td className="px-3 py-2">{formatDate(invoice.invoice_date)}</td><td className="px-3 py-2">{formatDate(invoice.due_date)}</td><td className="px-3 py-2"><Badge variant="outline" className={`h-5 rounded-sm px-1.5 text-[10px] ${getStatusClass(invoice.payment_status)}`}>{paymentStatusLabels[invoice.payment_status] ?? invoice.payment_status}</Badge></td><td className="px-3 py-2 text-right font-medium">{formatClp(invoice.total_amount, locale)}</td><td className="px-3 py-2 text-right">{formatClp(balance, locale)}</td><td className="px-3 py-2"><div className="flex justify-end gap-1"><Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => { setSelectedInvoice(invoice); setEditorOpen(true) }} aria-label={`${copy.view} ${invoice.invoice_number}`}><Eye className="h-3.5 w-3.5" /></Button>{canEdit && <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => { setSelectedInvoice(invoice); setEditorOpen(true) }} aria-label={`${copy.edit} ${invoice.invoice_number}`}><Edit className="h-3.5 w-3.5" /></Button>}{canDelete && <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => void handleDeleteInvoice(invoice)} aria-label={`${copy.delete} ${invoice.invoice_number}`}><Trash2 className="h-3.5 w-3.5" /></Button>}</div></td></tr>
        })}</tbody>
      </table>
    </div>

    <div className="border-t border-white/10 bg-[#151718] px-4 py-2 text-[10px] text-muted-foreground">{copy.note}</div>
    <InvoiceEditorModal open={editorOpen} onOpenChange={(open) => { setEditorOpen(open); if (!open) setSelectedInvoice(null) }} invoice={selectedInvoice} onSave={() => { void loadInvoices(); setSelectedInvoice(null) }} />
  </div>
}
