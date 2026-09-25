'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { AppLayout } from '@/components/app-layout'
import { FinanceApprovalQueue } from '@/components/finance-approval-queue'
import { FinanceHistoricalAliasReview } from '@/components/finance-historical-alias-review'
import { RaimundoFinanceImport } from '@/components/raimundo-finance-import'
import { RaimundoReviewInbox } from '@/components/raimundo-review-inbox'
import { SiiSourceReview } from '@/components/sii-source-review'
import { PageHeader } from '@/components/page-header'
import { useLanguage } from '@/lib/hooks/use-language'
import { createClient } from '@/lib/supabase/client'

const copy = {
  en: { title: 'Financial approval', description: 'Review one case at a time, confirm quickly and preserve traceability against the canonical Budget.' },
  es: { title: 'Aprobación financiera', description: 'Revisa un caso por vez, confirma rápido y conserva trazabilidad contra el Budget canónico.' },
  de: { title: 'Finanzielle Freigabe', description: 'Prüfen Sie jeweils einen Fall, bestätigen Sie zügig und erhalten Sie die Nachverfolgbarkeit zum kanonischen Budget.' },
} as const

export default function BudgetApprovalsPage() {
  const { language } = useLanguage()
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])
  const [allowed, setAllowed] = useState<boolean | null>(null)
  const text = copy[language]

  useEffect(() => {
    let cancelled = false
    void Promise.all([
      supabase.rpc('can_finance_approve'),
      supabase.rpc('can_finance_payment_authorize'),
    ]).then(([approver, payer]) => {
      if (cancelled) return
      if (approver.data) {
        setAllowed(true)
        return
      }
      setAllowed(false)
      router.replace(`/${language}${payer.data ? '/budgets/payments' : '/os'}`)
    })
    return () => { cancelled = true }
  }, [language, router, supabase])

  if (allowed !== true) return null

  return (
    <AppLayout>
      <PageHeader title={text.title} description={text.description} />
      <FinanceApprovalQueue />
      <SiiSourceReview />
      <RaimundoReviewInbox />
      <FinanceHistoricalAliasReview />
      <RaimundoFinanceImport />
    </AppLayout>
  )
}
