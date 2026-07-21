'use client'

import { ReactNode, useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

const protectedPaths = ['/procurement', '/dashboard', '/admin']

function isProtected(pathname: string | null) {
  return protectedPaths.some(p => pathname?.startsWith(p))
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isReady, setIsReady] = useState(false)
  const router = useRouter()
  const pathname = usePathname()
  const supabase = createClient()

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setIsReady(true)
      if (!session && isProtected(pathname)) {
        router.push('/auth/login')
      }
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session && isProtected(pathname)) {
        router.push('/auth/login')
      }
    })

    return () => subscription?.unsubscribe()
  }, [pathname])

  if (!isReady) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="h-8 w-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
      </div>
    )
  }

  return <>{children}</>
}
