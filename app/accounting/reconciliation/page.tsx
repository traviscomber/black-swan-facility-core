import { BankReconciliationReview } from '@/components/bank-reconciliation-review'

export default function AccountingReconciliationPage() {
  return (
    <div className="mx-auto w-full max-w-7xl space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Bank Reconciliation</h1>
        <p className="text-sm text-muted-foreground">Review bank movements against canonical accounting documents.</p>
      </div>
      <BankReconciliationReview />
    </div>
  )
}
