'use client'

import type { ReactNode } from 'react'
import { useEffect, useMemo, useState } from 'react'
import { Loader2, ShieldX } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useLanguage } from '@/lib/hooks/use-language'

export function FinanceApprovalRouteGate({ children }: { children: ReactNode }) {
  const supabase = useMemo(() => createClient(), [])
  const router = useRouter()
  const { language } = useLanguage()
  const [allowed, setAllowed] = useState<boolean | null>(null)

  useEffect(() => {
    let cancelled = false

    void Promise.all([
      supabase.rpc('can_finance_approve'),
      supabase.rpc('can_finance_payment_authorize'),
    ]).then(([approveResult, paymentResult]) => {
      if (cancelled) return

      const canApprove = !approveResult.error && Boolean(approveResult.data)
      const canPay = !paymentResult.error && Boolean(paymentResult.data)

      if (canApprove) {
        setAllowed(true)
        return
      }

      setAllowed(false)
      if (canPay) {
        router.replace(`/${language}/budgets/payments`)
      }
    })

    return () => { cancelled = true }
  }, [language, router, supabase])

  if (allowed === true) return <>{children}</>

  if (allowed === null) {
    return (
      <div className="flex min-h-[320px] items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="flex min-h-[320px] items-center justify-center p-6">
      <div className="max-w-md rounded-lg border bg-card p-6 text-center shadow-sm">
        <ShieldX className="mx-auto h-8 w-8 text-muted-foreground" />
        <h2 className="mt-4 text-lg font-semibold">Acceso restringido</h2>
        <p className="mt-2 text-sm text-muted-foreground">Esta cola pertenece al proceso de aprobación de gastos.</p>
      </div>
    </div>
  )
}
