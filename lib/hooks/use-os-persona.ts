"use client"

import { useEffect, useMemo, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { useLanguage } from "@/lib/hooks/use-language"
import { getOsPersonaLabel, normalizeOsPersona, type OsPersonaKey } from "@/lib/os/personas"

export function useOsPersona() {
  const supabase = useMemo(() => createClient(), [])
  const { language } = useLanguage()
  const [persona, setPersona] = useState<OsPersonaKey>("general")
  const [firstName, setFirstName] = useState<string>("")
  const [primaryDomain, setPrimaryDomain] = useState<string | null>(null)
  const [startPath, setStartPath] = useState<string>("/os")
  const [employeeId, setEmployeeId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false

    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user || cancelled) {
        if (!cancelled) setLoading(false)
        return
      }

      const fullName = typeof user.user_metadata?.full_name === "string" ? user.user_metadata.full_name.trim() : ""
      const fallbackName = user.email?.split("@")[0]?.split(/[._-]/)[0] ?? ""
      const resolvedFirstName = fullName.split(/\s+/)[0] || fallbackName

      // UX context only. Route permissions remain server/database controlled.
      const { data } = await supabase
        .from("user_access_profiles")
        .select("os_persona_key, os_primary_domain, os_start_path, employee_id")
        .eq("user_id", user.id)
        .maybeSingle()

      if (cancelled) return
      setFirstName(resolvedFirstName)
      setPersona(normalizeOsPersona(data?.os_persona_key))
      setPrimaryDomain(typeof data?.os_primary_domain === "string" ? data.os_primary_domain : null)
      setStartPath(typeof data?.os_start_path === "string" && data.os_start_path.startsWith("/") ? data.os_start_path : "/os")
      setEmployeeId(typeof data?.employee_id === "string" ? data.employee_id : null)
      setLoading(false)
    }

    void load().catch(() => {
      if (!cancelled) setLoading(false)
    })

    return () => {
      cancelled = true
    }
  }, [supabase])

  return {
    persona,
    personaLabel: getOsPersonaLabel(persona, primaryDomain, language),
    firstName,
    primaryDomain,
    startPath,
    employeeId,
    loading,
  }
}
