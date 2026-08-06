'use client'

import { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const searchParams = useSearchParams()
  const supabase = createClient()

  const handleLogin = async (event: React.FormEvent) => {
    event.preventDefault()
    setLoading(true)

    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) {
        toast.error(error.message)
        return
      }

      if (data?.user) {
        const requestedPath = searchParams.get('next')
        const destination = requestedPath?.startsWith('/') && !requestedPath.startsWith('//') ? requestedPath : '/'
        router.refresh()
        router.push(destination)
      }
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : 'Ocurrió un error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="grid min-h-dvh bg-[var(--bs-bg-primary)] lg:grid-cols-2">
      <section className="relative hidden overflow-hidden bg-[var(--bs-bg-secondary)] p-12 lg:flex lg:flex-col lg:justify-between">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 opacity-70"
          style={{
            backgroundImage:
              'radial-gradient(circle at 18% 20%, rgba(139,203,168,0.12) 0 1px, transparent 1.5px), radial-gradient(circle at 72% 76%, rgba(139,203,168,0.08) 0 1px, transparent 1.5px)',
            backgroundSize: '32px 32px, 48px 48px',
          }}
        />
        <div aria-hidden="true" className="absolute inset-y-0 right-0 w-px bg-[var(--bs-divider-subtle)]" />
        <div aria-hidden="true" className="absolute left-0 top-0 h-1 w-40 bg-[var(--bs-cool-sage)]" />

        <header className="relative flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--bs-surface-elevated)] text-xs font-medium text-[var(--bs-text-primary)]">
            BS
          </div>
          <span className="text-[13px] font-medium tracking-[0.08em] text-[var(--bs-text-primary)]">
            BLACK SWAN FACILITY
          </span>
        </header>

        <div className="relative max-w-xl space-y-5">
          <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-[var(--bs-cool-sage)]">
            Facility Core
          </p>
          <blockquote className="bs-heading max-w-lg text-[30px] leading-[1.18] text-[var(--bs-text-primary)]">
            Control operacional con trazabilidad y acceso seguro por usuario.
          </blockquote>
          <p className="max-w-md text-[13px] leading-6 text-[var(--bs-text-secondary)]">
            Reservas, recursos, tareas y procedimientos coordinados desde una única operación.
          </p>
        </div>

        <footer className="relative text-xs text-[var(--bs-text-muted)]">
          © 2026 Black Swan Facility Core
        </footer>
      </section>

      <section className="flex min-h-dvh items-center justify-center bg-[var(--bs-bg-primary)] px-6 py-12 sm:px-10 lg:px-16">
        <div className="w-full max-w-sm">
          <div className="mb-10 flex items-center gap-3 lg:hidden">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--bs-surface-elevated)] text-xs font-medium text-[var(--bs-text-primary)]">
              BS
            </div>
            <span className="text-[13px] font-medium tracking-[0.08em] text-[var(--bs-text-primary)]">
              BLACK SWAN FACILITY
            </span>
          </div>

          <div className="mb-8 space-y-2">
            <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-[var(--bs-cool-sage)]">
              Acceso operativo
            </p>
            <h1 className="bs-heading text-[30px] leading-tight text-[var(--bs-text-primary)]">Iniciar sesión</h1>
            <p className="text-[13px] text-[var(--bs-text-secondary)]">Ingresa tus credenciales para acceder.</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-5">
            <div className="space-y-2">
              <label htmlFor="email" className="block text-[13px] font-medium text-[var(--bs-text-primary)]">
                Email
              </label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="usuario@dominio.com"
                autoComplete="email"
                disabled={loading}
                required
                className="h-11 border-0 bg-[var(--bs-surface-secondary)] text-[var(--bs-text-primary)] placeholder:text-[var(--bs-text-muted)]"
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="password" className="block text-[13px] font-medium text-[var(--bs-text-primary)]">
                Contraseña
              </label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="••••••••"
                autoComplete="current-password"
                disabled={loading}
                required
                className="h-11 border-0 bg-[var(--bs-surface-secondary)] text-[var(--bs-text-primary)] placeholder:text-[var(--bs-text-muted)]"
              />
            </div>

            <Button
              type="submit"
              disabled={loading}
              className="h-11 w-full border-0 bg-[var(--bs-cool-sage)] text-[13px] font-medium text-[var(--bs-bg-primary)] hover:bg-[#9bd8b6]"
            >
              {loading ? 'Ingresando…' : 'Ingresar'}
            </Button>
          </form>

          <p className="mt-7 text-center text-xs leading-5 text-[var(--bs-text-muted)]">
            Acceso restringido a usuarios autorizados.
            <br />
            Contacta al administrador si no tienes acceso.
          </p>
        </div>
      </section>
    </main>
  )
}
