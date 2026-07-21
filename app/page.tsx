'use client'

import Link from "next/link"
import { useState, useEffect } from "react"
import {
  Building2, Beef, Grape, Zap, Wrench, Package,
  Users, Calendar, Anchor, ChevronRight, ShoppingCart
} from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { useRouter } from "next/navigation"

const modules = [
  {
    label: "Hospitalidad",
    description: "Reservas, huéspedes, cocina y conserjería",
    icon: Building2,
    href: "/bookings",
    color: "#726658",
  },
  {
    label: "Ganadería",
    description: "Salud animal, pastoreo y registros",
    icon: Beef,
    href: "/cattle",
    color: "#5a4e45",
  },
  {
    label: "Viñedo",
    description: "Cosecha, bodega y huerto",
    icon: Grape,
    href: "/vineyard",
    color: "#726658",
  },
  {
    label: "Energía",
    description: "Consumo, solar y reportes Victron",
    icon: Zap,
    href: "/energy-dashboard",
    color: "#5a4e45",
  },
  {
    label: "Mantenimiento",
    description: "Issues, tareas y checklists",
    icon: Wrench,
    href: "/maintenance",
    color: "#726658",
  },
  {
    label: "Inventario",
    description: "Stock, activos y combustibles",
    icon: Package,
    href: "/inventory",
    color: "#5a4e45",
  },
  {
    label: "Personas",
    description: "Equipo, voluntarios y empleados",
    icon: Users,
    href: "/employees",
    color: "#726658",
  },
  {
    label: "Actividades",
    description: "Calendario y planificación",
    icon: Calendar,
    href: "/activities-calendar",
    color: "#5a4e45",
  },
  {
    label: "Puertos",
    description: "Embarcaciones y programación",
    icon: Anchor,
    href: "/ports-boats",
    color: "#726658",
  },
  {
    label: "Compras",
    description: "Solicitudes y aprobaciones",
    icon: ShoppingCart,
    href: "/procurement",
    color: "#5a4e45",
  },
]

export default function Landing() {
  const [userEmail, setUserEmail] = useState<string | null>(null)
  const [isClient, setIsClient] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    setIsClient(true)
    supabase.auth.getUser().then(({ data: { user } }) => {
      setUserEmail(user?.email ?? null)
    })
  }, [])

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push("/auth/login")
  }

  return (
    <div
      className="min-h-screen flex flex-col"
      style={{ backgroundColor: "var(--background)", color: "var(--foreground)" }}
    >
      {/* Header */}
      <header
        className="flex items-center justify-between px-8 py-5 border-b"
        style={{ borderColor: "var(--border)" }}
      >
        <div className="flex items-center gap-3">
          <div
            className="h-8 w-8 rounded-full flex items-center justify-center text-sm font-bold text-white"
            style={{ backgroundColor: "var(--primary)" }}
          >
            BS
          </div>
          <span className="font-semibold tracking-wide text-sm uppercase" style={{ color: "var(--foreground)" }}>
            Black Swan Facility Core
          </span>
        </div>

        {isClient && (
          <div className="flex items-center gap-4">
            {userEmail && (
              <span className="text-sm hidden sm:block" style={{ color: "var(--muted-foreground)" }}>
                {userEmail}
              </span>
            )}
            {userEmail ? (
              <button
                onClick={handleLogout}
                className="text-sm px-3 py-1.5 rounded-md border transition-colors hover:bg-secondary"
                style={{ borderColor: "var(--border)", color: "var(--muted-foreground)" }}
              >
                Cerrar sesión
              </button>
            ) : (
              <Link
                href="/auth/login"
                className="text-sm px-3 py-1.5 rounded-md transition-colors"
                style={{ backgroundColor: "var(--primary)", color: "var(--primary-foreground)" }}
              >
                Ingresar
              </Link>
            )}
          </div>
        )}
      </header>

      {/* Hero */}
      <section className="px-8 py-16 max-w-4xl">
        <p
          className="text-xs font-semibold uppercase tracking-widest mb-4"
          style={{ color: "var(--primary)" }}
        >
          Plataforma de gestión
        </p>
        <h1
          className="text-4xl sm:text-5xl font-bold leading-tight mb-4 text-balance"
          style={{ color: "var(--foreground)" }}
        >
          Black Swan
          <br />
          Facility Core
        </h1>
        <p
          className="text-base max-w-lg leading-relaxed"
          style={{ color: "var(--muted-foreground)" }}
        >
          Sistema de operaciones integrado para la gestión completa de la propiedad — hospitalidad, ganadería, viñedo, energía y más.
        </p>
      </section>

      {/* Divider */}
      <div className="px-8">
        <div className="h-px w-full" style={{ backgroundColor: "var(--border)" }} />
      </div>

      {/* Modules grid */}
      <section className="px-8 py-12 flex-1">
        <p
          className="text-xs font-semibold uppercase tracking-widest mb-8"
          style={{ color: "var(--muted-foreground)" }}
        >
          Módulos
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-px"
          style={{ backgroundColor: "var(--border)" }}
        >
          {modules.map((mod) => {
            const Icon = mod.icon
            return (
              <Link
                key={mod.href}
                href={mod.href}
                className="group flex flex-col gap-3 p-6 transition-colors"
                style={{ backgroundColor: "var(--background)" }}
                onMouseEnter={e => (e.currentTarget.style.backgroundColor = "var(--card)")}
                onMouseLeave={e => (e.currentTarget.style.backgroundColor = "var(--background)")}
              >
                <div className="flex items-start justify-between">
                  <div
                    className="h-9 w-9 rounded-lg flex items-center justify-center"
                    style={{ backgroundColor: "var(--card)" }}
                  >
                    <Icon className="h-4 w-4" style={{ color: "var(--primary)" }} />
                  </div>
                  <ChevronRight
                    className="h-4 w-4 opacity-0 group-hover:opacity-100 transition-opacity"
                    style={{ color: "var(--muted-foreground)" }}
                  />
                </div>
                <div>
                  <p className="font-semibold text-sm mb-1" style={{ color: "var(--foreground)" }}>
                    {mod.label}
                  </p>
                  <p className="text-xs leading-relaxed" style={{ color: "var(--muted-foreground)" }}>
                    {mod.description}
                  </p>
                </div>
              </Link>
            )
          })}
        </div>
      </section>

      {/* Footer */}
      <footer
        className="px-8 py-6 border-t flex items-center justify-between"
        style={{ borderColor: "var(--border)" }}
      >
        <p className="text-xs" style={{ color: "var(--muted-foreground)" }}>
          © 2026 Black Swan Facility Core
        </p>
        <p className="text-xs" style={{ color: "var(--muted-foreground)" }}>
          v2.1
        </p>
      </footer>
    </div>
  )
}
