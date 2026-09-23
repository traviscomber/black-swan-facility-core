"use client"

import { useEffect, useMemo, useState } from "react"
import { Banknote, CreditCard, ShieldCheck, WalletCards } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { useLanguage } from "@/lib/hooks/use-language"

type ExternalMethod = { id:string; source_system:string; external_ref:string; label:string; enabled:boolean; configuration:Record<string,unknown>|null }

const SENSITIVE_CONFIG_KEY = /(secret|token|password|api[_-]?key|credential|private[_-]?key)/i
function safeConfiguration(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(safeConfiguration)
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value as Record<string, unknown>).map(([key, item]) => [key, SENSITIVE_CONFIG_KEY.test(key) ? "[redacted]" : safeConfiguration(item)]))
  }
  return value
}

const COPY={
  en:{title:"Payment methods",subtitle:"Verified payment capabilities for Booking plus the preserved BedBooking configuration.",active:"Active",inactive:"Inactive",historical:"Migrated configuration",operational:"Black Swan operational methods",transfer:"Bank transfer",transferBody:"Manual payments are recorded against the reservation with amount and bank reference. They update the canonical payment state and remain visible in Payments, Invoices and Stay Cockpit.",place:"Payment on place",placeBody:"Preserved from BedBooking as an enabled operational option. Payment is recorded canonically when received.",tuu:"TUU Remote POS",pending:"Pending credentials",tuuBody:"Remote POS integration is implemented. Activation requires the TUU API key and device serial. Provider secrets are not stored in the Booking database.",scope:"Control rule",scopeBody:"Only verified methods are presented as active. Unverified provider states from the BedBooking snapshot are kept as migration evidence, not promoted to live payment methods."},
  es:{title:"Métodos de pago",subtitle:"Capacidades de pago verificadas para Reservas y configuración preservada desde BedBooking.",active:"Activo",inactive:"Inactivo",historical:"Configuración migrada",operational:"Métodos operacionales Black Swan",transfer:"Transferencia bancaria",transferBody:"Los pagos manuales se registran contra la reserva con monto y referencia bancaria. Actualizan el estado canónico y quedan visibles en Pagos, Facturas y Stay Cockpit.",place:"Pago en el lugar",placeBody:"Preservado desde BedBooking como opción operacional activa. El pago se registra canónicamente al momento de recibirse.",tuu:"TUU Remote POS",pending:"Pendiente de credenciales",tuuBody:"La integración Remote POS está implementada. La activación requiere API key de TUU y serial del dispositivo. Los secretos del proveedor no se almacenan en Booking.",scope:"Regla de control",scopeBody:"Sólo se presentan como activos métodos verificados. Estados no verificados del snapshot de BedBooking se conservan como evidencia de migración y no se promueven a métodos vivos."},
  de:{title:"Zahlungsmethoden",subtitle:"Verifizierte Zahlungsfunktionen für Booking plus erhaltene BedBooking-Konfiguration.",active:"Aktiv",inactive:"Inaktiv",historical:"Migrierte Konfiguration",operational:"Black-Swan-Zahlungsmethoden",transfer:"Banküberweisung",transferBody:"Manuelle Zahlungen werden mit Betrag und Bankreferenz der Reservierung zugeordnet und im kanonischen Zahlungsstatus geführt.",place:"Zahlung vor Ort",placeBody:"Aus BedBooking als aktive Betriebsoption erhalten. Zahlung wird beim Eingang kanonisch erfasst.",tuu:"TUU Remote POS",pending:"Zugangsdaten ausstehend",tuuBody:"Remote POS ist implementiert. Aktivierung benötigt TUU API-Key und Geräteseriennummer. Provider-Geheimnisse werden nicht in Booking gespeichert.",scope:"Kontrollregel",scopeBody:"Nur verifizierte Methoden werden aktiv dargestellt. Nicht verifizierte BedBooking-Providerzustände bleiben Migrationsnachweis und werden nicht aktiviert."},
} as const

export default function BookingPaymentMethodsPage(){
  const {language}=useLanguage(); const c=COPY[language]
  const supabase=useMemo(()=>createClient(),[])
  const [methods,setMethods]=useState<ExternalMethod[]>([])
  const [error,setError]=useState<string|null>(null)

  useEffect(()=>{void(async()=>{
    const {data,error:loadError}=await supabase.from("booking_external_payment_methods").select("id,source_system,external_ref,label,enabled,configuration").order("label")
    if(loadError)setError(loadError.message);else setMethods((data??[]) as ExternalMethod[])
  })()},[supabase])

  const transfer=methods.find(m=>m.external_ref==="bank-transfer")
  const onPlace=methods.find(m=>m.external_ref==="payment-on-place")

  return <div className="min-h-screen bg-[#171512] text-[#e7e1d8]">
    <header className="bg-[#211e1a] px-5 py-4"><h1 className="text-lg font-medium">{c.title}</h1><p className="mt-1 text-xs text-[#b9b0a4]">{c.subtitle}</p></header>
    {error?<div className="bg-[#3a211d] px-5 py-2 text-xs text-[#e7a393]">{error}</div>:null}
    <main className="max-w-6xl p-5">
      <div className="mb-2 text-[11px] uppercase tracking-[.08em] text-[#8f867b]">{c.operational}</div>
      <div className="grid gap-px bg-white/[.05] md:grid-cols-3">
        <MethodCard icon={<Banknote className="h-5 w-5"/>} title={c.transfer} status={transfer?.enabled===false?c.inactive:c.active} active={transfer?.enabled!==false} body={c.transferBody} detail={transfer?.configuration}/>
        <MethodCard icon={<WalletCards className="h-5 w-5"/>} title={c.place} status={onPlace?.enabled===false?c.inactive:c.active} active={onPlace?.enabled!==false} body={c.placeBody} detail={onPlace?.configuration}/>
        <MethodCard icon={<CreditCard className="h-5 w-5"/>} title={c.tuu} status={c.pending} active={false} body={c.tuuBody}/>
      </div>

      <div className="mt-6 mb-2 text-[11px] uppercase tracking-[.08em] text-[#8f867b]">{c.historical}</div>
      <div className="overflow-x-auto bg-[#211e1a]"><table className="w-full min-w-[720px] text-xs"><thead className="bg-[#2b2722] text-left text-[#8f867b]"><tr><th className="px-3 py-2">Source</th><th className="px-3 py-2">Method</th><th className="px-3 py-2">Status</th><th className="px-3 py-2">Configuration</th></tr></thead><tbody>{methods.map(method=><tr key={method.id} className="border-t border-white/[.05]"><td className="px-3 py-2">{method.source_system}</td><td className="px-3 py-2">{method.label}</td><td className="px-3 py-2">{method.enabled?c.active:c.inactive}</td><td className="px-3 py-2 font-mono text-[11px] text-[#8f867b]">{method.configuration?JSON.stringify(safeConfiguration(method.configuration)):"{}"}</td></tr>)}</tbody></table></div>

      <section className="mt-5 flex gap-3 bg-[#1d1a17] p-4"><ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-[#8f867b]"/><div><h2 className="text-xs font-medium">{c.scope}</h2><p className="mt-1 text-[11px] leading-5 text-[#8f867b]">{c.scopeBody}</p></div></section>
    </main>
  </div>
}

function MethodCard({icon,title,status,active,body,detail}:{icon:React.ReactNode;title:string;status:string;active:boolean;body:string;detail?:Record<string,unknown>|null}){
  return <section className="bg-[#211e1a] p-5"><div className="flex items-start gap-3"><div className={active?"text-[#8fb79f]":"text-[#d3ad61]"}>{icon}</div><div><h2 className="text-sm font-medium">{title}</h2><span className={`mt-1 inline-block text-[10px] uppercase tracking-[.08em] ${active?"text-[#9db69f]":"text-[#d3ad61]"}`}>{status}</span></div></div><p className="mt-4 text-xs leading-5 text-[#b9b0a4]">{body}</p>{detail&&Object.keys(detail).length?<pre className="mt-3 whitespace-pre-wrap break-all bg-[#171512] p-2 text-[10px] text-[#8f867b]">{JSON.stringify(safeConfiguration(detail),null,2)}</pre>:null}</section>
}
