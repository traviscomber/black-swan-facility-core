'use client'

import { useState, useCallback } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { X } from 'lucide-react'

interface Vehicle {
  id: string
  code: string
  name: string
  vehicle_type: string
}

interface Team {
  id: string
  name: string
}

interface VehicleTeamFilterProps {
  vehicles: Vehicle[]
  teams: Team[]
  selectedVehicles: Set<string>
  selectedTeams: Set<string>
  onVehicleToggle: (vehicleId: string) => void
  onTeamToggle: (teamId: string) => void
  onClearAll: () => void
}

const vehicleTypeLabels: Record<string, string> = {
  truck: 'Camión',
  van: 'Furgoneta',
  car: 'Auto',
  tractor: 'Tractor',
  excavator: 'Excavadora',
  drone: 'Drone',
  other: 'Otro',
}

export function VehicleTeamFilter({
  vehicles,
  teams,
  selectedVehicles,
  selectedTeams,
  onVehicleToggle,
  onTeamToggle,
  onClearAll,
}: VehicleTeamFilterProps) {
  const [isOpen, setIsOpen] = useState(false)

  const hasFilters = selectedVehicles.size > 0 || selectedTeams.size > 0

  const groupedVehicles = vehicles.reduce(
    (acc, vehicle) => {
      if (!acc[vehicle.vehicle_type]) {
        acc[vehicle.vehicle_type] = []
      }
      acc[vehicle.vehicle_type].push(vehicle)
      return acc
    },
    {} as Record<string, Vehicle[]>
  )

  return (
    <div className="space-y-3">
      {/* Filter Button and Active Filters */}
      <div className="flex items-center gap-2 flex-wrap">
        <Button
          variant={isOpen ? 'default' : 'outline'}
          size="sm"
          onClick={() => setIsOpen(!isOpen)}
        >
          Filtrar por Vehículo/Equipo
        </Button>

        {hasFilters && (
          <>
            <div className="flex items-center gap-2 flex-wrap">
              {Array.from(selectedVehicles).map(vehicleId => {
                const vehicle = vehicles.find(v => v.id === vehicleId)
                return (
                  <Badge key={vehicleId} variant="secondary" className="flex items-center gap-1">
                    {vehicle?.name}
                    <button
                      onClick={() => onVehicleToggle(vehicleId)}
                      className="ml-1 hover:text-destructive"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </Badge>
                )
              })}
              {Array.from(selectedTeams).map(teamId => {
                const team = teams.find(t => t.id === teamId)
                return (
                  <Badge key={teamId} variant="secondary" className="flex items-center gap-1">
                    {team?.name}
                    <button
                      onClick={() => onTeamToggle(teamId)}
                      className="ml-1 hover:text-destructive"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </Badge>
                )
              })}
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={onClearAll}
              className="text-muted-foreground"
            >
              Limpiar filtros
            </Button>
          </>
        )}
      </div>

      {/* Filter Panel */}
      {isOpen && (
        <Card className="p-4 space-y-4">
          {/* Teams Section */}
          {teams.length > 0 && (
            <div>
              <h4 className="font-semibold text-sm mb-3">Equipos/Centros de Costo</h4>
              <div className="space-y-2">
                {teams.map(team => (
                  <div key={team.id} className="flex items-center gap-2">
                    <Checkbox
                      id={`team-${team.id}`}
                      checked={selectedTeams.has(team.id)}
                      onCheckedChange={() => onTeamToggle(team.id)}
                    />
                    <label htmlFor={`team-${team.id}`} className="text-sm cursor-pointer">
                      {team.name}
                    </label>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Vehicles by Type */}
          <div>
            <h4 className="font-semibold text-sm mb-3">Vehículos</h4>
            <div className="space-y-4">
              {Object.entries(groupedVehicles).map(([type, typeVehicles]) => (
                <div key={type}>
                  <p className="text-xs text-muted-foreground font-medium mb-2">
                    {vehicleTypeLabels[type] || type}
                  </p>
                  <div className="space-y-2 ml-2">
                    {typeVehicles.map(vehicle => (
                      <div key={vehicle.id} className="flex items-center gap-2">
                        <Checkbox
                          id={`vehicle-${vehicle.id}`}
                          checked={selectedVehicles.has(vehicle.id)}
                          onCheckedChange={() => onVehicleToggle(vehicle.id)}
                        />
                        <label
                          htmlFor={`vehicle-${vehicle.id}`}
                          className="text-sm cursor-pointer"
                        >
                          {vehicle.name}
                          <span className="text-xs text-muted-foreground ml-2">({vehicle.code})</span>
                        </label>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </Card>
      )}
    </div>
  )
}
