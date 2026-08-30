'use client'

import { TuuPaymentConsole } from '@/components/tuu-payment-console'
import { useLanguage } from '@/lib/hooks/use-language'

const copy = {
  en: {
    eyebrow: 'Black Swan OS · Events',
    title: 'TUU POS Payments',
    description: 'Send event participation charges to the physical TUU terminal and synchronize provider status.',
  },
  es: {
    eyebrow: 'Black Swan OS · Eventos',
    title: 'Pagos TUU POS',
    description: 'Envía cobros de participación en eventos al terminal físico TUU y sincroniza el estado del proveedor.',
  },
  de: {
    eyebrow: 'Black Swan OS · Veranstaltungen',
    title: 'TUU-POS-Zahlungen',
    description: 'Senden Sie Teilnahmegebühren für Veranstaltungen an das physische TUU-Terminal und synchronisieren Sie den Anbieterstatus.',
  },
} as const

export default function Page() {
  const { language } = useLanguage()
  const text = copy[language]

  return <div className="space-y-6">
    <div><p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">{text.eyebrow}</p><h1 className="text-3xl font-normal">{text.title}</h1><p className="mt-2 text-sm text-muted-foreground">{text.description}</p></div>
    <TuuPaymentConsole />
  </div>
}
