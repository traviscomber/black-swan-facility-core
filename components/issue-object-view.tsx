'use client'

import Link from 'next/link'
import { AlertTriangle, ArrowLeft, ArrowRight, CalendarClock, ClipboardList, PackageSearch, Wrench } from 'lucide-react'
import { AppLayout } from '@/components/app-layout'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useLanguage } from '@/lib/hooks/use-language'

type IssueObject = {
  id: string
  title: string | null
  description: string | null
  status: string | null
  priority: string | null
  severity: string | null
  category: string | null
  created_at: string | null
  resolved_at: string | null
  related_item_type: string | null
  related_item_id: string | null
}

type RelatedAsset = { id: string; name: string; asset_code: string | null; status: string | null }
type RelatedReservation = { id: string; guest_name: string | null; check_in: string | null; check_out: string | null; status: string | null }
type RelatedTask = { id: string; title: string; status: string | null; priority: string | null; due_date: string | null }
type RelatedMaintenance = { id: string; title: string; status: string | null; prioridad: string | null; fecha_objetivo: string | null; bloqueado: boolean | null }

const COPY = {
  en: {
    back: 'Back to issues', object: 'Object · Issue', untitled: 'Untitled issue', noDescription: 'No description recorded.', partial: 'Some related context could not be loaded. Only RLS-visible evidence is shown.',
    state: 'Status', priority: 'Priority', category: 'Category', created: 'Created', resolved: 'Resolved', notRecorded: 'Not recorded', open: 'Open',
    cause: 'Canonical context', causeDetail: 'Observed relationships attached to this issue. No inferred links are added.', asset: 'Asset', reservation: 'Reservation', tasks: 'Derived tasks', maintenance: 'Maintenance',
    noAsset: 'No asset linked.', noReservation: 'No reservation linked.', noTasks: 'No linked tasks.', noMaintenance: 'No maintenance linked to this issue.', guest: 'Guest', stay: 'Stay', due: 'Due', blocked: 'Blocked',
  },
  es: {
    back: 'Volver a incidencias', object: 'Objeto · Incidencia', untitled: 'Incidencia sin título', noDescription: 'Sin descripción registrada.', partial: 'Parte del contexto relacionado no pudo cargarse. Sólo se muestra evidencia visible por RLS.',
    state: 'Estado', priority: 'Prioridad', category: 'Categoría', created: 'Creada', resolved: 'Resuelta', notRecorded: 'No registrado', open: 'Abierta',
    cause: 'Contexto canónico', causeDetail: 'Relaciones observadas asociadas a esta incidencia. No se agregan vínculos inferidos.', asset: 'Activo', reservation: 'Reserva', tasks: 'Tareas derivadas', maintenance: 'Mantenimiento',
    noAsset: 'Sin activo vinculado.', noReservation: 'Sin reserva vinculada.', noTasks: 'Sin tareas vinculadas.', noMaintenance: 'Sin mantenimiento vinculado a esta incidencia.', guest: 'Huésped', stay: 'Estadía', due: 'Vence', blocked: 'Bloqueado',
  },
  de: {
    back: 'Zurück zu Vorfällen', object: 'Objekt · Vorfall', untitled: 'Vorfall ohne Titel', noDescription: 'Keine Beschreibung erfasst.', partial: 'Ein Teil des zugehörigen Kontexts konnte nicht geladen werden. Es werden nur durch RLS sichtbare Nachweise gezeigt.',
    state: 'Status', priority: 'Priorität', category: 'Kategorie', created: 'Erstellt', resolved: 'Gelöst', notRecorded: 'Nicht erfasst', open: 'Offen',
    cause: 'Kanonischer Kontext', causeDetail: 'Beobachtete Beziehungen dieses Vorfalls. Es werden keine Verknüpfungen abgeleitet.', asset: 'Anlage', reservation: 'Reservierung', tasks: 'Abgeleitete Aufgaben', maintenance: 'Instandhaltung',
    noAsset: 'Keine Anlage verknüpft.', noReservation: 'Keine Reservierung verknüpft.', noTasks: 'Keine Aufgaben verknüpft.', noMaintenance: 'Keine Instandhaltung mit diesem Vorfall verknüpft.', guest: 'Gast', stay: 'Aufenthalt', due: 'Fällig', blocked: 'Blockiert',
  },
} as const

const LOCALES = { en: 'en-US', es: 'es-CL', de: 'de-DE' } as const

export function IssueObjectView({ issue, asset, reservation, tasks, maintenance, partial }: { issue: IssueObject; asset: RelatedAsset | null; reservation: RelatedReservation | null; tasks: RelatedTask[]; maintenance: RelatedMaintenance[]; partial: boolean }) {
  const { language } = useLanguage()
  const copy = COPY[language]
  const date = new Intl.DateTimeFormat(LOCALES[language], { dateStyle: 'medium', timeZone: 'America/Santiago' })
  const formatDate = (value: string | null) => value ? date.format(new Date(value.includes('T') ? value : `${value}T12:00:00-04:00`)) : copy.notRecorded
  const priority = issue.severity || issue.priority || copy.notRecorded

  return <AppLayout><div className="space-y-6 p-4 md:p-6">
    <div className="flex items-center justify-between gap-3"><Link href="/issues" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="h-4 w-4" />{copy.back}</Link><Badge variant="outline">{copy.object}</Badge></div>
    <Card><CardHeader><div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between"><div><CardTitle className="text-2xl">{issue.title || copy.untitled}</CardTitle><p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">{issue.description || copy.noDescription}</p></div><div className="flex flex-wrap gap-2"><Badge>{issue.status || copy.open}</Badge><Badge variant="secondary">{priority}</Badge></div></div></CardHeader><CardContent><div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4"><Info label={copy.state} value={issue.status || copy.open} /><Info label={copy.priority} value={priority} /><Info label={copy.category} value={issue.category || copy.notRecorded} /><Info label={copy.created} value={formatDate(issue.created_at)} /></div>{issue.resolved_at && <div className="mt-4"><Info label={copy.resolved} value={formatDate(issue.resolved_at)} /></div>}</CardContent></Card>
    {partial && <div className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/5 p-4 text-sm text-muted-foreground"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />{copy.partial}</div>}
    <section className="space-y-3"><div><h2 className="text-lg font-semibold">{copy.cause}</h2><p className="text-sm text-muted-foreground">{copy.causeDetail}</p></div><div className="grid gap-4 lg:grid-cols-2">
      <RelationCard icon={PackageSearch} title={copy.asset}>{asset ? <ObjectLink href={`/inventory/${asset.id}`} title={asset.name} detail={[asset.asset_code, asset.status].filter(Boolean).join(' · ')} /> : <Empty text={copy.noAsset} />}</RelationCard>
      <RelationCard icon={CalendarClock} title={copy.reservation}>{reservation ? <ObjectLink href={`/bookings/reservations/${reservation.id}`} title={reservation.guest_name || copy.reservation} detail={`${copy.stay}: ${formatDate(reservation.check_in)} → ${formatDate(reservation.check_out)}${reservation.status ? ` · ${reservation.status}` : ''}`} /> : <Empty text={copy.noReservation} />}</RelationCard>
      <RelationCard icon={ClipboardList} title={copy.tasks}>{tasks.length ? <div className="space-y-2">{tasks.map((task) => <ObjectLink key={task.id} href="/tasks" title={task.title} detail={[task.status, task.priority, task.due_date ? `${copy.due} ${formatDate(task.due_date)}` : null].filter(Boolean).join(' · ')} />)}</div> : <Empty text={copy.noTasks} />}</RelationCard>
      <RelationCard icon={Wrench} title={copy.maintenance}>{maintenance.length ? <div className="space-y-2">{maintenance.map((item) => <ObjectLink key={item.id} href="/maintenance" title={item.title} detail={[item.bloqueado ? copy.blocked : null, item.status, item.prioridad, item.fecha_objetivo ? `${copy.due} ${formatDate(item.fecha_objetivo)}` : null].filter(Boolean).join(' · ')} />)}</div> : <Empty text={copy.noMaintenance} />}</RelationCard>
    </div></section>
  </div></AppLayout>
}

function RelationCard({ icon: Icon, title, children }: { icon: typeof Wrench; title: string; children: React.ReactNode }) { return <Card><CardHeader className="pb-3"><CardTitle className="flex items-center gap-2 text-base"><Icon className="h-4 w-4" />{title}</CardTitle></CardHeader><CardContent>{children}</CardContent></Card> }
function ObjectLink({ href, title, detail }: { href: string; title: string; detail: string }) { return <Link href={href} className="group flex items-start justify-between gap-3 rounded-md border p-3 hover:bg-muted/40"><div className="min-w-0"><p className="font-medium">{title}</p>{detail && <p className="mt-1 text-xs text-muted-foreground">{detail}</p>}</div><ArrowRight className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" /></Link> }
function Empty({ text }: { text: string }) { return <p className="text-sm text-muted-foreground">{text}</p> }
function Info({ label, value }: { label: string; value: string }) { return <div><p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p><p className="mt-1 font-medium">{value}</p></div> }
