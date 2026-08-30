import { Suspense } from 'react'
import { OsEntry } from '@/components/os-entry'

export default function Page() {
  return (
    <Suspense fallback={<div className="min-h-24" aria-hidden="true" />}>
      <OsEntry />
    </Suspense>
  )
}
