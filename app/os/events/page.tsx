'use client'

import Link from 'next/link'
import { EventPortalAdmin } from '@/components/event-portal-admin'
import { EventRegistrationManagement } from '@/components/event-registration-management'
import { OsWorkspace } from '@/components/os-workspace'
import { Button } from '@/components/ui/button'
import { useLanguage } from '@/lib/hooks/use-language'

const copy = {
  en: { payments: 'TUU POS Payments' },
  es: { payments: 'Pagos TUU POS' },
  de: { payments: 'TUU-POS-Zahlungen' },
} as const

export default function Page() {
  const { language } = useLanguage()
  const text = copy[language]

  return <div className="space-y-6">
    <div className="flex justify-end"><Button asChild variant="outline"><Link href="/os/events/tuu-payments">{text.payments}</Link></Button></div>
    <OsWorkspace workspace="events" />
    <EventPortalAdmin />
    <EventRegistrationManagement />
  </div>
}
