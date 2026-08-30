"use client"

import { useCallback, useState } from "react"
import { addDays, format } from "date-fns"
import { DAY_WIDTH, ROW_HEIGHT } from "./timeline-row"
import { ReservationPreview } from "./reservation-preview"
import { useLanguage } from "@/lib/hooks/use-language"

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

const previewLabels = {
  en: "New: Drag to create reservation",
  es: "Nuevo: Arrastra para crear reserva",
  de: "Neu: Ziehen, um Reservierung anzulegen",
} as const

export function CreationSelection({
  bedId,
  dates,
  timelineWidth,
  isActive,
  onCreationStart,
  onCreationAbort,
  onCreationCommit,
}: CreationSelectionProps) {
  const { language } = useLanguage()
  const previewLabel = previewLabels[language]
  const [dragState, setDragState] = useState<{
    startX: number
    startIndex: number
    currentIndex: number
  } | null>(null)

  const toRange = useCallback((startIdx: number, endIdx: number): CreationRange => ({
    bedId,
    startIndex: startIdx,
    endIndex: endIdx,
    startDate: format(dates[startIdx], "yyyy-MM-dd"),
    endDate: format(addDays(dates[endIdx], 1), "yyyy-MM-dd"),
  }), [bedId, dates])

  const handlePointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!isActive || e.button !== 0) return
      e.preventDefault()
      e.stopPropagation()
      const rect = e.currentTarget.getBoundingClientRect()
      const dayIndex = Math.floor((e.clientX - rect.left) / DAY_WIDTH)
      if (dayIndex < 0 || dayIndex >= dates.length) return
      setDragState({ startX: e.clientX, startIndex: dayIndex, currentIndex: dayIndex })
      onCreationStart(toRange(dayIndex, dayIndex))
      e.currentTarget.setPointerCapture(e.pointerId)
    }, [dates.length, isActive, onCreationStart, toRange])

  const handlePointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!dragState) return
      e.preventDefault()
      e.stopPropagation()
      const rect = e.currentTarget.getBoundingClientRect()
      const dayIndex = Math.max(0, Math.min(dates.length - 1, Math.floor((e.clientX - rect.left) / DAY_WIDTH)))
      const [startIdx, endIdx] = dayIndex >= dragState.startIndex ? [dragState.startIndex, dayIndex] : [dayIndex, dragState.startIndex]
      setDragState((prev) => prev ? { ...prev, currentIndex: dayIndex } : null)
      onCreationStart(toRange(startIdx, endIdx))
    }, [dates.length, dragState, onCreationStart, toRange])

  const handlePointerUp = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!dragState) return
      e.preventDefault()
      e.stopPropagation()
      const rect = e.currentTarget.getBoundingClientRect()
      const dayIndex = Math.max(0, Math.min(dates.length - 1, Math.floor((e.clientX - rect.left) / DAY_WIDTH)))
      const [startIdx, endIdx] = dayIndex >= dragState.startIndex ? [dragState.startIndex, dayIndex] : [dayIndex, dragState.startIndex]
      const createdRange = toRange(startIdx, endIdx)
      setDragState(null)
      if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId)
      onCreationCommit(createdRange)
    }, [dates.length, dragState, onCreationCommit, toRange])

  const handlePointerCancel = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!dragState) return
      e.preventDefault()
      e.stopPropagation()
      setDragState(null)
      if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId)
      onCreationAbort()
    }, [dragState, onCreationAbort])

  let previewGeometry: { left: number; width: number } | null = null
  if (dragState) {
    const [startIdx, endIdx] = dragState.currentIndex >= dragState.startIndex
      ? [dragState.startIndex, dragState.currentIndex]
      : [dragState.currentIndex, dragState.startIndex]
    previewGeometry = { left: startIdx * DAY_WIDTH, width: (endIdx - startIdx + 1) * DAY_WIDTH }
  }

  return (
    <>
      <div className="absolute inset-0 cursor-crosshair" style={{ left: 0, top: 0, width: timelineWidth, height: ROW_HEIGHT }} onPointerDown={handlePointerDown} onPointerMove={handlePointerMove} onPointerUp={handlePointerUp} onPointerCancel={handlePointerCancel} />
      {previewGeometry && <ReservationPreview left={previewGeometry.left} width={previewGeometry.width} intent="create" conflict="none" label={previewLabel} />}
    </>
  )
}
