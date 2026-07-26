"use client"

import { useCallback, useState } from "react"
import { addDays, format } from "date-fns"
import { DAY_WIDTH, LABEL_WIDTH, ROW_HEIGHT } from "./timeline-row"
import { ReservationPreview } from "./reservation-preview"

export interface CreationRange {
  bedId: string
  startIndex: number
  endIndex: number
  startDate: string
  endDate: string
}

export interface CreationSelectionProps {
  bedId: string
  dates: Date[]
  timelineWidth: number
  isActive: boolean
  onCreationStart: (range: CreationRange) => void
  onCreationAbort: () => void
  onCreationCommit: (range: CreationRange) => void
}

/**
 * CreationSelection
 * Renders an overlay on a timeline row that detects horizontal drag to create a new reservation.
 * Shows a ghost pastilla while dragging, commits on pointer up.
 */
export function CreationSelection({
  bedId,
  dates,
  timelineWidth,
  isActive,
  onCreationStart,
  onCreationAbort,
  onCreationCommit,
}: CreationSelectionProps) {
  const [dragState, setDragState] = useState<{
    startX: number
    startIndex: number
    currentIndex: number
  } | null>(null)

  const handlePointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!isActive || e.button !== 0) return
      e.preventDefault()
      e.stopPropagation()

      // Calculate which day index the pointer started on
      const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect()
      const relativeX = e.clientX - rect.left
      const dayIndex = Math.floor(relativeX / DAY_WIDTH)

      if (dayIndex < 0 || dayIndex >= dates.length) return

      setDragState({
        startX: e.clientX,
        startIndex: dayIndex,
        currentIndex: dayIndex,
      })

      onCreationStart({
        bedId,
        startIndex: dayIndex,
        endIndex: dayIndex,
        startDate: format(dates[dayIndex], "yyyy-MM-dd"),
        endDate: format(addDays(dates[dayIndex], 1), "yyyy-MM-dd"),
      })

      // Attach pointer capture to this element
      ;(e.currentTarget as HTMLDivElement).setPointerCapture(e.pointerId)
    },
    [bedId, dates, isActive, onCreationStart],
  )

  const handlePointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!dragState) return
      e.preventDefault()
      e.stopPropagation()

      const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect()
      const relativeX = e.clientX - rect.left
      const dayIndex = Math.max(
        0,
        Math.min(dates.length - 1, Math.floor(relativeX / DAY_WIDTH)),
      )

      // Update range: ensure startIndex <= endIndex
      const [startIdx, endIdx] =
        dayIndex >= dragState.startIndex
          ? [dragState.startIndex, dayIndex]
          : [dayIndex, dragState.startIndex]

      setDragState((prev) =>
        prev ? { ...prev, currentIndex: dayIndex } : null,
      )

      onCreationStart({
        bedId,
        startIndex: startIdx,
        endIndex: endIdx,
        startDate: format(dates[startIdx], "yyyy-MM-dd"),
        endDate: format(addDays(dates[endIdx + 1], 1), "yyyy-MM-dd"),
      })
    },
    [bedId, dates, dragState, onCreationStart],
  )

  const handlePointerUp = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!dragState) return
      e.preventDefault()
      e.stopPropagation()

      const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect()
      const relativeX = e.clientX - rect.left
      const dayIndex = Math.max(
        0,
        Math.min(dates.length - 1, Math.floor(relativeX / DAY_WIDTH)),
      )

      const [startIdx, endIdx] =
        dayIndex >= dragState.startIndex
          ? [dragState.startIndex, dayIndex]
          : [dayIndex, dragState.startIndex]

      const createdRange: CreationRange = {
        bedId,
        startIndex: startIdx,
        endIndex: endIdx,
        startDate: format(dates[startIdx], "yyyy-MM-dd"),
        endDate: format(addDays(dates[endIdx + 1], 1), "yyyy-MM-dd"),
      }

      setDragState(null)
      ;(e.currentTarget as HTMLDivElement).releasePointerCapture(e.pointerId)
      onCreationCommit(createdRange)
    },
    [bedId, dates, dragState, onCreationCommit],
  )

  const handlePointerCancel = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!dragState) return
      e.preventDefault()
      e.stopPropagation()
      setDragState(null)
      ;(e.currentTarget as HTMLDivElement).releasePointerCapture(e.pointerId)
      onCreationAbort()
    },
    [dragState, onCreationAbort],
  )

  // Calculate preview geometry if dragging
  let previewGeometry: { left: number; width: number } | null = null
  if (dragState) {
    const [startIdx, endIdx] =
      dragState.currentIndex >= dragState.startIndex
        ? [dragState.startIndex, dragState.currentIndex]
        : [dragState.currentIndex, dragState.startIndex]

    previewGeometry = {
      left: startIdx * DAY_WIDTH,
      width: (endIdx - startIdx + 1) * DAY_WIDTH,
    }
  }

  return (
    <>
      {/* Invisible overlay that covers the entire timeline cell for the row */}
      <div
        className="absolute inset-0 cursor-crosshair"
        style={{
          left: 0,
          top: 0,
          width: timelineWidth,
          height: ROW_HEIGHT,
        }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerCancel}
      />

      {/* Ghost pastilla during creation drag */}
      {previewGeometry && (
        <ReservationPreview
          left={previewGeometry.left}
          width={previewGeometry.width}
          intent="create"
          conflict="none"
          label={`Nuevo: Arrastra para crear`}
        />
      )}
    </>
  )
}
