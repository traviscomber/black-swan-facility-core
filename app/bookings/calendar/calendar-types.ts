export type CalendarEventType = "reservation" | "block"

export interface CalendarLocation {
  id: string
  name: string
}

export interface CalendarBed {
  id: string
  bed_number: string
  bed_type: string
  room: {
    id: string
    room_number: string
    room_type?: string
    location_id: string
    location_ref?: {
      id: string
      name: string
    }
  }
}

export interface CalendarInventoryEvent {
  event_id: string
  event_type: CalendarEventType
  bed_id: string
  room_id: string
  location_id: string
  starts_on: string
  ends_on: string
  status: string
  label: string
  guest_name: string | null
  block_type: string | null
  source: string | null
  total_amount: number | null
}

export interface CalendarGeometry {
  left: number
  width: number
}

export type CalendarInteractionType = "move" | "resize-start" | "resize-end" | "create"

interface CalendarInteractionBase {
  type: CalendarInteractionType
  pointerId: number
  previewStart: string
  previewEnd: string
}

export interface CalendarMoveInteraction extends CalendarInteractionBase {
  type: "move"
  reservationId: string
  originBedId: string
  targetBedId: string
  originalStart: string
  originalEnd: string
  pointerStartX: number
  pointerStartY: number
  initialScrollLeft: number
  initialScrollTop: number
}

export interface CalendarResizeInteraction extends CalendarInteractionBase {
  type: "resize-start" | "resize-end"
  reservationId: string
  bedId: string
  originalStart: string
  originalEnd: string
  pointerStartX: number
  initialScrollLeft: number
}

export interface CalendarCreateInteraction extends CalendarInteractionBase {
  type: "create"
  bedId: string
  anchorDate: string
  pointerStartX: number
  initialScrollLeft: number
}

export type CalendarInteraction =
  | CalendarMoveInteraction
  | CalendarResizeInteraction
  | CalendarCreateInteraction

export type AvailabilityState = "idle" | "validating" | "available" | "conflict" | "error"

export interface CalendarInteractionPreview {
  interaction: CalendarInteraction
  availability: AvailabilityState
  conflictType: "reservation" | "block" | null
  message: string | null
}
