"use client"

import Link from "next/link"
import { useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { Building2, ChevronRight, LogOut, Package, ShieldCheck, ShoppingCart, Wrench } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { OperationsCenter } from "@/components/dashboard/operations-center"
import { OperationalCalendar } from "@/components/operational-calendar"

const areas = [
  { label: "Hospitalidad y reservas", description: "Calendario, huéspedes, habitaciones y Housekeeping.", icon: Building2, href: "/bookings" },
  { label: "Mantenimiento", description: "Incidencias, trabajos y bloqueos operacionales.", icon: Wrench, href: "/maintenance" },
  { label: "Compras", description: "Solicitudes, aprobaciones, órdenes y recepción.", icon: ShoppingCart, href: "/procurement" },
  { label: "Inventario", description: "Existencias, movimientos, custodia y trazabilidad.", icon: Package, href: "/inventory" },
]

export default function OperationsDashboard() {
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])
  const [closingSession, setClosingSession] = useState(false)

  const handleLogout = async () => {
    setClosingSession(true)
    await supabase.auth.signOut()
    router.push("/auth/login")
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border bg-background">
        <div className="mx-auto flex max-w-[1600px] items-center justify-between gap-8 px-5 py-5 sm:px-8 lg:px-10">
          <Link href="/" className="flex min-w-0 items-center gap-4">
            <img src="/blackswan-logo.png" alt="Black Swan Facility Core" className="h-12 w-12 shrink-0 object-contain" />
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.13em]">Black Swan</p>
              <p className="text-xs uppercase tracking-[0.17em] text-muted-foreground">Facility Core</p>
            </div>
          </Link>
          <div className="flex items-center gap-2">
            <Button asChild variant="ghost" size="sm"><Link href="/admin/access"><ShieldCheck className="mr-2 h-4 w-4" />Accesos</Link></Button>
            <Button variant="ghost" size="sm" onClick={handleLogout} disabled={closingSession}><LogOut className="mr-2 h-4 w-4" />{closingSession ? "Cerrando…" : "Salir"}</Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1600px] space-y-12 px-5 py-10 sm:px-8 lg:px-10 lg:py-14">
        <section className="grid gap-8 border-b border-border pb-10 lg:grid-cols-[1fr_auto] lg:items-end">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">Black Swan Facility Core</p>
            <h1 className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">Dashboard operacional</h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground sm:text-base">Lo próximo que debe ejecutarse, cuándo debe ocurrir y qué requiere confirmación o responsable.</p>
          </div>
          <Link href="/events/paseo-black-swan" className="group flex min-w-0 items-center justify-between gap-6 border-l-2 border-primary bg-card px-5 py-4 transition-colors hover:bg-accent/40 lg:min-w-[360px]">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">Evento vigente</p>
              <p className="mt-2 text-sm font-semibold">Paseo Black Swan</p>
              <p className="mt-1 text-xs text-muted-foreground">10–14 agosto 2026 · 9 participantes</p>
            </div>
            <ChevronRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-1" />
          </Link>
        </section>

        <OperationalCalendar days={14} compact title="Qué debe ocurrir en los próximos 14 días" />

        <section className="border-t border-border pt-10">
          <OperationsCenter />
        </section>

        <section className="space-y-5 border-t border-border pt-10">
          <div><p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Áreas</p><h2 className="mt-2 text-xl font-semibold">Gestión detallada</h2></div>
          <div className="grid gap-px overflow-hidden rounded-lg border border-border bg-border md:grid-cols-2 xl:grid-cols-4">
            {areas.map((area) => {
              const Icon = area.icon
              return <Link key={area.href} href={area.href} className="group flex min-h-36 flex-col justify-between bg-card p-5 transition-colors hover:bg-accent/50">
                <div className="flex items-start justify-between"><Icon className="h-5 w-5 text-primary" /><ChevronRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-1" /></div>
                <div className="mt-8"><h3 className="text-sm font-semibold">{area.label}</h3><p className="mt-2 text-sm leading-6 text-muted-foreground">{area.description}</p></div>
              </Link>
            })}
          </div>
        </section>
      </main>
    </div>
  )
}
