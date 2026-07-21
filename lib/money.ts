export const DEFAULT_CURRENCY = "CLP" as const

export function roundClp(value: number) {
  if (!Number.isFinite(value)) return 0
  return Math.round(value)
}

export function formatClp(value: number | string | null | undefined) {
  const amount = typeof value === "string" ? Number(value) : Number(value ?? 0)

  return new Intl.NumberFormat("es-CL", {
    style: "currency",
    currency: DEFAULT_CURRENCY,
    currencyDisplay: "symbol",
    maximumFractionDigits: 0,
    minimumFractionDigits: 0,
  }).format(roundClp(amount))
}

export function parseClpInput(value: string | number) {
  const amount = typeof value === "number" ? value : Number(value)
  if (!Number.isFinite(amount)) return null
  return roundClp(amount)
}

export function isValidClpAmount(value: number, options: { allowZero?: boolean; max?: number } = {}) {
  if (!Number.isSafeInteger(value)) return false
  if (options.allowZero ? value < 0 : value <= 0) return false
  if (options.max !== undefined && value > options.max) return false
  return true
}
