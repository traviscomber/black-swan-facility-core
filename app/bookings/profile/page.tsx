"use client"

import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { useLanguage } from "@/lib/hooks/use-language"

const copy = {
  en: { title: "Profile", subtitle: "Current authenticated account for the Booking workspace.", email: "Email", role: "Role", department: "Department", loading: "Loading profile…", unavailable: "Not provided" },
  es: { title: "Perfil", subtitle: "Cuenta autenticada actual del workspace Booking.", email: "Correo", role: "Rol", department: "Departamento", loading: "Cargando perfil…", unavailable: "No informado" },
  de: { title: "Profil", subtitle: "Aktuell authentifiziertes Konto für den Booking-Arbeitsbereich.", email: "E-Mail", role: "Rolle", department: "Abteilung", loading: "Profil wird geladen…", unavailable: "Nicht angegeben" },
} as const

type Profile = { email: string | null; role: string | null; department: string | null }

export default function BookingProfilePage() {
  const { language } = useLanguage()
  const c = copy[language]
  const [profile, setProfile] = useState<Profile | null>(null)

  useEffect(() => {
    const supabase = createClient()
    void supabase.auth.getUser().then(({ data: { user } }) => {
      setProfile({
        email: user?.email ?? null,
        role: String(user?.app_metadata?.role ?? user?.app_metadata?.procurement_role ?? "") || null,
        department: String(user?.app_metadata?.department ?? "") || null,
      })
    })
  }, [])

  return <div className="min-h-screen bg-[#111213] text-foreground">
    <header className="min-h-[58px] border-b border-white/10 px-4 py-3 md:px-5"><h1 className="text-xl font-semibold tracking-tight">{c.title}</h1><p className="text-xs text-muted-foreground">{c.subtitle}</p></header>
    {!profile ? <div className="px-5 py-10 text-sm text-muted-foreground">{c.loading}</div> : <dl className="divide-y divide-white/[0.06] text-sm"><div className="grid grid-cols-[160px_1fr] px-5 py-4"><dt className="text-muted-foreground">{c.email}</dt><dd>{profile.email ?? c.unavailable}</dd></div><div className="grid grid-cols-[160px_1fr] px-5 py-4"><dt className="text-muted-foreground">{c.role}</dt><dd>{profile.role ?? c.unavailable}</dd></div><div className="grid grid-cols-[160px_1fr] px-5 py-4"><dt className="text-muted-foreground">{c.department}</dt><dd>{profile.department ?? c.unavailable}</dd></div></dl>}
  </div>
}
