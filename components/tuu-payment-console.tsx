'use client'

import { FormEvent, useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { useLanguage } from '@/lib/hooks/use-language'

const operationsApi = process.env.NEXT_PUBLIC_BLACK_SWAN_OPERATIONS_API_URL
const bankingApi = process.env.NEXT_PUBLIC_BLACK_SWAN_BANKING_API_URL

type Portal = { id: string; slug: string; status: string }
type Registration = { id: string; full_name: string; email: string; registration_status: string; payment_status: string }
type Payment = { id?: string; provider_status?: string; amount_clp?: number; idempotency_key?: string; last_error?: string | null }

const copy = {
  en: {
    title: 'TUU POS Payments',
    description: 'Send a charge from Black Swan OS to the existing TUU terminal. The terminal must be active and in Integration Mode (Modo Integración).',
    selectPortal: 'Select event portal',
    selectGuest: 'Select unpaid confirmed guest',
    amount: 'Amount CLP',
    chooseOnPos: 'Choose on POS',
    credit: 'Credit',
    debit: 'Debit',
    receiptTaxable: 'Taxable receipt',
    invoiceTaxable: 'Taxable invoice',
    receiptTaxable48: 'Taxable receipt (48)',
    receiptExempt: 'Exempt receipt',
    optionalDescription: 'Description (optional)',
    sending: 'Sending…',
    send: 'Send to TUU terminal',
    request: 'TUU request',
    refresh: 'Refresh status',
    status: 'Status',
    amountLabel: 'Amount',
    sent: 'Payment request sent to the TUU POS. Confirm it on the terminal in Integration Mode.',
    statusMessage: (status: string) => `TUU status: ${status}`,
    loadPortalsError: 'Unable to load event portals.',
    loadRegistrationsError: 'Unable to load registrations.',
    paymentError: 'Unable to start TUU payment.',
    refreshError: 'Unable to refresh TUU status.',
  },
  es: {
    title: 'Pagos TUU POS',
    description: 'Envía un cobro desde Black Swan OS al terminal TUU existente. El terminal debe estar activo y en Modo Integración.',
    selectPortal: 'Seleccionar portal de evento',
    selectGuest: 'Seleccionar invitado confirmado con pago pendiente',
    amount: 'Monto CLP',
    chooseOnPos: 'Elegir en POS',
    credit: 'Crédito',
    debit: 'Débito',
    receiptTaxable: 'Comprobante afecto',
    invoiceTaxable: 'Factura afecta',
    receiptTaxable48: 'Comprobante afecto (48)',
    receiptExempt: 'Comprobante exento',
    optionalDescription: 'Descripción (opcional)',
    sending: 'Enviando…',
    send: 'Enviar al terminal TUU',
    request: 'Solicitud TUU',
    refresh: 'Actualizar estado',
    status: 'Estado',
    amountLabel: 'Monto',
    sent: 'Solicitud de pago enviada al POS TUU. Confírmala en el terminal en Modo Integración.',
    statusMessage: (status: string) => `Estado TUU: ${status}`,
    loadPortalsError: 'No fue posible cargar los portales de eventos.',
    loadRegistrationsError: 'No fue posible cargar las inscripciones.',
    paymentError: 'No fue posible iniciar el pago TUU.',
    refreshError: 'No fue posible actualizar el estado TUU.',
  },
  de: {
    title: 'TUU-POS-Zahlungen',
    description: 'Senden Sie eine Zahlung aus Black Swan OS an das vorhandene TUU-Terminal. Das Terminal muss aktiv und im Integrationsmodus (Modo Integración) sein.',
    selectPortal: 'Eventportal auswählen',
    selectGuest: 'Bestätigten Gast mit offenem Betrag auswählen',
    amount: 'Betrag CLP',
    chooseOnPos: 'Am POS auswählen',
    credit: 'Kreditkarte',
    debit: 'Debitkarte',
    receiptTaxable: 'Steuerpflichtiger Beleg',
    invoiceTaxable: 'Steuerpflichtige Rechnung',
    receiptTaxable48: 'Steuerpflichtiger Beleg (48)',
    receiptExempt: 'Steuerbefreiter Beleg',
    optionalDescription: 'Beschreibung (optional)',
    sending: 'Wird gesendet…',
    send: 'An TUU-Terminal senden',
    request: 'TUU-Anforderung',
    refresh: 'Status aktualisieren',
    status: 'Status',
    amountLabel: 'Betrag',
    sent: 'Zahlungsanforderung an das TUU-POS gesendet. Bestätigen Sie sie am Terminal im Integrationsmodus.',
    statusMessage: (status: string) => `TUU-Status: ${status}`,
    loadPortalsError: 'Eventportale konnten nicht geladen werden.',
    loadRegistrationsError: 'Registrierungen konnten nicht geladen werden.',
    paymentError: 'TUU-Zahlung konnte nicht gestartet werden.',
    refreshError: 'TUU-Status konnte nicht aktualisiert werden.',
  },
} as const

async function accessToken() {
  const supabase = createClient()
  const { data } = await supabase.auth.getSession()
  if (!data.session?.access_token) throw new Error('AUTHENTICATION_REQUIRED')
  return data.session.access_token
}

async function call(base: string | undefined, path: string, init: RequestInit = {}) {
  if (!base) throw new Error('SERVICE_URL_NOT_CONFIGURED')
  const token = await accessToken()
  const response = await fetch(`${base}${path}`, {
    ...init,
    headers: { authorization: `Bearer ${token}`, ...(init.body ? { 'content-type': 'application/json' } : {}), ...(init.headers || {}) },
  })
  const result = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(result?.error?.code || 'REQUEST_FAILED')
  return result.data
}

export function TuuPaymentConsole() {
  const { language } = useLanguage()
  const text = copy[language]
  const numberLocale = language === 'es' ? 'es-CL' : language === 'de' ? 'de-DE' : 'en-US'
  const [portals, setPortals] = useState<Portal[]>([])
  const [portalId, setPortalId] = useState('')
  const [registrations, setRegistrations] = useState<Registration[]>([])
  const [selectedRegistration, setSelectedRegistration] = useState('')
  const [payment, setPayment] = useState<Payment | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  useEffect(() => {
    void (async () => {
      try {
        const workspace = await call(operationsApi, '/v1/os/workspaces/events')
        setPortals(Array.isArray(workspace?.portals) ? workspace.portals : [])
      } catch { setError(text.loadPortalsError) }
    })()
  }, [text.loadPortalsError])

  async function loadRegistrations(id: string) {
    setPortalId(id); setSelectedRegistration(''); setPayment(null); setRegistrations([])
    if (!id) return
    setBusy(true); setError(null)
    try {
      const management = await call(operationsApi, `/v1/os/event-portals/${id}`)
      setRegistrations(Array.isArray(management?.registrations) ? management.registrations : [])
    } catch { setError(text.loadRegistrationsError) }
    finally { setBusy(false) }
  }

  async function charge(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError(null); setMessage(null); setPayment(null)
    const form = new FormData(event.currentTarget)
    try {
      const data = await call(bankingApi, '/v1/banking/tuu/payments', {
        method: 'POST',
        body: JSON.stringify({
          registration_id: selectedRegistration,
          amount_clp: Number(form.get('amount_clp')),
          dte_type: Number(form.get('dte_type') || 0),
          payment_method: form.get('payment_method') ? Number(form.get('payment_method')) : null,
          description: form.get('description') || null,
        }),
      })
      setPayment(data?.request || null)
      setMessage(text.sent)
    } catch { setError(text.paymentError) }
    finally { setBusy(false) }
  }

  async function refresh() {
    if (!payment?.id) return
    setBusy(true); setError(null)
    try {
      const data = await call(bankingApi, `/v1/banking/tuu/payments/${payment.id}`)
      setPayment(data as Payment)
      setMessage(text.statusMessage(String(data?.provider_status || 'unknown')))
      if (data?.provider_status === 'completed' && portalId) await loadRegistrations(portalId)
    } catch { setError(text.refreshError) }
    finally { setBusy(false) }
  }

  const payable = registrations.filter((r) => ['confirmed','checked_in','completed'].includes(r.registration_status) && r.payment_status !== 'paid')

  return <Card>
    <CardHeader>
      <CardTitle>{text.title}</CardTitle>
      <CardDescription>{text.description}</CardDescription>
    </CardHeader>
    <CardContent className="space-y-5">
      <select value={portalId} onChange={(e) => void loadRegistrations(e.target.value)} className="h-10 w-full rounded-md border bg-background px-3 text-sm">
        <option value="">{text.selectPortal}</option>
        {portals.map((p) => <option key={p.id} value={p.id}>{p.slug} · {p.status}</option>)}
      </select>

      {portalId && <form className="grid gap-3 md:grid-cols-2" onSubmit={charge}>
        <select value={selectedRegistration} onChange={(e) => setSelectedRegistration(e.target.value)} required className="h-10 rounded-md border bg-background px-3 text-sm md:col-span-2">
          <option value="">{text.selectGuest}</option>
          {payable.map((r) => <option key={r.id} value={r.id}>{r.full_name} · {r.email} · {r.payment_status}</option>)}
        </select>
        <Input name="amount_clp" type="number" min="100" max="99999999" step="1" required placeholder={text.amount} />
        <select name="payment_method" className="h-10 rounded-md border bg-background px-3 text-sm"><option value="">{text.chooseOnPos}</option><option value="1">{text.credit}</option><option value="2">{text.debit}</option></select>
        <select name="dte_type" className="h-10 rounded-md border bg-background px-3 text-sm"><option value="0">{text.receiptTaxable}</option><option value="33">{text.invoiceTaxable}</option><option value="48">{text.receiptTaxable48}</option><option value="99">{text.receiptExempt}</option></select>
        <Input name="description" placeholder={text.optionalDescription} />
        <div className="md:col-span-2"><Button disabled={busy || !selectedRegistration}>{busy ? text.sending : text.send}</Button></div>
      </form>}

      {payment && <div className="space-y-2 rounded-md border p-4 text-sm">
        <div className="flex flex-wrap items-center justify-between gap-3"><div><p className="font-medium">{text.request}</p><p className="text-muted-foreground">{payment.id}</p></div><Button type="button" variant="outline" size="sm" disabled={busy} onClick={() => void refresh()}>{text.refresh}</Button></div>
        <p>{text.status}: <strong>{payment.provider_status || 'created'}</strong></p>
        {payment.amount_clp != null && <p>{text.amountLabel}: CLP {Number(payment.amount_clp).toLocaleString(numberLocale)}</p>}
        {payment.last_error && <p className="text-destructive">{payment.last_error}</p>}
      </div>}

      {message && <p className="text-sm text-muted-foreground">{message}</p>}
      {error && <p className="text-sm text-destructive">{error}</p>}
    </CardContent>
  </Card>
}