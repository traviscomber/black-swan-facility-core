'use client'

import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { BigPictureHome } from '@/components/big-picture-home'
import { FieldAdminHome } from '@/components/field-admin-home'
import { OsTodayActionCenter as OsDecisionCockpit } from '@/components/os-today-action-center'
import { OsHome } from '@/components/os-home'
import { useOsPersona } from '@/lib/hooks/use-os-persona'
import { useLanguage } from '@/lib/hooks/use-language'

const copy = {
  en: { loading: 'Loading your workspace…', today: 'Today', panorama: 'Panorama' },
  es: { loading: 'Cargando tu espacio de trabajo…', today: 'Hoy', panorama: 'Panorama' },
  de: { loading: 'Arbeitsbereich wird geladen…', today: 'Heute', panorama: 'Panorama' },
} as const

export function OsEntry() {
  const searchParams = useSearchParams()
  const { persona, loading } = useOsPersona()
  const { language } = useLanguage()
  const text = copy[language]
  const panorama = searchParams.get('view') === 'panorama'

  if (loading) return <div className="p-6 text-sm text-muted-foreground">{text.loading}</div>

  const dailyHome = persona === 'field_admin' ? <FieldAdminHome /> : <OsHome />

  return (
    <div>
      <div className="border-b border-border/50 px-4 pt-4 md:px-6">
        <div className="flex w-fit items-center rounded-lg border bg-muted/20 p-1">
          <Link href="/os" className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${!panorama ? 'bg-background shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}>{text.today}</Link>
          <Link href="/os?view=panorama" className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${panorama ? 'bg-background shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}>{text.panorama}</Link>
        </div>
      </div>
      {!panorama && persona !== 'field_admin' && <OsDecisionCockpit />}
      {panorama ? <BigPictureHome /> : dailyHome}
    </div>
  )
}
