'use client'

import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { BigPictureHome } from '@/components/big-picture-home'
import { FieldAdminHome } from '@/components/field-admin-home'
import { OsHome } from '@/components/os-home'
import { useOsPersona } from '@/lib/hooks/use-os-persona'

export function OsEntry() {
  const searchParams = useSearchParams()
  const { persona, loading } = useOsPersona()
  const panorama = searchParams.get('view') === 'panorama'

  if (loading) {
    return <div className="p-6 text-sm text-muted-foreground">Cargando tu espacio de trabajo…</div>
  }

  return (
    <div>
      <div className="border-b border-border/50 px-4 pt-4 md:px-6">
        <div className="flex w-fit items-center rounded-lg border bg-muted/20 p-1">
          <Link href="/os" className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${!panorama ? 'bg-background shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}>Hoy</Link>
          <Link href="/os?view=panorama" className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${panorama ? 'bg-background shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}>Panorama</Link>
        </div>
      </div>
      {panorama ? <BigPictureHome /> : persona === 'field_admin' ? <FieldAdminHome /> : <OsHome />}
    </div>
  )
}
