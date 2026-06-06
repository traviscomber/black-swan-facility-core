'use client'

import { useState, useEffect } from 'react'
import { PageHeader } from '@/components/page-header'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { createBrowserClient } from '@/lib/supabase/client'
import { useLanguage } from '@/lib/hooks/use-language'

interface AnalyticsData {
  harvest_records: any[]
  equipment: any[]
  amendments: any[]
}

export default function VineyardAnalyticsPage() {
  const [data, setData] = useState<AnalyticsData>({ harvest_records: [], equipment: [], amendments: [] })
  const [loading, setLoading] = useState(true)
  const supabase = createBrowserClient()
  const { t } = useLanguage()

  useEffect(() => {
    fetchAnalytics()
  }, [])

  const fetchAnalytics = async () => {
    try {
      setLoading(true)
      const [harvests, equipment, amendments] = await Promise.all([
        supabase.from('vineyard_harvest_records').select('*'),
        supabase.from('vineyard_equipment').select('*'),
        supabase.from('vineyard_soil_amendments').select('*'),
      ])

      setData({
        harvest_records: harvests.data || [],
        equipment: equipment.data || [],
        amendments: amendments.data || [],
      })
    } catch (error) {
      console.error('[v0] Error fetching analytics:', error)
    } finally {
      setLoading(false)
    }
  }

  const harvestTrend = data.harvest_records.length > 0 ? data.harvest_records.map(h => ({
    date: h.harvest_date,
    quantity: h.quantity_kg,
    brix: h.brix_level,
  })).slice(-12) : []

  const totalYield = data.harvest_records.reduce((sum, h) => sum + (h.quantity_kg || 0), 0)
  const avgQuality = data.harvest_records.length > 0 
    ? (data.harvest_records.reduce((sum, h) => sum + (h.brix_level || 0), 0) / data.harvest_records.length).toFixed(1)
    : 0
  const premiumHarvests = data.harvest_records.filter(h => h.quality_rating === 'premium').length

  return (
    <div className='space-y-6'>
      <PageHeader
        title='Vineyard Analytics'
        description='Production metrics, quality analysis, and performance trends'
      />

      <div className='grid grid-cols-1 md:grid-cols-4 gap-4'>
        <Card>
          <CardHeader className='pb-2'>
            <CardTitle className='text-sm font-medium text-muted-foreground'>Total Yield</CardTitle>
          </CardHeader>
          <CardContent>
            <div className='text-2xl font-bold'>{totalYield.toFixed(1)}</div>
            <p className='text-xs text-muted-foreground'>kg harvested</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className='pb-2'>
            <CardTitle className='text-sm font-medium text-muted-foreground'>Avg Sugar Level</CardTitle>
          </CardHeader>
          <CardContent>
            <div className='text-2xl font-bold'>{avgQuality}°</div>
            <p className='text-xs text-muted-foreground'>Brix average</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className='pb-2'>
            <CardTitle className='text-sm font-medium text-muted-foreground'>Premium Grade</CardTitle>
          </CardHeader>
          <CardContent>
            <div className='text-2xl font-bold'>{premiumHarvests}</div>
            <p className='text-xs text-muted-foreground'>Harvests</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className='pb-2'>
            <CardTitle className='text-sm font-medium text-muted-foreground'>Equipment Health</CardTitle>
          </CardHeader>
          <CardContent>
            <div className='text-2xl font-bold'>
              {data.equipment.length > 0 
                ? Math.round((data.equipment.filter(e => e.status === 'operational').length / data.equipment.length) * 100)
                : 0}%
            </div>
            <p className='text-xs text-muted-foreground'>Operational</p>
          </CardContent>
        </Card>
      </div>

      <div className='grid grid-cols-1 lg:grid-cols-2 gap-6'>
        <Card>
          <CardHeader>
            <CardTitle>Harvest Trend</CardTitle>
            <CardDescription>Quantity and quality over time</CardDescription>
          </CardHeader>
          <CardContent>
            {harvestTrend.length > 0 ? (
              <ResponsiveContainer width='100%' height={300}>
                <LineChart data={harvestTrend}>
                  <CartesianGrid strokeDasharray='3 3' />
                  <XAxis dataKey='date' />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Line type='monotone' dataKey='quantity' stroke='#8b5cf6' name='Quantity (kg)' />
                  <Line type='monotone' dataKey='brix' stroke='#ec4899' name='Sugar Level' />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className='h-80 flex items-center justify-center text-muted-foreground'>
                No harvest data available
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Equipment Status</CardTitle>
            <CardDescription>Operational vs maintenance needed</CardDescription>
          </CardHeader>
          <CardContent>
            {data.equipment.length > 0 ? (
              <ResponsiveContainer width='100%' height={300}>
                <BarChart data={[
                  {
                    name: 'Equipment Status',
                    operational: data.equipment.filter(e => e.status === 'operational').length,
                    maintenance: data.equipment.filter(e => e.status === 'maintenance_needed').length,
                    broken: data.equipment.filter(e => e.status === 'broken').length,
                  }
                ]}>
                  <CartesianGrid strokeDasharray='3 3' />
                  <XAxis dataKey='name' />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey='operational' fill='#10b981' name='Operational' />
                  <Bar dataKey='maintenance' fill='#f59e0b' name='Maintenance Needed' />
                  <Bar dataKey='broken' fill='#ef4444' name='Broken' />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className='h-80 flex items-center justify-center text-muted-foreground'>
                No equipment data available
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Key Metrics Summary</CardTitle>
          <CardDescription>Overall vineyard performance overview</CardDescription>
        </CardHeader>
        <CardContent>
          <div className='grid grid-cols-1 md:grid-cols-3 gap-4'>
            <div className='p-4 border rounded-lg'>
              <h4 className='font-semibold mb-2'>Production</h4>
              <p className='text-sm text-muted-foreground'>Total harvests: {data.harvest_records.length}</p>
              <p className='text-sm text-muted-foreground'>Average yield: {(totalYield / (data.harvest_records.length || 1)).toFixed(1)} kg</p>
            </div>
            <div className='p-4 border rounded-lg'>
              <h4 className='font-semibold mb-2'>Quality</h4>
              <p className='text-sm text-muted-foreground'>Avg Brix: {avgQuality}°</p>
              <p className='text-sm text-muted-foreground'>Premium harvests: {premiumHarvests}</p>
            </div>
            <div className='p-4 border rounded-lg'>
              <h4 className='font-semibold mb-2'>Maintenance</h4>
              <p className='text-sm text-muted-foreground'>Soil amendments: {data.amendments.length}</p>
              <p className='text-sm text-muted-foreground'>Equipment: {data.equipment.length} items</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
