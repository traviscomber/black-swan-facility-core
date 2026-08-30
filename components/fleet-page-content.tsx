'use client'

import { Card, CardContent } from '@/components/ui/card'
import { FleetRegistryConsole, type FleetRegistryRow } from '@/components/fleet-registry-console'
import { PageHeader } from '@/components/page-header'
import { useLanguage } from '@/lib/hooks/use-language'

const copy = {
  en: {
    title: 'Fleet and equipment',
    description: 'Operational classification, identity, fuel and maintenance for Fundo Corcovado’s mobile assets.',
    error: 'Unable to load the fleet registry.',
  },
  es: {
    title: 'Flota y equipos',
    description: 'Clasificación operacional, identidad, combustible y mantenimiento del parque móvil del Fundo Corcovado.',
    error: 'No fue posible cargar el registro de flota.',
  },
  de: {
    title: 'Fuhrpark und Geräte',
    description: 'Betriebsklassifizierung, Identität, Kraftstoff und Wartung für den mobilen Bestand von Fundo Corcovado.',
    error: 'Das Fuhrparkregister konnte nicht geladen werden.',
  },
} as const

export function FleetPageContent({ rows, hasError }: { rows: FleetRegistryRow[]; hasError: boolean }) {
  const { language } = useLanguage()
  const text = copy[language]

  return (
    <>
      <PageHeader title={text.title} description={text.description} />
      <div className="space-y-6 p-4 sm:p-8">
        {hasError ? (
          <Card className="border-destructive/50"><CardContent className="p-4 text-sm text-destructive">{text.error}</CardContent></Card>
        ) : (
          <FleetRegistryConsole rows={rows} />
        )}
      </div>
    </>
  )
}
