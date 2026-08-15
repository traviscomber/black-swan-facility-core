import { EventPortalAdmin } from '@/components/event-portal-admin'
import { EventRegistrationManagement } from '@/components/event-registration-management'
import { OsWorkspace } from '@/components/os-workspace'

export default function Page() {
  return <div className="space-y-6">
    <OsWorkspace workspace="events" title="Events" description="Member-linked event planning, invite-only guest pages, external service providers, operational status and Education output." />
    <EventPortalAdmin />
    <EventRegistrationManagement />
  </div>
}
