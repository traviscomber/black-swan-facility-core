"use client"

import { Banknote, CreditCard, ShieldCheck } from "lucide-react"
import { useLanguage } from "@/lib/hooks/use-language"

const COPY = {
  en: {
    title: "Payment methods",
    subtitle: "Configure the payment methods available to the booking operation.",
    transfer: "Bank transfer",
    transferStatus: "Active",
    transferBody: "Manual payments are recorded against the reservation with amount and bank reference. They update the canonical payment status and remain visible in Payments, Invoices and the Stay Cockpit.",
    tuu: "TUU",
    tuuStatus: "Pending credentials",
    tuuBody: "Remote POS integration is already implemented. Activation is pending the TUU API key and device serial. Provider secrets are never stored in the booking database.",
    scope: "Operational scope",
    scopeBody: "Only verified payment methods are exposed. Cash, generic card and other methods remain hidden until they are explicitly configured.",
  },
  es: {
    title: "Métodos de pago",
    subtitle: "Configura los métodos de pago disponibles para la operación de reservas.",
    transfer: "Transferencia bancaria",
    transferStatus: "Activo",
    transferBody: "Los pagos manuales se registran contra la reserva con monto y referencia bancaria. Actualizan el estado canónico del pago y quedan visibles en Pagos, Facturas y Stay Cockpit.",
    tuu: "TUU",
    tuuStatus: "Pendiente de credenciales",
    tuuBody: "La integración Remote POS ya está implementada. La activación queda pendiente de la API key de TUU y el serial del dispositivo. Los secretos del proveedor nunca se guardan en la base de datos de Booking.",
    scope: "Alcance operacional",
    scopeBody: "Sólo se muestran métodos de pago verificados. Efectivo, tarjeta genérica y otros métodos permanecen ocultos hasta que sean configurados explícitamente.",
  },
  de: {
    title: "Zahlungsmethoden",
    subtitle: "Konfigurieren Sie die für den Buchungsbetrieb verfügbaren Zahlungsmethoden.",
    transfer: "Banküberweisung",
    transferStatus: "Aktiv",
    transferBody: "Manuelle Zahlungen werden mit Betrag und Bankreferenz der Reservierung zugeordnet. Sie aktualisieren den kanonischen Zahlungsstatus und bleiben in Zahlungen, Rechnungen und im Stay Cockpit sichtbar.",
    tuu: "TUU",
    tuuStatus: "Zugangsdaten ausstehend",
    tuuBody: "Die Remote-POS-Integration ist bereits implementiert. Für die Aktivierung fehlen noch TUU API-Key und Geräteseriennummer. Provider-Geheimnisse werden niemals in der Booking-Datenbank gespeichert.",
    scope: "Operativer Umfang",
    scopeBody: "Es werden nur verifizierte Zahlungsmethoden angezeigt. Bargeld, generische Kartenzahlung und andere Methoden bleiben verborgen, bis sie ausdrücklich konfiguriert sind.",
  },
} as const

export default function BookingPaymentMethodsPage() {
  const { language } = useLanguage()
  const c = COPY[language]

  return (
    <div className="min-h-screen bg-[#171512] text-[#e7e1d8]">
      <header className="border-b border-white/[0.07] bg-[#211e1a] px-5 py-4">
        <h1 className="text-lg font-medium">{c.title}</h1>
        <p className="mt-1 text-xs text-[#b9b0a4]">{c.subtitle}</p>
      </header>

      <main className="mx-auto max-w-5xl p-5">
        <div className="grid gap-px bg-white/[0.05] md:grid-cols-2">
          <section className="bg-[#211e1a] p-5">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-3">
                <Banknote className="h-5 w-5 text-[#8fb79f]" />
                <div>
                  <h2 className="text-sm font-medium">{c.transfer}</h2>
                  <span className="mt-1 inline-block text-[10px] font-medium uppercase tracking-[0.08em] text-[#9db69f]">{c.transferStatus}</span>
                </div>
              </div>
            </div>
            <p className="mt-4 text-xs leading-5 text-[#b9b0a4]">{c.transferBody}</p>
          </section>

          <section className="bg-[#211e1a] p-5">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-3">
                <CreditCard className="h-5 w-5 text-[#d3ad61]" />
                <div>
                  <h2 className="text-sm font-medium">{c.tuu}</h2>
                  <span className="mt-1 inline-block text-[10px] font-medium uppercase tracking-[0.08em] text-[#d3ad61]">{c.tuuStatus}</span>
                </div>
              </div>
            </div>
            <p className="mt-4 text-xs leading-5 text-[#b9b0a4]">{c.tuuBody}</p>
          </section>
        </div>

        <section className="mt-5 flex gap-3 bg-[#1d1a17] p-4">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-[#8f867b]" />
          <div>
            <h2 className="text-xs font-medium">{c.scope}</h2>
            <p className="mt-1 text-[11px] leading-5 text-[#8f867b]">{c.scopeBody}</p>
          </div>
        </section>
      </main>
    </div>
  )
}
