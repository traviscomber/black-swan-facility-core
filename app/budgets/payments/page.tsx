'use client'

import { AppLayout } from '@/components/app-layout'
import { PageHeader } from '@/components/page-header'
import { SantiagoPaymentQueue } from '@/components/santiago-payment-queue'
import { useLanguage } from '@/lib/hooks/use-language'

const copy = {
  en: { title: 'Supplier payments', description: 'Final payment authorization and execution after Raimundo validates the expense allocation.' },
  es: { title: 'Finanzas · Santiago', description: 'Raimundo revisa primero. Santiago sólo resuelve excepciones escaladas y autoriza o ejecuta pagos ya aprobados por Raimundo.' },
  de: { title: 'Lieferantenzahlungen', description: 'Endgültige Zahlungsfreigabe und Ausführung nach Raimundos Prüfung der Kostenverteilung.' },
} as const

export default function SupplierPaymentsPage() {
  const { language } = useLanguage()
  const text = copy[language]
  return <AppLayout><PageHeader title={text.title} description={text.description} /><SantiagoPaymentQueue /></AppLayout>
}
