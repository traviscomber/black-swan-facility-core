'use client'

import Link from 'next/link'
import { AlertTriangle, ArrowLeft, ArrowRight, BedDouble, CalendarClock, Car, ClipboardList, Factory, PackageSearch, UserRound, Wrench } from 'lucide-react'
import { AppLayout } from '@/components/app-layout'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useLanguage } from '@/lib/hooks/use-language'

type Maintenance = { id:string; title:string; description:string|null; status:string|null; estado_extendido:string|null; prioridad:string|null; next_run:string|null; last_completed:string|null; fecha_objetivo:string|null; fecha_completado:string|null; bloqueado:boolean|null }
type Named = { id:string; name:string; status?:string|null }
type Asset = Named & { asset_code:string|null }
type Vehicle = Named & { code:string|null }
type Reservation = { id:string; guest_name:string|null; check_in:string|null; check_out:string|null; status:string|null }
type Room = { id:string; room_number:string|null; room_type:string|null; status:string|null; operational_status:string|null }
type Issue = { id:string; title:string|null; status:string|null; priority:string|null; severity:string|null }
type Incident = { id:string; title:string|null; status:string|null; priority:string|null; severity:string|null }
type HospitalityRequest = { id:string; request_type:string|null; status:string|null; priority:string|null; guest_name:string|null; reservation_id:string|null }

const COPY={
 en:{back:'Back to maintenance',object:'Object · Maintenance',partial:'Some related context could not be loaded. Only RLS-visible evidence is shown.',noDescription:'No description recorded.',state:'Status',priority:'Priority',target:'Target date',completed:'Completed',notRecorded:'Not recorded',blocked:'Blocked',context:'Canonical context',contextDetail:'Observed relationships attached to this maintenance work. No inferred links are added.',responsible:'Responsible',asset:'Asset',infrastructure:'Infrastructure',vehicle:'Vehicle',reservation:'Reservation',room:'Room',issue:'Issue',incident:'Incident',request:'Hospitality request',guest:'Guest',stay:'Stay',openTask:'Open operational task',none:'Not linked'},
 es:{back:'Volver a mantenimiento',object:'Objeto · Mantenimiento',partial:'Parte del contexto relacionado no pudo cargarse. Sólo se muestra evidencia visible por RLS.',noDescription:'Sin descripción registrada.',state:'Estado',priority:'Prioridad',target:'Fecha objetivo',completed:'Completado',notRecorded:'No registrado',blocked:'Bloqueado',context:'Contexto canónico',contextDetail:'Relaciones observadas asociadas a este trabajo de mantenimiento. No se agregan vínculos inferidos.',responsible:'Responsable',asset:'Activo',infrastructure:'Infraestructura',vehicle:'Vehículo',reservation:'Reserva',room:'Habitación',issue:'Incidencia',incident:'Incidente',request:'Solicitud de hospitality',guest:'Huésped',stay:'Estadía',openTask:'Abrir tarea operativa',none:'Sin vínculo'},
 de:{back:'Zurück zur Instandhaltung',object:'Objekt · Instandhaltung',partial:'Ein Teil des zugehörigen Kontexts konnte nicht geladen werden. Es werden nur durch RLS sichtbare Nachweise gezeigt.',noDescription:'Keine Beschreibung erfasst.',state:'Status',priority:'Priorität',target:'Zieldatum',completed:'Abgeschlossen',notRecorded:'Nicht erfasst',blocked:'Blockiert',context:'Kanonischer Kontext',contextDetail:'Beobachtete Beziehungen dieser Instandhaltungsarbeit. Es werden keine Verknüpfungen abgeleitet.',responsible:'Verantwortlich',asset:'Anlage',infrastructure:'Infrastruktur',vehicle:'Fahrzeug',reservation:'Reservierung',room:'Zimmer',issue:'Vorfall',incident:'Incident',request:'Hospitality-Anfrage',guest:'Gast',stay:'Aufenthalt',openTask:'Operative Aufgabe öffnen',none:'Nicht verknüpft'},
} as const
const LOCALES={en:'en-US',es:'es-CL',de:'de-DE'} as const

export function MaintenanceObjectView({task,employee,asset,infrastructure,vehicle,reservation,room,issue,incident,hospitalityRequest,partial}:{task:Maintenance;employee:Named|null;asset:Asset|null;infrastructure:Named|null;vehicle:Vehicle|null;reservation:Reservation|null;room:Room|null;issue:Issue|null;incident:Incident|null;hospitalityRequest:HospitalityRequest|null;partial:boolean}){
 const {language}=useLanguage(); const copy=COPY[language]; const date=new Intl.DateTimeFormat(LOCALES[language],{dateStyle:'medium',timeZone:'America/Santiago'}); const formatDate=(value:string|null)=>value?date.format(new Date(value.includes('T')?value:`${value}T12:00:00-04:00`)):copy.notRecorded; const state=task.estado_extendido||task.status||copy.notRecorded
 return <AppLayout><div className="space-y-6 p-4 md:p-6">
  <div className="flex items-center justify-between gap-3"><Link href="/maintenance" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="h-4 w-4"/>{copy.back}</Link><Badge variant="outline">{copy.object}</Badge></div>
  <Card><CardHeader><div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between"><div><CardTitle className="text-2xl">{task.title}</CardTitle><p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">{task.description||copy.noDescription}</p></div><div className="flex flex-wrap gap-2"><Badge>{state}</Badge>{task.bloqueado&&<Badge variant="destructive">{copy.blocked}</Badge>}</div></div></CardHeader><CardContent><div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4"><Info label={copy.state} value={state}/><Info label={copy.priority} value={task.prioridad||copy.notRecorded}/><Info label={copy.target} value={formatDate(task.fecha_objetivo||task.next_run)}/><Info label={copy.completed} value={formatDate(task.fecha_completado||task.last_completed)}/></div></CardContent></Card>
  {partial&&<div className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/5 p-4 text-sm text-muted-foreground"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500"/>{copy.partial}</div>}
  <section className="space-y-3"><div><h2 className="text-lg font-semibold">{copy.context}</h2><p className="text-sm text-muted-foreground">{copy.contextDetail}</p></div><div className="grid gap-4 lg:grid-cols-2">
   <RelationCard icon={UserRound} title={copy.responsible}>{employee?<StaticRelation title={employee.name} detail={employee.status||''}/>:<Empty text={copy.none}/>}</RelationCard>
   <RelationCard icon={PackageSearch} title={copy.asset}>{asset?<ObjectLink href={`/inventory/${asset.id}`} title={asset.name} detail={[asset.asset_code,asset.status].filter(Boolean).join(' · ')}/>:<Empty text={copy.none}/>}</RelationCard>
   <RelationCard icon={Factory} title={copy.infrastructure}>{infrastructure?<StaticRelation title={infrastructure.name} detail={infrastructure.status||''}/>:<Empty text={copy.none}/>}</RelationCard>
   <RelationCard icon={Car} title={copy.vehicle}>{vehicle?<StaticRelation title={vehicle.name} detail={[vehicle.code,vehicle.status].filter(Boolean).join(' · ')}/>:<Empty text={copy.none}/>}</RelationCard>
   <RelationCard icon={CalendarClock} title={copy.reservation}>{reservation?<ObjectLink href={`/bookings/reservations/${reservation.id}`} title={reservation.guest_name||copy.reservation} detail={`${copy.stay}: ${formatDate(reservation.check_in)} → ${formatDate(reservation.check_out)}${reservation.status?` · ${reservation.status}`:''}`}/>:<Empty text={copy.none}/>}</RelationCard>
   <RelationCard icon={BedDouble} title={copy.room}>{room?<ObjectLink href={`/bookings/rooms/${room.id}`} title={room.room_number||copy.room} detail={[room.room_type,room.operational_status||room.status].filter(Boolean).join(' · ')}/>:<Empty text={copy.none}/>}</RelationCard>
   <RelationCard icon={Wrench} title={copy.issue}>{issue?<ObjectLink href={`/issues/${issue.id}`} title={issue.title||copy.issue} detail={[issue.status,issue.severity||issue.priority].filter(Boolean).join(' · ')}/>:<Empty text={copy.none}/>}</RelationCard>
   <RelationCard icon={AlertTriangle} title={copy.incident}>{incident?<StaticRelation title={incident.title||copy.incident} detail={[incident.status,incident.severity||incident.priority].filter(Boolean).join(' · ')}/>:<Empty text={copy.none}/>}</RelationCard>
   <RelationCard icon={ClipboardList} title={copy.request}>{hospitalityRequest?<StaticRelation title={hospitalityRequest.request_type||copy.request} detail={[hospitalityRequest.guest_name,hospitalityRequest.status,hospitalityRequest.priority].filter(Boolean).join(' · ')}/>:<Empty text={copy.none}/>}</RelationCard>
   <RelationCard icon={ClipboardList} title={copy.openTask}><ObjectLink href={`/tasks?selected=${task.id}`} title={task.title} detail={copy.openTask}/></RelationCard>
  </div></section>
 </div></AppLayout>
}
function RelationCard({icon:Icon,title,children}:{icon:typeof Wrench;title:string;children:React.ReactNode}){return <Card><CardHeader className="pb-3"><CardTitle className="flex items-center gap-2 text-base"><Icon className="h-4 w-4"/>{title}</CardTitle></CardHeader><CardContent>{children}</CardContent></Card>}
function ObjectLink({href,title,detail}:{href:string;title:string;detail:string}){return <Link href={href} className="group flex items-start justify-between gap-3 rounded-md border p-3 hover:bg-muted/40"><div className="min-w-0"><p className="font-medium">{title}</p>{detail&&<p className="mt-1 text-xs text-muted-foreground">{detail}</p>}</div><ArrowRight className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5"/></Link>}
function StaticRelation({title,detail}:{title:string;detail:string}){return <div className="rounded-md border p-3"><p className="font-medium">{title}</p>{detail&&<p className="mt-1 text-xs text-muted-foreground">{detail}</p>}</div>}
function Empty({text}:{text:string}){return <p className="text-sm text-muted-foreground">{text}</p>}
function Info({label,value}:{label:string;value:string}){return <div><p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p><p className="mt-1 font-medium">{value}</p></div>}
