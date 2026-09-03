"use client"

import { useEffect, useMemo, useState } from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { Check, CopyPlus, Pencil, Save, Trash2, X } from "lucide-react"
import { OrchardConfigurableDashboard } from "@/components/orchard/orchard-configurable-dashboard"
import { createBrowserClient } from "@/lib/supabase/client"
import { useLanguage } from "@/lib/hooks/use-language"

type Locale = "en" | "es" | "de"
type DashboardView = "operation" | "planning"
type DashboardProfile = {
  id: string
  user_id: string
  name: string
  base_view: DashboardView
  widget_order: unknown
  hidden_widgets: unknown
  notepad: string
}
type Preference = {
  active_view: DashboardView
  active_profile_id: string | null
  operation_widget_order: unknown
  planning_widget_order: unknown
  operation_hidden_widgets: unknown
  planning_hidden_widgets: unknown
  notepad: string
}

const copy = {
  en: {
    label: "Dashboard",
    operation: "Weekly operation",
    planning: "Planning",
    newDashboard: "New dashboard",
    namePlaceholder: "Dashboard name",
    create: "Create",
    cancel: "Cancel",
    saveLayout: "Save current layout",
    rename: "Rename",
    delete: "Delete",
    confirmDelete: "Confirm delete",
    saveName: "Save name",
    duplicate: "A dashboard with that name already exists.",
    saveError: "Could not save dashboard configuration.",
    loading: "Loading dashboards…",
    saved: "Saved",
  },
  es: {
    label: "Dashboard",
    operation: "Operación semanal",
    planning: "Planificación",
    newDashboard: "Nuevo dashboard",
    namePlaceholder: "Nombre del dashboard",
    create: "Crear",
    cancel: "Cancelar",
    saveLayout: "Guardar layout actual",
    rename: "Renombrar",
    delete: "Eliminar",
    confirmDelete: "Confirmar eliminación",
    saveName: "Guardar nombre",
    duplicate: "Ya existe un dashboard con ese nombre.",
    saveError: "No fue posible guardar la configuración del dashboard.",
    loading: "Cargando dashboards…",
    saved: "Guardado",
  },
  de: {
    label: "Dashboard",
    operation: "Wochenbetrieb",
    planning: "Planung",
    newDashboard: "Neues Dashboard",
    namePlaceholder: "Dashboard-Name",
    create: "Erstellen",
    cancel: "Abbrechen",
    saveLayout: "Aktuelles Layout speichern",
    rename: "Umbenennen",
    delete: "Löschen",
    confirmDelete: "Löschen bestätigen",
    saveName: "Namen speichern",
    duplicate: "Ein Dashboard mit diesem Namen existiert bereits.",
    saveError: "Dashboard-Konfiguration konnte nicht gespeichert werden.",
    loading: "Dashboards werden geladen…",
    saved: "Gespeichert",
  },
} as const

function profileOrder(pref: Preference, view: DashboardView) {
  return view === "operation" ? pref.operation_widget_order : pref.planning_widget_order
}
function profileHidden(pref: Preference, view: DashboardView) {
  return view === "operation" ? pref.operation_hidden_widgets : pref.planning_hidden_widgets
}

export function OrchardDashboardWorkspace() {
  const supabase = useMemo(() => createBrowserClient(), [])
  const searchParams = useSearchParams()
  const pathname = usePathname() || "/"
  const router = useRouter()
  const { language } = useLanguage()
  const lang: Locale = language
  const text = copy[lang]

  const [userId, setUserId] = useState<string | null>(null)
  const [profiles, setProfiles] = useState<DashboardProfile[]>([])
  const [selection, setSelection] = useState<string>("operation")
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [newName, setNewName] = useState("")
  const [renaming, setRenaming] = useState(false)
  const [renameValue, setRenameValue] = useState("")
  const [deleteArmed, setDeleteArmed] = useState(false)
  const [savedFlash, setSavedFlash] = useState(false)
  const [dashboardKey, setDashboardKey] = useState(0)

  const selectedProfile = profiles.find((profile) => profile.id === selection) ?? null

  const updateUrl = (profileId: string | null) => {
    const params = new URLSearchParams(searchParams.toString())
    if (profileId) params.set("dashboard", profileId)
    else params.delete("dashboard")
    const query = params.toString()
    router.replace(`${pathname}${query ? `?${query}` : ""}`, { scroll: false })
  }

  const readPreference = async (uid: string) => {
    const result = await supabase
      .from("orchard_dashboard_preferences")
      .select("active_view,active_profile_id,operation_widget_order,planning_widget_order,operation_hidden_widgets,planning_hidden_widgets,notepad")
      .eq("user_id", uid)
      .maybeSingle()
    if (result.error) throw result.error
    return result.data as Preference | null
  }

  const applyProfile = async (uid: string, profile: DashboardProfile) => {
    const layout = profile.base_view === "operation"
      ? { operation_widget_order: profile.widget_order, operation_hidden_widgets: profile.hidden_widgets }
      : { planning_widget_order: profile.widget_order, planning_hidden_widgets: profile.hidden_widgets }
    const result = await supabase.from("orchard_dashboard_preferences").upsert({
      user_id: uid,
      active_view: profile.base_view,
      active_profile_id: profile.id,
      notepad: profile.notepad ?? "",
      ...layout,
    }, { onConflict: "user_id" })
    if (result.error) throw result.error
  }

  useEffect(() => {
    let live = true
    setLoading(true)
    setError(null)
    void (async () => {
      const auth = await supabase.auth.getUser()
      const uid = auth.data.user?.id ?? null
      if (!live) return
      setUserId(uid)
      if (!uid) { setLoading(false); return }

      const [profileResult, pref] = await Promise.all([
        supabase.from("orchard_dashboard_profiles").select("id,user_id,name,base_view,widget_order,hidden_widgets,notepad").eq("user_id", uid).order("created_at"),
        readPreference(uid),
      ])
      if (!live) return
      if (profileResult.error) { setError(profileResult.error.message); setLoading(false); return }
      const nextProfiles = (profileResult.data ?? []) as DashboardProfile[]
      setProfiles(nextProfiles)

      const requestedId = searchParams.get("dashboard")
      const requestedProfile = nextProfiles.find((profile) => profile.id === requestedId) ?? null
      const activeProfile = nextProfiles.find((profile) => profile.id === pref?.active_profile_id) ?? null

      if (requestedProfile && requestedProfile.id !== pref?.active_profile_id) {
        try { await applyProfile(uid, requestedProfile) }
        catch (cause) { setError(cause instanceof Error ? cause.message : text.saveError) }
        if (!live) return
        setSelection(requestedProfile.id)
        setDashboardKey((value) => value + 1)
      } else if (requestedProfile) {
        setSelection(requestedProfile.id)
      } else if (activeProfile) {
        setSelection(activeProfile.id)
      } else {
        setSelection(pref?.active_view === "planning" ? "planning" : "operation")
      }
      setLoading(false)
    })()
    return () => { live = false }
  }, [supabase])

  const selectDashboard = async (value: string) => {
    if (!userId || busy) return
    setBusy(true)
    setError(null)
    try {
      if (value === "operation" || value === "planning") {
        const result = await supabase.from("orchard_dashboard_preferences").upsert({ user_id: userId, active_view: value, active_profile_id: null }, { onConflict: "user_id" })
        if (result.error) throw result.error
        setSelection(value)
        updateUrl(null)
      } else {
        const profile = profiles.find((item) => item.id === value)
        if (!profile) return
        await applyProfile(userId, profile)
        setSelection(profile.id)
        updateUrl(profile.id)
      }
      setDashboardKey((key) => key + 1)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : text.saveError)
    } finally {
      setBusy(false)
    }
  }

  const createDashboard = async () => {
    if (!userId || busy) return
    const name = newName.trim()
    if (!name) return
    setBusy(true)
    setError(null)
    try {
      const pref = await readPreference(userId)
      if (!pref) throw new Error(text.saveError)
      const baseView = pref.active_view === "planning" ? "planning" : "operation"
      const inserted = await supabase.from("orchard_dashboard_profiles").insert({
        user_id: userId,
        name,
        base_view: baseView,
        widget_order: profileOrder(pref, baseView),
        hidden_widgets: profileHidden(pref, baseView),
        notepad: pref.notepad ?? "",
      }).select("id,user_id,name,base_view,widget_order,hidden_widgets,notepad").single()
      if (inserted.error) {
        if (inserted.error.code === "23505") throw new Error(text.duplicate)
        throw inserted.error
      }
      const profile = inserted.data as DashboardProfile
      await applyProfile(userId, profile)
      setProfiles((current) => [...current, profile])
      setSelection(profile.id)
      setNewName("")
      setCreating(false)
      updateUrl(profile.id)
      setDashboardKey((key) => key + 1)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : text.saveError)
    } finally {
      setBusy(false)
    }
  }

  const saveCurrentLayout = async () => {
    if (!userId || !selectedProfile || busy) return
    setBusy(true)
    setError(null)
    try {
      const pref = await readPreference(userId)
      if (!pref) throw new Error(text.saveError)
      const baseView = pref.active_view === "planning" ? "planning" : "operation"
      const result = await supabase.from("orchard_dashboard_profiles").update({
        base_view: baseView,
        widget_order: profileOrder(pref, baseView),
        hidden_widgets: profileHidden(pref, baseView),
        notepad: pref.notepad ?? "",
      }).eq("id", selectedProfile.id).eq("user_id", userId).select("id,user_id,name,base_view,widget_order,hidden_widgets,notepad").single()
      if (result.error) throw result.error
      setProfiles((current) => current.map((profile) => profile.id === selectedProfile.id ? result.data as DashboardProfile : profile))
      setSavedFlash(true)
      window.setTimeout(() => setSavedFlash(false), 1400)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : text.saveError)
    } finally {
      setBusy(false)
    }
  }

  const renameDashboard = async () => {
    if (!userId || !selectedProfile || busy) return
    const name = renameValue.trim()
    if (!name) return
    setBusy(true)
    setError(null)
    try {
      const result = await supabase.from("orchard_dashboard_profiles").update({ name }).eq("id", selectedProfile.id).eq("user_id", userId).select("id,user_id,name,base_view,widget_order,hidden_widgets,notepad").single()
      if (result.error) {
        if (result.error.code === "23505") throw new Error(text.duplicate)
        throw result.error
      }
      setProfiles((current) => current.map((profile) => profile.id === selectedProfile.id ? result.data as DashboardProfile : profile))
      setRenaming(false)
      setRenameValue("")
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : text.saveError)
    } finally {
      setBusy(false)
    }
  }

  const deleteDashboard = async () => {
    if (!userId || !selectedProfile || busy) return
    if (!deleteArmed) { setDeleteArmed(true); return }
    setBusy(true)
    setError(null)
    try {
      const removed = await supabase.from("orchard_dashboard_profiles").delete().eq("id", selectedProfile.id).eq("user_id", userId)
      if (removed.error) throw removed.error
      const pref = await readPreference(userId)
      const fallback: DashboardView = pref?.active_view === "planning" ? "planning" : "operation"
      const cleared = await supabase.from("orchard_dashboard_preferences").upsert({ user_id: userId, active_profile_id: null, active_view: fallback }, { onConflict: "user_id" })
      if (cleared.error) throw cleared.error
      setProfiles((current) => current.filter((profile) => profile.id !== selectedProfile.id))
      setSelection(fallback)
      setDeleteArmed(false)
      updateUrl(null)
      setDashboardKey((key) => key + 1)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : text.saveError)
    } finally {
      setBusy(false)
    }
  }

  return <div className="orchard-dashboard-workspace">
    <style jsx global>{`
      .orchard-dashboard-workspace [data-orchard-dashboard] > header select { display: none; }
    `}</style>

    <div className="mx-auto w-full max-w-[1500px] px-4 pt-5 sm:px-6 lg:px-8">
      <section className="flex flex-col gap-3 border border-[var(--orchard-line)] bg-[var(--bs-surface-primary)] p-3 lg:flex-row lg:items-center">
        <label className="flex min-w-0 flex-1 items-center gap-3">
          <span className="text-[10px] font-semibold uppercase tracking-[.14em] text-muted-foreground">{text.label}</span>
          <select value={selection} disabled={loading || busy} onChange={(event) => void selectDashboard(event.target.value)} className="h-9 min-w-52 flex-1 border border-[var(--orchard-line)] bg-[var(--bs-bg-primary)] px-3 text-sm lg:max-w-sm">
            <option value="operation">{text.operation}</option>
            <option value="planning">{text.planning}</option>
            {profiles.map((profile) => <option key={profile.id} value={profile.id}>{profile.name}</option>)}
          </select>
        </label>

        <div className="flex flex-wrap items-center gap-2">
          {selectedProfile ? <>
            <button type="button" disabled={busy} onClick={() => void saveCurrentLayout()} className="inline-flex h-9 items-center gap-2 border border-[var(--orchard-line)] px-3 text-xs hover:bg-muted disabled:opacity-50"><Save className="h-3.5 w-3.5"/>{savedFlash ? text.saved : text.saveLayout}</button>
            <button type="button" disabled={busy} onClick={() => { setRenaming(true); setRenameValue(selectedProfile.name); setDeleteArmed(false) }} className="inline-flex h-9 items-center gap-2 border border-[var(--orchard-line)] px-3 text-xs hover:bg-muted disabled:opacity-50"><Pencil className="h-3.5 w-3.5"/>{text.rename}</button>
            <button type="button" disabled={busy} onClick={() => void deleteDashboard()} className="inline-flex h-9 items-center gap-2 border border-[var(--orchard-line)] px-3 text-xs hover:bg-muted disabled:opacity-50"><Trash2 className="h-3.5 w-3.5"/>{deleteArmed ? text.confirmDelete : text.delete}</button>
          </> : null}
          <button type="button" disabled={busy} onClick={() => { setCreating(true); setRenaming(false); setDeleteArmed(false) }} className="inline-flex h-9 items-center gap-2 bg-[var(--orchard-green)] px-3 text-xs font-medium text-black disabled:opacity-50"><CopyPlus className="h-3.5 w-3.5"/>{text.newDashboard}</button>
        </div>
      </section>

      {loading ? <p className="mt-2 text-xs text-muted-foreground">{text.loading}</p> : null}
      {error ? <p className="mt-2 text-xs text-red-300">{error}</p> : null}

      {creating ? <section className="mt-2 flex flex-col gap-2 border border-[var(--orchard-line)] bg-[var(--bs-surface-primary)] p-3 sm:flex-row sm:items-center">
        <input autoFocus maxLength={48} value={newName} onChange={(event) => setNewName(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") void createDashboard() }} placeholder={text.namePlaceholder} className="h-9 flex-1 border border-[var(--orchard-line)] bg-[var(--bs-bg-primary)] px-3 text-sm outline-none focus:border-[var(--orchard-green)]"/>
        <button type="button" disabled={busy || !newName.trim()} onClick={() => void createDashboard()} className="inline-flex h-9 items-center justify-center gap-2 bg-[var(--orchard-green)] px-3 text-xs font-medium text-black disabled:opacity-50"><Check className="h-3.5 w-3.5"/>{text.create}</button>
        <button type="button" onClick={() => { setCreating(false); setNewName("") }} className="inline-flex h-9 items-center justify-center gap-2 border border-[var(--orchard-line)] px-3 text-xs"><X className="h-3.5 w-3.5"/>{text.cancel}</button>
      </section> : null}

      {renaming && selectedProfile ? <section className="mt-2 flex flex-col gap-2 border border-[var(--orchard-line)] bg-[var(--bs-surface-primary)] p-3 sm:flex-row sm:items-center">
        <input autoFocus maxLength={48} value={renameValue} onChange={(event) => setRenameValue(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") void renameDashboard() }} className="h-9 flex-1 border border-[var(--orchard-line)] bg-[var(--bs-bg-primary)] px-3 text-sm outline-none focus:border-[var(--orchard-green)]"/>
        <button type="button" disabled={busy || !renameValue.trim()} onClick={() => void renameDashboard()} className="inline-flex h-9 items-center justify-center gap-2 bg-[var(--orchard-green)] px-3 text-xs font-medium text-black disabled:opacity-50"><Check className="h-3.5 w-3.5"/>{text.saveName}</button>
        <button type="button" onClick={() => { setRenaming(false); setRenameValue("") }} className="inline-flex h-9 items-center justify-center gap-2 border border-[var(--orchard-line)] px-3 text-xs"><X className="h-3.5 w-3.5"/>{text.cancel}</button>
      </section> : null}
    </div>

    {!loading ? <OrchardConfigurableDashboard key={`${selection}-${dashboardKey}`}/> : null}
  </div>
}
