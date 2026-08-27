import { Suspense } from 'react'
import { OsEntry } from '@/components/os-entry'

export default function Page() {
  return (
    <Suspense fallback={<div className="p-6 text-sm text-muted-foreground">Loading Black Swan OS…</div>}>
      <OsEntry />
    </Suspense>
  )
}
