/** Keep short views readable while using the calendar's available horizontal space. */
export function calendarDayWidth(viewportWidth: number, rangeDays: number, labelWidth = 168, minimum = 46) {
  if (!Number.isFinite(viewportWidth) || !Number.isInteger(rangeDays) || rangeDays < 1) return minimum
  return Math.max(minimum, Math.floor((viewportWidth - labelWidth - 16) / rangeDays))
}
