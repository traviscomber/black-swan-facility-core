'use client'

import { HrTransparencyDashboard } from '@/components/hr-transparency-dashboard'
import { useLanguage } from '@/lib/hooks/use-language'

const copy = {
  en: { title: 'HR Transparency', description: 'Read-only organizational information for authorized legal entities.' },
  es: { title: 'Transparencia de RR. HH.', description: 'Información organizacional de solo lectura para entidades legales autorizadas.' },
  de: { title: 'HR-Transparenz', description: 'Schreibgeschützte Organisationsinformationen für autorisierte Rechtseinheiten.' },
} as const

export default function HrTransparencyPage() {
  const { language } = useLanguage()
  const text = copy[language]
  return (
    <div className="mx-auto w-full max-w-7xl space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{text.title}</h1>
        <p className="text-sm text-muted-foreground">{text.description}</p>
      </div>
      <HrTransparencyDashboard />
    </div>
  )
}
