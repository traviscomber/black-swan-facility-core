import { notFound } from 'next/navigation'
import { MaintenanceObjectView } from '@/components/maintenance-object-view'
import { createClient } from '@/lib/supabase/server'

type PageProps = { params: Promise<{ id: string }> }

type MaintenanceRow = {
  id: string
  title: string
  description: string | null
  status: string | null
  estado_extendido: string | null
  prioridad: string | null
  next_run: string | null
  last_completed: string | null
  fecha_objetivo: string | null
  fecha_completado: string | null
  bloqueado: boolean | null
  assigned_to: string | null
  asset_id: string | null
  infrastructure_id: string | null
  vehicle_id: string | null
  reservation_id: string | null
  room_id: string | null
  issue_id: string | null
  incident_id: string | null
  hospitality_request_id: string | null
}

export default async function MaintenanceObjectPage({ params }: PageProps) {
  const { id } = await params
  const supabase = await createClient()
  const taskResult = await supabase
    .from('maintenance_tasks')
    .select('id,title,description,status,estado_extendido,prioridad,next_run,last_completed,fecha_objetivo,fecha_completado,bloqueado,assigned_to,asset_id,infrastructure_id,vehicle_id,reservation_id,room_id,issue_id,incident_id,hospitality_request_id')
    .eq('id', id)
    .maybeSingle()

  if (taskResult.error || !taskResult.data) notFound()
  const task = taskResult.data as MaintenanceRow

  const [employee, asset, infrastructure, vehicle, reservation, room, issue, incident, hospitalityRequest] = await Promise.all([
    task.assigned_to ? supabase.from('employees').select('id,name').eq('id', task.assigned_to).maybeSingle() : Promise.resolve({ data: null, error: null }),
    task.asset_id ? supabase.from('assets').select('id,name,asset_code,status').eq('id', task.asset_id).maybeSingle() : Promise.resolve({ data: null, error: null }),
    task.infrastructure_id ? supabase.from('infrastructure_plans').select('id,name,status,priority').eq('id', task.infrastructure_id).maybeSingle() : Promise.resolve({ data: null, error: null }),
    task.vehicle_id ? supabase.from('vehicles').select('id,name,code,status').eq('id', task.vehicle_id).maybeSingle() : Promise.resolve({ data: null, error: null }),
    task.reservation_id ? supabase.from('reservations').select('id,guest_name,check_in,check_out,status').eq('id', task.reservation_id).maybeSingle() : Promise.resolve({ data: null, error: null }),
    task.room_id ? supabase.from('rooms').select('id,room_number,room_type,status,operational_status').eq('id', task.room_id).maybeSingle() : Promise.resolve({ data: null, error: null }),
    task.issue_id ? supabase.from('issues').select('id,title,status,priority,severity').eq('id', task.issue_id).maybeSingle() : Promise.resolve({ data: null, error: null }),
    task.incident_id ? supabase.from('incidents').select('id,title,status,priority,severity').eq('id', task.incident_id).maybeSingle() : Promise.resolve({ data: null, error: null }),
    task.hospitality_request_id ? supabase.from('hospitality_requests').select('id,request_type,status,priority,guest_name,reservation_id').eq('id', task.hospitality_request_id).maybeSingle() : Promise.resolve({ data: null, error: null }),
  ])

  const partial = [employee, asset, infrastructure, vehicle, reservation, room, issue, incident, hospitalityRequest].some((result) => Boolean(result.error))

  return <MaintenanceObjectView task={task} employee={employee.data ?? null} asset={asset.data ?? null} infrastructure={infrastructure.data ?? null} vehicle={vehicle.data ?? null} reservation={reservation.data ?? null} room={room.data ?? null} issue={issue.data ?? null} incident={incident.data ?? null} hospitalityRequest={hospitalityRequest.data ?? null} partial={partial} />
}

export const dynamic = 'force-dynamic'
export const revalidate = 0
