"use client"

import { useEffect, useMemo, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { getOsPersonaLabel, normalizeOsPersona, type OsPersonaKey } from "@/lib/os/personas"

export function useOsPersona() {
  const supabase = useMemo(() => createClient(), [])
  const [persona, setPersona] = useState<OsPersonaKey>("general")
  const [firstName, setFirstName] = useState<string>("")
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

      // UX persona is read only to prioritize presentation. It never grants access.
      const { data } = await supabase
        .from("user_access_profiles")
        .select("os_persona_key")
        .eq("user_id", user.id)
        .maybeSingle()

      if (cancelled) return
      setFirstName(resolvedFirstName)
      setPersona(normalizeOsPersona(data?.os_persona_key))
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
    personaLabel: getOsPersonaLabel(persona),
    firstName,
    loading,
  }
}
