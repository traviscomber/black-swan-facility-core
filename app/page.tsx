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
  { label: "Hospitalidad", description: "Reservas, huéspedes, cocina y conserjería", icon: Building2, href: "/bookings" },
  { label: "Ganadería", description: "Salud animal, pastoreo y registros", icon: Beef, href: "/cattle" },
  { label: "Viñedo", description: "Cosecha, bodega y huerto", icon: Grape, href: "/vineyard" },
  { label: "Energía", description: "Consumo, solar y reportes Victron", icon: Zap, href: "/energy-dashboard" },
  { label: "Mantenimiento", description: "Incidencias, tareas y listas de control", icon: Wrench, href: "/maintenance" },
  { label: "Inventario", description: "Existencias, activos y combustibles", icon: Package, href: "/inventory" },
  { label: "Personas", description: "Equipo, voluntarios y empleados", icon: Users, href: "/employees" },
  { label: "Actividades", description: "Calendario y planificación", icon: Calendar, href: "/activities-calendar" },
  { label: "Puertos", description: "Embarcaciones y programación", icon: Anchor, href: "/ports-boats" },
  { label: "Compras", description: "Solicitudes, órdenes y aprobaciones", icon: ShoppingCart, href: "/procurement" },
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
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: "var(--background)", color: "var(--foreground)" }}>
      <header className="flex items-center justify-between px-6 sm:px-8 py-5 border-b" style={{ borderColor: "var(--border)" }}>
        <div className="flex items-center gap-3">
          <div
            className="h-9 min-w-9 rounded-full px-2 flex items-center justify-center text-xs font-bold text-white tracking-wide"
            style={{ backgroundColor: "var(--primary)" }}
            aria-label="BSFC"
          >
            BSFC
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

      <main className="flex-1">
        <section className="px-6 sm:px-8 py-14 sm:py-16 max-w-4xl">
          <p className="text-xs font-semibold uppercase tracking-widest mb-4" style={{ color: "var(--primary)" }}>
            Sistema interno de operaciones
          </p>
          <h1 className="text-4xl sm:text-5xl font-bold leading-tight mb-4 text-balance" style={{ color: "var(--foreground)" }}>
            Black Swan
            <br />
            Facility Core
          </h1>
          <p className="text-base max-w-xl leading-relaxed" style={{ color: "var(--muted-foreground)" }}>
            Acceso centralizado a los módulos operativos de la propiedad, con trazabilidad y control por usuario.
          </p>
        </section>

        <div className="px-6 sm:px-8">
          <div className="h-px w-full" style={{ backgroundColor: "var(--border)" }} />
        </div>

        <section className="px-6 sm:px-8 py-12">
          <div className="mb-8">
            <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: "var(--muted-foreground)" }}>
              Módulos operativos
            </p>
            <p className="mt-2 text-sm" style={{ color: "var(--muted-foreground)" }}>
              Selecciona un área para consultar, registrar o gestionar su operación.
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-px" style={{ backgroundColor: "var(--border)" }}>
            {modules.map((mod) => {
              const Icon = mod.icon
              return (
                <Link
                  key={mod.href}
                  href={mod.href}
                  className="group flex flex-col gap-3 p-6 transition-colors hover:bg-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-inset"
                  style={{ backgroundColor: "var(--background)" }}
                >
                  <div className="flex items-start justify-between">
                    <div className="h-9 w-9 rounded-lg flex items-center justify-center" style={{ backgroundColor: "var(--card)" }}>
                      <Icon className="h-4 w-4" style={{ color: "var(--primary)" }} />
                    </div>
                    <ChevronRight className="h-4 w-4 opacity-40 group-hover:opacity-100 transition-opacity" style={{ color: "var(--muted-foreground)" }} />
                  </div>
                  <div>
                    <p className="font-semibold text-sm mb-1" style={{ color: "var(--foreground)" }}>{mod.label}</p>
                    <p className="text-xs leading-relaxed" style={{ color: "var(--muted-foreground)" }}>{mod.description}</p>
                  </div>
                </Link>
              )
            })}
          </div>
        </section>
      </main>

      <footer className="px-6 sm:px-8 py-6 border-t" style={{ borderColor: "var(--border)" }}>
        <p className="text-xs" style={{ color: "var(--muted-foreground)" }}>
          © 2026 Black Swan Facility Core · Uso interno
        </p>
      </footer>
    </div>
  )
}
