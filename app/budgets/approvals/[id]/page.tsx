import { notFound } from 'next/navigation'
import { FinanceApprovalObjectView } from '@/components/finance-approval-object-view'
import { createClient } from '@/lib/supabase/server'

type PageProps = { params: Promise<{ id: string }> }

export default async function FinanceApprovalObjectPage({ params }: PageProps) {
  const { id } = await params
  const supabase = await createClient()
  const permission = await supabase.rpc('can_finance_approve')
  if (permission.error || !permission.data) notFound()

  const { data, error } = await supabase
    .from('finance_approval_queue')
    .select('id,document_type,external_source,external_id,supplier_name,supplier_rut,document_number,document_date,due_date,description,net_amount,tax_amount,total_amount,currency,classification_status,approval_status,valuation_status,amount_eur,fx_rate_to_eur,fx_date,confidence,confidence_label,classification_reason,historical_count,historical_dominance,historical_median,accepted_min,accepted_max,amount_in_range,decision_notes,division_name,division_key,category_name,category_key,category_role,cost_center_name,cost_center_code,operational_label')
    .eq('id', id)
    .maybeSingle()

  if (error || !data) notFound()
  return <FinanceApprovalObjectView row={data} />
}

export const dynamic = 'force-dynamic'
export const revalidate = 0
