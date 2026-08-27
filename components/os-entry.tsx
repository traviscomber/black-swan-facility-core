'use client'

import { FieldAdminHome } from '@/components/field-admin-home'
import { OsHome } from '@/components/os-home'
import { useOsPersona } from '@/lib/hooks/use-os-persona'

export function OsEntry() {
  const { persona, loading } = useOsPersona()

  if (loading) {
    return <div className="p-6 text-sm text-muted-foreground">Cargando tu espacio de trabajo…</div>
  }

  if (persona === 'field_admin') return <FieldAdminHome />
  return <OsHome />
}
