"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { createClient } from "@/lib/supabase/client"

export type EffectiveAccess = {
  user_id: string | null
  role: string
  is_admin: boolean
  has_explicit_scopes: boolean
  allowed_actions: string[]
  departments: string[]
  location_ids: string[]
}

const EMPTY_ACCESS: EffectiveAccess = {
  user_id: null,
  role: "none",
  is_admin: false,
  has_explicit_scopes: false,
  allowed_actions: [],
  departments: [],
  location_ids: [],
}

function normalizeAccess(value: unknown): EffectiveAccess {
  const row = Array.isArray(value) ? value[0] : value
  if (!row || typeof row !== "object") return EMPTY_ACCESS
  const record = row as Record<string, unknown>

  return {
    user_id: typeof record.user_id === "string" ? record.user_id : null,
    role: typeof record.role === "string" ? record.role : "none",
    is_admin: record.is_admin === true,
    has_explicit_scopes: record.has_explicit_scopes === true,
    allowed_actions: Array.isArray(record.allowed_actions) ? record.allowed_actions.filter((item): item is string => typeof item === "string") : [],
    departments: Array.isArray(record.departments) ? record.departments.filter((item): item is string => typeof item === "string").map((item) => item.toLowerCase()) : [],
    location_ids: Array.isArray(record.location_ids) ? record.location_ids.filter((item): item is string => typeof item === "string") : [],
  }
}

export function useEffectiveAccess() {
  const supabase = useMemo(() => createClient(), [])
  const [access, setAccess] = useState<EffectiveAccess>(EMPTY_ACCESS)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    setLoading(true)
    const { data, error: rpcError } = await supabase.rpc("get_current_user_effective_access")
    if (rpcError) {
      setAccess(EMPTY_ACCESS)
      setError(rpcError.message)
    } else {
      setAccess(normalizeAccess(data))
      setError(null)
    }
    setLoading(false)
  }, [supabase])

  useEffect(() => {
    void refresh()
    const { data: listener } = supabase.auth.onAuthStateChange(() => void refresh())
    return () => listener.subscription.unsubscribe()
  }, [refresh, supabase])

  const can = useCallback((action: string) => access.is_admin || access.allowed_actions.includes(action), [access])
  const canAccessDepartment = useCallback((department: string) => {
    if (access.is_admin || !access.has_explicit_scopes) return true
    const normalized = department.toLowerCase()
    return access.departments.includes("*") || access.departments.includes("all") || access.departments.includes(normalized)
  }, [access])

  return { access, loading, error, refresh, can, canAccessDepartment }
}
