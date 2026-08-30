'use client'

import { useEffect, useMemo, useState } from 'react'
import { PageHeader } from '@/components/page-header'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Plus, Wrench } from 'lucide-react'
import { createBrowserClient } from '@/lib/supabase/client'
import { useLanguage } from '@/lib/hooks/use-language'

type Locale = 'en' | 'es' | 'de'

interface Equipment {
  id: string
  equipment_name: string
  equipment_type: string
  purchase_date: string
  last_maintenance_date: string
  next_maintenance_date: string
  condition: string
  storage_location: string
  notes: string
  location_id: string
  created_at: string
  updated_at: string
}

const localeMap: Record<Locale, string> = { en: 'en-US', es: 'es-CL', de: 'de-DE' }
const copy = {
  en: { title: 'Vineyard equipment', description: 'Track equipment, maintenance schedules and operating condition.', add: 'Add equipment', total: 'Total equipment', assets: 'assets tracked', operational: 'Operational', ready: 'ready to use', service: 'Needs service', serviceHelp: 'maintenance required', types: 'Types', categories: 'equipment categories', inventory: 'Equipment inventory', inventoryDescription: 'Registered vineyard equipment and maintenance status.', empty: 'No equipment registered.', name: 'Equipment name', type: 'Type', condition: 'Condition', storage: 'Storage location', last: 'Last maintenance', next: 'Next maintenance', maintenance: 'Maintenance needed', broken: 'Broken', unknown: 'Unknown', loading: 'Loading equipment…' },
  es: { title: 'Equipamiento del viñedo', description: 'Controla equipos, mantenciones y estado operativo.', add: 'Agregar equipo', total: 'Total de equipos', assets: 'equipos registrados', operational: 'Operativos', ready: 'listos para uso', service: 'Requieren servicio', serviceHelp: 'requieren mantención', types: 'Tipos', categories: 'categorías de equipo', inventory: 'Inventario de equipos', inventoryDescription: 'Equipos registrados del viñedo y su estado de mantención.', empty: 'No hay equipos registrados.', name: 'Equipo', type: 'Tipo', condition: 'Estado', storage: 'Ubicación', last: 'Última mantención', next: 'Próxima mantención', maintenance: 'Mantención requerida', broken: 'Fuera de servicio', unknown: 'Desconocido', loading: 'Cargando equipamiento…' },
  de: { title: 'Weinberggeräte', description: 'Geräte, Wartungspläne und Betriebszustand verwalten.', add: 'Gerät hinzufügen', total: 'Geräte gesamt', assets: 'erfasste Geräte', operational: 'Betriebsbereit', ready: 'einsatzbereit', service: 'Wartung fällig', serviceHelp: 'Wartung erforderlich', types: 'Typen', categories: 'Gerätekategorien', inventory: 'Gerätebestand', inventoryDescription: 'Erfasste Weinberggeräte und Wartungsstatus.', empty: 'Keine Geräte erfasst.', name: 'Gerät', type: 'Typ', condition: 'Zustand', storage: 'Lagerort', last: 'Letzte Wartung', next: 'Nächste Wartung', maintenance: 'Wartung erforderlich', broken: 'Defekt', unknown: 'Unbekannt', loading: 'Geräte werden geladen…' },
} as const

export default function VineyardEquipmentPage() {
  const [equipment, setEquipment] = useState<Equipment[]>([])
  const [loading, setLoading] = useState(true)
  const supabase = useMemo(() => createBrowserClient(), [])
  const { language } = useLanguage()
  const lang = language as Locale
  const text = copy[lang]
  const locale = localeMap[lang]
  const date = new Intl.DateTimeFormat(locale, { dateStyle: 'medium' })

  useEffect(() => {
    const fetchEquipment = async () => {
      try {
        setLoading(true)
        const { data, error } = await supabase.from('vineyard_equipment').select('*').order('created_at', { ascending: false })
        if (error) throw error
        setEquipment(data || [])
      } catch (error) {
        console.error('[v0] Error fetching equipment:', error)
      } finally {
        setLoading(false)
      }
    }
    void fetchEquipment()
  }, [supabase])

  const statusColor = (status: string) => status === 'operational' ? 'bg-green-100 text-green-800' : status === 'maintenance_needed' ? 'bg-yellow-100 text-yellow-800' : status === 'broken' ? 'bg-red-100 text-red-800' : 'bg-gray-100 text-gray-800'
  const statusLabel = (status: string) => status === 'operational' ? text.operational : status === 'maintenance_needed' ? text.maintenance : status === 'broken' ? text.broken : text.unknown
  const formatDate = (value: string) => value ? date.format(new Date(value)) : '—'
  const operational = equipment.filter((item) => item.condition === 'operational').length
  const needsMaintenance = equipment.filter((item) => item.condition === 'maintenance_needed').length

  if (loading) return <div className='flex min-h-screen items-center justify-center'><p className='text-muted-foreground'>{text.loading}</p></div>

  return <div className='space-y-6'>
    <PageHeader title={text.title} description={text.description} action={<Button className='gap-2'><Plus className='h-4 w-4' />{text.add}</Button>} />
    <div className='grid grid-cols-1 gap-4 md:grid-cols-4'>
      <Metric title={text.total} value={equipment.length.toLocaleString(locale)} detail={text.assets} />
      <Metric title={text.operational} value={operational.toLocaleString(locale)} detail={text.ready} />
      <Metric title={text.service} value={needsMaintenance.toLocaleString(locale)} detail={text.serviceHelp} />
      <Metric title={text.types} value={new Set(equipment.map((item) => item.equipment_type)).size.toLocaleString(locale)} detail={text.categories} />
    </div>
    <Card><CardHeader><CardTitle>{text.inventory}</CardTitle><CardDescription>{text.inventoryDescription}</CardDescription></CardHeader><CardContent>
      {equipment.length === 0 ? <div className='py-8 text-center'><Wrench className='mx-auto mb-2 h-12 w-12 text-muted-foreground' /><p className='text-muted-foreground'>{text.empty}</p></div> : <div className='overflow-x-auto'><table className='w-full'><thead><tr className='border-b'><th className='px-4 py-3 text-left font-semibold'>{text.name}</th><th className='px-4 py-3 text-left font-semibold'>{text.type}</th><th className='px-4 py-3 text-left font-semibold'>{text.condition}</th><th className='px-4 py-3 text-left font-semibold'>{text.storage}</th><th className='px-4 py-3 text-left font-semibold'>{text.last}</th><th className='px-4 py-3 text-left font-semibold'>{text.next}</th></tr></thead><tbody>{equipment.map((item) => <tr key={item.id} className='border-b hover:bg-muted/50'><td className='px-4 py-3'>{item.equipment_name}</td><td className='px-4 py-3'>{item.equipment_type}</td><td className='px-4 py-3'><span className={`rounded px-2 py-1 text-xs font-medium ${statusColor(item.condition)}`}>{statusLabel(item.condition)}</span></td><td className='px-4 py-3'>{item.storage_location || '—'}</td><td className='px-4 py-3'>{formatDate(item.last_maintenance_date)}</td><td className='px-4 py-3'>{formatDate(item.next_maintenance_date)}</td></tr>)}</tbody></table></div>}
    </CardContent></Card>
  </div>
}

function Metric({ title, value, detail }: { title: string; value: string; detail: string }) { return <Card><CardHeader className='pb-2'><CardTitle className='text-sm font-medium text-muted-foreground'>{title}</CardTitle></CardHeader><CardContent><div className='text-2xl font-bold'>{value}</div><p className='text-xs text-muted-foreground'>{detail}</p></CardContent></Card> }
