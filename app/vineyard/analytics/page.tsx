'use client'

import { useEffect, useMemo, useState } from 'react'
import { PageHeader } from '@/components/page-header'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { createBrowserClient } from '@/lib/supabase/client'
import { useLanguage } from '@/lib/hooks/use-language'

type Locale = 'en' | 'es' | 'de'
interface AnalyticsData { harvest_records: any[]; equipment: any[]; amendments: any[] }

const localeMap: Record<Locale, string> = { en: 'en-US', es: 'es-CL', de: 'de-DE' }
const copy = {
  en: { title:'Vineyard analytics', description:'Production metrics, quality analysis and performance trends.', totalYield:'Total yield', kgHarvested:'kg harvested', avgSugar:'Average sugar level', brixAverage:'Brix average', premiumGrade:'Premium grade', harvests:'harvests', equipmentHealth:'Equipment health', operational:'Operational', harvestTrend:'Harvest trend', trendDescription:'Quantity and quality over time.', quantity:'Quantity (kg)', sugar:'Sugar level', noHarvest:'No harvest data available.', equipmentStatus:'Equipment status', equipmentDescription:'Operational equipment versus maintenance requirements.', maintenanceNeeded:'Maintenance needed', broken:'Broken', noEquipment:'No equipment data available.', summary:'Key metrics summary', summaryDescription:'Overall vineyard performance overview.', production:'Production', totalHarvests:'Total harvests', averageYield:'Average yield', quality:'Quality', avgBrix:'Average Brix', premiumHarvests:'Premium harvests', maintenance:'Maintenance', soilAmendments:'Soil amendments', equipment:'Equipment', items:'items', loading:'Loading vineyard analytics…' },
  es: { title:'Analítica del viñedo', description:'Métricas de producción, calidad y tendencias de desempeño.', totalYield:'Rendimiento total', kgHarvested:'kg cosechados', avgSugar:'Nivel promedio de azúcar', brixAverage:'promedio Brix', premiumGrade:'Calidad premium', harvests:'cosechas', equipmentHealth:'Estado de equipos', operational:'Operativo', harvestTrend:'Tendencia de cosecha', trendDescription:'Cantidad y calidad a lo largo del tiempo.', quantity:'Cantidad (kg)', sugar:'Nivel de azúcar', noHarvest:'No hay datos de cosecha disponibles.', equipmentStatus:'Estado de equipos', equipmentDescription:'Equipos operativos frente a requerimientos de mantenimiento.', maintenanceNeeded:'Requiere mantenimiento', broken:'Fuera de servicio', noEquipment:'No hay datos de equipos disponibles.', summary:'Resumen de indicadores', summaryDescription:'Visión general del desempeño del viñedo.', production:'Producción', totalHarvests:'Cosechas totales', averageYield:'Rendimiento promedio', quality:'Calidad', avgBrix:'Brix promedio', premiumHarvests:'Cosechas premium', maintenance:'Mantenimiento', soilAmendments:'Enmiendas de suelo', equipment:'Equipos', items:'elementos', loading:'Cargando analítica del viñedo…' },
  de: { title:'Weinberganalyse', description:'Produktionskennzahlen, Qualitätsanalyse und Leistungstrends.', totalYield:'Gesamtertrag', kgHarvested:'kg geerntet', avgSugar:'Durchschnittlicher Zuckergehalt', brixAverage:'Brix-Durchschnitt', premiumGrade:'Premiumqualität', harvests:'Ernten', equipmentHealth:'Gerätezustand', operational:'Betriebsbereit', harvestTrend:'Erntetrend', trendDescription:'Menge und Qualität im Zeitverlauf.', quantity:'Menge (kg)', sugar:'Zuckergehalt', noHarvest:'Keine Erntedaten verfügbar.', equipmentStatus:'Gerätestatus', equipmentDescription:'Betriebsbereite Geräte im Vergleich zum Wartungsbedarf.', maintenanceNeeded:'Wartung erforderlich', broken:'Defekt', noEquipment:'Keine Gerätedaten verfügbar.', summary:'Kennzahlenübersicht', summaryDescription:'Gesamtüberblick über die Leistung des Weinbergs.', production:'Produktion', totalHarvests:'Ernten insgesamt', averageYield:'Durchschnittlicher Ertrag', quality:'Qualität', avgBrix:'Brix-Durchschnitt', premiumHarvests:'Premium-Ernten', maintenance:'Wartung', soilAmendments:'Bodenverbesserungen', equipment:'Geräte', items:'Elemente', loading:'Weinberganalyse wird geladen…' },
} as const

export default function VineyardAnalyticsPage() {
  const [data, setData] = useState<AnalyticsData>({ harvest_records: [], equipment: [], amendments: [] })
  const [loading, setLoading] = useState(true)
  const supabase = useMemo(() => createBrowserClient(), [])
  const { language } = useLanguage()
  const lang = language as Locale
  const text = copy[lang]
  const locale = localeMap[lang]

  useEffect(() => {
    const fetchAnalytics = async () => {
      try {
        setLoading(true)
        const [harvests, equipment, amendments] = await Promise.all([
          supabase.from('vineyard_harvest_records').select('*'),
          supabase.from('vineyard_equipment').select('*'),
          supabase.from('vineyard_soil_amendments').select('*'),
        ])
        setData({ harvest_records: harvests.data || [], equipment: equipment.data || [], amendments: amendments.data || [] })
      } catch (error) {
        console.error('[v0] Error fetching analytics:', error)
      } finally { setLoading(false) }
    }
    void fetchAnalytics()
  }, [supabase])

  const number = new Intl.NumberFormat(locale, { maximumFractionDigits: 1 })
  const integer = new Intl.NumberFormat(locale, { maximumFractionDigits: 0 })
  const date = new Intl.DateTimeFormat(locale, { month: 'short', day: 'numeric' })
  const harvestTrend = data.harvest_records.slice(-12).map(h => ({ date: h.harvest_date, dateLabel: h.harvest_date ? date.format(new Date(`${h.harvest_date}T12:00:00`)) : '—', quantity: Number(h.quantity_kg || 0), brix: Number(h.brix_level || 0) }))
  const totalYield = data.harvest_records.reduce((sum, h) => sum + Number(h.quantity_kg || 0), 0)
  const avgQuality = data.harvest_records.length ? data.harvest_records.reduce((sum, h) => sum + Number(h.brix_level || 0), 0) / data.harvest_records.length : 0
  const premiumHarvests = data.harvest_records.filter(h => h.quality_rating === 'premium').length
  const equipmentHealth = data.equipment.length ? Math.round((data.equipment.filter(e => e.status === 'operational').length / data.equipment.length) * 100) : 0

  if (loading) return <div className='flex min-h-72 items-center justify-center text-muted-foreground'>{text.loading}</div>

  return <div className='space-y-6'>
    <PageHeader title={text.title} description={text.description} />
    <div className='grid grid-cols-1 gap-4 md:grid-cols-4'>
      <Metric title={text.totalYield} value={number.format(totalYield)} detail={text.kgHarvested} />
      <Metric title={text.avgSugar} value={`${number.format(avgQuality)}°`} detail={text.brixAverage} />
      <Metric title={text.premiumGrade} value={integer.format(premiumHarvests)} detail={text.harvests} />
      <Metric title={text.equipmentHealth} value={`${integer.format(equipmentHealth)}%`} detail={text.operational} />
    </div>
    <div className='grid grid-cols-1 gap-6 lg:grid-cols-2'>
      <Card><CardHeader><CardTitle>{text.harvestTrend}</CardTitle><CardDescription>{text.trendDescription}</CardDescription></CardHeader><CardContent>
        {harvestTrend.length ? <ResponsiveContainer width='100%' height={300}><LineChart data={harvestTrend}><CartesianGrid strokeDasharray='3 3' /><XAxis dataKey='dateLabel' /><YAxis /><Tooltip /><Legend /><Line type='monotone' dataKey='quantity' stroke='#8b5cf6' name={text.quantity} /><Line type='monotone' dataKey='brix' stroke='#ec4899' name={text.sugar} /></LineChart></ResponsiveContainer> : <Empty text={text.noHarvest} />}
      </CardContent></Card>
      <Card><CardHeader><CardTitle>{text.equipmentStatus}</CardTitle><CardDescription>{text.equipmentDescription}</CardDescription></CardHeader><CardContent>
        {data.equipment.length ? <ResponsiveContainer width='100%' height={300}><BarChart data={[{ name:text.equipmentStatus, operational:data.equipment.filter(e=>e.status==='operational').length, maintenance:data.equipment.filter(e=>e.status==='maintenance_needed').length, broken:data.equipment.filter(e=>e.status==='broken').length }]}><CartesianGrid strokeDasharray='3 3' /><XAxis dataKey='name' /><YAxis /><Tooltip /><Legend /><Bar dataKey='operational' fill='#10b981' name={text.operational} /><Bar dataKey='maintenance' fill='#f59e0b' name={text.maintenanceNeeded} /><Bar dataKey='broken' fill='#ef4444' name={text.broken} /></BarChart></ResponsiveContainer> : <Empty text={text.noEquipment} />}
      </CardContent></Card>
    </div>
    <Card><CardHeader><CardTitle>{text.summary}</CardTitle><CardDescription>{text.summaryDescription}</CardDescription></CardHeader><CardContent><div className='grid grid-cols-1 gap-4 md:grid-cols-3'>
      <Summary title={text.production} lines={[`${text.totalHarvests}: ${integer.format(data.harvest_records.length)}`, `${text.averageYield}: ${number.format(totalYield / (data.harvest_records.length || 1))} kg`]} />
      <Summary title={text.quality} lines={[`${text.avgBrix}: ${number.format(avgQuality)}°`, `${text.premiumHarvests}: ${integer.format(premiumHarvests)}`]} />
      <Summary title={text.maintenance} lines={[`${text.soilAmendments}: ${integer.format(data.amendments.length)}`, `${text.equipment}: ${integer.format(data.equipment.length)} ${text.items}`]} />
    </div></CardContent></Card>
  </div>
}

function Metric({ title, value, detail }: { title:string; value:string; detail:string }) { return <Card><CardHeader className='pb-2'><CardTitle className='text-sm font-medium text-muted-foreground'>{title}</CardTitle></CardHeader><CardContent><div className='text-2xl font-bold'>{value}</div><p className='text-xs text-muted-foreground'>{detail}</p></CardContent></Card> }
function Empty({ text }: { text:string }) { return <div className='flex h-80 items-center justify-center text-muted-foreground'>{text}</div> }
function Summary({ title, lines }: { title:string; lines:string[] }) { return <div className='rounded-lg border p-4'><h4 className='mb-2 font-semibold'>{title}</h4>{lines.map(line => <p key={line} className='text-sm text-muted-foreground'>{line}</p>)}</div> }
