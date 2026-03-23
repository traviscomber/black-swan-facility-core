'use client'

import { useState, useEffect } from 'react'
import { PageHeader } from '@/components/page-header'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Plus, Wrench } from 'lucide-react'
import { createBrowserClient } from '@/lib/supabase/client'
import { useLanguage } from '@/lib/hooks/use-language'

interface Equipment {
  id: string
  name: string
  equipment_type: string
  purchase_date: string
  last_maintenance: string
  next_maintenance: string
  status: string
  location: string
  notes: string
}

export default function VineyardEquipmentPage() {
  const [equipment, setEquipment] = useState<Equipment[]>([])
  const [loading, setLoading] = useState(true)
  const supabase = createBrowserClient()
  const { t } = useLanguage()

  useEffect(() => {
    fetchEquipment()
  }, [])

  const fetchEquipment = async () => {
    try {
      setLoading(true)
      const { data, error } = await supabase
        .from('vineyard_equipment')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) throw error
      setEquipment(data || [])
    } catch (error) {
      console.error('[v0] Error fetching equipment:', error)
    } finally {
      setLoading(false)
    }
  }

  const getStatusColor = (status: string) => {
    if (status === 'operational') return 'bg-green-100 text-green-800'
    if (status === 'maintenance_needed') return 'bg-yellow-100 text-yellow-800'
    if (status === 'broken') return 'bg-red-100 text-red-800'
    return 'bg-gray-100 text-gray-800'
  }

  const operational = equipment.filter(e => e.status === 'operational').length
  const needsMaintenance = equipment.filter(e => e.status === 'maintenance_needed').length

  return (
    <div className='space-y-6'>
      <PageHeader
        title='Vineyard Equipment'
        description='Track equipment, maintenance schedules, and status'
        action={
          <Button className='gap-2'>
            <Plus className='w-4 h-4' />
            Add Equipment
          </Button>
        }
      />

      <div className='grid grid-cols-1 md:grid-cols-4 gap-4'>
        <Card>
          <CardHeader className='pb-2'>
            <CardTitle className='text-sm font-medium text-muted-foreground'>Total Equipment</CardTitle>
          </CardHeader>
          <CardContent>
            <div className='text-2xl font-bold'>{equipment.length}</div>
            <p className='text-xs text-muted-foreground'>Assets tracked</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className='pb-2'>
            <CardTitle className='text-sm font-medium text-muted-foreground'>Operational</CardTitle>
          </CardHeader>
          <CardContent>
            <div className='text-2xl font-bold text-green-600'>{operational}</div>
            <p className='text-xs text-muted-foreground'>Ready to use</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className='pb-2'>
            <CardTitle className='text-sm font-medium text-muted-foreground'>Needs Service</CardTitle>
          </CardHeader>
          <CardContent>
            <div className='text-2xl font-bold text-yellow-600'>{needsMaintenance}</div>
            <p className='text-xs text-muted-foreground'>Maintenance needed</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className='pb-2'>
            <CardTitle className='text-sm font-medium text-muted-foreground'>Types</CardTitle>
          </CardHeader>
          <CardContent>
            <div className='text-2xl font-bold'>
              {new Set(equipment.map(e => e.equipment_type)).size}
            </div>
            <p className='text-xs text-muted-foreground'>Equipment categories</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Equipment Inventory</CardTitle>
          <CardDescription>All vineyard equipment and maintenance tracking</CardDescription>
        </CardHeader>
        <CardContent>
          {equipment.length === 0 ? (
            <div className='text-center py-8'>
              <Wrench className='w-12 h-12 mx-auto text-muted-foreground mb-2' />
              <p className='text-muted-foreground'>No equipment registered</p>
            </div>
          ) : (
            <div className='overflow-x-auto'>
              <table className='w-full'>
                <thead>
                  <tr className='border-b'>
                    <th className='text-left py-3 px-4 font-semibold'>Name</th>
                    <th className='text-left py-3 px-4 font-semibold'>Type</th>
                    <th className='text-left py-3 px-4 font-semibold'>Status</th>
                    <th className='text-left py-3 px-4 font-semibold'>Location</th>
                    <th className='text-left py-3 px-4 font-semibold'>Last Service</th>
                    <th className='text-left py-3 px-4 font-semibold'>Next Service</th>
                  </tr>
                </thead>
                <tbody>
                  {equipment.map(item => (
                    <tr key={item.id} className='border-b hover:bg-muted/50'>
                      <td className='py-3 px-4'>{item.name}</td>
                      <td className='py-3 px-4'>{item.equipment_type}</td>
                      <td className='py-3 px-4'>
                        <span className={`px-2 py-1 rounded text-xs font-medium ${getStatusColor(item.status)}`}>
                          {item.status}
                        </span>
                      </td>
                      <td className='py-3 px-4'>{item.location}</td>
                      <td className='py-3 px-4'>{item.last_maintenance || '-'}</td>
                      <td className='py-3 px-4'>{item.next_maintenance || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
