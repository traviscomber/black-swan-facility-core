'use client'

import { FormEvent, useEffect, useMemo, useState } from 'react'
import { useParams, useSearchParams } from 'next/navigation'
import QRCode from 'react-qr-code'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'

const eventPortalApi = process.env.NEXT_PUBLIC_BLACK_SWAN_EVENT_PORTAL_API_URL

type Portal = {
  portal_id: string
  slug: string
  headline: string
  black_swan_intro?: string | null
  event_description?: string | null
  event: { name: string; start_date: string; end_date: string; location_name?: string | null }
  program?: unknown[]
  practical_info?: Record<string, unknown>
  capacity?: number | null
  places_remaining?: number | null
  allow_companions?: boolean
  max_companions?: number
  commercial_model: string
  ticket_price?: number | null
  currency: string
}

type RegistrationResult = {
  registration_id: string
  registration_status: 'confirmed' | 'waitlist' | string
  payment_status: string
  checkin_token?: string | null
}

function money(value: number | null | undefined, currency: string) {
  if (value == null) return null
  return new Intl.NumberFormat('en', { style: 'currency', currency }).format(value)
}

export default function EventGuestPage() {
  const params = useParams<{ slug: string }>()
  const searchParams = useSearchParams()
  const slug = params.slug
  const [access, setAccess] = useState('')
  const [portal, setPortal] = useState<Portal | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [registration, setRegistration] = useState<RegistrationResult | null>(null)

  const initialAccess = useMemo(() => searchParams.get('access') || '', [searchParams])

  async function unlock(secret: string) {
    if (!eventPortalApi) { setError('Event portal service is not configured.'); return }
    if (!secret) return
    setLoading(true); setError(null)
    try {
      const response = await fetch(`${eventPortalApi}/v1/events/${encodeURIComponent(slug)}?access=${encodeURIComponent(secret)}`, { cache: 'no-store' })
      const result = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(result?.error?.message || 'Invitation or passcode is not valid.')
      setAccess(secret)
      setPortal(result.data as Portal)
      sessionStorage.setItem(`black-swan-event:${slug}`, secret)
      if (window.location.search) window.history.replaceState({}, '', window.location.pathname)
    } catch (e) { setPortal(null); setError(e instanceof Error ? e.message : 'Unable to open event.') }
    finally { setLoading(false) }
  }

  useEffect(() => {
    const stored = typeof window !== 'undefined' ? sessionStorage.getItem(`black-swan-event:${slug}`) || '' : ''
    const secret = initialAccess || stored
    if (secret) void unlock(secret)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug, initialAccess])

  async function register(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!eventPortalApi || !portal || !access) return
    setLoading(true); setError(null)
    const data = new FormData(event.currentTarget)
    const companions = String(data.get('companions') || '').split('\n').map((v) => v.trim()).filter(Boolean).map((full_name) => ({ full_name }))
    try {
      const response = await fetch(`${eventPortalApi}/v1/events/${encodeURIComponent(slug)}/register`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          access,
          full_name: data.get('full_name'),
          email: data.get('email'),
          phone: data.get('phone'),
          company_name: data.get('company_name'),
          dietary_preferences: data.get('dietary_preferences'),
          allergies: data.get('allergies'),
          companions,
          consent_data_processing: data.get('consent_data_processing') === 'on',
          consent_marketing: data.get('consent_marketing') === 'on',
        }),
      })
      const result = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(result?.error?.message || 'Registration failed.')
      setRegistration(result.data as RegistrationResult)
      event.currentTarget.reset()
    } catch (e) { setError(e instanceof Error ? e.message : 'Registration failed.') }
    finally { setLoading(false) }
  }

  if (!portal) return (
    <main className="min-h-screen bg-background px-6 py-16 text-foreground">
      <div className="mx-auto max-w-md space-y-6">
        <div className="space-y-2"><p className="text-xs uppercase tracking-[0.24em] text-muted-foreground">Black Swan</p><h1 className="text-3xl font-normal">Private event</h1><p className="text-sm text-muted-foreground">Enter the access code supplied by the hosting Member.</p></div>
        <Card><CardContent className="pt-6"><form className="space-y-4" onSubmit={(e) => { e.preventDefault(); const form = new FormData(e.currentTarget); void unlock(String(form.get('access') || '')) }}><Input name="access" type="password" placeholder="Access code" required /><Button className="w-full" disabled={loading}>{loading ? 'Opening…' : 'Open invitation'}</Button>{error && <p className="text-sm text-destructive">{error}</p>}</form></CardContent></Card>
      </div>
    </main>
  )

  return (
    <main className="min-h-screen bg-background px-6 py-14 text-foreground">
      <div className="mx-auto max-w-4xl space-y-10">
        <header className="space-y-4"><p className="text-xs uppercase tracking-[0.28em] text-muted-foreground">Black Swan · Private Invitation</p><h1 className="max-w-3xl text-4xl font-normal tracking-tight md:text-6xl">{portal.headline}</h1>{portal.event_description && <p className="max-w-2xl text-lg text-muted-foreground">{portal.event_description}</p>}</header>

        <div className="grid gap-4 md:grid-cols-3">
          <Card><CardHeader><CardDescription>Date</CardDescription><CardTitle className="text-lg">{portal.event.start_date}{portal.event.end_date !== portal.event.start_date ? ` — ${portal.event.end_date}` : ''}</CardTitle></CardHeader></Card>
          <Card><CardHeader><CardDescription>Location</CardDescription><CardTitle className="text-lg">{portal.event.location_name || 'Black Swan'}</CardTitle></CardHeader></Card>
          <Card><CardHeader><CardDescription>Registration</CardDescription><CardTitle className="text-lg">{portal.places_remaining == null ? 'Invite only' : portal.places_remaining > 0 ? `${portal.places_remaining} places remaining` : 'Waitlist available'}</CardTitle></CardHeader></Card>
        </div>

        {portal.black_swan_intro && <section className="max-w-3xl space-y-3"><h2 className="text-2xl font-normal">About Black Swan</h2><p className="leading-7 text-muted-foreground">{portal.black_swan_intro}</p></section>}

        {Array.isArray(portal.program) && portal.program.length > 0 && <section className="space-y-4"><h2 className="text-2xl font-normal">Programme</h2><div className="space-y-2">{portal.program.map((item, index) => <Card key={index}><CardContent className="pt-6 text-sm">{typeof item === 'string' ? item : JSON.stringify(item)}</CardContent></Card>)}</div></section>}

        {portal.commercial_model !== 'free' && <Card><CardHeader><CardTitle>Participation</CardTitle><CardDescription>{portal.ticket_price != null ? money(portal.ticket_price, portal.currency) : 'Payment details will be confirmed after registration.'} Payment processing is not activated in this version.</CardDescription></CardHeader></Card>}

        <Card>
          <CardHeader>
            <CardTitle>{registration ? (registration.registration_status === 'waitlist' ? 'You are on the waitlist' : 'Registration confirmed') : 'Register'}</CardTitle>
            <CardDescription>{registration ? (registration.registration_status === 'waitlist' ? 'Your place is not confirmed yet. Black Swan will contact you if capacity becomes available.' : 'Your registration is linked to this event and its hosting Member. Keep your check-in pass for arrival.') : 'No Black Swan account is required.'}</CardDescription>
          </CardHeader>
          {registration ? <CardContent>
            {registration.registration_status === 'confirmed' && registration.checkin_token ? <div className="flex flex-col items-center gap-4 rounded-md border p-6 text-center">
              <div className="bg-white p-3"><QRCode value={`black-swan-checkin:${registration.checkin_token}`} size={180} /></div>
              <div><p className="text-sm font-medium">Guest check-in pass</p><p className="mt-1 max-w-md text-xs text-muted-foreground">Present this QR at arrival. Entry is still subject to the hosting Member being on ground.</p></div>
            </div> : <p className="text-sm text-muted-foreground">Waitlist registrations do not receive an access pass until promoted to confirmed.</p>}
          </CardContent> : <CardContent><form className="grid gap-4 md:grid-cols-2" onSubmit={register}><Input name="full_name" placeholder="Full name" required /><Input name="email" type="email" placeholder="Email" required /><Input name="phone" placeholder="WhatsApp / phone" /><Input name="company_name" placeholder="Company / organisation" /><Input name="dietary_preferences" placeholder="Dietary preferences" /><Input name="allergies" placeholder="Allergies" />{portal.allow_companions && <textarea name="companions" className="min-h-24 rounded-md border bg-background p-3 text-sm md:col-span-2" placeholder={`Companion names, one per line (maximum ${portal.max_companions || 0})`} />}<label className="flex gap-2 text-sm md:col-span-2"><input type="checkbox" name="consent_data_processing" required /> I consent to Black Swan processing my registration data for this event.</label><label className="flex gap-2 text-sm md:col-span-2"><input type="checkbox" name="consent_marketing" /> I would like to receive future Black Swan event and educational updates.</label><div className="md:col-span-2"><Button disabled={loading}>{loading ? 'Registering…' : portal.places_remaining === 0 ? 'Join waitlist' : 'Confirm registration'}</Button></div>{error && <p className="text-sm text-destructive md:col-span-2">{error}</p>}</form></CardContent>}
        </Card>
      </div>
    </main>
  )
}
