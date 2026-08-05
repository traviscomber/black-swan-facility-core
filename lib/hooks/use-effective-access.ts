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

function stringArray(value: unknown) {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : []
}

function normalizeAccess(value: unknown): EffectiveAccess {
  const row = Array.isArray(value) ? value[0] : value
  if (!row || typeof row !== "object") return EMPTY_ACCESS
  const record = row as Record<string, unknown>

  const userId = record.user_id ?? record.userId
  const isAdmin = record.is_admin ?? record.isAdmin
  const hasExplicitScopes = record.has_explicit_scopes ?? record.hasExplicitScopes
  const actions = record.allowed_actions ?? record.actions
  const locations = record.location_ids ?? record.locations

  return {
    user_id: typeof userId === "string" ? userId : null,
    role: typeof record.role === "string" ? record.role : "none",
    is_admin: isAdmin === true,
    has_explicit_scopes: hasExplicitScopes === true,
    allowed_actions: stringArray(actions),
    departments: stringArray(record.departments).map((item) => item.toLowerCase()),
    location_ids: stringArray(locations),
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
