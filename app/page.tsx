"use client"

import Link from "next/link"
import { useMemo, useState } from "react"
import { Beef, Building2, Calendar, ChevronRight, Grape, LogOut, Package, ShoppingCart, Users, Wrench, Zap } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { OperationsCenter } from "@/components/dashboard/operations-center"

const moduleGroups = [
  {
    label: "Operación y hospitalidad",
    description: "Trabajo diario, huéspedes, infraestructura y abastecimiento.",
    modules: [
      { label: "Hospitalidad", description: "Reservas, habitaciones, huéspedes y operación asociada.", icon: Building2, href: "/bookings" },
      { label: "Mantenimiento", description: "Trabajos preventivos, correctivos e incidencias.", icon: Wrench, href: "/maintenance" },
      { label: "Compras", description: "Solicitudes, aprobaciones, órdenes y recepción.", icon: ShoppingCart, href: "/procurement" },
      { label: "Personas", description: "Equipo, funciones y operación interna.", icon: Users, href: "/employees" },
      { label: "Actividades", description: "Calendario, responsables y planificación diaria.", icon: Calendar, href: "/activities-calendar" },
    ],
  },
  {
    label: "Recursos y territorio",
    description: "Activos, producción, energía y registros del Fundo Corcovado.",
    modules: [
      { label: "Inventario y activos", description: "Activos, existencias, movimientos y custodia.", icon: Package, href: "/inventory" },
      { label: "Ganadería", description: "Potreros, crianza, salud y planificación ganadera.", icon: Beef, href: "/cattle" },
      { label: "Viñedo y huerto", description: "Cultivos, manejo, sanidad y cosechas.", icon: Grape, href: "/vineyard" },
      { label: "Energía y combustibles", description: "Consumos, generación y validación operacional.", icon: Zap, href: "/energy" },
    ],
  },
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
        <div className="mx-auto flex max-w-[1600px] items-center justify-between px-4 py-4 sm:px-8">
          <div className="flex items-center gap-3">
            <img src="/blackswan-logo.png" alt="Blackswan Facility Core" className="h-10 w-10 object-contain" />
            <div>
              <p className="text-sm font-semibold tracking-wide">BSFC</p>
              <p className="text-xs text-muted-foreground">Fundo Corcovado · Valdivia</p>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={handleLogout} disabled={closingSession}>
            <LogOut className="mr-2 h-4 w-4" />{closingSession ? "Cerrando…" : "Cerrar sesión"}
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-[1600px] space-y-10 px-4 py-8 sm:px-8">
        <section className="max-w-3xl">
          <p className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-primary">Centro interno de operaciones</p>
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Fundo Corcovado</h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground sm:text-base">Vista diaria para una organización de aproximadamente 100 usuarios administrativos distribuidos en áreas operativas. Cada persona ve únicamente el trabajo y las ubicaciones dentro de su alcance.</p>
        </section>

        <OperationsCenter />

        <section>
          <div className="mb-6">
            <h2 className="text-lg font-semibold">Áreas del sistema</h2>
            <p className="mt-1 text-sm text-muted-foreground">Acceso a los módulos completos para revisión, planificación y gestión detallada.</p>
          </div>
          <div className="space-y-8">
            {moduleGroups.map((group) => (
              <div key={group.label}>
                <div className="mb-3">
                  <h3 className="text-sm font-semibold">{group.label}</h3>
                  <p className="mt-1 text-xs text-muted-foreground">{group.description}</p>
                </div>
                <div className="grid gap-px overflow-hidden rounded-lg border border-border bg-border sm:grid-cols-2 lg:grid-cols-3">
                  {group.modules.map((module) => {
                    const Icon = module.icon
                    return (
                      <Link key={module.href} href={module.href} className="group flex min-h-36 flex-col justify-between bg-background p-5 transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-inset">
                        <div className="flex items-start justify-between">
                          <div className="flex h-9 w-9 items-center justify-center rounded-md border border-border bg-card"><Icon className="h-4 w-4 text-primary" /></div>
                          <ChevronRight className="h-4 w-4 text-muted-foreground opacity-50 transition-all group-hover:translate-x-0.5 group-hover:opacity-100" />
                        </div>
                        <div className="mt-5">
                          <p className="text-sm font-semibold">{module.label}</p>
                          <p className="mt-1 text-xs leading-5 text-muted-foreground">{module.description}</p>
                        </div>
                      </Link>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        </section>
      </main>

      <footer className="border-t border-border px-4 py-5 text-center text-xs text-muted-foreground sm:px-8">Blackswan Facility Core · Fundo Corcovado, Valdivia · Uso interno</footer>
    </div>
  )
}
