"use client"

import { useMemo } from "react"
import { useSearchParams } from "next/navigation"
import { useLanguage } from "@/lib/hooks/use-language"

const copy = {
  en: {
    title: "Sales channels",
    subtitle: "External booking channels and calendar synchronization.",
    channel: "Channel",
    status: "Status",
    scope: "Scope",
    detail: "Detail",
    selected: "Selected channel",
    notConfigured: "Not configured",
    direct: "No production connection is configured in Black Swan yet.",
    noCredentials: "No credentials, listing mapping or synchronization job is stored for this channel.",
    safeState: "This view is informational only until a canonical integration is configured.",
    airbnb: "Airbnb",
    booking: "Booking.com",
    ical: "iCalendar",
    availability: "Availability and reservations",
    calendar: "Calendar synchronization",
  },
  es: {
    title: "Canales de venta",
    subtitle: "Canales externos de reservas y sincronización de calendarios.",
    channel: "Canal",
    status: "Estado",
    scope: "Alcance",
    detail: "Detalle",
    selected: "Canal seleccionado",
    notConfigured: "No configurado",
    direct: "Black Swan todavía no tiene una conexión productiva configurada para este canal.",
    noCredentials: "No existen credenciales, mapeo de anuncios ni trabajo de sincronización almacenado para este canal.",
    safeState: "Esta vista es sólo informativa hasta que exista una integración canónica configurada.",
    airbnb: "Airbnb",
    booking: "Booking.com",
    ical: "iCalendar",
    availability: "Disponibilidad y reservas",
    calendar: "Sincronización de calendario",
  },
  de: {
    title: "Vertriebskanäle",
    subtitle: "Externe Buchungskanäle und Kalendersynchronisierung.",
    channel: "Kanal",
    status: "Status",
    scope: "Umfang",
    detail: "Detail",
    selected: "Ausgewählter Kanal",
    notConfigured: "Nicht konfiguriert",
    direct: "Für diesen Kanal ist in Black Swan noch keine produktive Verbindung konfiguriert.",
    noCredentials: "Für diesen Kanal sind keine Zugangsdaten, Listing-Zuordnung oder Synchronisierungsjobs gespeichert.",
    safeState: "Diese Ansicht ist nur informativ, bis eine kanonische Integration konfiguriert ist.",
    airbnb: "Airbnb",
    booking: "Booking.com",
    ical: "iCalendar",
    availability: "Verfügbarkeit und Reservierungen",
    calendar: "Kalendersynchronisierung",
  },
} as const

type ChannelKey = "airbnb" | "booking" | "ical"

export default function BookingChannelsPage() {
  const { language } = useLanguage()
  const searchParams = useSearchParams()
  const c = copy[language]

  const rows = useMemo(() => [
    { key: "airbnb" as const, name: c.airbnb, scope: c.availability },
    { key: "booking" as const, name: c.booking, scope: c.availability },
    { key: "ical" as const, name: c.ical, scope: c.calendar },
  ], [c])

  const requested = searchParams.get("channel")
  const selectedKey: ChannelKey | null = requested === "airbnb" || requested === "booking" || requested === "ical" ? requested : null
  const selected = selectedKey ? rows.find((row) => row.key === selectedKey) ?? null : null

  return (
    <div className="min-h-screen bg-[#171512] text-[#e7e1d8]">
      <header className="min-h-[58px] bg-[#211e1a] px-4 py-3 md:px-5">
        <h1 className="font-normal tracking-tight text-[#e7e1d8]">{c.title}</h1>
        <p className="text-xs text-[#b9b0a4]">{c.subtitle}</p>
      </header>

      {selected && (
        <section className="bg-[#2b2722] px-4 py-4 md:px-5" aria-live="polite">
          <div className="text-[11px] uppercase tracking-[0.08em] text-[#8f867b]">{c.selected}</div>
          <div className="mt-1 flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <h2 className="text-base font-normal text-[#e7e1d8]">{selected.name}</h2>
            <span className="text-[11px] text-[#d3ad61]">{c.notConfigured}</span>
          </div>
          <p className="mt-2 max-w-3xl text-xs leading-5 text-[#b9b0a4]">{c.direct}</p>
          <p className="mt-1 max-w-3xl text-xs leading-5 text-[#8f867b]">{c.noCredentials}</p>
          <p className="mt-3 text-[11px] text-[#8f867b]">{c.safeState}</p>
        </section>
      )}

      <div className="overflow-x-auto">
        <table className="w-full min-w-[760px] text-xs">
          <thead className="bg-[#211e1a] text-left text-[11px] uppercase tracking-[0.08em] text-[#8f867b]">
            <tr>
              <th className="px-4 py-2.5 font-medium">{c.channel}</th>
              <th className="px-4 py-2.5 font-medium">{c.scope}</th>
              <th className="px-4 py-2.5 font-medium">{c.status}</th>
              <th className="px-4 py-2.5 font-medium">{c.detail}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const isSelected = row.key === selectedKey
              return (
                <tr key={row.key} className={isSelected ? "bg-[#2b2722]" : "bg-[#171512]"}>
                  <td className="px-4 py-3 font-medium text-[#e7e1d8]">{row.name}</td>
                  <td className="px-4 py-3 text-[#b9b0a4]">{row.scope}</td>
                  <td className="px-4 py-3"><span className="text-[11px] text-[#d3ad61]">{c.notConfigured}</span></td>
                  <td className="px-4 py-3 text-[#8f867b]">{c.direct}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
