import { TuuPaymentConsole } from '@/components/tuu-payment-console'

export default function Page() {
  return <div className="space-y-6">
    <div><p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Black Swan OS · Events</p><h1 className="text-3xl font-normal">TUU POS Payments</h1><p className="mt-2 text-sm text-muted-foreground">Send event participation charges to the physical TUU terminal and synchronize provider status.</p></div>
    <TuuPaymentConsole />
  </div>
}
