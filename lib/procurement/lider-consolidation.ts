export type LiderConsolidationCadence = "daily" | "weekly"

export function liderConsolidationCadence(date = new Date()): LiderConsolidationCadence {
  const month = date.getMonth() + 1
  return month >= 11 || month <= 2 ? "daily" : "weekly"
}

export function liderConsolidationLabel(date = new Date()) {
  return liderConsolidationCadence(date) === "daily"
    ? "Diaria · temporada alta (nov–feb)"
    : "Semanal · temporada baja (mar–oct)"
}

export function nextLiderConsolidationDate(from = new Date()) {
  const next = new Date(from)
  const days = liderConsolidationCadence(from) === "daily" ? 1 : 7
  next.setDate(next.getDate() + days)
  return next
}
