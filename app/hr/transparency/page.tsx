import { HrTransparencyDashboard } from '@/components/hr-transparency-dashboard'

export default function HrTransparencyPage() {
  return (
    <div className="mx-auto w-full max-w-7xl space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">HR Transparency</h1>
        <p className="text-sm text-muted-foreground">Read-only organizational information for authorized legal entities.</p>
      </div>
      <HrTransparencyDashboard />
    </div>
  )
}
