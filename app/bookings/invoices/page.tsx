"use client"

import { useEffect, useMemo, useState } from "react"
import { Edit, Eye, FileText, Search, Trash2 } from "lucide-react"
import { toast } from "sonner"
import { AppLayout } from "@/components/app-layout"
import { InvoiceEditorModal } from "@/components/invoice-editor-modal"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { createClient } from "@/lib/supabase/client"
import { formatClp } from "@/lib/money"
import { useLanguage, type Language } from "@/lib/hooks/use-language"
import { fillInvoiceCopy, invoiceCopy } from "@/lib/translations/invoices"

type AppRole = "admin" | "approver" | "operator" | "viewer" | null

interface Invoice {
  id: string
  reservation_id: string | null
  invoice_number: string
  invoice_date: string
  due_date: string
  customer_name: string
  customer_email: string | null
  total_amount: number
  amount_paid: number | null
  payment_status: string
  status: string
}

const LOCALES: Record<Language, string> = { en: "en-US", es: "es-CL", de: "de-DE" }

function getStatusClass(status: string) {
  switch (status) {
    case "paid": return "bg-emerald-100 text-emerald-800"
    case "pending": return "bg-amber-100 text-amber-800"
    case "partial": return "bg-sky-100 text-sky-800"
    case "overdue": return "bg-red-100 text-red-800"
    default: return "bg-muted text-muted-foreground"
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

  function formatDate(value: string) {
    return new Intl.DateTimeFormat(locale, { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "UTC" }).format(new Date(`${value}T00:00:00Z`))
  }

  useEffect(() => {
    const supabase = createClient()
    void supabase.auth.getUser().then(({ data: { user } }) => setRole((user?.app_metadata?.procurement_role as AppRole) ?? null))
    void loadInvoices()
  }, [])

  async function loadInvoices() {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch("/api/bookings/invoices")
      const data = (await response.json()) as Invoice[] | { error?: string }
      if (!response.ok) throw new Error(copy.loadFailed)
      setInvoices(Array.isArray(data) ? data : [])
    } catch {
      setError(copy.loadFailed)
      setInvoices([])
    } finally {
      setLoading(false)
    }
  }

  async function handleDeleteInvoice(invoice: Invoice) {
    if (!confirm(fillInvoiceCopy(copy.deleteConfirm, { number: invoice.invoice_number }))) return
    try {
      const response = await fetch(`/api/bookings/invoices/${invoice.id}`, { method: "DELETE" })
      if (!response.ok) throw new Error(copy.deleteFailed)
      setInvoices((current) => current.filter((item) => item.id !== invoice.id))
      toast.success(copy.deleted)
    } catch {
      toast.error(copy.deleteFailed)
    }
  }

  const filteredInvoices = useMemo(() => {
    const query = searchTerm.trim().toLocaleLowerCase(locale)
    if (!query) return invoices
    return invoices.filter((invoice) =>
      invoice.invoice_number.toLocaleLowerCase(locale).includes(query)
      || invoice.customer_name.toLocaleLowerCase(locale).includes(query)
      || invoice.customer_email?.toLocaleLowerCase(locale).includes(query),
    )
  }, [invoices, locale, searchTerm])

  const canEdit = role === "admin" || role === "approver"
  const canDelete = role === "admin"

  return (
    <AppLayout>
      <div className="space-y-5 p-4 sm:p-6">
        <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div><h1 className="text-2xl font-semibold sm:text-3xl">{copy.title}</h1><p className="mt-1 text-sm text-muted-foreground">{copy.subtitle}</p></div>
          <div className="rounded-lg border bg-muted/30 px-3 py-2 text-xs text-muted-foreground sm:max-w-sm">{copy.note}</div>
        </header>

        <Card><CardContent className="p-4"><div className="relative"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input placeholder={copy.search} value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} className="pl-9" /></div></CardContent></Card>

        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-base">{copy.registered} ({filteredInvoices.length})</CardTitle></CardHeader>
          <CardContent>
            {loading ? (
              <div className="py-10 text-center text-sm text-muted-foreground">{copy.loading}</div>
            ) : error ? (
              <div className="space-y-3 py-8 text-center"><p className="text-sm text-destructive">{error}</p><Button variant="outline" onClick={() => void loadInvoices()}>{copy.retry}</Button></div>
            ) : filteredInvoices.length === 0 ? (
              <div className="flex flex-col items-center gap-3 py-12 text-center"><FileText className="h-9 w-9 text-muted-foreground" /><div><p className="font-medium">{copy.empty}</p><p className="mt-1 text-sm text-muted-foreground">{copy.emptyHint}</p></div></div>
            ) : (
              <div className="divide-y rounded-lg border">
                {filteredInvoices.map((invoice) => {
                  const balance = Math.max(0, Number(invoice.total_amount) - Number(invoice.amount_paid ?? 0))
                  return (
                    <div key={invoice.id} className="grid gap-3 p-4 md:grid-cols-[1.4fr_1fr_auto] md:items-center">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2"><span className="font-semibold">{invoice.invoice_number}</span><Badge className={getStatusClass(invoice.payment_status)}>{paymentStatusLabels[invoice.payment_status] ?? invoice.payment_status}</Badge></div>
                        <p className="mt-1 truncate text-sm">{invoice.customer_name}</p>
                        <p className="text-xs text-muted-foreground">{copy.issued} {formatDate(invoice.invoice_date)} · {copy.due} {formatDate(invoice.due_date)}</p>
                      </div>
                      <div className="md:text-right"><p className="font-semibold">{formatClp(invoice.total_amount, locale)}</p>{balance > 0 && <p className="text-xs text-muted-foreground">{copy.balance} {formatClp(balance, locale)}</p>}</div>
                      <div className="flex justify-end gap-2">
                        <Button size="icon" variant="outline" onClick={() => { setSelectedInvoice(invoice); setEditorOpen(true) }} aria-label={`${copy.view} ${invoice.invoice_number}`}><Eye className="h-4 w-4" /></Button>
                        {canEdit && <Button size="icon" variant="outline" onClick={() => { setSelectedInvoice(invoice); setEditorOpen(true) }} aria-label={`${copy.edit} ${invoice.invoice_number}`}><Edit className="h-4 w-4" /></Button>}
                        {canDelete && <Button size="icon" variant="outline" onClick={() => void handleDeleteInvoice(invoice)} aria-label={`${copy.delete} ${invoice.invoice_number}`}><Trash2 className="h-4 w-4" /></Button>}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>

        <InvoiceEditorModal open={editorOpen} onOpenChange={(open) => { setEditorOpen(open); if (!open) setSelectedInvoice(null) }} invoice={selectedInvoice} onSave={() => { void loadInvoices(); setSelectedInvoice(null) }} />
      </div>
    </AppLayout>
  )
}
