"use client"

import { useLanguage } from "@/lib/hooks/use-language"
import { Badge } from "@/components/ui/badge"

const copy = {
  en: { title: "Sales channels", subtitle: "External booking channels and calendar synchronization.", channel: "Channel", status: "Status", scope: "Scope", notConfigured: "Not configured", direct: "No production connection is configured in Black Swan yet.", airbnb: "Airbnb", booking: "Booking.com", ical: "iCalendar", availability: "Availability and reservations", calendar: "Calendar synchronization" },
  es: { title: "Canales de venta", subtitle: "Canales externos de reservas y sincronización de calendarios.", channel: "Canal", status: "Estado", scope: "Alcance", notConfigured: "No configurado", direct: "Black Swan todavía no tiene una conexión productiva configurada para este canal.", airbnb: "Airbnb", booking: "Booking.com", ical: "iCalendar", availability: "Disponibilidad y reservas", calendar: "Sincronización de calendario" },
  de: { title: "Vertriebskanäle", subtitle: "Externe Buchungskanäle und Kalendersynchronisierung.", channel: "Kanal", status: "Status", scope: "Umfang", notConfigured: "Nicht konfiguriert", direct: "Für diesen Kanal ist in Black Swan noch keine produktive Verbindung konfiguriert.", airbnb: "Airbnb", booking: "Booking.com", ical: "iCalendar", availability: "Verfügbarkeit und Reservierungen", calendar: "Kalendersynchronisierung" },
} as const

export default function BookingChannelsPage() {
  const { language } = useLanguage()
  const c = copy[language]
  const rows = [
    { name: c.airbnb, scope: c.availability },
    { name: c.booking, scope: c.availability },
    { name: c.ical, scope: c.calendar },
  ]

  return <div className="min-h-screen bg-[#111213] text-foreground">
    <header className="min-h-[58px] border-b border-white/10 px-4 py-3 md:px-5"><h1 className="text-xl font-semibold tracking-tight">{c.title}</h1><p className="text-xs text-muted-foreground">{c.subtitle}</p></header>
    <div className="overflow-x-auto"><table className="w-full min-w-[760px] text-xs"><thead className="bg-[#17191a] text-left text-[11px] uppercase tracking-[0.08em] text-muted-foreground"><tr><th className="px-4 py-2.5">{c.channel}</th><th className="px-4 py-2.5">{c.scope}</th><th className="px-4 py-2.5">{c.status}</th><th className="px-4 py-2.5">Detail</th></tr></thead><tbody className="divide-y divide-white/[0.06]">{rows.map((row) => <tr key={row.name} className="bg-[#111213]"><td className="px-4 py-3 font-medium">{row.name}</td><td className="px-4 py-3 text-muted-foreground">{row.scope}</td><td className="px-4 py-3"><Badge variant="outline" className="h-5 rounded-[3px] border-white/10 bg-white/[0.03] px-1.5 text-[10px] text-muted-foreground">{c.notConfigured}</Badge></td><td className="px-4 py-3 text-muted-foreground">{c.direct}</td></tr>)}</tbody></table></div>
  </div>
}
