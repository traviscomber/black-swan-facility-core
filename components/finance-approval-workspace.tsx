'use client'

import type { ReactNode } from 'react'
import { useEffect, useMemo, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { TomasInfrastructureInvoiceQueue } from '@/components/tomas-infrastructure-invoice-queue'

export function FinanceApprovalWorkspace({ children }: { children: ReactNode }) {
  const supabase = useMemo(() => createClient(), [])
  const [mode, setMode] = useState<'loading' | 'raimundo' | 'tomas' | 'none'>('loading')

  useEffect(() => {
    let cancelled = false
    void Promise.all([
      supabase.rpc('can_finance_approve'),
      supabase.rpc('can_review_infrastructure_invoices'),
    ]).then(([approval, infrastructure]) => {
      if (cancelled) return
      if (!approval.error && approval.data) setMode('raimundo')
      else if (!infrastructure.error && infrastructure.data) setMode('tomas')
      else setMode('none')
    })
    return () => { cancelled = true }
  }, [supabase])

  if (mode === 'loading') return <div className="flex min-h-[320px] items-center justify-center"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
  if (mode === 'tomas') return <TomasInfrastructureInvoiceQueue />
  if (mode === 'raimundo') return <>{children}</>
  return null
}
