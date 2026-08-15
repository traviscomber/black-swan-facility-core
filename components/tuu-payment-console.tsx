'use client'

import { FormEvent, useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'

const operationsApi = process.env.NEXT_PUBLIC_BLACK_SWAN_OPERATIONS_API_URL
const bankingApi = process.env.NEXT_PUBLIC_BLACK_SWAN_BANKING_API_URL

type Portal = { id: string; slug: string; status: string }
type Registration = { id: string; full_name: string; email: string; registration_status: string; payment_status: string }
type Payment = { id?: string; provider_status?: string; amount_clp?: number; idempotency_key?: string; last_error?: string | null }

async function accessToken() {
  const supabase = createClient()
  const { data } = await supabase.auth.getSession()
  if (!data.session?.access_token) throw new Error('Authentication required')
  return data.session.access_token
}

async function call(base: string | undefined, path: string, init: RequestInit = {}) {
  if (!base) throw new Error('Required service URL is not configured.')
  const token = await accessToken()
  const response = await fetch(`${base}${path}`, {
    ...init,
    headers: { authorization: `Bearer ${token}`, ...(init.body ? { 'content-type': 'application/json' } : {}), ...(init.headers || {}) },
  })
  const result = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(result?.error?.message || result?.error?.code || 'Request failed')
  return result.data
}

export function TuuPaymentConsole() {
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
      } catch (e) { setError(e instanceof Error ? e.message : 'Unable to load event portals') }
    })()
  }, [])

  async function loadRegistrations(id: string) {
    setPortalId(id); setSelectedRegistration(''); setPayment(null); setRegistrations([])
    if (!id) return
    setBusy(true); setError(null)
    try {
      const management = await call(operationsApi, `/v1/os/event-portals/${id}`)
      setRegistrations(Array.isArray(management?.registrations) ? management.registrations : [])
    } catch (e) { setError(e instanceof Error ? e.message : 'Unable to load registrations') }
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
      setMessage('Payment request sent to the TUU POS. Confirm it on the terminal in Modo Integracion.')
    } catch (e) { setError(e instanceof Error ? e.message : 'Unable to start TUU payment') }
    finally { setBusy(false) }
  }

  async function refresh() {
    if (!payment?.id) return
    setBusy(true); setError(null)
    try {
      const data = await call(bankingApi, `/v1/banking/tuu/payments/${payment.id}`)
      setPayment(data as Payment)
      setMessage(`TUU status: ${String(data?.provider_status || 'unknown')}`)
      if (data?.provider_status === 'completed' && portalId) await loadRegistrations(portalId)
    } catch (e) { setError(e instanceof Error ? e.message : 'Unable to refresh TUU status') }
    finally { setBusy(false) }
  }

  const payable = registrations.filter((r) => ['confirmed','checked_in','completed'].includes(r.registration_status) && r.payment_status !== 'paid')

  return <Card>
    <CardHeader>
      <CardTitle>TUU POS Payments</CardTitle>
      <CardDescription>Send a charge from Black Swan OS to the existing TUU terminal. The terminal must be active and in Modo Integracion.</CardDescription>
    </CardHeader>
    <CardContent className="space-y-5">
      <select value={portalId} onChange={(e) => void loadRegistrations(e.target.value)} className="h-10 w-full rounded-md border bg-background px-3 text-sm">
        <option value="">Select event portal</option>
        {portals.map((p) => <option key={p.id} value={p.id}>{p.slug} · {p.status}</option>)}
      </select>

      {portalId && <form className="grid gap-3 md:grid-cols-2" onSubmit={charge}>
        <select value={selectedRegistration} onChange={(e) => setSelectedRegistration(e.target.value)} required className="h-10 rounded-md border bg-background px-3 text-sm md:col-span-2">
          <option value="">Select unpaid confirmed guest</option>
          {payable.map((r) => <option key={r.id} value={r.id}>{r.full_name} · {r.email} · {r.payment_status}</option>)}
        </select>
        <Input name="amount_clp" type="number" min="100" max="99999999" step="1" required placeholder="Amount CLP" />
        <select name="payment_method" className="h-10 rounded-md border bg-background px-3 text-sm"><option value="">Choose on POS</option><option value="1">Credit</option><option value="2">Debit</option></select>
        <select name="dte_type" className="h-10 rounded-md border bg-background px-3 text-sm"><option value="0">Comprobante afecto</option><option value="33">Factura afecta</option><option value="48">Comprobante afecto (48)</option><option value="99">Comprobante exento</option></select>
        <Input name="description" placeholder="Description (optional)" />
        <div className="md:col-span-2"><Button disabled={busy || !selectedRegistration}>{busy ? 'Sending…' : 'Send to TUU terminal'}</Button></div>
      </form>}

      {payment && <div className="space-y-2 rounded-md border p-4 text-sm">
        <div className="flex flex-wrap items-center justify-between gap-3"><div><p className="font-medium">TUU request</p><p className="text-muted-foreground">{payment.id}</p></div><Button type="button" variant="outline" size="sm" disabled={busy} onClick={() => void refresh()}>Refresh status</Button></div>
        <p>Status: <strong>{payment.provider_status || 'created'}</strong></p>
        {payment.amount_clp != null && <p>Amount: CLP {Number(payment.amount_clp).toLocaleString('es-CL')}</p>}
        {payment.last_error && <p className="text-destructive">{payment.last_error}</p>}
      </div>}

      {message && <p className="text-sm text-muted-foreground">{message}</p>}
      {error && <p className="text-sm text-destructive">{error}</p>}
    </CardContent>
  </Card>
}
