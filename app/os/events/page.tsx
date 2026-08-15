import Link from 'next/link'
import { EventPortalAdmin } from '@/components/event-portal-admin'
import { EventRegistrationManagement } from '@/components/event-registration-management'
import { OsWorkspace } from '@/components/os-workspace'
import { Button } from '@/components/ui/button'

export default function Page() {
  return <div className="space-y-6">
    <div className="flex justify-end"><Button asChild variant="outline"><Link href="/os/events/tuu-payments">TUU POS Payments</Link></Button></div>
    <OsWorkspace workspace="events" title="Events" description="Member-linked event planning, invite-only guest pages, external service providers, operational status and Education output." />
    <EventPortalAdmin />
    <EventRegistrationManagement />
  </div>
}
