import { Suspense } from 'react'
import { OsHome } from '@/components/os-home'

export default function Page() {
  return (
    <Suspense fallback={<div className="p-6 text-sm text-muted-foreground">Loading Black Swan OS…</div>}>
      <OsHome />
    </Suspense>
  )
}
