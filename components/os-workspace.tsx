'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { OsActions } from '@/components/os-actions'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useLanguage } from '@/lib/hooks/use-language'

const operationsApi = process.env.NEXT_PUBLIC_BLACK_SWAN_OPERATIONS_API_URL

type Locale = 'en' | 'es' | 'de'
type WorkspacePayload = Record<string, unknown>
type WorkspaceRow = Record<string, unknown>
type WorkspaceSection = { key: string; rows: WorkspaceRow[] }
type NavItem = { key: string; label: string; href: string }
type Navigation = { role?: string; is_member?: boolean; items?: NavItem[] }

const copy = {
  en: { member: 'Member', loading: 'Loading…', refresh: 'Refresh', loadError: 'Unable to load workspace.', recordsDescription: 'Canonical records only. Empty states indicate missing source data or no records, not simulated content.', empty: 'No canonical records are available for this section yet.', yes: 'Yes', no: 'No', items: (count: number) => `${count} item${count === 1 ? '' : 's'}` },
  es: { member: 'Miembro', loading: 'Cargando…', refresh: 'Actualizar', loadError: 'No fue posible cargar el espacio de trabajo.', recordsDescription: 'Solo registros canónicos. Los estados vacíos indican ausencia de datos de origen o de registros, no contenido simulado.', empty: 'Aún no hay registros canónicos disponibles para esta sección.', yes: 'Sí', no: 'No', items: (count: number) => `${count} elemento${count === 1 ? '' : 's'}` },
  de: { member: 'Mitglied', loading: 'Wird geladen…', refresh: 'Aktualisieren', loadError: 'Arbeitsbereich konnte nicht geladen werden.', recordsDescription: 'Nur kanonische Datensätze. Leere Zustände bedeuten fehlende Quelldaten oder fehlende Einträge, keine simulierten Inhalte.', empty: 'Für diesen Bereich sind noch keine kanonischen Datensätze verfügbar.', yes: 'Ja', no: 'Nein', items: (count: number) => `${count} Element${count === 1 ? '' : 'e'}` },
} as const

const workspaceMeta = {
  people: {
    en: ['People Graph', 'Members are the root people object. Guests remain attached to the inviting Member, with current on-ground presence controlling guest access.'],
    es: ['Grafo de personas', 'Los miembros son el objeto raíz de personas. Los huéspedes permanecen asociados al miembro que invita y su presencia actual en el lugar controla el acceso.'],
    de: ['Personengraph', 'Mitglieder sind das zentrale Personenobjekt. Gäste bleiben dem einladenden Mitglied zugeordnet; die aktuelle Anwesenheit vor Ort steuert den Gastzugang.'],
  },
  audit: {
    en: ['Audit Center', 'Cross-system exception dashboard for entity allocation, People Graph rules, event-to-education completeness, provider compliance, intercompany terms and accounting review queues.'],
    es: ['Centro de auditoría', 'Panel transversal de excepciones para asignación de entidades, reglas del grafo de personas, integridad evento-educación, cumplimiento de proveedores, condiciones intercompañía y colas de revisión contable.'],
    de: ['Audit-Zentrum', 'Systemübergreifendes Ausnahme-Dashboard für Entitätszuordnung, Regeln des Personengraphen, Vollständigkeit von Event-zu-Bildung, Anbieter-Compliance, Intercompany-Bedingungen und Buchhaltungsprüfungen.'],
  },
  education: {
    en: ['Education', 'Event-derived educational collections and materials, including editorial state, privacy classification and publication readiness.'],
    es: ['Educación', 'Colecciones y materiales educativos derivados de eventos, incluyendo estado editorial, clasificación de privacidad y preparación para publicación.'],
    de: ['Bildung', 'Aus Veranstaltungen abgeleitete Bildungssammlungen und Materialien einschließlich Redaktionsstatus, Datenschutzklassifizierung und Publikationsbereitschaft.'],
  },
  events: {
    en: ['Events', 'Member-linked event planning, invite-only guest pages, external service providers, operational status and Education output.'],
    es: ['Eventos', 'Planificación de eventos vinculada a miembros, páginas de invitados por invitación, proveedores externos, estado operativo y resultados para Educación.'],
    de: ['Veranstaltungen', 'Mitgliederbezogene Veranstaltungsplanung, Gastseiten nur auf Einladung, externe Dienstleister, Betriebsstatus und Ergebnisse für Bildung.'],
  },
  'event-providers': {
    en: ['External Event Providers', 'Canonical supplier-backed inventory of external event service providers, compliance state, preferred status and engagement history.'],
    es: ['Proveedores externos de eventos', 'Inventario canónico respaldado por proveedores para servicios externos de eventos, estado de cumplimiento, preferencia e historial de contrataciones.'],
    de: ['Externe Eventanbieter', 'Kanonischer, lieferantengestützter Bestand externer Eventdienstleister mit Compliance-Status, Präferenz und Einsatzhistorie.'],
  },
  'front-door': {
    en: ['Sales & Marketing', 'The Foundation front door: approved educational material from events, prepared for controlled public disclosure and outreach.'],
    es: ['Ventas y marketing', 'La puerta de entrada de la Fundación: material educativo aprobado proveniente de eventos, preparado para difusión pública controlada y relacionamiento.'],
    de: ['Vertrieb und Marketing', 'Der öffentliche Einstieg der Stiftung: freigegebene Bildungsinhalte aus Veranstaltungen, vorbereitet für kontrollierte Veröffentlichung und Ansprache.'],
  },
  imports: {
    en: ['Canonical Imports', 'Review-first employee and inventory source batches. Santi’s source files remain required before any entity allocation is applied.'],
    es: ['Importaciones canónicas', 'Lotes de origen de personal e inventario con revisión previa. Los archivos fuente de Santi siguen siendo obligatorios antes de aplicar cualquier asignación de entidad.'],
    de: ['Kanonische Importe', 'Quellbatches für Personal und Inventar mit Prüfung vor der Übernahme. Santis Quelldateien bleiben Voraussetzung, bevor Entitätszuordnungen angewendet werden.'],
  },
  intercompany: {
    en: ['Intercompany', 'Rules and audit readiness across legal entities. Commercial terms remain incomplete until approved agreements provide lease amounts, tax treatment and references.'],
    es: ['Intercompañía', 'Reglas y preparación para auditoría entre entidades legales. Las condiciones comerciales permanecen incompletas hasta que acuerdos aprobados definan arriendos, tratamiento tributario y referencias.'],
    de: ['Intercompany', 'Regeln und Audit-Bereitschaft über Rechtseinheiten hinweg. Kommerzielle Bedingungen bleiben unvollständig, bis genehmigte Vereinbarungen Mietbeträge, steuerliche Behandlung und Referenzen festlegen.'],
  },
  'orchard-kitchen': {
    en: ['Orchard & Kitchen', 'One shared Corporación operating workspace for orchard and kitchen costs, purchases, suppliers and approved allocations.'],
    es: ['Huerto y cocina', 'Un espacio operativo compartido de la Corporación para costos, compras, proveedores y asignaciones aprobadas del huerto y la cocina.'],
    de: ['Obstgarten und Küche', 'Ein gemeinsamer Betriebsarbeitsbereich der Corporación für Kosten, Einkäufe, Lieferanten und genehmigte Zuordnungen von Obstgarten und Küche.'],
  },
} as const

async function accessToken() {
  const supabase = createClient()
  const { data } = await supabase.auth.getSession()
  return data.session?.access_token || null
}

async function call(path: string) {
  if (!operationsApi) throw new Error('OPERATIONS_API_NOT_CONFIGURED')
  const token = await accessToken()
  if (!token) throw new Error('AUTHENTICATION_REQUIRED')
  const response = await fetch(`${operationsApi}${path}`, { headers: { authorization: `Bearer ${token}` } })
  const body = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(body?.error?.code || 'REQUEST_FAILED')
  return body.data
}

function humanize(value: string) {
  return value.replaceAll('_', ' ').replaceAll('-', ' ').replace(/\b\w/g, (m) => m.toUpperCase())
}

function getSections(payload: WorkspacePayload): WorkspaceSection[] {
  const preferred = ['members','events','collections','materials','costs','responsibilities','providers','engagements','publications','batches','rows','rules','checks']
  const seen = new Set<string>()
  const sections: WorkspaceSection[] = []
  for (const key of preferred) {
    const value = payload[key]
    if (Array.isArray(value)) { sections.push({ key, rows: value as WorkspaceRow[] }); seen.add(key) }
  }
  for (const [key, value] of Object.entries(payload)) {
    if (key === 'summary' || seen.has(key) || !Array.isArray(value)) continue
    sections.push({ key, rows: value as WorkspaceRow[] })
  }
  return sections.length ? sections : [{ key: 'records', rows: [] }]
}

function sectionColumns(rows: WorkspaceRow[]) {
  const first = rows[0]
  if (!first) return []
  return Object.keys(first).filter((key) => {
    const value = first[key]
    return !Array.isArray(value) && (typeof value !== 'object' || value === null)
  }).slice(0, 10)
}

export function OsWorkspace({ workspace, title, description }: { workspace: string; title?: string; description?: string }) {
  const { language } = useLanguage()
  const lang = language as Locale
  const text = copy[lang]
  const locale = lang === 'es' ? 'es-CL' : lang === 'de' ? 'de-DE' : 'en-US'
  const meta = workspaceMeta[workspace as keyof typeof workspaceMeta]?.[lang]
  const resolvedTitle = meta?.[0] ?? title ?? humanize(workspace)
  const resolvedDescription = meta?.[1] ?? description ?? ''
  const [payload, setPayload] = useState<WorkspacePayload | null>(null)
  const [references, setReferences] = useState<WorkspacePayload>({})
  const [navigation, setNavigation] = useState<Navigation | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(true)

  const displayValue = (value: unknown) => {
    if (value === null || value === undefined) return '—'
    if (typeof value === 'boolean') return value ? text.yes : text.no
    if (typeof value === 'number') return value.toLocaleString(locale)
    if (Array.isArray(value)) return text.items(value.length)
    if (typeof value === 'object') return JSON.stringify(value)
    return String(value)
  }

  async function load() {
    setBusy(true); setError(null)
    try {
      const [workspaceData, navigationData, referenceData] = await Promise.all([
        call(`/v1/os/workspaces/${workspace}`),
        call('/v1/os/navigation'),
        call(`/v1/os/references/${workspace}`).catch(() => ({})),
      ])
      setPayload(workspaceData || {}); setNavigation(navigationData || {}); setReferences(referenceData || {})
    } catch {
      setError(text.loadError)
    } finally { setBusy(false) }
  }

  useEffect(() => { void load() }, [workspace, text.loadError])

  const summary = (payload?.summary && typeof payload.summary === 'object' ? payload.summary : {}) as Record<string, unknown>
  const sections = useMemo(() => getSections(payload || {}), [payload])
  const localizedHref = (href: string) => href.startsWith('/') && !/^\/(en|es|de)(\/|$)/.test(href) ? `/${lang}${href}` : href

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div><CardTitle>{resolvedTitle}</CardTitle><CardDescription className="mt-1 max-w-3xl">{resolvedDescription}</CardDescription></div>
            <div className="flex items-center gap-2">
              {navigation?.role && <Badge variant="outline">{navigation.role}</Badge>}
              {navigation?.is_member && <Badge variant="secondary">{text.member}</Badge>}
              <Button variant="outline" size="sm" onClick={() => void load()} disabled={busy}>{busy ? text.loading : text.refresh}</Button>
            </div>
          </div>
        </CardHeader>
        {navigation?.items?.length ? <CardContent className="flex flex-wrap gap-2">{navigation.items.map((item) => <Button key={item.key} asChild variant={item.key === workspace ? 'default' : 'outline'} size="sm"><Link href={localizedHref(item.href)}>{item.label}</Link></Button>)}</CardContent> : null}
      </Card>

      {error && <div className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">{error}</div>}

      {!error && <>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">{Object.entries(summary).map(([key, value]) => <Card key={key}><CardContent className="p-4"><div className="text-xs uppercase tracking-wide text-muted-foreground">{humanize(key)}</div><div className="mt-1 text-2xl font-semibold">{displayValue(value)}</div></CardContent></Card>)}</div>
        <OsActions workspace={workspace} payload={payload || {}} references={references} onDone={load} />
        {sections.map((section) => {
          const columns = sectionColumns(section.rows)
          return <Card key={section.key}><CardHeader><CardTitle>{humanize(section.key)}</CardTitle><CardDescription>{text.recordsDescription}</CardDescription></CardHeader><CardContent className="overflow-x-auto">{section.rows.length === 0 ? <p className="text-sm text-muted-foreground">{text.empty}</p> : <table className="w-full min-w-[720px] text-sm"><thead><tr>{columns.map((column) => <th key={column} className="border-b p-2 text-left font-medium">{humanize(column)}</th>)}</tr></thead><tbody>{section.rows.map((row, index) => <tr key={String(row.id || `${section.key}-${index}`)}>{columns.map((column) => <td key={column} className="border-b p-2 align-top">{displayValue(row[column])}</td>)}</tr>)}</tbody></table>}</CardContent></Card>
        })}
      </>}
    </div>
  )
}