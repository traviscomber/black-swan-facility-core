'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter, useSearchParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { toast } from 'sonner'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const searchParams = useSearchParams()
  const supabase = createClient()

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
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
    <div className="flex min-h-screen">
      <div className="hidden lg:flex lg:w-1/2 flex-col justify-between p-12" style={{ backgroundColor: 'var(--primary)' }}>
        <div><div className="flex items-center gap-2"><div className="h-8 w-8 rounded-full bg-white/20 flex items-center justify-center"><span className="text-white font-bold text-sm">BS</span></div><span className="text-white font-semibold tracking-wide text-sm uppercase">Black Swan Facility</span></div></div>
        <div className="space-y-4"><blockquote className="text-white/90 text-2xl font-light leading-relaxed">&ldquo;Control operativo con trazabilidad y acceso seguro por usuario.&rdquo;</blockquote><p className="text-white/60 text-sm">Black Swan Facility Core</p></div>
        <div><p className="text-white/40 text-xs">© 2026 Black Swan Facility Core</p></div>
      </div>

      <div className="flex w-full lg:w-1/2 flex-col items-center justify-center px-6 py-12" style={{ backgroundColor: 'var(--background)' }}>
        <div className="flex lg:hidden items-center gap-2 mb-10"><div className="h-8 w-8 rounded-full flex items-center justify-center" style={{ backgroundColor: 'var(--primary)' }}><span className="text-white font-bold text-sm">BS</span></div><span className="text-foreground font-semibold tracking-wide text-sm uppercase">Black Swan Facility</span></div>
        <div className="w-full max-w-sm space-y-8">
          <div className="space-y-1"><h1 className="text-2xl font-bold tracking-tight" style={{ color: 'var(--foreground)', fontSize: 'var(--font-size-3xl)' }}>Iniciar sesión</h1><p style={{ color: 'var(--muted-foreground)', fontSize: 'var(--font-size-sm)' }}>Ingresa tus credenciales para acceder</p></div>
          <form onSubmit={handleLogin} className="space-y-5">
            <div className="space-y-2"><label htmlFor="email" className="block text-sm font-medium" style={{ color: 'var(--foreground)' }}>Email</label><Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="usuario@dominio.com" disabled={loading} required style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border)', color: 'var(--foreground)' }} /></div>
            <div className="space-y-2"><label htmlFor="password" className="block text-sm font-medium" style={{ color: 'var(--foreground)' }}>Contraseña</label><Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" disabled={loading} required style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border)', color: 'var(--foreground)' }} /></div>
            <Button type="submit" disabled={loading} className="w-full font-semibold" style={{ backgroundColor: 'var(--primary)', color: 'var(--primary-foreground)' }}>{loading ? 'Ingresando...' : 'Ingresar'}</Button>
          </form>
          <p className="text-center text-xs" style={{ color: 'var(--muted-foreground)' }}>Acceso restringido a usuarios autorizados.<br />Contacta al administrador si no tienes acceso.</p>
        </div>
      </div>
    </div>
  )
}
