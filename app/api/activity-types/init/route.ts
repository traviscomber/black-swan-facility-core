import { createServerClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

const SECTION_BASED_ACTIVITY_TYPES = [
  // Admin & Operations
  {
    id: 'admin-general',
    name: 'Administración General',
    icon: '⚙️',
    color: '#8B7355',
    description: 'Actividades administrativas y operacionales generales',
  },
  // Hospitality
  {
    id: 'hospitality',
    name: 'Hospedería',
    icon: '🏨',
    color: '#D4A574',
    description: 'Servicios de hospedería y reservas',
  },
  {
    id: 'concierge',
    name: 'Concierge',
    icon: '🎩',
    color: '#CD853F',
    description: 'Servicios de concierge y atención al huésped',
  },
  // Landscaping & Farming
  {
    id: 'orchard',
    name: 'Huerto',
    icon: '🌳',
    color: '#6B8E23',
    description: 'Actividades de mantenimiento del huerto',
  },
  {
    id: 'vineyard',
    name: 'Viñedo',
    icon: '🍇',
    color: '#722F37',
    description: 'Actividades de mantenimiento del viñedo',
  },
  {
    id: 'cattle',
    name: 'Ganadería',
    icon: '🐄',
    color: '#8B4513',
    description: 'Actividades de crianza de ganado',
  },
  // Infrastructure & Facilities
  {
    id: 'maintenance',
    name: 'Mantenimiento',
    icon: '🔧',
    color: '#696969',
    description: 'Tareas de mantenimiento e infraestructura',
  },
  {
    id: 'property-management',
    name: 'Gestión de Propiedad',
    icon: '🏛️',
    color: '#A9A9A9',
    description: 'Actividades de gestión de propiedad',
  },
  {
    id: 'inventory',
    name: 'Inventario',
    icon: '📦',
    color: '#4682B4',
    description: 'Gestión de inventario y activos',
  },
  {
    id: 'procurement',
    name: 'Compras',
    icon: '🛒',
    color: '#20B2AA',
    description: 'Procesos de adquisición y compras',
  },
  {
    id: 'energy',
    name: 'Energía',
    icon: '⚡',
    color: '#FFD700',
    description: 'Gestión de energía y combustibles',
  },
  // People Operations
  {
    id: 'people-ops',
    name: 'Personal',
    icon: '👥',
    color: '#DC143C',
    description: 'Actividades de personal y operaciones',
  },
]

export async function POST(request: Request) {
  try {
    const supabase = await createServerClient()

    // Get current activity types
    const { data: existingTypes } = await supabase.from('activity_types').select('*')

    // Check if we already have the section-based types
    const hasNewTypes = existingTypes?.some((type) =>
      SECTION_BASED_ACTIVITY_TYPES.some((newType) => newType.id === type.id)
    )

    if (hasNewTypes) {
      console.log('[v0] Activity types already using section-based system')
      return NextResponse.json({
        message: 'Activity types already initialized with section-based system',
        inserted: 0,
        total: SECTION_BASED_ACTIVITY_TYPES.length,
      })
    }

    // Delete old activity types if they exist
    if (existingTypes && existingTypes.length > 0) {
      console.log('[v0] Removing old activity types...')
      const { error: deleteError } = await supabase
        .from('activity_types')
        .delete()
        .neq('id', '')

      if (deleteError) {
        console.warn('[v0] Warning deleting old types:', deleteError.message)
        // Continue anyway
      }
    }

    // Insert section-based activity types
    const { error: insertError, data } = await supabase
      .from('activity_types')
      .insert(SECTION_BASED_ACTIVITY_TYPES)
      .select()

    if (insertError) {
      console.error('[v0] Error inserting activity types:', insertError)
      return NextResponse.json({ error: insertError.message }, { status: 400 })
    }

    console.log('[v0] Activity types initialized:', data?.length)
    return NextResponse.json({
      message: `${data?.length || 0} activity types initialized`,
      inserted: data?.length || 0,
      total: SECTION_BASED_ACTIVITY_TYPES.length,
    })
  } catch (error) {
    console.error('[v0] Init activity types error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

export async function GET() {
  try {
    const supabase = await createServerClient()
    const { data } = await supabase.from('activity_types').select('*')

    return NextResponse.json({
      types: data,
      total: data?.length || 0,
    })
  } catch (error) {
    console.error('[v0] Get activity types error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
