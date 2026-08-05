"use client"

import Link from "next/link"
import { useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import {
  ArrowRight,
  BedDouble,
  Beef,
  Building2,
  CalendarDays,
  ChevronRight,
  ClipboardCheck,
  Grape,
  LogOut,
  Package,
  ShieldCheck,
  ShoppingCart,
  Users,
  Wrench,
  Zap,
} from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { OperationsCenter } from "@/components/dashboard/operations-center"

const quickActions = [
  {
    label: "Calendario de reservas",
    description: "Llegadas, salidas, habitaciones, tareas y eventos en un solo timeline.",
    href: "/bookings",
    icon: BedDouble,
  },
  {
    label: "Centro de mantenimiento",
    description: "Incidencias, trabajos preventivos y bloqueos operacionales.",
    href: "/maintenance",
    icon: Wrench,
  },
  {
    label: "Compras e inventario",
    description: "Solicitudes, aprobaciones, recepción, activos y existencias.",
    href: "/procurement",
    icon: ShoppingCart,
  },
  {
    label: "Evento Black Swan",
    description: "Participantes, alojamientos, presupuesto y compras del 10 al 14 de agosto.",
    href: "/events/paseo-black-swan",
    icon: CalendarDays,
  },
]

const systemAreas = [
  {
    label: "Hospitalidad y reservas",
    description: "Reservas, huéspedes, habitaciones, Housekeeping y Hospitality.",
    icon: Building2,
    href: "/bookings",
  },
  {
    label: "Personas y operación",
    description: "Equipo, responsabilidades, tareas y coordinación diaria.",
    icon: Users,
    href: "/employees",
  },
  {
    label: "Inventario y activos",
    description: "Movimientos, custodias, existencias y trazabilidad.",
    icon: Package,
    href: "/inventory",
  },
  {
    label: "Ganadería",
    description: "Potreros, crianza, sanidad y planificación ganadera.",
    icon: Beef,
    href: "/cattle",
  },
  {
    label: "Viñedo y huerto",
    description: "Cultivos, manejo, sanidad, producción y cosechas.",
    icon: Grape,
    href: "/vineyard",
  },
  {
    label: "Energía y combustibles",
    description: "Consumo, generación, registros y validaciones.",
    icon: Zap,
    href: "/energy",
  },
]

const platformPrinciples = [
  "Una sola fuente operacional",
  "Permisos por rol, área y ubicación",
  "Datos canónicos y trazabilidad",
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
    <div className="min-h-screen bg-[#f4f6f4] text-[#17211c]">
      <header className="sticky top-0 z-40 border-b border-black/10 bg-[#f4f6f4]/95 backdrop-blur">
        <div className="mx-auto flex max-w-[1600px] items-center justify-between px-4 py-4 sm:px-8 lg:px-10">
          <Link href="/" className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-black/10 bg-white shadow-sm">
              <img src="/blackswan-logo.png" alt="Blackswan Facility Core" className="h-8 w-8 object-contain" />
            </div>
            <div>
              <p className="text-sm font-semibold tracking-[0.08em]">BLACK SWAN FACILITY CORE</p>
              <p className="text-xs text-[#657069]">Fundo Corcovado · Valdivia</p>
            </div>
          </Link>

          <div className="flex items-center gap-2">
            <Link href="/admin/access" className="hidden sm:block">
              <Button variant="ghost" size="sm" className="text-[#455149]">
                <ShieldCheck className="mr-2 h-4 w-4" />Accesos
              </Button>
            </Link>
            <Button variant="outline" size="sm" onClick={handleLogout} disabled={closingSession} className="border-black/10 bg-white">
              <LogOut className="mr-2 h-4 w-4" />{closingSession ? "Cerrando…" : "Cerrar sesión"}
            </Button>
          </div>
        </div>
      </header>

      <main>
        <section className="border-b border-black/10 bg-[#17211c] text-white">
          <div className="mx-auto grid max-w-[1600px] gap-10 px-4 py-12 sm:px-8 sm:py-16 lg:grid-cols-[1.15fr_0.85fr] lg:px-10 lg:py-20">
            <div className="max-w-4xl">
              <div className="mb-6 flex flex-wrap gap-2">
                {platformPrinciples.map((item) => (
                  <span key={item} className="rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs text-white/70">
                    {item}
                  </span>
                ))}
              </div>
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#9cb4a7]">Centro interno de operaciones</p>
              <h1 className="mt-4 max-w-3xl text-4xl font-semibold leading-[1.05] tracking-[-0.035em] sm:text-5xl lg:text-6xl">
                Toda la operación del Fundo, conectada en un solo sistema.
              </h1>
              <p className="mt-6 max-w-2xl text-base leading-7 text-white/65 sm:text-lg">
                Reservas, eventos, mantenimiento, compras, inventario, personas y territorio coordinados desde una única fuente confiable.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Link href="/bookings">
                  <Button size="lg" className="bg-white text-[#17211c] hover:bg-white/90">
                    Abrir calendario <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </Link>
                <Link href="/events/paseo-black-swan">
                  <Button size="lg" variant="outline" className="border-white/20 bg-transparent text-white hover:bg-white/10 hover:text-white">
                    Ver evento canónico
                  </Button>
                </Link>
              </div>
            </div>

            <div className="self-end rounded-2xl border border-white/10 bg-white/[0.04] p-6">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#9cb4a7]">Evento activo</p>
              <h2 className="mt-3 text-2xl font-semibold">Paseo Black Swan</h2>
              <p className="mt-2 text-sm text-white/60">10–14 agosto 2026</p>
              <div className="mt-6 grid grid-cols-3 gap-3">
                <div className="rounded-xl border border-white/10 bg-black/10 p-4">
                  <p className="text-2xl font-semibold">9</p>
                  <p className="mt-1 text-xs text-white/55">Participantes</p>
                </div>
                <div className="rounded-xl border border-white/10 bg-black/10 p-4">
                  <p className="text-2xl font-semibold">7</p>
                  <p className="mt-1 text-xs text-white/55">Ocupaciones</p>
                </div>
                <div className="rounded-xl border border-white/10 bg-black/10 p-4">
                  <p className="text-2xl font-semibold">78</p>
                  <p className="mt-1 text-xs text-white/55">Partidas</p>
                </div>
              </div>
              <Link href="/events/paseo-black-swan" className="mt-5 flex items-center justify-between rounded-xl border border-white/10 px-4 py-3 text-sm transition-colors hover:bg-white/5">
                <span>Presupuesto canónico: CLP 2.268.450</span>
                <ChevronRight className="h-4 w-4 text-white/50" />
              </Link>
            </div>
          </div>
        </section>

        <div className="mx-auto max-w-[1600px] space-y-14 px-4 py-10 sm:px-8 lg:px-10 lg:py-14">
          <section>
            <div className="mb-5 flex items-end justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#6f7d74]">Acceso inmediato</p>
                <h2 className="mt-2 text-2xl font-semibold tracking-tight">Entrar al trabajo principal</h2>
              </div>
            </div>
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              {quickActions.map((item) => {
                const Icon = item.icon
                return (
                  <Link key={item.href} href={item.href} className="group rounded-2xl border border-black/10 bg-white p-5 shadow-[0_1px_0_rgba(0,0,0,0.03)] transition-all hover:-translate-y-0.5 hover:border-black/20 hover:shadow-lg hover:shadow-black/5">
                    <div className="flex items-start justify-between">
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#e9efeb] text-[#244332]">
                        <Icon className="h-5 w-5" />
                      </div>
                      <ArrowRight className="h-4 w-4 text-[#8a958e] transition-transform group-hover:translate-x-1" />
                    </div>
                    <h3 className="mt-6 text-base font-semibold">{item.label}</h3>
                    <p className="mt-2 text-sm leading-6 text-[#69746d]">{item.description}</p>
                  </Link>
                )
              })}
            </div>
          </section>

          <section className="rounded-3xl border border-black/10 bg-white p-5 shadow-sm sm:p-7 lg:p-8">
            <OperationsCenter />
          </section>

          <section>
            <div className="mb-5">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#6f7d74]">Plataforma completa</p>
              <h2 className="mt-2 text-2xl font-semibold tracking-tight">Áreas conectadas</h2>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-[#69746d]">
                Cada módulo mantiene su operación detallada, pero comparte permisos, ubicaciones, responsables, auditoría y datos canónicos.
              </p>
            </div>
            <div className="grid overflow-hidden rounded-2xl border border-black/10 bg-black/10 md:grid-cols-2 xl:grid-cols-3">
              {systemAreas.map((area) => {
                const Icon = area.icon
                return (
                  <Link key={area.href} href={area.href} className="group flex min-h-44 flex-col justify-between bg-white p-6 transition-colors hover:bg-[#f8faf8]">
                    <div className="flex items-start justify-between">
                      <Icon className="h-5 w-5 text-[#315c45]" />
                      <ChevronRight className="h-4 w-4 text-[#8a958e] transition-transform group-hover:translate-x-1" />
                    </div>
                    <div className="mt-8">
                      <h3 className="text-sm font-semibold">{area.label}</h3>
                      <p className="mt-2 text-sm leading-6 text-[#69746d]">{area.description}</p>
                    </div>
                  </Link>
                )
              })}
            </div>
          </section>

          <section className="grid gap-6 rounded-3xl bg-[#dfe7e2] p-6 sm:p-8 lg:grid-cols-[0.8fr_1.2fr] lg:p-10">
            <div>
              <ClipboardCheck className="h-6 w-6 text-[#315c45]" />
              <h2 className="mt-5 text-2xl font-semibold tracking-tight">Diseñado para operación real</h2>
            </div>
            <div className="grid gap-5 sm:grid-cols-3">
              <div>
                <p className="text-sm font-semibold">Prioridades visibles</p>
                <p className="mt-2 text-sm leading-6 text-[#5d6961]">Pendientes, bloqueos y vencimientos aparecen antes que los reportes generales.</p>
              </div>
              <div>
                <p className="text-sm font-semibold">Acceso controlado</p>
                <p className="mt-2 text-sm leading-6 text-[#5d6961]">Cada persona ve únicamente las acciones, departamentos y ubicaciones autorizadas.</p>
              </div>
              <div>
                <p className="text-sm font-semibold">Datos verificables</p>
                <p className="mt-2 text-sm leading-6 text-[#5d6961]">La plataforma separa datos canónicos, estimados, pendientes y operacionales.</p>
              </div>
            </div>
          </section>
        </div>
      </main>

      <footer className="border-t border-black/10 bg-white px-4 py-6 text-center text-xs text-[#6f7d74] sm:px-8">
        Black Swan Facility Core · Fundo Corcovado, Valdivia · Uso interno
      </footer>
    </div>
  )
}
