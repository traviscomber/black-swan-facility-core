"use client"

import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { useLanguage } from "@/lib/hooks/use-language"

const copy = {
  en: { title: "Profile", subtitle: "Current authenticated account for the Booking workspace.", email: "Email", role: "Role", department: "Department", loading: "Loading profile…", unavailable: "Not provided", account: "Authenticated account" },
  es: { title: "Perfil", subtitle: "Cuenta autenticada actual del workspace Booking.", email: "Correo", role: "Rol", department: "Departamento", loading: "Cargando perfil…", unavailable: "No informado", account: "Cuenta autenticada" },
  de: { title: "Profil", subtitle: "Aktuell authentifiziertes Konto für den Booking-Arbeitsbereich.", email: "E-Mail", role: "Rolle", department: "Abteilung", loading: "Profil wird geladen…", unavailable: "Nicht angegeben", account: "Authentifiziertes Konto" },
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

  return (
    <section className="min-h-screen bg-[#171512] text-[#e7e1d8]">
      <header className="min-h-[58px] bg-[#211e1a] px-4 py-3 md:px-5">
        <h1 className="text-base font-normal tracking-tight">{c.title}</h1>
        <p className="text-xs text-[#b9b0a4]">{c.subtitle}</p>
      </header>

      {!profile ? (
        <div className="px-5 py-10 text-sm text-[#8f867b]">{c.loading}</div>
      ) : (
        <div className="max-w-3xl">
          <div className="bg-[#2b2722] px-5 py-3 text-[11px] uppercase tracking-[0.08em] text-[#8f867b]">{c.account}</div>
          <dl className="text-sm">
            <ProfileRow label={c.email} value={profile.email ?? c.unavailable} />
            <ProfileRow label={c.role} value={profile.role ?? c.unavailable} />
            <ProfileRow label={c.department} value={profile.department ?? c.unavailable} />
          </dl>
        </div>
      )}
    </section>
  )
}

function ProfileRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-[minmax(120px,160px)_1fr] border-b border-[#39342d] px-5 py-4">
      <dt className="text-[#8f867b]">{label}</dt>
      <dd className="min-w-0 break-words text-[#e7e1d8]">{value}</dd>
    </div>
  )
}
