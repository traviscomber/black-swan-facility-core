'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { User } from '@supabase/supabase-js'

export function useAuth() {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [isApprover, setIsApprover] = useState(false)
  const supabase = createClient()

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
      checkApproverRole(session?.user)
      setLoading(false)
    })

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
      checkApproverRole(session?.user)
    })

    return () => subscription?.unsubscribe()
  }, [])

  const checkApproverRole = async (user: User | undefined) => {
    if (!user) {
      setIsApprover(false)
      return
    }

    try {
      // Call the is_procurement_approver() function
      const { data, error } = await supabase.rpc('is_procurement_approver')

      if (error) {
        console.error('Error checking approver role:', error)
        setIsApprover(false)
        return
      }

      setIsApprover(data === true)
    } catch (error) {
      console.error('Error checking approver role:', error)
      setIsApprover(false)
    }
  }

  return { user, loading, isApprover }
}
